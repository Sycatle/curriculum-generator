CREATE TABLE "job_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"posting_id" uuid NOT NULL,
	"cv_id" uuid,
	"cv_revision_id" uuid,
	"submit_strategy" text NOT NULL,
	"status" text NOT NULL,
	"cover_letter_text" text,
	"submitted_at" timestamp with time zone,
	"external_ref" text,
	"error" text,
	"request" jsonb,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_posting_id_job_posting_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."job_posting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_cv_id_cv_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."cv"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_cv_revision_id_cv_revision_id_fk" FOREIGN KEY ("cv_revision_id") REFERENCES "public"."cv_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_application_user_posting_unique" ON "job_application" USING btree ("user_id","posting_id");--> statement-breakpoint
CREATE INDEX "job_application_user_id_idx" ON "job_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_application_status_idx" ON "job_application" USING btree ("status");