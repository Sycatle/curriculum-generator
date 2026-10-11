import { requireSession } from "@/lib/auth/server";
import { DiscoverForm } from "./discover-form";

export const metadata = { title: "Découvrir des entreprises" };

export default async function DiscoverPage() {
  await requireSession();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Découvrir des entreprises</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Source : <span className="font-mono">recherche-entreprises.api.gouv.fr</span> (gratuit,
          sans auth). Tech : code NAF <span className="font-mono">62.01Z</span> (programmation),{" "}
          <span className="font-mono">62.02A</span> (conseil informatique),{" "}
          <span className="font-mono">63.11Z</span> (traitement de données / hébergement),{" "}
          <span className="font-mono">62.09Z</span> (autres activités informatiques).
        </p>
      </div>
      <DiscoverForm />
    </div>
  );
}
