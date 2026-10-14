-- Optional for deployments that disable TypeORM synchronize.
-- The existing project has synchronize=true, which creates this automatically.
-- App startup seeds missing presets WITHOUT overwriting admin-customized rows.
CREATE TABLE IF NOT EXISTS "site_theme" (
  "id" varchar(32) PRIMARY KEY,
  "light" jsonb NOT NULL,
  "dark" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
