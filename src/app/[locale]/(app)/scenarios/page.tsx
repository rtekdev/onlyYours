import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { ScenariosClient } from "@/components/scenarios/scenarios-client";
import { listScenarios } from "@/server/actions/scenarios";

export default async function ScenariosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("scenarios");

  const result = await listScenarios();

  return (
    <>
      <PageHeader title={t("title")} />
      <ScenariosClient scenarios={result.ok ? result.data : []} />
    </>
  );
}
