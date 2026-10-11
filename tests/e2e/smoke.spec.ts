import { expect, test } from "@playwright/test";

test("home page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/le cv des devs/i);
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
});

test("login page exposes magic link form and GitHub button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
});

test("dashboard route redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/cvs");
  await expect(page).toHaveURL(/\/login/);
});

test("health endpoint is reachable", async ({ request }) => {
  const res = await request.get("/api/health");
  // Either 200 (DB up) or 503 (DB not started in this env). Both prove the route mounts.
  expect([200, 503]).toContain(res.status());
});
