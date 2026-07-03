import { ListChecks, Lock, ShieldAlert, ShieldCheck, StickyNote, Workflow } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const userId = session!.user.id; // layout guarantees a session

  const [t, format, noteCount, scenarioCount, vaultItemCount, automationCount, security, recentNotes, recentScenarios] =
    await Promise.all([
      getTranslations("dashboard"),
      getFormatter(),
      prisma.note.count({ where: { userId, deletedAt: null } }),
      prisma.scenario.count({ where: { userId } }),
      prisma.vaultItem.count({ where: { vault: { userId } } }),
      prisma.automation.count({ where: { userId } }),
      prisma.userSecurity.findUnique({ where: { userId }, select: { totpEnabledAt: true } }),
      prisma.note.findMany({
        where: { userId, deletedAt: null, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { id: true, title: true, updatedAt: true },
      }),
      prisma.scenario.findMany({
        where: { userId, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
    ]);

  const mfaEnabled = Boolean(security?.totpEnabledAt);

  const stats = [
    { label: t("stats.notes"), value: noteCount, icon: StickyNote, href: "/notes" },
    { label: t("stats.scenarios"), value: scenarioCount, icon: ListChecks, href: "/scenarios" },
    { label: t("stats.vaultItems"), value: vaultItemCount, icon: Lock, href: "/vault" },
    { label: t("stats.automations"), value: automationCount, icon: Workflow, href: "/automations" },
  ] as const;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={session?.user.name ? t("welcome", { name: session.user.name.split(" ")[0] }) : t("welcomeAnonymous")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={href} href={href}>
            <Card className="animate-card-enter transition-colors hover:bg-surface-hover">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none">{value}</p>
                  <p className="mt-1 text-xs text-muted">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="animate-card-enter lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mfaEnabled ? (
                <ShieldCheck className="size-4 text-success" aria-hidden />
              ) : (
                <ShieldAlert className="size-4 text-warning" aria-hidden />
              )}
              {t("securityCard.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">{mfaEnabled ? t("securityCard.mfaOn") : t("securityCard.mfaOff")}</p>
            {!mfaEnabled ? (
              <Link href="/settings/security" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                {t("securityCard.cta")}
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card className="animate-card-enter">
          <CardHeader>
            <CardTitle>{t("recentNotes")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-muted">{t("emptyRecent")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {recentNotes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={{ pathname: "/notes", query: { open: note.id } }}
                      className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-hover"
                    >
                      <span className="truncate">{note.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {format.relativeTime(note.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="animate-card-enter">
          <CardHeader>
            <CardTitle>{t("recentScenarios")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentScenarios.length === 0 ? (
              <p className="text-sm text-muted">{t("emptyRecent")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {recentScenarios.map((scenario) => (
                  <li key={scenario.id}>
                    <Link
                      href={`/scenarios/${scenario.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-hover"
                    >
                      <span className="truncate">{scenario.title}</span>
                      <Badge variant={scenario.status === "ACTIVE" ? "primary" : "default"}>
                        {scenario.status === "ACTIVE" ? "●" : "○"}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
