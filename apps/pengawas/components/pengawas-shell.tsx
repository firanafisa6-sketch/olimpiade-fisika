import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, SUPERVISOR_ALLOWED_ROLES } from "@/lib/access";
import { PengawasShellClient } from "./pengawas-shell-client";

export async function PengawasShell({
  children,
  title,
  subtitle,
  allowedRoles = [...SUPERVISOR_ALLOWED_ROLES],
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  allowedRoles?: string[];
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canAccess(user.roles, allowedRoles)) redirect("/?access=denied");

  return (
    <PengawasShellClient title={title} subtitle={subtitle} user={{ name: user.name, email: user.email, roles: user.roles }}>
      {children}
    </PengawasShellClient>
  );
}
