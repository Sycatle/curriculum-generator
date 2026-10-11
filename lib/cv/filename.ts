import type { CvData } from "./schema";

const MAX_BASE_LENGTH = 80;

const EXTRA_FOLDS: Record<string, string> = { œ: "oe", Œ: "OE", æ: "ae", Æ: "AE", ß: "ss", ø: "o", Ø: "O", ł: "l", Ł: "L" };

function slugify(input: string, keep: RegExp): string {
  return input
    .replace(/[œŒæÆßøØłŁ]/g, (c) => EXTRA_FOLDS[c]!)
    .replace(keep, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function truncate(s: string): string {
  if (s.length <= MAX_BASE_LENGTH) return s;
  const cut = s.slice(0, MAX_BASE_LENGTH);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > MAX_BASE_LENGTH / 2 ? cut.slice(0, lastDash) : cut).replace(/-$/, "");
}

function build(header: CvData["header"], keep: RegExp, fold: (s: string) => string): string {
  const parts = [fold(header.name), fold(header.title)].map((p) => slugify(p, keep)).filter(Boolean);
  return truncate(["CV", ...parts].join("-"));
}

/** `CV-Prenom-Nom-Titre.ext`, ASCII only (diacritics stripped), for the `filename=` fallback. */
export function cvFilename(header: CvData["header"], ext: "pdf" | "docx"): string {
  const ascii = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
  return `${build(header, /[^A-Za-z0-9]+/g, ascii)}.${ext}`;
}

/** Same name with accents kept, for `filename*=UTF-8''…`. */
function cvFilenameUnicode(header: CvData["header"], ext: "pdf" | "docx"): string {
  return `${build(header, /[^\p{L}\p{N}]+/gu, (s) => s.normalize("NFC"))}.${ext}`;
}

/** `inline` by default, `attachment` when the download was explicitly requested. */
export function contentDisposition(
  header: CvData["header"],
  ext: "pdf" | "docx",
  download: boolean,
): string {
  const encoded = encodeURIComponent(cvFilenameUnicode(header, ext)).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${download ? "attachment" : "inline"}; filename="${cvFilename(header, ext)}"; filename*=UTF-8''${encoded}`;
}
