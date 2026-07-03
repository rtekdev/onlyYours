import { getTranslations, setRequestLocale } from "next-intl/server";

import { signIn } from "@/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/** Only same-origin relative paths are accepted — prevents open redirects. */
function sanitizeCallbackUrl(raw: string | undefined): string | undefined {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return undefined;
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { callbackUrl, error } = await searchParams;
  const t = await getTranslations("auth");

  const redirectTo = sanitizeCallbackUrl(callbackUrl) ?? `/${locale}/dashboard`;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        Only Yours
      </Link>
      <Card className="w-full max-w-md animate-card-enter">
        <CardHeader>
          <CardTitle>{t("signInTitle")}</CardTitle>
          <CardDescription>{t("signInSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{t("error")}</AlertDescription>
            </Alert>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <GoogleMark />
              {t("signInWithGoogle")}
            </Button>
          </form>
          <p className="text-xs text-muted">{t("sessionNote")}</p>
        </CardContent>
      </Card>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81"
      />
    </svg>
  );
}
