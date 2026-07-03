import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { routing } from "@/i18n/routing";

// Next 16 proxy (successor of middleware.ts). Two responsibilities:
//  1. locale negotiation/redirects (next-intl),
//  2. coarse redirect-to-login for app routes without a session cookie.
//
// This is a UX layer only — real authorization happens server-side in every
// page/action via requireUser()/requireMfa() (see src/lib/security/guards.ts).
// The adapter-free auth config keeps Prisma out of this bundle.

const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/notes",
  "/scenarios",
  "/vault",
  "/automations",
  "/integrations",
  "/settings",
];

const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

export default auth((request) => {
  const { nextUrl } = request;
  const localeMatch = nextUrl.pathname.match(localePattern);
  const locale = localeMatch?.[1] ?? routing.defaultLocale;
  const pathWithoutLocale = nextUrl.pathname.replace(localePattern, "") || "/";

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathWithoutLocale === prefix || pathWithoutLocale.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.auth) {
    const loginUrl = new URL(`/${locale}/login`, nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathWithoutLocale === "/login" && request.auth) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
  }

  return intlMiddleware(request);
});

export const config = {
  // Skip API routes, Next internals and static assets.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
