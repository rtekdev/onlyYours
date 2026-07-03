import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { ScenarioDetailClient } from "@/components/scenarios/scenario-detail-client";
import { getScenario } from "@/server/actions/scenarios";

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const result = await getScenario({ id });
  if (!result.ok) {
    notFound();
  }

  return <ScenarioDetailClient scenario={result.data} />;
}
