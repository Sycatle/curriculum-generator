if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://cv:cv@localhost:5432/cv";
}
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-test";
}
if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}
