import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better-Auth tables (schema must match what the Drizzle adapter expects)
// https://www.better-auth.com/docs/adapters/drizzle
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const cv = pgTable(
  "cv",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    locale: text("locale").notNull().default("fr"),
    data: jsonb("data").notNull(),
    theme: jsonb("theme").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userSlugUnique: uniqueIndex("cv_user_id_slug_unique").on(table.userId, table.slug),
    userIdx: index("cv_user_id_idx").on(table.userId),
  }),
);

export const cvRevision = pgTable(
  "cv_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvId: uuid("cv_id")
      .notNull()
      .references(() => cv.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    theme: jsonb("theme").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cvIdIdx: index("cv_revision_cv_id_idx").on(table.cvId),
  }),
);

// ---------------------------------------------------------------------------
// Jobs domain — sourcing (Jalon 1)
// ---------------------------------------------------------------------------

export const jobSource = pgTable(
  "job_source",
  {
    id: text("id").primaryKey(), // e.g. 'greenhouse:airbnb', 'lever:vercel', 'france-travail', 'hn:whoishiring'
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<"greenhouse" | "lever" | "ashby" | "workday" | "france-travail" | "hn" | "remoteok">(),
    label: text("label").notNull(), // display name
    config: jsonb("config").notNull(), // connector-specific (e.g. { board: "airbnb" })
    enabled: boolean("enabled").notNull().default(true),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("job_source_user_id_idx").on(table.userId),
  }),
);

export const jobPosting = pgTable(
  "job_posting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id")
      .notNull()
      .references(() => jobSource.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    remote: boolean("remote").notNull().default(false),
    employmentType: text("employment_type"), // full-time, contract, internship...
    department: text("department"),
    descriptionHtml: text("description_html"),
    descriptionText: text("description_text"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    fitScore: integer("fit_score"), // 0-100, nullable until matched, -1 if excluded by targeting profile
    fitScoreBreakdown: jsonb("fit_score_breakdown"), // PostingMatchBreakdown JSON, null when scored without profile
    // Typed signals extracted at ingestion (mainly populated by France Travail; null for other sources)
    isAlternance: boolean("is_alternance"),
    salaryMinEUR: integer("salary_min_eur"),
    salaryMaxEUR: integer("salary_max_eur"),
    salaryPeriod: text("salary_period"), // 'year' | 'month' | 'day' | 'hour'
    salaryRaw: text("salary_raw"),
    experienceRequiredMonths: integer("experience_required_months"),
    experienceLabel: text("experience_label"),
    workContext: jsonb("work_context"),
    appellationLibelle: text("appellation_libelle"),
    romeCode: text("rome_code"),
    dateActualisation: timestamp("date_actualisation", { withTimezone: true }),
    accessibleTH: boolean("accessible_th"),
    entrepriseAdaptee: boolean("entreprise_adaptee"),
    employeurHandiEngage: boolean("employeur_handi_engage"),
    nombrePostes: integer("nombre_postes"),
    // LLM matching results (populated by /api/jobs/match-all when profile + LLM enabled)
    llmVerdict: text("llm_verdict"), // 'fit' | 'stretch' | 'mismatch'
    llmScore: integer("llm_score"), // 0-100
    llmCheckedAt: timestamp("llm_checked_at", { withTimezone: true }),
    raw: jsonb("raw").notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceExternalUnique: uniqueIndex("job_posting_source_external_unique").on(
      table.sourceId,
      table.externalId,
    ),
    sourceIdx: index("job_posting_source_id_idx").on(table.sourceId),
    discoveredAtIdx: index("job_posting_discovered_at_idx").on(table.discoveredAt),
    alternanceIdx: index("job_posting_is_alternance_idx").on(table.isAlternance),
    romeIdx: index("job_posting_rome_code_idx").on(table.romeCode),
    llmVerdictIdx: index("job_posting_llm_verdict_idx").on(table.llmVerdict),
  }),
);

// ---------------------------------------------------------------------------
// Companies domain — cold outreach (Jalon 5)
// ---------------------------------------------------------------------------

export const company = pgTable(
  "company",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    discoveredFrom: text("discovered_from").notNull(), // 'recherche-entreprises', 'apify-gmaps', 'crunchbase', 'manual'
    externalId: text("external_id").notNull(), // SIREN, SIRET, place_id, etc.
    name: text("name").notNull(),
    domain: text("domain"), // canonical key when known
    country: text("country"), // ISO2
    city: text("city"),
    postalCode: text("postal_code"),
    activityCode: text("activity_code"), // NAF / SIC
    activityLabel: text("activity_label"),
    headcount: text("headcount"), // raw label e.g. "10 à 19 salariés"
    headcountMin: integer("headcount_min"),
    headcountMax: integer("headcount_max"),
    websiteLang: text("website_lang"), // 'fr' | 'en' | 'both'
    remoteFriendly: boolean("remote_friendly"),
    fitScore: integer("fit_score"),
    raw: jsonb("raw").notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userExternalUnique: uniqueIndex("company_user_source_external_unique").on(
      table.userId,
      table.discoveredFrom,
      table.externalId,
    ),
    userIdx: index("company_user_id_idx").on(table.userId),
    activityIdx: index("company_activity_code_idx").on(table.activityCode),
  }),
);

