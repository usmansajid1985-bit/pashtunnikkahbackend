"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  IdCard,
  CreditCard,
  MessageSquareHeart,
  MessagesSquare,
  Flag,
  Menu,
  ImageIcon,
  Images,
  Bell,
  Megaphone,
  UserCog,
  LogOut,
  ListChecks,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/app/login/actions";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/profiles", label: "Profiles", icon: IdCard },
  { href: "/photos", label: "Photos", icon: ImageIcon },
  { href: "/homepage", label: "Homepage", icon: Images },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/requests", label: "Requests", icon: MessageSquareHeart },
  { href: "/chats", label: "Chats", icon: MessagesSquare },
  { href: "/notifications", label: "Push log", icon: Bell },
  { href: "/wali", label: "Wali", icon: UserCog },
  { href: "/reports", label: "Reports", icon: Flag },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/roadmap", label: "Roadmap", icon: ListChecks },
  { href: "/account", label: "Account", icon: UserCog },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-1">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pashtun Nikah</p>
      <h1 className="font-heading text-xl font-medium mt-0.5">Admin</h1>
    </div>
  );
}

function AccountFooter({ email }: { email?: string | null }) {
  if (!email) return null;
  return (
    <div className="mt-auto pt-6 px-1">
      <p className="text-xs font-medium text-foreground truncate">{email}</p>
      <form action={logout} className="mt-2">
        <button
          type="submit"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          Log out
        </button>
      </form>
    </div>
  );
}

export function AdminShell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6">
        <Brand />
        <Separator className="my-5" />
        <NavLinks />
        <AccountFooter email={adminEmail} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/90 backdrop-blur px-4 py-3">
          <Brand />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Open menu" />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="px-0">
                <SheetTitle className="font-heading text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-6 px-0">
                <AccountFooter email={adminEmail} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 p-5 sm:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
