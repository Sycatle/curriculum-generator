"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Loader2,
  Redo2,
  Save,
  Sparkles,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { CvData, CvInput } from "@/lib/cv/schema";
import type { FitReport } from "@/lib/pdf/fit";
import { measureCvAction, saveCvAction } from "@/app/(dashboard)/cvs/actions";
import {
  canRedo,
  canUndo,
  init,
  push,
  redo,
  undo,
  type HistoryState,
} from "@/lib/cv/history";
import { CvForm } from "./cv-form";
import { CvChatPanel } from "./cv-chat-panel";
import { RevisionsPanel } from "./revisions-panel";
import { AtsScorePanel } from "./ats-score-panel";
import { JobMatchPanel } from "./job-match-panel";
import { AtsPreviewPanel } from "./ats-preview-panel";
import { CompletenessChecklist } from "./completeness-checklist";
import { ScanText, Target } from "lucide-react";

const PdfPreview = dynamic(
  () => import("@/components/preview/pdf-preview").then((m) => m.PdfPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
        Loading preview…
      </div>
    ),
  },
);

type Props = {
  id: string;
  initial: CvInput;
  updatedAt: string;
};

type Action =
  | { type: "edit"; value: CvInput }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: CvInput };

function reducer(state: HistoryState<CvInput>, action: Action): HistoryState<CvInput> {
  switch (action.type) {
    case "edit":
      return push(state, action.value);
    case "undo":
      return undo(state);
    case "redo":
      return redo(state);
    case "reset":
      return init(action.value);
  }
}

