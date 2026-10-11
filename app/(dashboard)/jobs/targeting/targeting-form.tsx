"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TargetingProfile } from "@/lib/db/schema";

const SENIORITY_LABELS = ["Intern", "Junior", "Mid", "Senior", "Lead", "Staff"] as const;

type FormState = {
  targetRoles: string[];
  mustHaveSkills: string[];
  niceSkills: string[];
  excludeKeywords: string[];
  targetLocations: string[];
  excludeCompanies: string[];
  remoteRequired: boolean;
  excludeAlternance: boolean;
  seniorityMin: number | null;
  seniorityMax: number | null;
  languages: { fr?: "required" | "nice"; en?: "required" | "nice" };
  employmentTypes: string[];
  salaryMinEUR: number | null;
};

const EMPLOYMENT_OPTIONS = ["CDI", "CDD", "Freelance", "Contract", "Full-time", "Part-time", "Internship"];

function emptyState(): FormState {
  return {
    targetRoles: [],
    mustHaveSkills: [],
    niceSkills: [],
    excludeKeywords: [],
    targetLocations: [],
    excludeCompanies: [],
    remoteRequired: false,
    excludeAlternance: true,
    seniorityMin: null,
    seniorityMax: null,
    languages: {},
    employmentTypes: [],
    salaryMinEUR: null,
  };
}

function fromProfile(p: TargetingProfile | null): FormState {
  if (!p) return emptyState();
  return {
    targetRoles: p.targetRoles ?? [],
    mustHaveSkills: p.mustHaveSkills ?? [],
    niceSkills: p.niceSkills ?? [],
    excludeKeywords: p.excludeKeywords ?? [],
    targetLocations: p.targetLocations ?? [],
    excludeCompanies: p.excludeCompanies ?? [],
    remoteRequired: p.remoteRequired,
    excludeAlternance: p.excludeAlternance ?? true,
    seniorityMin: p.seniorityMin,
    seniorityMax: p.seniorityMax,
    languages: p.languages ?? {},
    employmentTypes: p.employmentTypes ?? [],
    salaryMinEUR: p.salaryMinEUR,
  };
}

