import { createSupabaseAdminClient } from "../supabase/admin";
import { isStaffRole, ROLE_LABELS, type StaffRole } from "../auth/roles";

// Camada server-side dos "usuários do sistema" (equipe com acesso ao /admin).
// Criar conta exige Supabase Auth Admin API, então usa SEMPRE o service role —
// mesmo desenho de lib/admin/manualBookings.ts. Toda ação entra em system_logs.
//
// Regras de segurança que valem para qualquer chamada daqui:
//   - ninguém altera o próprio papel nem desativa a própria conta;
//   - a agência nunca fica sem nenhum admin ativo;
//   - senha nunca é escrita em log.

export class AdminUserError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AdminUserError";
    this.statusCode = statusCode;
  }
}

export type StaffUser = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateStaffUserInput = {
  adminId: string;
  name: string;
  email: string;
  password: string;
  // Chega cru da requisição; assertValidRole valida e estreita para StaffRole.
  role: string;
  phone?: string | null;
};

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const admin = () => createSupabaseAdminClient() as any;

const logAction = async (
  adminId: string,
  action: string,
  profileId: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const { error } = await admin().from("system_logs").insert({
    user_id: adminId,
    action,
    entity: "users_profiles",
    entity_id: profileId,
    metadata,
  });

  // Log é auditoria, não pode derrubar a operação em si.
  if (error) {
    console.error("admin users log failed", { action, error });
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const assertValidRole = (role: string): StaffRole => {
  if (!isStaffRole(role)) {
    throw new AdminUserError("Papel inválido.", 400);
  }
  return role;
};

const assertValidPassword = (password: string) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AdminUserError(
      `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      400
    );
  }
};

export const listStaffUsers = async (): Promise<StaffUser[]> => {
  const { data, error } = await admin()
    .from("users_profiles")
    .select("*")
    .neq("role", "customer")
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminUserError(
      "Não foi possível carregar os usuários do sistema.",
      500
    );
  }

  return ((data ?? []) as StaffUser[]).map((row) => ({
    ...row,
    active: row.active !== false,
  }));
};

const getStaffUserById = async (id: string): Promise<StaffUser> => {
  const { data, error } = await admin()
    .from("users_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new AdminUserError("Não foi possível carregar o usuário.", 500);
  }
  if (!data) {
    throw new AdminUserError("Usuário não encontrado.", 404);
  }
  if (!isStaffRole((data as StaffUser).role)) {
    throw new AdminUserError(
      "Este perfil é de cliente, não de usuário do sistema.",
      400
    );
  }

  const row = data as StaffUser;
  return { ...row, active: row.active !== false };
};

const getProfileByEmail = async (email: string): Promise<StaffUser | null> => {
  const { data, error } = await admin()
    .from("users_profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new AdminUserError("Não foi possível verificar o e-mail.", 500);
  }

  return (data as StaffUser | null) ?? null;
};

const countActiveAdmins = async (): Promise<number> => {
  const { count, error } = await admin()
    .from("users_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true);

  if (error) {
    throw new AdminUserError(
      "Não foi possível conferir os administradores ativos.",
      500
    );
  }

  return count ?? 0;
};

// Impede o cenário em que a agência perde o último acesso total ao painel.
const assertNotLastActiveAdmin = async (target: StaffUser) => {
  if (target.role !== "admin" || target.active !== true) return;

  if ((await countActiveAdmins()) <= 1) {
    throw new AdminUserError(
      "Este é o único administrador ativo. Promova outra pessoa a Administrador antes de alterar este acesso.",
      409
    );
  }
};

const assertNotSelf = (adminId: string, target: StaffUser, action: string) => {
  if (target.user_id === adminId) {
    throw new AdminUserError(`Você não pode ${action} na sua própria conta.`, 409);
  }
};

export const createStaffUser = async ({
  adminId,
  name,
  email,
  password,
  role,
  phone,
}: CreateStaffUserInput): Promise<{ user: StaffUser; promoted: boolean }> => {
  const staffRole = assertValidRole(role);
  assertValidPassword(password);

  const cleanName = (name ?? "").trim();
  if (cleanName.length < 2) {
    throw new AdminUserError("Informe o nome da pessoa.", 400);
  }

  const cleanEmail = normalizeEmail(email ?? "");
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw new AdminUserError("E-mail inválido.", 400);
  }

  const cleanPhone = (phone ?? "").trim() || null;
  const existing = await getProfileByEmail(cleanEmail);

  // E-mail já é da equipe: nada a criar.
  if (existing && isStaffRole(existing.role)) {
    throw new AdminUserError(
      `${cleanEmail} já é usuário do sistema (${ROLE_LABELS[existing.role]}).`,
      409
    );
  }

  // E-mail já tem conta de cliente no site (funcionário que também viaja com a
  // agência). Em vez de travar, promove a conta existente e registra no log —
  // a senha atual dele continua valendo, então não trocamos a senha aqui.
  if (existing) {
    const { data, error } = await admin()
      .from("users_profiles")
      .update({ role: staffRole, active: true, name: cleanName || existing.name })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw new AdminUserError("Não foi possível promover a conta existente.", 500);
    }

    await logAction(adminId, "admin_promote_user", existing.id, {
      email: cleanEmail,
      previous_role: existing.role,
      new_role: staffRole,
    });

    return { user: { ...(data as StaffUser), active: true }, promoted: true };
  }

  const { data: created, error: createError } = await admin().auth.admin.createUser({
    email: cleanEmail,
    password,
    // Conta de equipe é criada pelo próprio admin: já nasce confirmada para a
    // pessoa poder entrar na hora, sem depender de e-mail chegar.
    email_confirm: true,
    user_metadata: { name: cleanName },
  });

  if (createError || !created?.user) {
    const message = String(createError?.message ?? "");
    if (/already been registered|already exists/i.test(message)) {
      throw new AdminUserError(
        "Este e-mail já tem login no sistema, mas sem perfil. Peça para a pessoa entrar uma vez e tente de novo.",
        409
      );
    }
    throw new AdminUserError(
      message || "Não foi possível criar o acesso.",
      400
    );
  }

  const authUserId = created.user.id as string;

  const { data: profile, error: profileError } = await admin()
    .from("users_profiles")
    .insert({
      user_id: authUserId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: staffRole,
      active: true,
    })
    .select("*")
    .single();

  // Sem perfil o login existiria sem papel nenhum — desfaz para não deixar
  // conta órfã no Auth e permitir que o admin tente de novo.
  if (profileError || !profile) {
    await admin().auth.admin.deleteUser(authUserId);
    throw new AdminUserError(
      "Acesso criado mas o perfil falhou. Nada foi salvo, tente novamente.",
      500
    );
  }

  await logAction(adminId, "admin_create_user", (profile as StaffUser).id, {
    email: cleanEmail,
    role: staffRole,
  });

  return { user: { ...(profile as StaffUser), active: true }, promoted: false };
};

export const updateStaffUser = async (
  adminId: string,
  id: string,
  values: { name?: string; phone?: string | null; role?: string }
): Promise<StaffUser> => {
  const target = await getStaffUserById(id);
  const payload: Record<string, unknown> = {};

  if (typeof values.name === "string") {
    const cleanName = values.name.trim();
    if (cleanName.length < 2) {
      throw new AdminUserError("Informe o nome da pessoa.", 400);
    }
    payload.name = cleanName;
  }

  if (values.phone !== undefined) {
    payload.phone = (values.phone ?? "").trim() || null;
  }

  if (values.role !== undefined && values.role !== target.role) {
    const nextRole = assertValidRole(values.role);
    assertNotSelf(adminId, target, "trocar o papel");
    await assertNotLastActiveAdmin(target);
    payload.role = nextRole;
  }

  if (Object.keys(payload).length === 0) {
    return target;
  }

  const { data, error } = await admin()
    .from("users_profiles")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new AdminUserError("Não foi possível salvar o usuário.", 500);
  }

  await logAction(adminId, "admin_update_user", id, {
    email: target.email,
    changed: Object.keys(payload),
    previous_role: target.role,
    new_role: payload.role ?? target.role,
  });

  const row = data as StaffUser;
  return { ...row, active: row.active !== false };
};

export const setStaffUserActive = async (
  adminId: string,
  id: string,
  active: boolean
): Promise<StaffUser> => {
  const target = await getStaffUserById(id);

  if (!active) {
    assertNotSelf(adminId, target, "desativar o acesso");
    await assertNotLastActiveAdmin(target);
  }

  const { data, error } = await admin()
    .from("users_profiles")
    .update({ active })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new AdminUserError("Não foi possível alterar o acesso.", 500);
  }

  await logAction(adminId, "admin_set_user_active", id, {
    email: target.email,
    role: target.role,
    active,
  });

  const row = data as StaffUser;
  return { ...row, active: row.active !== false };
};

export const resetStaffPassword = async (
  adminId: string,
  id: string,
  password: string
): Promise<void> => {
  assertValidPassword(password);
  const target = await getStaffUserById(id);

  const { error } = await admin().auth.admin.updateUserById(target.user_id, {
    password,
  });

  if (error) {
    throw new AdminUserError(
      error.message || "Não foi possível trocar a senha.",
      400
    );
  }

  // Só o fato fica registrado — a senha nunca entra no log.
  await logAction(adminId, "admin_reset_user_password", id, {
    email: target.email,
    role: target.role,
  });
};
