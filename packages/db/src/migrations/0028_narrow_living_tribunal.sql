CREATE TABLE "plugin_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_config_plugin_id_unique" UNIQUE("plugin_id")
);
--> statement-breakpoint
CREATE TABLE "plugin_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "plugin_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"job_key" text NOT NULL,
	"display_name" text NOT NULL,
	"cron" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	CONSTRAINT "plugin_jobs_plugin_job_key_uniq" UNIQUE("plugin_id","job_key")
);
--> statement-breakpoint
CREATE TABLE "plugin_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_state_plugin_scope_key_uniq" UNIQUE("plugin_id","scope","key")
);
--> statement-breakpoint
CREATE TABLE "plugin_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"parameters_schema" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "plugin_tools_plugin_tool_name_uniq" UNIQUE("plugin_id","tool_name")
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_key" text NOT NULL,
	"display_name" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'installed' NOT NULL,
	"capabilities" text[] DEFAULT '{}' NOT NULL,
	"manifest" jsonb NOT NULL,
	"install_path" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugins_plugin_key_unique" UNIQUE("plugin_key")
);
--> statement-breakpoint
ALTER TABLE "plugin_config" ADD CONSTRAINT "plugin_config_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_job_runs" ADD CONSTRAINT "plugin_job_runs_job_id_plugin_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."plugin_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_job_runs" ADD CONSTRAINT "plugin_job_runs_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_jobs" ADD CONSTRAINT "plugin_jobs_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_state" ADD CONSTRAINT "plugin_state_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_tools" ADD CONSTRAINT "plugin_tools_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;