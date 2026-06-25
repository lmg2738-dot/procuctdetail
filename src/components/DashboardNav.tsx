"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, Sparkles } from "lucide-react";

export default function DashboardNav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "새로 만들기", icon: Plus },
    { href: "/dashboard", label: "내 작업함", icon: LayoutDashboard },
  ];

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="page-shell">
        <div className="flex items-center justify-between h-[4.25rem]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-ink)] text-[var(--color-accent-light)] shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <span className="block text-[0.9375rem] font-bold tracking-tight text-[var(--color-ink)]">
                DetailMaster
              </span>
              <span className="block text-[0.6875rem] font-medium tracking-wide text-[var(--color-ink-faint)]">
                AI Commerce Studio
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border)]">
            {links.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-white text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
