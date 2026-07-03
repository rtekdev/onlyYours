import { getTranslations, setRequestLocale } from "next-intl/server";

import { AutomationsClient } from "@/components/automations/automations-client";
import { PageHeader } from "@/components/layout/page-header";
import { listAutomations } from "@/server/actions/automations";

export default async function AutomationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("automations");

  const result = await listAutomations();

  return (
    <>
      <PageHeader title={t("title")} />
      <AutomationsClient automations={result.ok ? result.data : []} />
    </>
  );
}
