"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    // Digest only — never render or log raw error details in the client.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{t("errors.generic")}</h1>
      <Button variant="secondary" onClick={reset}>
        {t("common.retry")}
      </Button>
    </main>
  );
}
