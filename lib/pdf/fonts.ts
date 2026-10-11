import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Idempotent registration of the Inter family for React-PDF.
 *
 * React-PDF treats string `src` as a URL and tries to fetch it.
 *  - On the server we feed a Buffer read from /public/fonts/inter/*.ttf
 *  - In the browser we point to the public URL (served by Next from /public)
 *
 * `eval("require")` is used to grab Node's CJS require in an ESM module without
 * tripping the bundler — Next.js never sees a static `import "node:fs"` so the
 * client bundle stays clean.
 */
export function registerFonts(): void {
  if (registered) return;
  registered = true;

  const fonts =
    typeof window === "undefined" ? loadServerFonts() : loadBrowserFonts();
  if (fonts.length === 0) return;

  Font.register({ family: "Inter", fonts });
  Font.registerHyphenationCallback((word) => [word]);
}

type FontFace = { src: string; fontWeight: 400 | 500 | 600 | 700 };
let serverFontsCache: FontFace[] | null = null;

/**
 * Give the next document its own fontkit instances (server only).
 *
 * fontkit memoises `Glyph` objects per font instance, keyed by glyph id and
 * keeping the codePoints of the *first* use. Shared across documents, a glyph
 * first reached through another character (e.g. around "·") keeps the wrong
 * ToUnicode entry: "Node.js" was extracted as "Node js" in later PDFs. Fresh
 * `FontSource`s per document avoid that. Data-URL sources load synchronously,
 * so documents already being laid out never see an unloaded font.
 */
export function refreshFonts(): void {
  if (typeof window !== "undefined") return;
  const fonts = loadServerFonts();
  if (fonts.length === 0) return;
  const store = Font as unknown as {
    getRegisteredFonts(): Record<string, { sources: Array<{ load(): Promise<void> }> } | undefined>;
  };
  const family = store.getRegisteredFonts().Inter;
  if (!family) return;
  family.sources = [];
  Font.register({ family: "Inter", fonts });
  for (const source of family.sources) void source.load();
}

function loadServerFonts(): FontFace[] {
  if (serverFontsCache) return serverFontsCache;
  try {
     
    const req = eval("require") as NodeRequire;
    const fs = req("node:fs") as typeof import("node:fs");
    const path = req("node:path") as typeof import("node:path");
    const dir = path.join(process.cwd(), "public", "fonts", "inter");
    const read = (file: string) =>
      `data:font/ttf;base64,${fs.readFileSync(path.join(dir, file)).toString("base64")}`;
    serverFontsCache = [
      { src: read("Inter-Regular.ttf"), fontWeight: 400 },
      { src: read("Inter-Medium.ttf"), fontWeight: 500 },
      { src: read("Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: read("Inter-Bold.ttf"), fontWeight: 700 },
    ];
    return serverFontsCache;
  } catch (err) {
    console.warn("[pdf/fonts] failed to load Inter from disk, falling back to Helvetica", err);
    return [];
  }
}

function loadBrowserFonts(): Array<{ src: string; fontWeight: 400 | 500 | 600 | 700 }> {
  const base = "/fonts/inter";
  return [
    { src: `${base}/Inter-Regular.ttf`, fontWeight: 400 },
    { src: `${base}/Inter-Medium.ttf`, fontWeight: 500 },
    { src: `${base}/Inter-SemiBold.ttf`, fontWeight: 600 },
    { src: `${base}/Inter-Bold.ttf`, fontWeight: 700 },
  ];
}
