"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopUtilities } from "@seleksi/ui";
import {
  LayoutDashboard,
  ClipboardList,
  FileQuestion,
  ShieldCheck,
  PackageCheck,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Workflow,
  ClipboardCheck,
  UploadCloud,
  GraduationCap,
  BarChart3,
  UserCog,
  CalendarDays,
  MonitorCheck,
  Printer,
  FileDown,
  Code2,
  MonitorPlay,
  Calculator,
  type LucideIcon
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { canAccess, roleName } from "@/lib/access";
import { AppLogo } from "@/components/app-logo";

type MenuItem = { href: string; label: string; icon: LucideIcon; roles: string[]; group?: string };

const menu: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["BLUEPRINT_AUTHOR", "QUESTION_AUTHOR", "QUESTION_VALIDATOR", "EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/workflow", label: "Alur Kerja", icon: Workflow, roles: ["BLUEPRINT_AUTHOR", "QUESTION_AUTHOR", "QUESTION_VALIDATOR", "EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/assignments", label: "Plotting Tugas", icon: ClipboardCheck, roles: ["EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/blueprints", label: "Kisi-kisi", icon: ClipboardList, roles: ["BLUEPRINT_AUTHOR", "SUPER_ADMIN"] },
  { href: "/questions", label: "Tulis Soal", icon: FileQuestion, roles: ["QUESTION_AUTHOR", "SUPER_ADMIN"] },
  { href: "/simulations", label: "Simulasi Soal", icon: MonitorPlay, roles: ["BLUEPRINT_AUTHOR", "QUESTION_AUTHOR", "QUESTION_VALIDATOR", "EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/reviews", label: "Validasi Soal", icon: ShieldCheck, roles: ["QUESTION_VALIDATOR", "SUPER_ADMIN"] },
  { href: "/packages", label: "Buat Paket", icon: PackageCheck, roles: ["EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/question-exports", label: "Export Soal", icon: FileDown, roles: ["EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/analytics", label: "Nilai & Parameter Soal", icon: BarChart3, roles: ["EXAM_ADMIN", "SUPER_ADMIN"] },
  { href: "/imports", label: "Upload Kisi-kisi & Soal", icon: UploadCloud, roles: ["SUPER_ADMIN"] },
  { href: "/users", label: "User", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Pengaturan", icon: Settings, roles: ["SUPER_ADMIN"], group: "Sistem" },
  { href: "/developer", label: "Pengembang", icon: Code2, roles: ["BLUEPRINT_AUTHOR", "QUESTION_AUTHOR", "QUESTION_VALIDATOR", "EXAM_ADMIN", "SUPER_ADMIN"], group: "Sistem" },
  { href: "/participants", label: "Peserta Ujian", icon: GraduationCap, roles: ["EXAM_ADMIN", "SUPER_ADMIN"], group: "Operasional Ujian" },
  { href: "/supervisors", label: "Pengawas", icon: UserCog, roles: ["EXAM_ADMIN", "SUPER_ADMIN"], group: "Operasional Ujian" },
  { href: "/exam-sessions", label: "Sesi Ujian & Ruang", icon: CalendarDays, roles: ["EXAM_ADMIN", "SUPER_ADMIN"], group: "Operasional Ujian" },
  { href: "/monitoring", label: "Monitoring Ujian", icon: MonitorCheck, roles: ["EXAM_ADMIN", "SUPER_ADMIN"], group: "Operasional Ujian" },
  { href: "/scoring", label: "Penskoran & Publikasi", icon: Calculator, roles: ["EXAM_ADMIN", "SUPER_ADMIN"], group: "Operasional Ujian" },
  { href: "/print-reports", label: "Cetak BA & Laporan", icon: Printer, roles: ["EXAM_ADMIN", "SUPER_ADMIN"], group: "Operasional Ujian" }
];

type AdminUser = {
  name: string;
  email: string;
  roles: string[];
};

export function AdminShellClient({
  children,
  title,
  subtitle,
  user
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  user: AdminUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const visibleMenu = useMemo(() => menu.filter((item) => canAccess(user.roles, item.roles)), [user.roles]);

  useEffect(() => {
    const saved = window.localStorage.getItem("seleksi-sidebar-hidden");
    setSidebarHidden(saved === "true");
  }, []);

  function toggleSidebar() {
    setSidebarHidden((current) => {
      const next = !current;
      window.localStorage.setItem("seleksi-sidebar-hidden", String(next));
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
          <div><strong>Olimpiade Fisika</strong><span>Kisi • Penulisan • Validasi</span></div>
        </div>
        <nav className="sidebar-nav" aria-label="Menu utama">
          {visibleMenu.map((item, index) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const showGroup = item.group && visibleMenu.findIndex((entry) => entry.group === item.group) === index;
            return (
              <Fragment key={item.href}>
                {showGroup ? <span className="sidebar-group-label">{item.group}</span> : null}
                <Link className={`sidebar-link ${active ? "is-active" : ""}`} href={item.href} tabIndex={sidebarHidden ? -1 : 0}>
                  <Icon size={19} /><span>{item.label}</span>
                </Link>
              </Fragment>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <strong>{user.name}</strong>
          <div className="sidebar-user-email">{user.email}</div>
          <div className="sidebar-role-list">
            {user.roles.slice(0, 2).map((role) => <span className="sidebar-role" key={role}>{roleName(role)}</span>)}
          </div>
          <button type="button" className="sidebar-logout" onClick={logout} disabled={isLoggingOut}>
            <LogOut size={16} /> {isLoggingOut ? "Keluar..." : "Keluar"}
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="utility-button sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarHidden ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
              aria-pressed={sidebarHidden}
            >
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
