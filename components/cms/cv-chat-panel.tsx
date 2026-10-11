"use client";

import { useRef, useState } from "react";
import type { CvData } from "@/lib/cv/schema";
import { CvDiffPreview } from "./cv-diff-preview";

type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; summary: string; ok: boolean }[];
};

type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; summary: string; ok: boolean; error?: string }
  | { type: "done"; finalData: CvData; summary: string }
  | { type: "error"; error: string };

type Pending = { proposed: CvData; summary: string } | null;

type Props = {
  cvId: string;
  cvData: CvData;
  onApply: (next: CvData) => void;
  onClose: () => void;
};

export function CvChatPanel({ cvId, cvData, onApply, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setPending(null);
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/cv/${cvId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          cvData,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const assistant: Message = { role: "assistant", content: "", toolCalls: [] };
      setMessages((m) => [...m, assistant]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "text") {
            assistant.content += event.delta;
            setMessages((m) => [...m.slice(0, -1), { ...assistant }]);
          } else if (event.type === "tool_call") {
            assistant.toolCalls!.push({
              name: event.name,
              summary: event.summary,
              ok: event.ok,
            });
            setMessages((m) => [...m.slice(0, -1), { ...assistant }]);
          } else if (event.type === "done") {
            setPending({ proposed: event.finalData, summary: event.summary });
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Chat failed");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function apply() {
    if (!pending) return;
    onApply(pending.proposed);
    setPending(null);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: `✓ Applied: ${pending.summary}` },
    ]);
  }

  function reject() {
    setPending(null);
    setMessages((m) => [...m, { role: "assistant", content: "Changes discarded." }]);
  }

  return (
    <aside className="flex h-full w-full max-w-md flex-col border-l bg-[var(--color-bg)]">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">AI Assistant</span>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs hover:bg-[var(--color-border)]/30"
        >
          Close
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2 text-xs text-[var(--color-muted)]">
            <p>Try:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Reformule la 1ère bullet de mon poste actuel en plus quantitatif</li>
              <li>Ajoute Docker dans mes skills</li>
              <li>Réécris mon résumé pour un poste de Tech Lead</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-md p-2 ${
              m.role === "user"
                ? "bg-[var(--color-accent)]/10 ml-6"
                : "bg-[var(--color-border)]/30 mr-6"
            }`}
          >
            {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
            {m.toolCalls && m.toolCalls.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {m.toolCalls.map((tc, j) => (
                  <li
                    key={j}
                    className={tc.ok ? "text-[var(--color-muted)]" : "text-red-500"}
                  >
                    {tc.ok ? "✓" : "✗"} {tc.summary}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {pending && (
          <div className="rounded-md border-2 border-[var(--color-accent)] p-3">
            <p className="text-sm font-medium">{pending.summary}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Review the changes:</p>
            <div className="mt-2 max-h-64 overflow-y-auto">
              <CvDiffPreview before={cvData} after={pending.proposed} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={apply}
                className="rounded-md bg-[var(--color-fg)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg)] hover:opacity-90"
              >
                Apply
              </button>
              <button
                onClick={reject}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-border)]/30"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
        {busy && !pending && (
          <p className="text-xs text-[var(--color-muted)]">Thinking…</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t p-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Ask the assistant…"
            className="flex-1 resize-none rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-[var(--color-fg)] px-3 py-1.5 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
