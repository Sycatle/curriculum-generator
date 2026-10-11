CREATE TABLE "job_posting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"remote" boolean DEFAULT false NOT NULL,
	"employment_type" text,
	"department" text,
	"description_html" text,
	"description_text" text,
	"posted_at" timestamp with time zone,
	"fit_score" integer,
	"raw" jsonb NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_source" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_posting" ADD CONSTRAINT "job_posting_source_id_job_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source" ADD CONSTRAINT "job_source_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_posting_source_external_unique" ON "job_posting" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "job_posting_source_id_idx" ON "job_posting" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "job_posting_discovered_at_idx" ON "job_posting" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "job_source_user_id_idx" ON "job_source" USING btree ("user_id");