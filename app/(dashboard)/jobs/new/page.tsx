import { requireSession } from "@/lib/auth/server";
import { NewSourceForm } from "./new-source-form";

export const metadata = { title: "Nouvelle source d'offres" };

export default async function NewJobSourcePage() {
  await requireSession();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajouter une source</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Chaque source pointe vers un connecteur (Greenhouse, Lever, France Travail, HN) et garde sa
          config dédiée. Tu peux en ajouter autant que tu veux.
        </p>
      </div>
      <NewSourceForm />
    </div>
  );
}
