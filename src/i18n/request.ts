import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

type Messages = Record<string, unknown>;

// English acts as the fallback dictionary: any key missing from a locale
// resolves to its English message instead of rendering a raw key.
function withEnglishFallback(base: Messages, overrides: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      existing !== null &&
      typeof existing === "object"
    ) {
      result[key] = withEnglishFallback(existing as Messages, value as Messages);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const english = (await import("../../messages/en.json")).default as Messages;
  const messages =
    locale === "en"
      ? english
      : withEnglishFallback(english, (await import(`../../messages/${locale}.json`)).default as Messages);

  return { locale, messages };
});
