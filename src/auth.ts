import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// JWT session strategy + Prisma adapter: users/accounts persist in Postgres,
// while session state stays in an encrypted cookie (edge- and
// Cloudflare-friendly; no session table lookups per request).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
});
