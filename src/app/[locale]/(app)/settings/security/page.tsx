import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { SecuritySettingsClient } from "@/components/security/security-settings-client";
import { getSecurityOverview } from "@/server/actions/mfa";

export default async function SecuritySettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("security");

  const overview = await getSecurityOverview();

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {overview.ok ? <SecuritySettingsClient overview={overview.data} /> : null}
    </>
  );
}
