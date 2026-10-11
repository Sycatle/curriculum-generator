"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Kind = "greenhouse" | "lever" | "france-travail" | "hn";

const PRESETS: Record<Kind, { label: string; defaults: { id: string; label: string; config: object } }> = {
  greenhouse: {
    label: "Greenhouse (board public)",
    defaults: {
      id: "greenhouse:vercel",
      label: "Vercel",
      config: {
        board: "vercel",
        titleExcludeRegex: "stage|alternance|internship",
        remoteOnly: false,
      },
    },
  },
  lever: {
    label: "Lever (site public)",
    defaults: {
      id: "lever:netflix",
      label: "Netflix",
      config: {
        site: "netflix",
        titleExcludeRegex: "stage|alternance|internship",
      },
    },
  },
  "france-travail": {
    label: "France Travail (OAuth requis)",
    defaults: {
      id: "france-travail:dev-remote",
      label: "Dev remote (FR)",
      config: {
        // ROME codes utiles : M1805 Études/Dév info · M1810 Études/Dév web · M1811 Data
        codeROME: "M1805",
        typeContrat: "CDI",
        teletravail: true,
        publieeDepuis: 7,
        maxResults: 100,
        titleExcludeRegex: "stage|alternance",
      },
    },
  },
  hn: {
    label: "Hacker News — Who's Hiring",
    defaults: {
      id: "hn:tech-remote",
      label: "HN — TS/Python/Go remote",
      config: {
        monthsBack: 3,
        // Pour HN c'est CRITIQUE : on dump tous les commentaires, sans ce filtre
        // on ingère des centaines d'offres non pertinentes.
        requireStackKeywords: ["typescript", "python", "go", "rust"],
        titleIncludeRegex: "remote|anywhere|worldwide",
      },
    },
  },
};

const KIND_HINTS: Record<Kind, string> = {
  greenhouse: "Champs partagés : titleIncludeRegex, titleExcludeRegex, remoteOnly, requireStackKeywords (drop à l'ingestion).",
  lever: "Champs partagés : titleIncludeRegex, titleExcludeRegex, remoteOnly, requireStackKeywords (drop à l'ingestion).",
  "france-travail":
    "ROME : M1805 dev info · M1810 dev web · M1811 data · M1802 conseil. typeContrat=CDI|CDD|MIS|SAI. teletravail=true filtre les offres téletravaillables côté FT.",
  hn: "requireStackKeywords est crucial sinon tous les commentaires Who's-Hiring sont ingérés.",
};

export function NewSourceForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("greenhouse");
  const [id, setId] = useState(PRESETS.greenhouse.defaults.id);
  const [label, setLabel] = useState(PRESETS.greenhouse.defaults.label);
  const [configText, setConfigText] = useState(
    JSON.stringify(PRESETS.greenhouse.defaults.config, null, 2),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(k: Kind) {
    setKind(k);
    setId(PRESETS[k].defaults.id);
    setLabel(PRESETS[k].defaults.label);
    setConfigText(JSON.stringify(PRESETS[k].defaults.config, null, 2));
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setError("Config: JSON invalide");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind, label, config }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Échec");
        return;
      }
      router.push("/jobs");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium">Connecteur</label>
        <select
          value={kind}
          onChange={(e) => applyPreset(e.target.value as Kind)}
          className="w-full rounded-md border px-2 py-1.5 text-sm"
        >
          {(Object.keys(PRESETS) as Kind[]).map((k) => (
            <option key={k} value={k}>
              {PRESETS[k].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">ID (unique)</label>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="w-full rounded-md border px-2 py-1.5 font-mono text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Label affiché</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-md border px-2 py-1.5 text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Config (JSON)</label>
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          rows={10}
          className="w-full rounded-md border px-2 py-1.5 font-mono text-xs"
          required
        />
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{KIND_HINTS[kind]}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Création…" : "Créer la source"}
      </button>
    </form>
  );
}
