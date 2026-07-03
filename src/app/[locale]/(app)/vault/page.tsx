import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { VaultClient } from "@/components/vault/vault-client";
import { getVaultData, getVaultStatus } from "@/server/actions/vault";

export default async function VaultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("vault");

  const statusResult = await getVaultStatus();
  const status = statusResult.ok
    ? statusResult.data
    : { hasVault: false, mfaEnabled: false, mfaVerified: false };

  // With an active step-up grant the encrypted payload can be fetched
  // server-side right away (getVaultData records the audit event). The
  // client still cannot show anything without the master password.
  const dataResult =
    status.hasVault && status.mfaVerified ? await getVaultData() : null;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <VaultClient initialStatus={status} initialData={dataResult?.ok ? dataResult.data : null} />
    </>
  );
}
