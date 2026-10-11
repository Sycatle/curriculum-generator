import Link from "next/link";
import { requireSession } from "@/lib/auth/server";
import { listCvsForUser } from "@/lib/cv/repository";
import { DeleteCvButton } from "./delete-button";

export const metadata = { title: "Your CVs" };

export default async function CvsPage() {
  const session = await requireSession();
  const cvs = await listCvsForUser(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your CVs</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/cvs/import"
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-[var(--color-border)]/30"
          >
            Import from file
          </Link>
          <Link
            href="/cvs/new"
            className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
          >
            New CV
          </Link>
        </div>
      </div>

      {cvs.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-[var(--color-muted)]">
          No CVs yet. Create your first one.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {cvs.map((cv) => (
            <li key={cv.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/cvs/${cv.id}/edit`} className="font-medium hover:underline">
                  {cv.title}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">
                  {cv.slug} · {cv.locale.toUpperCase()} ·{" "}
                  {cv.isPublic ? (
                    <Link href={`/cv/${cv.id}`} className="text-[var(--color-accent)] hover:underline">
                      public
                    </Link>
                  ) : (
                    "private"
                  )}{" "}
                  · updated {new Date(cv.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <a
                  href={`/api/cv/${cv.id}/pdf?download=1`}
                  className="rounded-md border px-3 py-1 hover:bg-[var(--color-border)]/30"
                >
                  PDF
                </a>
                <Link
                  href={`/cvs/${cv.id}/edit`}
                  className="rounded-md border px-3 py-1 hover:bg-[var(--color-border)]/30"
                >
                  Edit
                </Link>
                <DeleteCvButton id={cv.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
