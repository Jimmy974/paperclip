ALTER TABLE "plugin_jobs" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plugin_jobs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plugin_tools" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plugin_tools" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "plugin_job_runs_plugin_started_idx" ON "plugin_job_runs" USING btree ("plugin_id","started_at");--> statement-breakpoint
CREATE INDEX "plugin_job_runs_job_started_idx" ON "plugin_job_runs" USING btree ("job_id","started_at");