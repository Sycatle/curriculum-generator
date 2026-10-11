"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NAF_PRESETS = [
  { code: "62.01Z", label: "Programmation informatique" },
  { code: "62.02A", label: "Conseil en systèmes informatiques" },
  { code: "62.02B", label: "Tierce maintenance, autres conseils" },
  { code: "62.03Z", label: "Gestion d'installations informatiques" },
  { code: "62.09Z", label: "Autres activités informatiques" },
  { code: "63.11Z", label: "Traitement de données / hébergement" },
  { code: "63.12Z", label: "Portails internet" },
  { code: "58.29C", label: "Édition de logiciels applicatifs" },
];

const HEADCOUNT_OPTIONS = [
  { value: "", label: "(toutes tailles)" },
  { value: "11", label: "10-19 salariés" },
  { value: "12", label: "20-49 salariés" },
  { value: "21", label: "50-99 salariés" },
  { value: "22", label: "100-199 salariés" },
  { value: "31", label: "200-249 salariés" },
  { value: "32", label: "250-499 salariés" },
];

/**
 * Code postal — filtre dur de l'API. Pour les grandes villes, un seul code
 * postal couvre un arrondissement ; on choisit le plus représentatif côté
 * tech (CBD/quartier startup). Tu peux saisir un autre code postal libre.
 */
const POSTAL_PRESETS = [
  { code: "", label: "(France entière)" },
  { code: "75008", label: "Paris 8e" },
  { code: "75009", label: "Paris 9e" },
  { code: "75010", label: "Paris 10e" },
  { code: "75011", label: "Paris 11e" },
  { code: "69002", label: "Lyon 2e" },
  { code: "69003", label: "Lyon 3e" },
  { code: "13001", label: "Marseille 1er" },
  { code: "33000", label: "Bordeaux" },
  { code: "44000", label: "Nantes" },
  { code: "31000", label: "Toulouse" },
  { code: "67000", label: "Strasbourg" },
  { code: "92100", label: "Boulogne-Billancourt" },
];

type Mode = "recherche-entreprises" | "apify-gmaps";

const GMAPS_LOCATIONS = [
  "London, UK",
  "Berlin, Germany",
  "Amsterdam, Netherlands",
  "Barcelona, Spain",
  "Dublin, Ireland",
  "Lisbon, Portugal",
  "Stockholm, Sweden",
  "Copenhagen, Denmark",
  "Munich, Germany",
  "Madrid, Spain",
  "New York, NY, USA",
  "San Francisco, CA, USA",
  "Austin, TX, USA",
  "Boston, MA, USA",
  "Toronto, Canada",
];

const GMAPS_KEYWORD_PRESETS = [
  "software company",
  "AI startup",
  "SaaS",
  "fintech",
  "data analytics",
  "developer tools",
];

