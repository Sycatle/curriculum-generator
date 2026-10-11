import Link from "next/link";
import { requireSession } from "@/lib/auth/server";
import { listCvsForUser } from "@/lib/cv/repository";
import { getTargetingProfile } from "@/lib/jobs/targeting";
import { TargetingForm } from "./targeting-form";

export const metadata = { title: "Profil de ciblage" };
export const dynamic = "force-dynamic";

export default async function TargetingPage() {
  const session = await requireSession();
  const [profile, cvs] = await Promise.all([
    getTargetingProfile(session.user.id),
    listCvsForUser(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profil de ciblage</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Définit ce que tu cherches (en complément de ton CV). Pilote le scoring des offres et masque celles qui ne correspondent pas.
          </p>
        </div>
        <Link
          href="/jobs"
          className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-border)]/30"
        >
          ← Offres
        </Link>
      </div>

      <TargetingForm
        initial={profile}
        cvs={cvs.map((c) => ({ id: c.id, title: c.title }))}
      />
    </div>
  );
}
