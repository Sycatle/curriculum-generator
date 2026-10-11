CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"discovered_from" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"country" text,
	"city" text,
	"postal_code" text,
	"activity_code" text,
	"activity_label" text,
	"headcount" text,
	"headcount_min" integer,
	"headcount_max" integer,
	"website_lang" text,
	"remote_friendly" boolean,
	"fit_score" integer,
	"raw" jsonb NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"email_kind" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"title" text,
	"source" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"complained_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"cv_id" uuid,
	"cv_revision_id" uuid,
	"lang" text NOT NULL,
	"subject" text NOT NULL,
	"body_markdown" text NOT NULL,
	"from_address" text NOT NULL,
	"resend_message_id" text,
	"status" text NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"follow_up_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_cv_id_cv_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."cv"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_cv_revision_id_cv_revision_id_fk" FOREIGN KEY ("cv_revision_id") REFERENCES "public"."cv_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_user_source_external_unique" ON "company" USING btree ("user_id","discovered_from","external_id");--> statement-breakpoint
CREATE INDEX "company_user_id_idx" ON "company" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "company_activity_code_idx" ON "company" USING btree ("activity_code");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_company_email_unique" ON "contact" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "contact_company_id_idx" ON "contact" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "outreach_message_user_id_idx" ON "outreach_message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outreach_message_contact_id_idx" ON "outreach_message" USING btree ("contact_id");