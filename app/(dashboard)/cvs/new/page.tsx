import { createCvAction } from "../actions";

export const metadata = { title: "New CV" };

export default function NewCvPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">New CV</h1>
      <form action={createCvAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="CV Full-Stack FR"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="slug" className="block text-sm font-medium">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            placeholder="full-stack-fr"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-muted)]">
            Used in your CV URL. kebab-case alphanumeric.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
        >
          Create
        </button>
      </form>
    </div>
  );
}
