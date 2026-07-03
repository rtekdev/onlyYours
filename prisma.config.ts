// Prisma CLI configuration (migrations, studio, validate).
// import "dotenv/config" is required — the Prisma CLI does not load .env
// files by itself anymore.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations must bypass connection poolers (PgBouncer/Supabase pooler),
    // so the CLI prefers DIRECT_URL when it is set. The app itself always
    // connects through DATABASE_URL (see src/lib/prisma.ts).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
