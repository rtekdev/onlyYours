import { ListChecks, Lock, ShieldCheck, StickyNote, Workflow } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/auth";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user) {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("landing");
  const tFooter = await getTranslations("footer");

  const features = [
    { key: "notes", icon: StickyNote },
    { key: "vault", icon: Lock },
    { key: "scenarios", icon: ListChecks },
    { key: "automations", icon: Workflow },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Only Yours</span>
        <LocaleSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-14 text-center sm:pt-24">
        <Badge variant="primary" className="animate-card-enter">
          {t("badge")}
        </Badge>
        <h1 className="animate-card-enter mt-6 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          {t("title")}
        </h1>
        <p className="animate-card-enter mt-5 max-w-2xl text-balance text-base text-muted sm:text-lg">
          {t("subtitle")}
        </p>
        <div className="animate-card-enter mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            {t("cta")}
          </Link>
        </div>

        <div className="mt-20 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ key, icon: Icon }) => (
            <Card key={key} className="animate-card-enter text-left transition-colors hover:bg-surface-hover">
              <CardContent className="p-5">
                <Icon className="size-5 text-primary" aria-hidden />
                <h2 className="mt-3 font-medium">{t(`features.${key}.title`)}</h2>
                <p className="mt-1.5 text-sm text-muted">{t(`features.${key}.description`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6 w-full text-left">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <ShieldCheck className="size-8 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 className="font-medium">{t("security.title")}</h2>
              <p className="mt-1 text-sm text-muted">{t("security.description")}</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 border-t border-border px-6 py-6 text-xs text-muted sm:flex-row">
        <span>{tFooter("openSource")}</span>
        <span>{tFooter("selfHosted")}</span>
      </footer>
    </div>
  );
}
