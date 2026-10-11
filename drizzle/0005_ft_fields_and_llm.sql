ALTER TABLE "job_posting" ADD COLUMN "is_alternance" boolean;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "salary_min_eur" integer;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "salary_max_eur" integer;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "salary_period" text;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "salary_raw" text;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "experience_required_months" integer;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "experience_label" text;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "work_context" jsonb;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "appellation_libelle" text;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "rome_code" text;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "date_actualisation" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "accessible_th" boolean;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "entreprise_adaptee" boolean;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "employeur_handi_engage" boolean;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "nombre_postes" integer;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "llm_verdict" text;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "llm_score" integer;--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "llm_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "targeting_profile" ADD COLUMN "exclude_alternance" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "job_posting_is_alternance_idx" ON "job_posting" USING btree ("is_alternance");--> statement-breakpoint
CREATE INDEX "job_posting_rome_code_idx" ON "job_posting" USING btree ("rome_code");--> statement-breakpoint
CREATE INDEX "job_posting_llm_verdict_idx" ON "job_posting" USING btree ("llm_verdict");