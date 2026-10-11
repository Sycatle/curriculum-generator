# AI features

Two features built on top of the Anthropic API:

1. **OCR import** — upload an old résumé (PDF or image), get a structured CV draft.
2. **Chat assistant** — in-editor chat with tool-calling to mutate the current CV.

### Editorial stance (both features)

The model is prompted as a senior recruiter / career coach whose goal is to show
the candidate at their **full potential** — confident, senior-grade phrasing,
implicit scope surfaced — **without inventing anything**. Think of it as the CV
the candidate would write if they didn't suffer from imposter syndrome.

Concretely, the prompts enforce a hard line:

- **Allowed**: rephrasing weak verbs ('helped with' → 'contributed to'),
  surfacing scope already mentioned ('team of 6', 'EU traffic'), normalizing
  titles to their conventional senior form, inferring tech stack from the prose.
- **Forbidden**: fabricating numbers, inventing employers / dates /
  certifications / technologies, promoting someone to a role they didn't hold,
  dropping factual content.

If the chat assistant is asked to quantify something and no number exists, it
asks a clarifying question instead of making one up. The prompts are in
`systemPrompt()` in `lib/ai/extract-cv.ts` and `lib/ai/chat-loop.ts`.

Both are gated by `ANTHROPIC_API_KEY`. Without it, the routes return `500` and the
UI entry points (`/cvs/import`, the "Assistant" toolbar button) are non-functional —
the rest of the app keeps working.

## Configuration

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

Models are pinned in [`lib/ai/client.ts`](../lib/ai/client.ts):

| Use case   | Model               | Why                          |
|------------|---------------------|------------------------------|
| OCR        | `claude-opus-4-7`   | Best multimodal extraction   |
| Chat agent | `claude-sonnet-4-6` | Cost/latency for tool loops  |

Change them in one place if needed.

## OCR import

**Entry point**: `/cvs/import` ([`app/(dashboard)/cvs/import/page.tsx`](../app/(dashboard)/cvs/import/page.tsx))

This is **not a literal OCR**. It uses Claude as a recruiter-style interpreter: it
reads the source résumé, understands the candidate's role and seniority, and
produces a *rewritten*, clean, structured CV. It rephrases bullets to be
action-oriented and quantified-when-possible, synthesizes a summary if the source
has none, infers each experience's technical stack from the prose, and groups
skills into coherent categories. The prompt has hard guardrails: never invent
employers / dates / metrics, never drop factual content.

**Flow**:

1. User drops a file in [`components/cms/cv-import-flow.tsx`](../components/cms/cv-import-flow.tsx).
2. `POST /api/cv/import` ([`route`](../app/api/cv/import/route.ts)) receives the
   multipart form, auth-checks the session, validates MIME type and size.
3. [`extractCvFromFile`](../lib/ai/extract-cv.ts) base64-encodes the file, sends it
   to Claude with **forced tool use** (`tool_choice: { type: "tool", name: "submit_cv" }`)
   so the response is always a structured `CvData`-shaped JSON.
4. The tool input is validated against `CvDataSchema`. On Zod failure, one retry is
   issued with the validation error injected back into the prompt.
5. The extracted data is sent back to the client (not yet persisted).
6. The user edits the title/slug, previews the parsed sections, and clicks
   "Create" → `createImportedCvAction` writes a new CV.

**Supported formats**: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`. Max 10 MB.

**Schema coverage**: header (with `photoUrl`), summary, experiences (with inferred
`stack`), projects, education, skills (categorized), languages, certifications,
interests. Mirrors `CvDataSchema`.

**Cost envelope**: ~$0.05–$0.15 per import depending on source length (higher than
a raw extraction because the model is reasoning over the whole document).

**Tuning**: the prompt and guardrails live in `systemPrompt()` inside
`lib/ai/extract-cv.ts` — edit there to change interpretation aggressiveness.

## Chat assistant

**Entry point**: `/cvs/[id]/edit` → the "Assistant" button in the editor toolbar.

**Flow**:

1. [`CvChatPanel`](../components/cms/cv-chat-panel.tsx) sends the user message and
   the current `CvData` snapshot to `POST /api/cv/[id]/chat`
   ([`route`](../app/api/cv/[id]/chat/route.ts)).
2. The route validates auth + CV ownership, then delegates to
   [`runChatStream`](../lib/ai/chat-loop.ts).
3. The loop calls Claude with the full tool catalog
   ([`lib/ai/tools.ts`](../lib/ai/tools.ts)). Each tool is a **pure executor**:
   `(currentCv, input) => { next: CvData, summary: string }`. No DB writes happen
   inside tools — the server keeps a running `CvData` in memory.
4. The loop streams events as **NDJSON** (one JSON object per line):
   - `{ type: "text", delta }` — assistant prose
   - `{ type: "tool_call", name, summary, ok }` — each applied (or rejected) mutation
   - `{ type: "done", finalData, summary }` — final state once `propose_changes` is called
   - `{ type: "error", error }` — fatal error
5. The client renders the streamed events, then shows a **diff preview**
   ([`cv-diff-preview.tsx`](../components/cms/cv-diff-preview.tsx)) of every change.
6. User clicks "Apply" → the parent `CvEditor` merges the patch via its history
   reducer (`dispatch({ type: "edit", ... })`), so AI changes are **undoable**
   like any manual edit, and the existing 1.5 s autosave persists them.

**Tools exposed** (all defined in `lib/ai/tools.ts`):

- `rewrite_bullet`, `rewrite_summary`
- `add_experience`, `update_experience`, `remove_experience`, `reorder_bullets`
- `add_project`, `add_education`, `add_language`
- `add_skill_group`, `add_skill_item`
- `set_header`
- `propose_changes` (terminal signal)

**Safety / cost guardrails** (in `lib/ai/chat-loop.ts`):

- Max **10 tool calls** per user turn (hard stop).
- Conversation history truncated to the last **20 messages**.
- `max_tokens: 2048` per assistant turn.
- The CV state is injected in the **system prompt**, not as a fake message — keeps
  the user/assistant turn structure clean.

**Cost envelope**: ~$0.01–$0.05 per user turn depending on complexity.

## Testing

Pure tool executors are tested without the LLM in
[`tests/unit/ai-tools.test.ts`](../tests/unit/ai-tools.test.ts) — they verify
patches are applied immutably, error cases are rejected, and ordering / dedup
logic works.

The LLM-calling code paths (`extract-cv.ts`, `chat-loop.ts`) are not unit-tested
against the real API; smoke-test them manually after setting `ANTHROPIC_API_KEY`.

## Roadmap

- Per-user AI usage tracking in a `ai_usage` table + rate limit.
- A `tailor_for_job` composite tool: paste a job description, retarget the CV
  in one shot (currently the chat does it via repeated `rewrite_bullet` calls).
- ATS-friendliness scoring as a non-mutating tool.
- Optional "verbatim" mode for the OCR import (keep the source bullets unchanged)
  for users who don't want the LLM to rewrite anything.
