import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CV Generator — Le CV des devs qui en ont marre de Canva.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #2563eb 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "white",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            CV
          </div>
          <span style={{ opacity: 0.7 }}>curriculum-generator · open source</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>
            Le CV des devs qui en ont marre de Canva.
          </div>
          <div style={{ display: "flex", fontSize: 24, opacity: 0.75, maxWidth: 880 }}>
            Édite le contenu, pas la mise en page. Aperçu live, export PDF A4 une ou plusieurs pages.
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 18, opacity: 0.7 }}>
          <span>· Self-hosted</span>
          <span>· MIT licensed</span>
          <span>· Next.js + Postgres + React-PDF</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