export const contact = pgTable(
  "contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    emailKind: text("email_kind").notNull(), // 'generic' | 'nominative'
    firstName: text("first_name"),
    lastName: text("last_name"),
    title: text("title"),
    source: text("source").notNull(), // 'dropcontact' | 'hunter' | 'manual' | 'recherche-entreprises'
    verified: boolean("verified").notNull().default(false),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    complainedAt: timestamp("complained_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyEmailUnique: uniqueIndex("contact_company_email_unique").on(table.companyId, table.email),
    companyIdx: index("contact_company_id_idx").on(table.companyId),
  }),
);

export const outreachMessage = pgTable(
  "outreach_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    cvId: uuid("cv_id").references(() => cv.id, { onDelete: "set null" }),
    cvRevisionId: uuid("cv_revision_id").references(() => cvRevision.id, { onDelete: "set null" }),
    lang: text("lang").notNull(), // 'fr' | 'en'
    subject: text("subject").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    fromAddress: text("from_address").notNull(),
    resendMessageId: text("resend_message_id"),
    status: text("status").notNull(), // queued | sent | bounced | complained | replied | unsubscribed | failed
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    followUpOf: uuid("follow_up_of"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("outreach_message_user_id_idx").on(table.userId),
    contactIdx: index("outreach_message_contact_id_idx").on(table.contactId),
  }),
);

export type User = typeof user.$inferSelect;
export type Cv = typeof cv.$inferSelect;
export type CvRevision = typeof cvRevision.$inferSelect;
export type JobSource = typeof jobSource.$inferSelect;
export type JobPosting = typeof jobPosting.$inferSelect;
export type Company = typeof company.$inferSelect;
export type Contact = typeof contact.$inferSelect;
export type OutreachMessage = typeof outreachMessage.$inferSelect;

// ---------------------------------------------------------------------------
// Job application — submissions made to ATS APIs (Jalon 3)
// ---------------------------------------------------------------------------

export const jobApplication = pgTable(
  "job_application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postingId: uuid("posting_id")
      .notNull()
      .references(() => jobPosting.id, { onDelete: "cascade" }),
    cvId: uuid("cv_id").references(() => cv.id, { onDelete: "set null" }),
    cvRevisionId: uuid("cv_revision_id").references(() => cvRevision.id, { onDelete: "set null" }),
    /** Strategy used: 'greenhouse-api' | 'lever-api' | 'stagehand' | 'email' | 'manual' */
    submitStrategy: text("submit_strategy").notNull(),
    /** queued | submitting | submitted | failed | replied | interview | offer | hired | rejected */
    status: text("status").notNull(),
    coverLetterText: text("cover_letter_text"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    externalRef: text("external_ref"), // ATS-side reference if returned
    error: text("error"),
    request: jsonb("request"), // request payload for debugging
    response: jsonb("response"), // response payload for debugging
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userPostingUnique: uniqueIndex("job_application_user_posting_unique").on(
      table.userId,
      table.postingId,
    ),
    userIdx: index("job_application_user_id_idx").on(table.userId),
    statusIdx: index("job_application_status_idx").on(table.status),
  }),
);

export type JobApplication = typeof jobApplication.$inferSelect;

// ---------------------------------------------------------------------------
// Targeting profile — 1:1 user-defined search criteria (drives matchPostingMulti)
// ---------------------------------------------------------------------------

export const targetingProfile = pgTable("targeting_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  targetRoles: jsonb("target_roles").$type<string[]>().notNull().default([]),
  mustHaveSkills: jsonb("must_have_skills").$type<string[]>().notNull().default([]),
  niceSkills: jsonb("nice_skills").$type<string[]>().notNull().default([]),
  excludeKeywords: jsonb("exclude_keywords").$type<string[]>().notNull().default([]),
  targetLocations: jsonb("target_locations").$type<string[]>().notNull().default([]),
  excludeCompanies: jsonb("exclude_companies").$type<string[]>().notNull().default([]),
  remoteRequired: boolean("remote_required").notNull().default(false),
  excludeAlternance: boolean("exclude_alternance").notNull().default(true),
  /** 0=intern, 1=junior, 2=mid, 3=senior, 4=lead, 5=staff/principal */
  seniorityMin: integer("seniority_min"),
  seniorityMax: integer("seniority_max"),
  languages: jsonb("languages")
    .$type<{ fr?: "required" | "nice"; en?: "required" | "nice" }>()
    .notNull()
    .default({}),
  employmentTypes: jsonb("employment_types").$type<string[]>().notNull().default([]),
  salaryMinEUR: integer("salary_min_eur"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TargetingProfile = typeof targetingProfile.$inferSelect;
