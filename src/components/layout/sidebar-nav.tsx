"use client";

import {
  LayoutDashboard,
  ListChecks,
  Lock,
  Plug,
  Settings,
  StickyNote,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: "dashboard" | "notes" | "scenarios" | "vault" | "automations" | "integrations" | "security";
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/notes", labelKey: "notes", icon: StickyNote },
  { href: "/scenarios", labelKey: "scenarios", icon: ListChecks },
  { href: "/vault", labelKey: "vault", icon: Lock },
  { href: "/automations", labelKey: "automations", icon: Workflow },
  { href: "/integrations", labelKey: "integrations", icon: Plug },
  { href: "/settings/security", labelKey: "security", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary-strong"
                : "text-muted hover:bg-surface-hover hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4" aria-hidden />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
