import { setRequestLocale } from "next-intl/server";

import { auth, signOut } from "@/auth";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Link, redirect } from "@/i18n/navigation";

// Server-side session guard for the whole authenticated area. The proxy
// already redirects unauthenticated traffic, but this check is the actual
// security boundary — proxies are UX, layouts and actions are enforcement.
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-background/60 backdrop-blur-sm md:flex">
        <div className="flex items-center justify-between px-4 py-5">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            Only Yours
          </Link>
          <LocaleSwitcher />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav />
        </div>
        <div className="border-t border-border p-3">
          <UserMenu
            name={session.user.name ?? null}
            email={session.user.email ?? null}
            image={session.user.image ?? null}
            signOutAction={signOutAction}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          name={session.user.name ?? null}
          email={session.user.email ?? null}
          image={session.user.image ?? null}
          signOutAction={signOutAction}
        />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
