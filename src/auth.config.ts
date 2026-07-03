import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Base Auth.js config, kept adapter-free so the proxy (edge-friendly, no
// database) can instantiate it too. The full config with the Prisma adapter
// lives in src/auth.ts.
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    // Localized sign-in page; next-intl proxy rewrites to /{locale}/login.
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // A per-session identifier for server-side step-up (MFA) grants.
        // Rotating on each sign-in means MFA elevation never outlives the
        // session that earned it.
        token.sid = crypto.randomUUID();
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.sid = typeof token.sid === "string" ? token.sid : undefined;
      return session;
    },
  },
} satisfies NextAuthConfig;
