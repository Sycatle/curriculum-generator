"use client";

import type {
  CvData,
  CvInput,
  Education,
  Experience,
  Language,
  Link as LinkT,
  Project,
  SkillGroup,
  Theme,
} from "@/lib/cv/schema";
import { LIMITS, levelFor } from "@/lib/cv/limits";
import { SortableList } from "./sortable-list";

type Props = {
  value: CvInput;
  onChange: (v: CvInput) => void;
};

export function CvForm({ value, onChange }: Props) {
  function patch<K extends keyof CvInput>(key: K, val: CvInput[K]) {
    onChange({ ...value, [key]: val });
  }
  function patchData<K extends keyof CvData>(key: K, val: CvData[K]) {
    onChange({ ...value, data: { ...value.data, [key]: val } });
  }

  return (
    <div className="space-y-3">
      <SettingsSection value={value} patch={patch} />
      <HeaderSection value={value.data} patchData={patchData} />
      <SummarySection value={value.data} patchData={patchData} />
      <ExperienceSection value={value.data} patchData={patchData} />
      <ProjectsSection value={value.data} patchData={patchData} />
      <SkillsSection value={value.data} patchData={patchData} />
      <LanguagesSection value={value.data} patchData={patchData} />
      <EducationSection value={value.data} patchData={patchData} />
      <CertificationsSection value={value.data} patchData={patchData} />
      <InterestsSection value={value.data} patchData={patchData} />
      <ThemeSection value={value.theme} onChange={(t) => patch("theme", t)} />
    </div>
  );
}

