import { CalendarDays, CalendarRange } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listIntegrations } from "@/server/actions/integrations";

const PROVIDERS = [
  { key: "GOOGLE_CALENDAR", icon: CalendarDays },
  { key: "MICROSOFT_CALENDAR", icon: CalendarRange },
] as const;

export default async function IntegrationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("integrations");

  const result = await listIntegrations();
  const connected = new Map((result.ok ? result.data : []).map((integration) => [integration.provider, integration]));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Alert variant="info" className="mb-4">
        <AlertDescription>{t("mfaNote")}</AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map(({ key, icon: Icon }) => {
          const integration = connected.get(key);
          return (
            <Card key={key} className="animate-card-enter">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{t(`providers.${key}.name`)}</h3>
                    {integration ? (
                      <Badge variant={integration.status === "CONNECTED" ? "success" : "warning"}>
                        {t(`status.${integration.status}`)}
                      </Badge>
                    ) : (
                      <Badge>{t("comingSoon")}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{t(`providers.${key}.description`)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