export function CvEditor({ id, initial, updatedAt: initialUpdatedAt }: Props) {
  const [history, dispatch] = useReducer(reducer, initial, init);
  const value = history.present;

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [fitReport, setFitReport] = useState<FitReport | null>(null);
  const [measuredFit, setMeasuredFit] = useState<FitReport | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const valueRef = useRef(history.present);
  valueRef.current = history.present;
  const applyChatPatch = useCallback((nextData: CvData) => {
    dispatch({ type: "edit", value: { ...valueRef.current, data: nextData } });
  }, []);

  const save = useCallback(
    async (next: CvInput) => {
      setStatus("saving");
      const res = await saveCvAction(id, next);
      if (!res.ok) {
        setStatus("error");
        setError(res.error);
        return;
      }
      setStatus("saved");
      setError(null);
      setUpdatedAt(res.updatedAt);
    },
    [id],
  );

  // Debounced autosave on every change to the present state.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save(value);
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Slightly more aggressive debounce for the heavy PDF preview re-render.
  const [previewValue, setPreviewValue] = useState(initial);
  useEffect(() => {
    const t = setTimeout(() => setPreviewValue(value), 300);
    return () => clearTimeout(t);
  }, [value]);

  // Page-count check measures the natural, unfitted PDF for both export modes.
  const [naturalPages, setNaturalPages] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await measureCvAction(previewValue);
      if (cancelled || !res.ok) return;
      setNaturalPages(res.pages);
      setMeasuredFit(res.fit);
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewValue]);

  // Live (browser) report while the preview is open, server-measured report otherwise.
  const activeFit = previewOpen ? fitReport : measuredFit;

  // Keyboard shortcuts: ⌘S save / ⌘Z undo / ⌘⇧Z redo / ⌘P toggle preview.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        void save(value);
      } else if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (k === "p") {
        e.preventDefault();
        setPreviewOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, value]);

  const onChange = useCallback((next: CvInput) => {
    dispatch({ type: "edit", value: next });
  }, []);

  const statusMeta = useMemo(() => {
    if (status === "saving")
      return { icon: Loader2, label: "Sauvegarde…", className: "text-[var(--color-muted)]", spin: true };
    if (status === "error")
      return { icon: TriangleAlert, label: error ?? "Échec", className: "text-red-500", spin: false };
    if (status === "saved")
      return {
        icon: CheckCircle2,
        label: `Sauvegardé · ${new Date(updatedAt).toLocaleTimeString()}`,
        className: "text-emerald-600",
        spin: false,
      };
    return {
      icon: Circle,
      label: `Dernière sauvegarde · ${new Date(updatedAt).toLocaleTimeString()}`,
      className: "text-[var(--color-muted)]",
      spin: false,
    };
  }, [status, updatedAt, error]);

  const StatusIcon = statusMeta.icon;
  const undoable = canUndo(history);
  const redoable = canRedo(history);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3">
      <Toolbar
        title={value.title}
        statusIcon={<StatusIcon className={`h-3.5 w-3.5 ${statusMeta.spin ? "animate-spin" : ""}`} />}
        statusLabel={statusMeta.label}
        statusClassName={statusMeta.className}
        pageMode={value.theme.pageMode}
        naturalPages={naturalPages}
        undoable={undoable}
        redoable={redoable}
        previewOpen={previewOpen}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onSave={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          void save(value);
        }}
        onTogglePreview={() => setPreviewOpen((v) => !v)}
        chatSlot={
          <>
            <ToolbarButton
              onClick={() => setAtsOpen((v) => !v)}
              tooltip={atsOpen ? "Fermer le score ATS" : "Afficher le score ATS"}
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="ATS"
            />
            <ToolbarButton
              onClick={() => setMatchOpen((v) => !v)}
              tooltip={matchOpen ? "Fermer le job-match" : "Match contre une fiche de poste"}
              icon={<Target className="h-3.5 w-3.5" />}
              label="Job"
            />
            <ToolbarButton
              onClick={() => setScanOpen((v) => !v)}
              tooltip={scanOpen ? "Fermer la vue ATS" : "Voir ce que lit un ATS"}
              icon={<ScanText className="h-3.5 w-3.5" />}
              label="Scan"
            />
            <ToolbarButton
              onClick={() => setChatOpen((v) => !v)}
              tooltip={chatOpen ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA"}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Assistant"
            />
            <a
              href={`/api/cv/${id}/pdf?download=1`}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-border)]/40"
              title={
                value.theme.pageMode === "multi"
                  ? "Télécharger en PDF multipage, sans couper le contenu"
                  : "Télécharger en PDF une page (ajustement automatique)"
              }
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </a>
            <a
              href={`/api/cv/${id}/docx?download=1`}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-border)]/40"
              title="Télécharger en DOCX (format préféré des ATS)"
            >
              <FileText className="h-3.5 w-3.5" />
              DOCX
            </a>
          </>
        }
        revisionsSlot={
          <RevisionsPanel
            cvId={id}
            currentSnapshot={value}
            onRestore={(next, ts) => {
              dispatch({ type: "reset", value: next });
              setUpdatedAt(ts);
              setStatus("saved");
            }}
          />
        }
      />
      {value.theme.pageMode === "single" &&
        activeFit &&
        (activeFit.overflowed || activeFit.droppedBullets > 0 || activeFit.droppedExperiences > 0) && (
        <FitWarning report={activeFit} />
      )}
      <div className="flex min-h-0 flex-1 gap-4">
        <div
          className={`grid min-h-0 flex-1 gap-4 ${previewOpen ? "lg:grid-cols-2" : "grid-cols-1"}`}
        >
          <div className="flex min-h-0 flex-col gap-2">
            <CompletenessChecklist data={value.data} />
            <div className="flex-1 overflow-y-auto rounded-md border bg-[var(--color-bg)] p-4">
              <CvForm value={value} onChange={onChange} />
            </div>
          </div>
          {previewOpen && (
            <div className="min-h-0 overflow-hidden rounded-md border bg-[var(--color-border)]/20">
              <PdfPreview
                data={previewValue.data}
                theme={previewValue.theme}
                locale={previewValue.locale}
                onFitReport={setFitReport}
              />
            </div>
          )}
        </div>
        {atsOpen && (
          <div className="hidden h-full w-[20rem] shrink-0 overflow-hidden rounded-md border lg:block">
            <AtsScorePanel
              data={value.data}
              onJumpTo={(path) => {
                const id = `cv-anchor-${path.split(".")[0]}`;
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </div>
        )}
        {matchOpen && (
          <div className="hidden h-full w-[22rem] shrink-0 overflow-hidden rounded-md border lg:block">
            <JobMatchPanel data={value.data} />
          </div>
        )}
        {scanOpen && (
          <div className="hidden h-full w-[22rem] shrink-0 overflow-hidden rounded-md border lg:block">
            <AtsPreviewPanel data={value.data} locale={value.locale} />
          </div>
        )}
        {chatOpen && (
          <div className="hidden h-full w-[24rem] shrink-0 overflow-hidden rounded-md border lg:block">
            <CvChatPanel
              cvId={id}
              cvData={value.data}
              onApply={applyChatPatch}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FitWarning({ report }: { report: FitReport }) {
  const { experiences, bullets } = report.dropped;
  return (
    <div
      role="alert"
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
        Export 1 page : du contenu sera coupé dans le PDF envoyé aux recruteurs.
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-9">
        {experiences.length > 0 && <li>Expériences retirées : {experiences.join(", ")}</li>}
        {bullets.length > 0 && (
          <li>
            Puces retirées : {bullets.map((b) => `${b.company} (${b.count})`).join(", ")}
          </li>
        )}
        {report.overflowed && (
          <li>
            Le contenu dépasse encore une page ({report.pages} pages) : le bas de la page est rogné.
          </li>
        )}
      </ul>
      <p className="mt-1 pl-5">Raccourcir le contenu ou passer en multi-pages.</p>
    </div>
  );
}

type ToolbarProps = {
  title: string;
  statusIcon: React.ReactNode;
  statusLabel: string;
  statusClassName: string;
  pageMode: "single" | "multi";
  /** Natural (un-fitted) page count, or null until measured. */
  naturalPages: number | null;
  undoable: boolean;
  redoable: boolean;
  previewOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onTogglePreview: () => void;
  revisionsSlot?: React.ReactNode;
  chatSlot?: React.ReactNode;
};

function Toolbar({
  title,
  statusIcon,
  statusLabel,
  statusClassName,
  pageMode,
  naturalPages,
  undoable,
  redoable,
  previewOpen,
  onUndo,
  onRedo,
  onSave,
  onTogglePreview,
  revisionsSlot,
  chatSlot,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{title || "Sans titre"}</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${statusClassName}`}
        >
          {statusIcon}
          {statusLabel}
        </span>
        {pageMode === "multi" && naturalPages != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-[var(--color-muted)]">
            PDF multipage · {naturalPages} page{naturalPages > 1 ? "s" : ""}
          </span>
        )}
        {pageMode === "single" && naturalPages != null && naturalPages > 1 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400"
            title="Le contenu déborde naturellement sur plusieurs pages. L'export PDF appliquera une compression automatique (spacing + fonts plus serrés, puis troncation si nécessaire) pour rester sur 1 page A4."
          >
            <TriangleAlert className="h-3.5 w-3.5" />
            Compression auto — {naturalPages} pages avant fit
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={onUndo}
          disabled={!undoable}
          tooltip="Annuler (⌘Z)"
          icon={<Undo2 className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          onClick={onRedo}
          disabled={!redoable}
          tooltip="Rétablir (⌘⇧Z)"
          icon={<Redo2 className="h-3.5 w-3.5" />}
        />
        <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        {chatSlot}
        {revisionsSlot}
        <ToolbarButton
          onClick={onTogglePreview}
          tooltip={previewOpen ? "Masquer la preview (⌘P)" : "Afficher la preview (⌘P)"}
          icon={previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          label={previewOpen ? "Masquer" : "Preview"}
        />
        <ToolbarButton
          onClick={onSave}
          tooltip="Sauvegarder maintenant (⌘S)"
          icon={<Save className="h-3.5 w-3.5" />}
          label="Sauver"
          variant="primary"
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  tooltip,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
  icon: React.ReactNode;
  label?: string;
  variant?: "primary";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90"
      : "hover:bg-[var(--color-border)]/40";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`${base} ${styles}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
