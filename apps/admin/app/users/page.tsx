import { AdminShell } from "@/components/admin-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ROLE_META, roleName } from "@/lib/access";
import { requiredText, optionalText } from "@/lib/db-helpers";
import { hashPassword, requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { Pencil, Trash2, UserPlus, Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function ensureRoles() {
  "use server";
  await requireActionUser(["SUPER_ADMIN"]);
  for (const role of ROLE_META) {
    await db.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: { code: role.code, name: role.name }
    });
  }
}

async function roleIdsFromForm(formData: FormData) {
  const codes = formData.getAll("roles").map(String).filter(Boolean);
  const safeCodes = codes.length ? codes : ["QUESTION_AUTHOR"];
  const roles = await db.role.findMany({ where: { code: { in: safeCodes } } });
  return roles.map((role) => role.id);
}

async function createUser(formData: FormData) {
  "use server";
  await requireActionUser(["SUPER_ADMIN"]);
  await ensureRoles();
  const email = requiredText(formData, "email").toLowerCase();
  const password = requiredText(formData, "password");
  const roleIds = await roleIdsFromForm(formData);

  await db.user.create({
    data: {
      name: requiredText(formData, "name"),
      email,
      passwordHash: hashPassword(password),
      isActive: formData.get("isActive") === "on",
      roles: { create: roleIds.map((roleId) => ({ roleId })) }
    }
  });
  revalidatePath("/users");
}

async function updateUser(formData: FormData) {
  "use server";
  await requireActionUser(["SUPER_ADMIN"]);
  await ensureRoles();
  const id = requiredText(formData, "id");
  const password = optionalText(formData, "password");
  const roleIds = await roleIdsFromForm(formData);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        name: requiredText(formData, "name"),
        email: requiredText(formData, "email").toLowerCase(),
        isActive: formData.get("isActive") === "on",
        ...(password ? { passwordHash: hashPassword(password) } : {})
      }
    });
    await tx.userRole.deleteMany({ where: { userId: id } });
    if (roleIds.length) {
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
    }
  });
  revalidatePath("/users");
}

async function deleteUser(formData: FormData) {
  "use server";
  const currentUser = await requireActionUser(["SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  if (currentUser?.id === id) throw new Error("Akun yang sedang login tidak boleh dihapus dari menu ini.");

  try {
    await db.user.delete({ where: { id } });
  } catch {
    await db.user.update({ where: { id }, data: { isActive: false } });
  }
  revalidatePath("/users");
}

type PageProps = { searchParams?: Promise<{ page?: string; size?: string }> };

export default async function UsersPage({ searchParams }: PageProps) {
  await requirePageUser(["SUPER_ADMIN"]);
  await ensureRoles();
  const params = await searchParams;
  const totalUsers = await db.user.count();
  const pagination = paginationWindow(totalUsers, parsePage(params?.page), parsePageSize(params?.size));
  const [users, roles] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      ...(pagination.take ? { take: pagination.take } : {}),
      include: { roles: { include: { role: true } } }
    }),
    db.role.findMany({ where: { code: { in: ROLE_META.map((role) => role.code) } }, orderBy: { code: "asc" } })
  ]);

  return (
    <AdminShell
      title="User"
      subtitle="Super admin menambah, mengedit, menghapus, dan mengatur role user"
      allowedRoles={["SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <h2>Manajemen user</h2>
          <p>Gunakan role sesuai tugas: penulis kisi-kisi, penulis soal, validator soal, admin ujian, dan super admin.</p>
        </div>
        <span className="badge">Super Admin</span>
      </div>

      <section className="crud-grid">
        <form action={createUser} className="card panel form-grid">
          <div className="panel-heading"><h3><UserPlus size={18} /> Tambah user</h3></div>
          <label className="field-block"><span className="field-label">Nama</span><input className="text-input" name="name" required /></label>
          <label className="field-block"><span className="field-label">Email</span><input className="text-input" name="email" type="email" required /></label>
          <label className="field-block"><span className="field-label">Password awal</span><input className="text-input" name="password" type="password" minLength={8} required /></label>
          <div className="checkbox-panel"><span className="field-label">Role</span>{roles.map((role) => <label className="check-row" key={role.id}><input type="checkbox" name="roles" value={role.code} defaultChecked={role.code === "QUESTION_AUTHOR"} /> {roleName(role.code)}</label>)}</div>
          <label className="check-row"><input type="checkbox" name="isActive" defaultChecked /> User aktif</label>
          <button className="primary-button" type="submit">Simpan user</button>
        </form>

        <section className="card panel data-table-wrap">
          <div className="panel-heading"><h3><Users size={18} /> Daftar user</h3><span className="badge">{totalUsers} akun</span></div>
          <table className="data-table">
            <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const selected = new Set(user.roles.map((item) => item.role.code));
                return (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td>{user.roles.length ? user.roles.map((item) => <span className="role-pill" key={item.role.code}>{roleName(item.role.code)}</span>) : <span className="muted-text">Belum ada role</span>}</td>
                    <td><span className={`badge ${user.isActive ? "" : "warning"}`}>{user.isActive ? "Aktif" : "Nonaktif"}</span></td>
                    <td className="table-actions">
                      <details className="action-details">
                        <summary className="secondary-button"><Pencil size={15} /> Edit</summary>
                        <form action={updateUser} className="inline-edit-form form-grid">
                          <input type="hidden" name="id" value={user.id} />
                          <label className="field-block"><span className="field-label">Nama</span><input className="text-input" name="name" defaultValue={user.name} required /></label>
                          <label className="field-block"><span className="field-label">Email</span><input className="text-input" name="email" type="email" defaultValue={user.email} required /></label>
                          <label className="field-block"><span className="field-label">Password baru</span><input className="text-input" name="password" type="password" minLength={8} placeholder="Kosongkan jika tidak diganti" /></label>
                          <div className="checkbox-panel"><span className="field-label">Role</span>{roles.map((role) => <label className="check-row" key={role.id}><input type="checkbox" name="roles" value={role.code} defaultChecked={selected.has(role.code)} /> {roleName(role.code)}</label>)}</div>
                          <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /> User aktif</label>
                          <button className="primary-button" type="submit">Simpan perubahan</button>
                        </form>
                      </details>
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={user.id} />
                        <button className="danger-button" type="submit"><Trash2 size={15} /> Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationControls
            basePath="/users"
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={totalUsers}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            itemLabel="user"
          />
        </section>
      </section>
    </AdminShell>
  );
}
