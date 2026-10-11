"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/cvs";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message ?? "Failed to send magic link");
      return;
    }
    setStatus("sent");
  }

  async function onGithub() {
    await authClient.signIn.social({ provider: "github", callbackURL: next });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={status === "sending" || status === "sent"}
          className="w-full rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent"
              ? "Check your email"
              : "Send magic link"}
        </button>
        {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
        {status === "sent" && (
          <p className="text-sm text-[var(--color-muted)]">
            We sent a sign-in link to {email}. The link expires in 5 minutes.
          </p>
        )}
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[var(--color-bg)] px-2 text-[var(--color-muted)]">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onGithub}
        className="w-full rounded-md border px-3 py-2 text-sm font-medium hover:bg-[var(--color-border)]/30"
      >
        Continue with GitHub
      </button>
    </div>
  );
}