export function TargetingForm({
  initial,
  cvs,
}: {
  initial: TargetingProfile | null;
  cvs: { id: string; title: string }[];
}) {
  const [state, setState] = useState<FormState>(() => fromProfile(initial));
  const [rescoreCvId, setRescoreCvId] = useState<string>(cvs[0]?.id ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(initial?.updatedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null);
  const skipNext = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave on state change, debounced 600ms; skip the first render.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/jobs/targeting", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setSavedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [state]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function rescoreAll() {
    if (!rescoreCvId) {
      setRescoreMsg("Choisis un CV.");
      return;
    }
    setRescoreMsg("Rescoring…");
    try {
      const res = await fetch(`/api/jobs/match-all?cvId=${encodeURIComponent(rescoreCvId)}`, {
        method: "POST",
      });
      const data = (await res.json()) as { scored?: number; excluded?: number; total?: number };
      setRescoreMsg(
        `Rescoré : ${data.scored ?? 0} / ${data.total ?? 0} · exclus : ${data.excluded ?? 0}`,
      );
    } catch (e) {
      setRescoreMsg(e instanceof Error ? e.message : "Rescore failed");
    }
  }

  const status = useMemo(() => {
    if (error) return { text: `Erreur : ${error}`, tone: "error" } as const;
    if (saving) return { text: "Enregistrement…", tone: "muted" } as const;
    if (savedAt) return { text: `Enregistré ${savedAt.toLocaleTimeString()}`, tone: "muted" } as const;
    return { text: "Non enregistré", tone: "muted" } as const;
  }, [error, saving, savedAt]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
        <span className={status.tone === "error" ? "text-red-500" : "text-[var(--color-muted)]"}>
          {status.text}
        </span>
        <div className="flex items-center gap-2">
          {rescoreMsg ? <span className="text-[var(--color-muted)]">{rescoreMsg}</span> : null}
          {cvs.length > 0 ? (
            <select
              value={rescoreCvId}
              onChange={(e) => setRescoreCvId(e.target.value)}
              className="rounded-md border px-2 py-1"
              aria-label="CV pour rescore"
            >
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={rescoreAll}
            disabled={!rescoreCvId}
            className="rounded-md border px-2 py-1 hover:bg-[var(--color-border)]/30 disabled:opacity-50"
          >
            Recalculer tous les scores
          </button>
        </div>
      </div>

      <Section title="Rôles ciblés" hint="Le titre du poste doit contenir un de ces mots (5 pts).">
        <ChipsInput
          values={state.targetRoles}
          onChange={(v) => update("targetRoles", v)}
          placeholder="Senior Fullstack, Staff Engineer, Data Engineer…"
        />
      </Section>

      <Section title="Localisations ciblées" hint="Ville ou « Remote EU » / « Remote US » (20 pts).">
        <ChipsInput
          values={state.targetLocations}
          onChange={(v) => update("targetLocations", v)}
          placeholder="Paris, Lyon, London, Remote EU, Remote US…"
        />
      </Section>

      <Section title="Remote">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.remoteRequired}
            onChange={(e) => update("remoteRequired", e.target.checked)}
          />
          Remote obligatoire (sinon offre exclue)
        </label>
      </Section>

      <Section title="Alternance / apprentissage" hint="Exclut les offres flaggées 'alternance' par France Travail.">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.excludeAlternance}
            onChange={(e) => update("excludeAlternance", e.target.checked)}
          />
          Exclure les contrats d&apos;alternance/apprentissage
        </label>
      </Section>

      <Section title="Compétences must-have" hint="Boost le score keywords (40 pts).">
        <ChipsInput
          values={state.mustHaveSkills}
          onChange={(v) => update("mustHaveSkills", v)}
          placeholder="typescript, react, postgres, aws…"
        />
      </Section>

      <Section title="Compétences nice-to-have">
        <ChipsInput
          values={state.niceSkills}
          onChange={(v) => update("niceSkills", v)}
          placeholder="rust, kafka, terraform…"
        />
      </Section>

      <Section title="Mots-clés à exclure" hint="Si présents dans titre/desc → offre rejetée.">
        <ChipsInput
          values={state.excludeKeywords}
          onChange={(v) => update("excludeKeywords", v)}
          placeholder="php, stage, alternance, onsite…"
        />
      </Section>

      <Section title="Entreprises à exclure">
        <ChipsInput
          values={state.excludeCompanies}
          onChange={(v) => update("excludeCompanies", v)}
          placeholder="…"
        />
      </Section>

      <Section title="Séniorité" hint="Hors borne → exclusion si le titre l'indique explicitement.">
        <div className="flex items-center gap-3 text-sm">
          <SeniorityPicker
            label="Min"
            value={state.seniorityMin}
            onChange={(v) => update("seniorityMin", v)}
          />
          <SeniorityPicker
            label="Max"
            value={state.seniorityMax}
            onChange={(v) => update("seniorityMax", v)}
          />
        </div>
      </Section>

      <Section title="Langues">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <LangPicker
            label="Français"
            value={state.languages.fr}
            onChange={(v) => update("languages", { ...state.languages, fr: v })}
          />
          <LangPicker
            label="Anglais"
            value={state.languages.en}
            onChange={(v) => update("languages", { ...state.languages, en: v })}
          />
        </div>
      </Section>

      <Section title="Type de contrat" hint="Vide = tous (5 pts).">
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_OPTIONS.map((opt) => {
            const active = state.employmentTypes.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  update(
                    "employmentTypes",
                    active
                      ? state.employmentTypes.filter((t) => t !== opt)
                      : [...state.employmentTypes, opt],
                  );
                }}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "hover:bg-[var(--color-border)]/30"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Salaire minimum (€/an, optionnel)">
        <input
          type="number"
          value={state.salaryMinEUR ?? ""}
          onChange={(e) =>
            update("salaryMinEUR", e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder="ex. 70000"
          className="w-40 rounded-md border px-2 py-1 text-sm"
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-md border p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChipsInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            aria-label={`Supprimer ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="min-w-[12rem] flex-1 rounded-md border px-2 py-1 text-sm"
      />
    </div>
  );
}

function SeniorityPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="rounded-md border px-2 py-1"
      >
        <option value="">—</option>
        {SENIORITY_LABELS.map((l, i) => (
          <option key={l} value={i}>
            {i} · {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function LangPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "required" | "nice" | undefined;
  onChange: (v: "required" | "nice" | undefined) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : (v as "required" | "nice"));
        }}
        className="rounded-md border px-2 py-1"
      >
        <option value="">indifférent</option>
        <option value="nice">souhaité</option>
        <option value="required">obligatoire</option>
      </select>
    </label>
  );
}
