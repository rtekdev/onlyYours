import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-5xl font-semibold text-muted">404</p>
      <h1 className="text-xl font-semibold">{t("errors.NOT_FOUND")}</h1>
      <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
        {t("nav.dashboard")}
      </Link>
    </main>
  );
}
