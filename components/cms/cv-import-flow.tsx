"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CvData } from "@/lib/cv/schema";
import { createImportedCvAction } from "@/app/(dashboard)/cvs/actions";

type Step = "upload" | "extracting" | "review";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export function CvImportFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [data, setData] = useState<CvData | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setStep("extracting");
    const form = new FormData();
    form.set("file", file);
    form.set("locale", locale);
    try {
      const res = await fetch("/api/cv/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction failed");
      setData(json.data as CvData);
      const name = (json.data as CvData).header?.name ?? "";
      const role = (json.data as CvData).header?.title ?? "";
      setTitle(`${name} — ${role}`.trim().replace(/^—\s*/, "") || "Imported CV");
      setSlug(slugify(`${name}-${role}`) || "imported-cv");
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStep("upload");
    }
  }

  async function handleCreate() {
    if (!data) return;
    setSaving(true);
    setError(null);
    const result = await createImportedCvAction({ title, slug, locale, data });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/cvs/${result.id}/edit`);
  }

  if (step === "upload" || step === "extracting") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold">Import a CV</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Drop a PDF or image of an existing résumé. The AI will extract the
          content into a new editable CV.
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Output language</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "fr" | "en")}
            disabled={step === "extracting"}
            className="rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        <Dropzone
          disabled={step === "extracting"}
          onFile={handleFile}
        />

        {step === "extracting" && (
          <p className="text-sm text-[var(--color-muted)]">
            Extracting… this typically takes 5–15 seconds.
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Review imported CV</h1>
      <p className="text-sm text-[var(--color-muted)]">
        Give it a title and slug. You can edit every field after creation.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {data && <ExtractedSummary data={data} />}

      <div className="flex items-center gap-2">
        <button
          onClick={handleCreate}
          disabled={saving || !title || !slug}
          className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create CV"}
        </button>
        <button
          type="button"
          onClick={() => {
            setData(null);
            setStep("upload");
          }}
          className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-border)]/30"
        >
          Start over
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

function Dropzone({
  disabled,
  onFile,
}: {
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={`flex h-40 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-sm transition ${
        over ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="text-[var(--color-muted)]">
        Drop a PDF/PNG/JPG/WebP here, or click to browse
      </span>
      <span className="mt-1 text-xs text-[var(--color-muted)]">Max 10 MB</span>
      <input
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function ExtractedSummary({ data }: { data: CvData }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">{data.header.name}</p>
      <p className="text-[var(--color-muted)]">{data.header.title}</p>
      <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-muted)]">
        <li>{data.experiences.length} experience(s)</li>
        <li>{data.projects.length} project(s)</li>
        <li>{data.education.length} education entry/ies</li>
        <li>{data.skills.reduce((n, s) => n + s.items.length, 0)} skill(s)</li>
        <li>{data.languages.length} language(s)</li>
      </ul>
    </div>
  );
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
