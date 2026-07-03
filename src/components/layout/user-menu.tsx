"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  name: string | null;
  email: string | null;
  image: string | null;
  signOutAction: () => Promise<void>;
}

export function UserMenu({ name, email, image, signOutAction }: UserMenuProps) {
  const t = useTranslations("auth");
  const initial = (name ?? email ?? "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-2.5 px-2 py-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar from Google, tiny, no optimization needed
            <img src={image} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary-strong">
              {initial}
            </span>
          )}
          <span className="flex min-w-0 flex-col items-start">
            <span className="w-full truncate text-sm font-medium text-foreground">{name ?? email}</span>
            {name && email ? <span className="w-full truncate text-xs text-muted">{email}</span> : null}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => void signOutAction()}>
          <LogOut aria-hidden />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
