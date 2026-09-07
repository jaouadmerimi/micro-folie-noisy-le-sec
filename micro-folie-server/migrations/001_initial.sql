CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL
);

CREATE TABLE "workshops" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"capacity" integer NOT NULL,
	"min_age" integer NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "capacity_positive" CHECK("workshops"."capacity" BETWEEN 1 AND 500),
	CONSTRAINT "workshop_status" CHECK("workshops"."status" IN ('draft','published','archived'))
);

CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamptz,
	"refresh_token_expires_at" timestamptz,
	"scope" text,
	"password" text,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
);

CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
);

CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL
);

CREATE TABLE "admins" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"created_by" text NOT NULL
);

CREATE TABLE "audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"consumed" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "news" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"image_key" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"published_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);

CREATE TABLE "reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"workshop_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"participants" integer NOT NULL,
	"status" text NOT NULL,
	"hold_until" text NOT NULL,
	"token_hash" text NOT NULL,
	"request_key" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "participants_range" CHECK("reservations"."participants" BETWEEN 1 AND 10),
	CONSTRAINT "reservation_status" CHECK("reservations"."status" IN ('pending','waitlist','confirmed','refused','cancelled'))
);

CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_id" text,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"locked_until" text DEFAULT '' NOT NULL,
	FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" text NOT NULL
);

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);

CREATE INDEX "account_user" ON "account" ("user_id");
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "invitations" ("token_hash");
CREATE INDEX "news_publication" ON "news" ("status","published_at");
CREATE INDEX "outbox_pending" ON "outbox" ("status","locked_until");
CREATE UNIQUE INDEX "reservations_reference_unique" ON "reservations" ("reference");
CREATE UNIQUE INDEX "reservations_token_hash_unique" ON "reservations" ("token_hash");
CREATE UNIQUE INDEX "reservations_request_key_unique" ON "reservations" ("request_key");
CREATE INDEX "reservations_workshop" ON "reservations" ("workshop_id","status","hold_until");
CREATE UNIQUE INDEX "session_token_unique" ON "session" ("token");
CREATE INDEX "session_user" ON "session" ("user_id");
CREATE UNIQUE INDEX "user_email_unique" ON "user" ("email");
CREATE INDEX "verification_identifier" ON "verification" ("identifier");
CREATE INDEX "workshops_date" ON "workshops" ("status","starts_at");

CREATE TABLE files (key text PRIMARY KEY, content_type text NOT NULL, data bytea NOT NULL CHECK (octet_length(data) <= 3145728));
