export const SUPERVISOR_ALLOWED_ROLES = ["EXAM_SUPERVISOR", "EXAM_ADMIN", "SUPER_ADMIN"] as const;

export function roleName(code: string) {
  const names: Record<string, string> = {
    EXAM_SUPERVISOR: "Pengawas Ujian",
    EXAM_ADMIN: "Admin Ujian",
    SUPER_ADMIN: "Super Admin"
  };
  return names[code] ?? code;
}

export function canAccess(userRoles: string[], allowedRoles: string[]) {
  return userRoles.includes("SUPER_ADMIN") || allowedRoles.some((role) => userRoles.includes(role));
}

export function canUsePengawasApp(userRoles: string[]) {
  return canAccess(userRoles, [...SUPERVISOR_ALLOWED_ROLES]);
}
