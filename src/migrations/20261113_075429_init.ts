import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE SCHEMA IF NOT EXISTS "rating";
  CREATE TYPE "rating"."enum_users_role" AS ENUM('student', 'teacher');
  CREATE TYPE "rating"."enum_submissions_status" AS ENUM('completed', 'excused');
  CREATE TABLE "rating"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "rating"."enum_users_role" DEFAULT 'student' NOT NULL,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"starts_on" timestamp(3) with time zone NOT NULL,
  	"ends_on" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."criteria" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"term_id" integer NOT NULL,
  	"label" varchar NOT NULL,
  	"position" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."teams" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"term_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"leader_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."teams_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "rating"."assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"team_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"opens_at" timestamp(3) with time zone NOT NULL,
  	"closes_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"assignment_id" integer NOT NULL,
  	"rater_id" integer NOT NULL,
  	"status" "rating"."enum_submissions_status" DEFAULT 'completed' NOT NULL,
  	"late" boolean DEFAULT false,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."ratings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"assignment_id" integer NOT NULL,
  	"rater_id" integer NOT NULL,
  	"ratee_id" integer NOT NULL,
  	"criterion_id" integer NOT NULL,
  	"score" numeric NOT NULL,
  	"late" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."otps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"ip" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "rating"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"terms_id" integer,
  	"criteria_id" integer,
  	"teams_id" integer,
  	"assignments_id" integer,
  	"submissions_id" integer,
  	"ratings_id" integer,
  	"otps_id" integer,
  	"sessions_id" integer
  );
  
  CREATE TABLE "rating"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "rating"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "rating"."criteria" ADD CONSTRAINT "criteria_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "rating"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."teams" ADD CONSTRAINT "teams_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "rating"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."teams" ADD CONSTRAINT "teams_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "rating"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."teams_rels" ADD CONSTRAINT "teams_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "rating"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."teams_rels" ADD CONSTRAINT "teams_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "rating"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."assignments" ADD CONSTRAINT "assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "rating"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "rating"."assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."submissions" ADD CONSTRAINT "submissions_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "rating"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."ratings" ADD CONSTRAINT "ratings_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "rating"."assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."ratings" ADD CONSTRAINT "ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "rating"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."ratings" ADD CONSTRAINT "ratings_ratee_id_users_id_fk" FOREIGN KEY ("ratee_id") REFERENCES "rating"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."ratings" ADD CONSTRAINT "ratings_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "rating"."criteria"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "rating"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "rating"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "rating"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "rating"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_criteria_fk" FOREIGN KEY ("criteria_id") REFERENCES "rating"."criteria"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "rating"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignments_fk" FOREIGN KEY ("assignments_id") REFERENCES "rating"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submissions_fk" FOREIGN KEY ("submissions_id") REFERENCES "rating"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ratings_fk" FOREIGN KEY ("ratings_id") REFERENCES "rating"."ratings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_otps_fk" FOREIGN KEY ("otps_id") REFERENCES "rating"."otps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "rating"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "rating"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "rating"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_email_idx" ON "rating"."users" USING btree ("email");
  CREATE INDEX "users_updated_at_idx" ON "rating"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "rating"."users" USING btree ("created_at");
  CREATE INDEX "terms_updated_at_idx" ON "rating"."terms" USING btree ("updated_at");
  CREATE INDEX "terms_created_at_idx" ON "rating"."terms" USING btree ("created_at");
  CREATE INDEX "criteria_term_idx" ON "rating"."criteria" USING btree ("term_id");
  CREATE INDEX "criteria_updated_at_idx" ON "rating"."criteria" USING btree ("updated_at");
  CREATE INDEX "criteria_created_at_idx" ON "rating"."criteria" USING btree ("created_at");
  CREATE UNIQUE INDEX "term_position_idx" ON "rating"."criteria" USING btree ("term_id","position");
  CREATE INDEX "teams_term_idx" ON "rating"."teams" USING btree ("term_id");
  CREATE INDEX "teams_leader_idx" ON "rating"."teams" USING btree ("leader_id");
  CREATE INDEX "teams_updated_at_idx" ON "rating"."teams" USING btree ("updated_at");
  CREATE INDEX "teams_created_at_idx" ON "rating"."teams" USING btree ("created_at");
  CREATE INDEX "teams_rels_order_idx" ON "rating"."teams_rels" USING btree ("order");
  CREATE INDEX "teams_rels_parent_idx" ON "rating"."teams_rels" USING btree ("parent_id");
  CREATE INDEX "teams_rels_path_idx" ON "rating"."teams_rels" USING btree ("path");
  CREATE INDEX "teams_rels_users_id_idx" ON "rating"."teams_rels" USING btree ("users_id");
  CREATE INDEX "assignments_team_idx" ON "rating"."assignments" USING btree ("team_id");
  CREATE INDEX "assignments_updated_at_idx" ON "rating"."assignments" USING btree ("updated_at");
  CREATE INDEX "assignments_created_at_idx" ON "rating"."assignments" USING btree ("created_at");
  CREATE INDEX "submissions_assignment_idx" ON "rating"."submissions" USING btree ("assignment_id");
  CREATE INDEX "submissions_rater_idx" ON "rating"."submissions" USING btree ("rater_id");
  CREATE INDEX "submissions_updated_at_idx" ON "rating"."submissions" USING btree ("updated_at");
  CREATE INDEX "submissions_created_at_idx" ON "rating"."submissions" USING btree ("created_at");
  CREATE UNIQUE INDEX "assignment_rater_idx" ON "rating"."submissions" USING btree ("assignment_id","rater_id");
  CREATE INDEX "ratings_assignment_idx" ON "rating"."ratings" USING btree ("assignment_id");
  CREATE INDEX "ratings_rater_idx" ON "rating"."ratings" USING btree ("rater_id");
  CREATE INDEX "ratings_ratee_idx" ON "rating"."ratings" USING btree ("ratee_id");
  CREATE INDEX "ratings_criterion_idx" ON "rating"."ratings" USING btree ("criterion_id");
  CREATE INDEX "ratings_updated_at_idx" ON "rating"."ratings" USING btree ("updated_at");
  CREATE INDEX "ratings_created_at_idx" ON "rating"."ratings" USING btree ("created_at");
  CREATE UNIQUE INDEX "assignment_rater_ratee_criterion_idx" ON "rating"."ratings" USING btree ("assignment_id","rater_id","ratee_id","criterion_id");
  CREATE INDEX "otps_email_idx" ON "rating"."otps" USING btree ("email");
  CREATE INDEX "otps_ip_idx" ON "rating"."otps" USING btree ("ip");
  CREATE INDEX "otps_updated_at_idx" ON "rating"."otps" USING btree ("updated_at");
  CREATE INDEX "otps_created_at_idx" ON "rating"."otps" USING btree ("created_at");
  CREATE INDEX "sessions_user_idx" ON "rating"."sessions" USING btree ("user_id");
  CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "rating"."sessions" USING btree ("token_hash");
  CREATE INDEX "sessions_updated_at_idx" ON "rating"."sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "rating"."sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "rating"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "rating"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "rating"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "rating"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "rating"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "rating"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "rating"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_terms_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("terms_id");
  CREATE INDEX "payload_locked_documents_rels_criteria_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("criteria_id");
  CREATE INDEX "payload_locked_documents_rels_teams_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("teams_id");
  CREATE INDEX "payload_locked_documents_rels_assignments_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("assignments_id");
  CREATE INDEX "payload_locked_documents_rels_submissions_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("submissions_id");
  CREATE INDEX "payload_locked_documents_rels_ratings_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("ratings_id");
  CREATE INDEX "payload_locked_documents_rels_otps_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("otps_id");
  CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" ON "rating"."payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX "payload_preferences_key_idx" ON "rating"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "rating"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "rating"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "rating"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "rating"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "rating"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "rating"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "rating"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "rating"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "rating"."users" CASCADE;
  DROP TABLE "rating"."terms" CASCADE;
  DROP TABLE "rating"."criteria" CASCADE;
  DROP TABLE "rating"."teams" CASCADE;
  DROP TABLE "rating"."teams_rels" CASCADE;
  DROP TABLE "rating"."assignments" CASCADE;
  DROP TABLE "rating"."submissions" CASCADE;
  DROP TABLE "rating"."ratings" CASCADE;
  DROP TABLE "rating"."otps" CASCADE;
  DROP TABLE "rating"."sessions" CASCADE;
  DROP TABLE "rating"."payload_kv" CASCADE;
  DROP TABLE "rating"."payload_locked_documents" CASCADE;
  DROP TABLE "rating"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "rating"."payload_preferences" CASCADE;
  DROP TABLE "rating"."payload_preferences_rels" CASCADE;
  DROP TABLE "rating"."payload_migrations" CASCADE;
  DROP TYPE "rating"."enum_users_role";
  DROP TYPE "rating"."enum_submissions_status";`)
}
