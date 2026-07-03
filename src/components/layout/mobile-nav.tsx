"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface MobileNavProps {
  name: string | null;
  email: string | null;
  image: string | null;
  signOutAction: () => Promise<void>;
}

export function MobileNav(props: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          Only Yours
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-border px-3 py-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
          <div className="mt-3 border-t border-border pt-3">
            <UserMenu {...props} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