// ---------- shared building blocks ----------

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-md border">
      <summary className="cursor-pointer select-none border-b px-3 py-2 text-sm font-medium">
        {title}
      </summary>
      <div className="space-y-3 p-3">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-[var(--color-muted)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm font-normal text-[var(--color-fg)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm font-normal text-[var(--color-fg)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm font-normal text-[var(--color-fg)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
    />
  );
}

function ArrayActions({
  onAdd,
  addLabel = "Add",
  disabled,
  hint,
}: {
  onAdd: () => void;
  addLabel?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="rounded-md border border-dashed px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        + {addLabel}
      </button>
      {hint && (
        <span className="text-xs text-amber-600 dark:text-amber-400">{hint}</span>
      )}
    </div>
  );
}

function ItemCard({
  title,
  onRemove,
  children,
  dragHandle,
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {dragHandle}
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            {title}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-500 hover:underline"
        >
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

function StringList({
  value,
  onChange,
  placeholder,
  limitKey,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  limitKey?: import("@/lib/cv/limits").LimitKey;
}) {
  const level = limitKey ? levelFor(value.length, limitKey) : "ok";
  const cap = limitKey ? LIMITS[limitKey] : null;
  const hint =
    level === "hard"
      ? `Maximum atteint (${cap!.hard}) — réduis pour préserver la lisibilité.`
      : level === "soft"
        ? `Beaucoup d'éléments (${value.length}) — risque de compression.`
        : undefined;
  return (
    <div className="space-y-1">
      {value.map((item, i) => (
        <div key={i} className="flex gap-1">
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(value.map((v, j) => (i === j ? e.target.value : v)))}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-md border px-2 text-xs text-red-500"
          >
            ×
          </button>
        </div>
      ))}
      <ArrayActions
        onAdd={() => onChange([...value, ""])}
        addLabel="Add"
        disabled={level === "hard"}
        hint={hint}
      />
    </div>
  );
}

// ---------- sections ----------

function SettingsSection({
  value,
  patch,
}: {
  value: CvInput;
  patch: <K extends keyof CvInput>(k: K, v: CvInput[K]) => void;
}) {
  return (
    <Section title="Settings" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Title">
          <Input value={value.title} onChange={(e) => patch("title", e.target.value)} />
        </Field>
        <Field label="Slug">
          <Input
            value={value.slug}
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            onChange={(e) => patch("slug", e.target.value)}
          />
        </Field>
        <Field label="Locale">
          <Select value={value.locale} onChange={(e) => patch("locale", e.target.value as "fr" | "en")}>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </Select>
        </Field>
        <Field label="Visibility">
          <Select
            value={value.isPublic ? "public" : "private"}
            onChange={(e) => patch("isPublic", e.target.value === "public")}
          >
            <option value="private">Private</option>
            <option value="public">Public (shareable URL)</option>
          </Select>
        </Field>
      </div>
    </Section>
  );
}

function HeaderSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  const h = value.header;
  function update<K extends keyof typeof h>(k: K, v: (typeof h)[K]) {
    patchData("header", { ...h, [k]: v });
  }
  return (
    <Section title="Header" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name">
          <Input value={h.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <Field label="Title / Role">
          <Input value={h.title} onChange={(e) => update("title", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={h.email ?? ""} onChange={(e) => update("email", e.target.value || undefined)} />
        </Field>
        <Field label="Phone">
          <Input value={h.phone ?? ""} onChange={(e) => update("phone", e.target.value || undefined)} />
        </Field>
        <Field label="Location">
          <Input value={h.location ?? ""} onChange={(e) => update("location", e.target.value || undefined)} />
        </Field>
      </div>
      <p className="text-xs font-medium text-[var(--color-muted)]">Links</p>
      <div className="space-y-2">
        {h.links.map((link, i) => (
          <ItemCard
            key={i}
            title={`Link #${i + 1}`}
            onRemove={() =>
              update("links", h.links.filter((_, j) => j !== i) as LinkT[])
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Label">
                <Input
                  value={link.label}
                  onChange={(e) =>
                    update(
                      "links",
                      h.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                    )
                  }
                />
              </Field>
              <Field label="URL">
                <Input
                  value={link.href}
                  onChange={(e) =>
                    update(
                      "links",
                      h.links.map((l, j) => (j === i ? { ...l, href: e.target.value } : l)),
                    )
                  }
                />
              </Field>
            </div>
          </ItemCard>
        ))}
        <ArrayActions
          onAdd={() => update("links", [...h.links, { label: "", href: "https://" }])}
          addLabel="Add link"
        />
      </div>
    </Section>
  );
}

function SummarySection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  const text = value.summary ?? "";
  const level = levelFor(text.length, "summaryChars");
  return (
    <Section title="Summary">
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => patchData("summary", e.target.value || undefined)}
        placeholder="2–3 phrases. Pattern : [Rôle] avec [X ans] d'expérience sur [domaine], focus [stack ou impact]. Ex: 'Senior backend engineer with 8 years building distributed payments systems at scale, focused on reliability and developer experience.'"
      />
      <div className="mt-1 flex justify-end text-xs">
        <span
          className={
            level === "hard"
              ? "text-red-500"
              : level === "soft"
                ? "text-amber-600 dark:text-amber-400"
                : "text-[var(--color-muted)]"
          }
        >
          {text.length} / {LIMITS.summaryChars.soft} caractères recommandés
        </span>
      </div>
    </Section>
  );
}

function ExperienceSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  function update(list: Experience[]) {
    patchData("experiences", list);
  }
  return (
    <Section title={`Experience (${value.experiences.length})`}>
      <div className="space-y-2">
        <SortableList
          items={value.experiences}
          onReorder={update}
          renderItem={(exp, i, handle) => (
          <ItemCard
            key={i}
            title={`Experience #${i + 1}`}
            onRemove={() => update(value.experiences.filter((_, j) => j !== i))}
            dragHandle={handle}
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Role">
                <Input
                  value={exp.role}
                  onChange={(e) =>
                    update(
                      value.experiences.map((x, j) =>
                        j === i ? { ...x, role: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Company">
                <Input
                  value={exp.company}
                  onChange={(e) =>
                    update(
                      value.experiences.map((x, j) =>
                        j === i ? { ...x, company: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Start (YYYY-MM)">
                <Input
                  value={exp.startDate}
                  onChange={(e) =>
                    update(
                      value.experiences.map((x, j) =>
                        j === i ? { ...x, startDate: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="End (YYYY-MM, blank = present)">
                <Input
                  value={exp.endDate ?? ""}
                  onChange={(e) =>
                    update(
                      value.experiences.map((x, j) =>
                        j === i ? { ...x, endDate: e.target.value || null } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Location">
                <Input
                  value={exp.location ?? ""}
                  onChange={(e) =>
                    update(
                      value.experiences.map((x, j) =>
                        j === i ? { ...x, location: e.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Summary (optional)">
              <Textarea
                rows={2}
                value={exp.summary ?? ""}
                onChange={(e) =>
                  update(
                    value.experiences.map((x, j) =>
                      j === i ? { ...x, summary: e.target.value || undefined } : x,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Bullets">
              <StringList
                value={exp.bullets}
                placeholder="Verbe d'action + ce qui a été fait + stack + chiffre + scope. Ex: 'Rebuilt auth service in Go, cutting login p95 from 850ms to 120ms across 500K MAU.'"
                limitKey="bulletsPerExperience"
                onChange={(b) =>
                  update(value.experiences.map((x, j) => (j === i ? { ...x, bullets: b } : x)))
                }
              />
            </Field>
            <Field label="Stack">
              <StringList
                value={exp.stack}
                placeholder="React, Postgres…"
                onChange={(s) =>
                  update(value.experiences.map((x, j) => (j === i ? { ...x, stack: s } : x)))
                }
              />
            </Field>
          </ItemCard>
          )}
        />
        <ArrayActions
          onAdd={() =>
            update([
              ...value.experiences,
              {
                role: "",
                company: "",
                startDate: new Date().toISOString().slice(0, 7),
                endDate: null,
                location: undefined,
                summary: undefined,
                bullets: [],
                stack: [],
              },
            ])
          }
          addLabel="Add experience"
          disabled={levelFor(value.experiences.length, "experiences") === "hard"}
          hint={
            levelFor(value.experiences.length, "experiences") === "hard"
              ? `Maximum ${LIMITS.experiences.hard} expériences — supprime les plus anciennes.`
              : levelFor(value.experiences.length, "experiences") === "soft"
                ? `${value.experiences.length} expériences — l'auto-fit risque de tronquer les plus anciennes.`
                : undefined
          }
        />
      </div>
    </Section>
  );
}

function ProjectsSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  function update(list: Project[]) {
    patchData("projects", list);
  }
  return (
    <Section title={`Projects (${value.projects.length})`}>
      <div className="space-y-2">
        <SortableList
          items={value.projects}
          onReorder={update}
          renderItem={(p, i, handle) => (
          <ItemCard
            key={i}
            title={`Project #${i + 1}`}
            onRemove={() => update(value.projects.filter((_, j) => j !== i))}
            dragHandle={handle}
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name">
                <Input
                  value={p.name}
                  onChange={(e) =>
                    update(
                      value.projects.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="URL">
                <Input
                  value={p.url ?? ""}
                  onChange={(e) =>
                    update(
                      value.projects.map((x, j) =>
                        j === i ? { ...x, url: e.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                rows={2}
                value={p.description}
                onChange={(e) =>
                  update(
                    value.projects.map((x, j) =>
                      j === i ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Stack">
              <StringList
                value={p.stack}
                onChange={(s) =>
                  update(value.projects.map((x, j) => (j === i ? { ...x, stack: s } : x)))
                }
              />
            </Field>
          </ItemCard>
          )}
        />
        <ArrayActions
          onAdd={() =>
            update([
              ...value.projects,
              { name: "", description: "", url: undefined, stack: [] },
            ])
          }
          addLabel="Add project"
        />
      </div>
    </Section>
  );
}

function SkillsSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  function update(list: SkillGroup[]) {
    patchData("skills", list);
  }
  return (
    <Section title={`Skills (${value.skills.length})`}>
      <div className="space-y-2">
        <SortableList
          items={value.skills}
          onReorder={update}
          renderItem={(g, i, handle) => (
          <ItemCard
            key={i}
            title={g.category || `Group #${i + 1}`}
            onRemove={() => update(value.skills.filter((_, j) => j !== i))}
            dragHandle={handle}
          >
            <Field label="Category">
              <Input
                value={g.category}
                onChange={(e) =>
                  update(
                    value.skills.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <Field label="Items">
              <StringList
                value={g.items}
                onChange={(items) =>
                  update(value.skills.map((x, j) => (j === i ? { ...x, items } : x)))
                }
              />
            </Field>
          </ItemCard>
          )}
        />
        <ArrayActions
          onAdd={() => update([...value.skills, { category: "", items: [""] }])}
          addLabel="Add skill group"
        />
      </div>
    </Section>
  );
}

function LanguagesSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  function update(list: Language[]) {
    patchData("languages", list);
  }
  return (
    <Section title={`Languages (${value.languages.length})`}>
      <div className="space-y-2">
        <SortableList
          items={value.languages}
          onReorder={update}
          renderItem={(l, i, handle) => (
          <ItemCard
            key={i}
            title={l.name || `Language #${i + 1}`}
            onRemove={() => update(value.languages.filter((_, j) => j !== i))}
            dragHandle={handle}
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name">
                <Input
                  value={l.name}
                  onChange={(e) =>
                    update(
                      value.languages.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Level">
                <Input
                  value={l.level}
                  onChange={(e) =>
                    update(
                      value.languages.map((x, j) =>
                        j === i ? { ...x, level: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
            </div>
          </ItemCard>
          )}
        />
        <ArrayActions
          onAdd={() => update([...value.languages, { name: "", level: "" }])}
          addLabel="Add language"
        />
      </div>
    </Section>
  );
}

function EducationSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  function update(list: Education[]) {
    patchData("education", list);
  }
  return (
    <Section title={`Education (${value.education.length})`}>
      <div className="space-y-2">
        <SortableList
          items={value.education}
          onReorder={update}
          renderItem={(e, i, handle) => (
          <ItemCard
            key={i}
            title={`Education #${i + 1}`}
            onRemove={() => update(value.education.filter((_, j) => j !== i))}
            dragHandle={handle}
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Degree">
                <Input
                  value={e.degree}
                  onChange={(ev) =>
                    update(
                      value.education.map((x, j) =>
                        j === i ? { ...x, degree: ev.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="School">
                <Input
                  value={e.school}
                  onChange={(ev) =>
                    update(
                      value.education.map((x, j) =>
                        j === i ? { ...x, school: ev.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Start (YYYY-MM)">
                <Input
                  value={e.startDate ?? ""}
                  onChange={(ev) =>
                    update(
                      value.education.map((x, j) =>
                        j === i ? { ...x, startDate: ev.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="End (YYYY-MM)">
                <Input
                  value={e.endDate ?? ""}
                  onChange={(ev) =>
                    update(
                      value.education.map((x, j) =>
                        j === i ? { ...x, endDate: ev.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Location">
                <Input
                  value={e.location ?? ""}
                  onChange={(ev) =>
                    update(
                      value.education.map((x, j) =>
                        j === i ? { ...x, location: ev.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Details">
              <Textarea
                rows={2}
                value={e.details ?? ""}
                onChange={(ev) =>
                  update(
                    value.education.map((x, j) =>
                      j === i ? { ...x, details: ev.target.value || undefined } : x,
                    ),
                  )
                }
              />
            </Field>
          </ItemCard>
          )}
        />
        <ArrayActions
          onAdd={() =>
            update([
              ...value.education,
              {
                degree: "",
                school: "",
                startDate: undefined,
                endDate: undefined,
                location: undefined,
                details: undefined,
              },
            ])
          }
          addLabel="Add education"
        />
      </div>
    </Section>
  );
}

function CertificationsSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  function update(list: CvData["certifications"]) {
    patchData("certifications", list);
  }
  return (
    <Section title={`Certifications (${value.certifications.length})`}>
      <div className="space-y-2">
        <SortableList
          items={value.certifications}
          onReorder={update}
          renderItem={(c, i, handle) => (
            <ItemCard
              key={i}
              title={c.name || `Cert. #${i + 1}`}
              onRemove={() => update(value.certifications.filter((_, j) => j !== i))}
              dragHandle={handle}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nom">
                  <Input
                    value={c.name}
                    onChange={(e) =>
                      update(
                        value.certifications.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Délivré par">
                  <Input
                    value={c.issuer}
                    onChange={(e) =>
                      update(
                        value.certifications.map((x, j) =>
                          j === i ? { ...x, issuer: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Date (YYYY-MM)">
                  <Input
                    value={c.date ?? ""}
                    onChange={(e) =>
                      update(
                        value.certifications.map((x, j) =>
                          j === i ? { ...x, date: e.target.value || undefined } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="URL (optionnel)">
                  <Input
                    value={c.url ?? ""}
                    onChange={(e) =>
                      update(
                        value.certifications.map((x, j) =>
                          j === i ? { ...x, url: e.target.value || undefined } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </ItemCard>
          )}
        />
        <ArrayActions
          onAdd={() =>
            update([
              ...value.certifications,
              { name: "", issuer: "", date: undefined, url: undefined },
            ])
          }
          addLabel="Add certification"
        />
      </div>
    </Section>
  );
}

function InterestsSection({
  value,
  patchData,
}: {
  value: CvData;
  patchData: <K extends keyof CvData>(k: K, v: CvData[K]) => void;
}) {
  return (
    <Section title={`Centres d'intérêt (${value.interests.length})`}>
      <StringList
        value={value.interests}
        placeholder="Photographie, lecture…"
        onChange={(v) => patchData("interests", v)}
      />
    </Section>
  );
}

function ThemeSection({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  function patch<K extends keyof Theme>(k: K, v: Theme[K]) {
    onChange({ ...value, [k]: v });
  }
  function patchColors<K extends keyof Theme["colors"]>(k: K, v: string) {
    onChange({ ...value, colors: { ...value.colors, [k]: v } });
  }
  function patchFonts<K extends keyof Theme["fonts"]>(k: K, v: Theme["fonts"][K]) {
    onChange({ ...value, fonts: { ...value.fonts, [k]: v } });
  }
  return (
    <Section title="Theme">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Template">
          <Select
            value={value.template}
            onChange={(e) => patch("template", e.target.value as Theme["template"])}
          >
            <option value="premium">Premium (single column, haut de gamme)</option>
            <option value="ats">ATS (single column, plain text, parser-safe)</option>
            <option value="modern">Modern (2 colonnes, héritage)</option>
          </Select>
        </Field>
        <Field label="PDF pages">
          <Select
            value={value.pageMode}
            onChange={(e) => patch("pageMode", e.target.value as Theme["pageMode"])}
          >
            <option value="single">Single page · auto-fit</option>
            <option value="multi">Multiple pages · keep all content</option>
          </Select>
        </Field>
        <Field label="Primary">
          <Input type="color" value={value.colors.primary} onChange={(e) => patchColors("primary", e.target.value)} />
        </Field>
        <Field label="Accent">
          <Input type="color" value={value.colors.accent} onChange={(e) => patchColors("accent", e.target.value)} />
        </Field>
        <Field label="Text">
          <Input type="color" value={value.colors.text} onChange={(e) => patchColors("text", e.target.value)} />
        </Field>
        <Field label="Muted">
          <Input type="color" value={value.colors.muted} onChange={(e) => patchColors("muted", e.target.value)} />
        </Field>
        <Field label="Heading font">
          <Select value={value.fonts.heading} onChange={(e) => patchFonts("heading", e.target.value as Theme["fonts"]["heading"])}>
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </Select>
        </Field>
        <Field label="Body font">
          <Select value={value.fonts.body} onChange={(e) => patchFonts("body", e.target.value as Theme["fonts"]["body"])}>
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </Select>
        </Field>
        <Field label="Spacing">
          <Select value={value.spacing} onChange={(e) => patch("spacing", e.target.value as Theme["spacing"])}>
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="airy">Airy</option>
          </Select>
        </Field>
        <Field label="Accent style">
          <Select value={value.accentStyle} onChange={(e) => patch("accentStyle", e.target.value as Theme["accentStyle"])}>
            <option value="bar">Bar</option>
            <option value="underline">Underline</option>
            <option value="none">None</option>
          </Select>
        </Field>
      </div>
    </Section>
  );
}
