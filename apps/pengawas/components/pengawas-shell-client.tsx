"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopUtilities } from "@seleksi/ui";
import { LayoutDashboard, LogOut, MonitorCheck, PanelLeftClose, PanelLeftOpen, Printer, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { roleName } from "@/lib/access";
import { AppLogo } from "@/components/app-logo";

type MenuItem = { href: string; label: string; icon: LucideIcon };

const menu: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/monitoring", label: "Monitoring Ujian", icon: MonitorCheck },
  { href: "/print-reports", label: "Cetak BA & Laporan", icon: Printer },
];

type User = { name: string; email: string; roles: string[] };

function supervisorUsername(email: string) {
  return email.endsWith("@pengawas.local") ? email.replace("@pengawas.local", "") : email;
}

export function PengawasShellClient({ children, title, subtitle, user }: { children: ReactNode; title: string; subtitle: string; user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const visibleMenu = useMemo(() => menu, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("seleksi-pengawas-sidebar-hidden");
    setSidebarHidden(saved === "true");
  }, []);

  function toggleSidebar() {
    setSidebarHidden((current) => {
      const next = !current;
      window.localStorage.setItem("seleksi-pengawas-sidebar-hidden", String(next));
      return next;
    });
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className={`admin-root ${sidebarHidden ? "sidebar-hidden" : ""}`}>
      <aside className="admin-sidebar" aria-hidden={sidebarHidden}>
        <div className="admin-brand">
          <div className="brand-mark"><AppLogo /></div>
          <div><strong>Olimpiade Fisika Pengawas</strong><span>Monitoring • Catatan • Cetak</span></div>
        </div>
        <nav className="sidebar-nav" aria-label="Menu pengawas">
          <span className="sidebar-group-label">Portal Pengawas</span>
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link className={`sidebar-link ${active ? "is-active" : ""}`} href={item.href} tabIndex={sidebarHidden ? -1 : 0} key={item.href}>
                <Icon size={19} /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <strong>{user.name}</strong>
          <div className="sidebar-user-email">{supervisorUsername(user.email)}</div>
          <div className="sidebar-role-list">
            {user.roles.filter((role) => ["EXAM_SUPERVISOR", "EXAM_ADMIN", "SUPER_ADMIN"].includes(role)).slice(0, 2).map((role) => <span className="sidebar-role" key={role}>{roleName(role)}</span>)}
          </div>
          <button type="button" className="sidebar-logout" onClick={logout} disabled={isLoggingOut}>
            <LogOut size={16} /> {isLoggingOut ? "Keluar..." : "Keluar"}
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button type="button" className="utility-button sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarHidden ? "Tampilkan sidebar" : "Sembunyikan sidebar"} aria-pressed={sidebarHidden}>
              {sidebarHidden ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <div><h1>{title}</h1><p>{subtitle}</p></div>
          </div>
          <TopUtilities />
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
