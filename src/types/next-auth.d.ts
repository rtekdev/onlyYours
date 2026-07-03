import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** Per-session id used to key server-side MFA step-up grants. */
    sid?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
  }
}
