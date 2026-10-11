CREATE TABLE "targeting_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"target_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"must_have_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nice_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_companies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"remote_required" boolean DEFAULT false NOT NULL,
	"seniority_min" integer,
	"seniority_max" integer,
	"languages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"employment_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"salary_min_eur" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_posting" ADD COLUMN "fit_score_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "targeting_profile" ADD CONSTRAINT "targeting_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;