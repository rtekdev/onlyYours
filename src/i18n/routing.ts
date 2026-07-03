import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Polish-first with English fallback; adding a language = one entry here
  // plus a messages/<locale>.json file.
  locales: ["pl", "en"],
  defaultLocale: "pl",
});

export type AppLocale = (typeof routing.locales)[number];