export function DiscoverForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("recherche-entreprises");

  // recherche-entreprises state
  const [q, setQ] = useState("");
  const [activite, setActivite] = useState("62.01Z");
  const [codePostal, setCodePostal] = useState("75008");
  const [codePostalLibre, setCodePostalLibre] = useState("");
  const [tranche, setTranche] = useState("12");
  const [maxPages, setMaxPages] = useState(4);

  // apify-gmaps state
  const [gmapsLocation, setGmapsLocation] = useState("London, UK");
  const [gmapsLocationLibre, setGmapsLocationLibre] = useState("");
  const [gmapsKeywords, setGmapsKeywords] = useState<string[]>(["software company", "AI startup"]);
  const [gmapsKeywordsLibre, setGmapsKeywordsLibre] = useState("");
  const [gmapsMaxPerSearch, setGmapsMaxPerSearch] = useState(40);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleGmapsKeyword(k: string) {
    setGmapsKeywords((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      let body: { kind: Mode; config: Record<string, unknown> };
      if (mode === "recherche-entreprises") {
        const config: Record<string, unknown> = {
          etatAdministratif: "A",
          perPage: 25,
          maxPages,
        };
        if (q) config.q = q;
        if (activite) config.activitePrincipale = activite;
        const cp = codePostalLibre.trim() || codePostal;
        if (cp) config.codePostal = cp;
        if (tranche) config.trancheEffectifSalarie = tranche;
        body = { kind: "recherche-entreprises", config };
      } else {
        const extraKeywords = gmapsKeywordsLibre
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        const searchStringsArray = [...new Set([...gmapsKeywords, ...extraKeywords])].slice(0, 10);
        if (searchStringsArray.length === 0) {
          setMsg("Sélectionne au moins un mot-clé.");
          setSubmitting(false);
          return;
        }
        const location = gmapsLocationLibre.trim() || gmapsLocation;
        body = {
          kind: "apify-gmaps",
          config: {
            locationQuery: location,
            searchStringsArray,
            maxCrawledPlacesPerSearch: gmapsMaxPerSearch,
          },
        };
      }

      const res = await fetch("/api/companies/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        fetched?: number;
        inserted?: number;
        updated?: number;
      };
      if (!res.ok) {
        setMsg(data.error ?? "Échec");
        return;
      }
      setMsg(`${data.fetched} entreprises (${data.inserted} nouvelles, ${data.updated} màj)`);
      setTimeout(() => router.push("/companies"), 700);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex gap-2 rounded-md border p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("recherche-entreprises")}
          className={`flex-1 rounded px-3 py-1.5 ${
            mode === "recherche-entreprises" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : ""
          }`}
        >
          France (Recherche-Entreprises, gratuit)
        </button>
        <button
          type="button"
          onClick={() => setMode("apify-gmaps")}
          className={`flex-1 rounded px-3 py-1.5 ${
            mode === "apify-gmaps" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : ""
          }`}
        >
          EU/US (Apify Google Maps, payant)
        </button>
      </div>

      {mode === "apify-gmaps" ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Ville (preset)</label>
              <select
                value={gmapsLocation}
                onChange={(e) => setGmapsLocation(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              >
                {GMAPS_LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">… ou ville libre</label>
              <input
                type="text"
                value={gmapsLocationLibre}
                onChange={(e) => setGmapsLocationLibre(e.target.value)}
                placeholder='ex "Tel Aviv, Israel"'
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Mots-clés</label>
            <div className="mb-1 flex flex-wrap gap-1">
              {GMAPS_KEYWORD_PRESETS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleGmapsKeyword(k)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    gmapsKeywords.includes(k) ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : ""
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={gmapsKeywordsLibre}
              onChange={(e) => setGmapsKeywordsLibre(e.target.value)}
              placeholder="mots-clés additionnels (séparés par des virgules)"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Max résultats par mot-clé (~$0.016 / résultat)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={gmapsMaxPerSearch}
              onChange={(e) => setGmapsMaxPerSearch(Number(e.target.value))}
              className="w-32 rounded-md border px-2 py-1.5 text-sm"
            />
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              Coût estimé : ~$
              {((gmapsKeywords.length + gmapsKeywordsLibre.split(",").filter((s) => s.trim()).length) *
                gmapsMaxPerSearch *
                0.016).toFixed(2)}
            </span>
          </div>
          {msg ? <p className="text-sm">{msg}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Recherche…" : "Lancer la découverte"}
          </button>
        </>
      ) : null}

      <div className={mode === "apify-gmaps" ? "hidden" : ""}>
      <div>
        <label className="mb-1 block text-sm font-medium">Activité principale (NAF)</label>
        <select
          value={activite}
          onChange={(e) => setActivite(e.target.value)}
          className="w-full rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">(toutes)</option>
          {NAF_PRESETS.map((n) => (
            <option key={n.code} value={n.code}>
              {n.code} — {n.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Code postal (preset)</label>
          <select
            value={codePostal}
            onChange={(e) => setCodePostal(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            {POSTAL_PRESETS.map((c) => (
              <option key={c.code || "x"} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">… ou code postal libre</label>
          <input
            type="text"
            value={codePostalLibre}
            onChange={(e) => setCodePostalLibre(e.target.value)}
            placeholder="ex 75002, 13008…"
            className="w-full rounded-md border px-2 py-1.5 font-mono text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Effectif</label>
          <select
            value={tranche}
            onChange={(e) => setTranche(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            {HEADCOUNT_OPTIONS.map((h) => (
              <option key={h.value || "x"} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Pages à parcourir (25/page)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Recherche libre (optionnelle)</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ex: intelligence artificielle, fintech…"
          className="w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      {msg ? <p className="text-sm">{msg}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Recherche…" : "Lancer la découverte"}
      </button>
      </div>
    </form>
  );
}
