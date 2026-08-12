import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/access";
import { AdminShellClient } from "./admin-shell-client";

export async function AdminShell({
  children,
  title,
  subtitle,
  allowedRoles,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  allowedRoles?: string[];
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (allowedRoles && !canAccess(user.roles, allowedRoles)) {
    redirect("/?access=denied");
  }

  return (
    <AdminShellClient
      title={title}
      subtitle={subtitle}
      user={{ name: user.name, email: user.email, roles: user.roles }}
    >
      {children}
    </AdminShellClient>
  );
}
