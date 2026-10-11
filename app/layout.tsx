import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "../public/fonts/inter/Inter-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/inter/Inter-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/inter/Inter-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/inter/Inter-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "CV Generator",
    template: "%s · CV Generator",
  },
  description: "Self-hosted, open-source CV generator with live preview and clean PDF export.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
