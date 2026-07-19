import { createSupabaseAdminClient } from "../supabase/admin";

// Camada server-side da operação manual de reservas (Fase 1). Envolve os RPCs
// security-definer (admin_create_booking, admin_confirm_manual_payment,
// admin_cancel_booking, admin_rebook), resolve o auth.users do cliente e mapeia
// os códigos de erro do Postgres para mensagens amigáveis — mesmo desenho de
// lib/bookings/createPendingBooking.ts. Usa SEMPRE o service role.

export class AdminBookingError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AdminBookingError";
    this.statusCode = statusCode;
  }
}

const RPC_ERRORS: Record<string, { message: string; status: number }> = {
  ADMIN_REQUIRED: { message: "Acesso restrito.", status: 403 },
  CUSTOMER_USER_REQUIRED: { message: "Cliente inválido.", status: 400 },
  PRODUCT_AND_DATE_REQUIRED: {
    message: "Produto e data são obrigatórios.",
    status: 400,
  },
  CUSTOMER_NAME_REQUIRED: {
    message: "Nome do cliente é obrigatório.",
    status: 400,
  },
  CUSTOMER_EMAIL_REQUIRED: {
    message: "E-mail do cliente é obrigatório.",
    status: 400,
  },
  INVALID_TRAVELERS_COUNT: {
    message: "Número de viajantes inválido.",
    status: 400,
  },
  INVALID_STATUS: { message: "Status inicial inválido.", status: 400 },
  INVALID_TOTAL: { message: "Valor total inválido.", status: 400 },
  INVALID_AMOUNT: { message: "Valor do pagamento inválido.", status: 400 },
  INVALID_METHOD: { message: "Método de pagamento inválido.", status: 400 },
  PRODUCT_NOT_AVAILABLE: { message: "Produto indisponível.", status: 404 },
  PRODUCT_DATE_NOT_AVAILABLE: { message: "Data indisponível.", status: 404 },
  PRODUCT_DATE_MISMATCH: {
    message: "A data não pertence ao produto.",
    status: 400,
  },
  PRODUCT_DATE_IN_PAST: { message: "A data selecionada já partiu.", status: 400 },
  NOT_ENOUGH_SLOTS: { message: "Vagas insuficientes na data.", status: 409 },
  BOOKING_ID_REQUIRED: { message: "Reserva inválida.", status: 400 },
  BOOKING_AND_DATE_REQUIRED: {
    message: "Reserva e nova data são obrigatórias.",
    status: 400,
  },
  BOOKING_NOT_FOUND: { message: "Reserva não encontrada.", status: 404 },
  BOOKING_NOT_ACTIVE: {
    message: "A reserva não está mais ativa.",
    status: 409,
  },
  ALREADY_PAID: { message: "Esta reserva já está paga.", status: 409 },
  SAME_DATE: { message: "Escolha uma data diferente da atual.", status: 400 },
};

const mapRpcError = (message: string): AdminBookingError => {
  for (const code of Object.keys(RPC_ERRORS)) {
    if (message.includes(code)) {
      return new AdminBookingError(RPC_ERRORS[code].message, RPC_ERRORS[code].status);
    }
  }
  return new AdminBookingError("Não foi possível concluir a operação.", 500);
};

const firstRow = (data: unknown) => (Array.isArray(data) ? data[0] : data);

// --- Resolução do cliente (auth.users) -------------------------------------

type CustomerInput = {
  user_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
};

const ensureProfile = async (
  admin: any,
  userId: string,
  customer: { name: string; email: string; phone: string | null }
) => {
  const { data: existing } = await admin
    .from("users_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  await admin.from("users_profiles").insert({
    user_id: userId,
    name: customer.name || null,
    email: customer.email,
    phone: customer.phone,
    role: "customer",
  });
};

const findAuthUserByEmail = async (
  admin: any,
  email: string
): Promise<string | null> => {
  // Fallback para o caso raro de existir auth.users sem users_profiles.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = (data?.users ?? []).find(
    (user: any) => (user.email ?? "").toLowerCase() === email
  );
  return match?.id ?? null;
};

// Retorna o auth.users id do cliente: usa o informado, procura por e-mail ou
// cria a conta (sem senha — o cliente acessa depois via "esqueci a senha"),
// garantindo o users_profiles para a reserva aparecer em /account/bookings.
const resolveCustomerUserId = async (
  admin: any,
  input: CustomerInput
): Promise<string> => {
  if (input.user_id) return input.user_id;

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;

  if (!email) {
    throw new AdminBookingError("E-mail do cliente é obrigatório.", 400);
  }

  const { data: existing } = await admin
    .from("users_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });

  if (created?.user) {
    await ensureProfile(admin, created.user.id, { name, email, phone });
    return created.user.id;
  }

  if (createError) {
    const recovered = await findAuthUserByEmail(admin, email);
    if (recovered) {
      await ensureProfile(admin, recovered, { name, email, phone });
      return recovered;
    }
    throw new AdminBookingError(
      `Não foi possível criar a conta do cliente: ${createError.message}`,
      400
    );
  }

  throw new AdminBookingError("Não foi possível criar a conta do cliente.", 500);
};

// --- Operações --------------------------------------------------------------

export type ManualPassengerInput = {
  full_name: string;
  document?: string | null;
  birth_date?: string | null;
  type: "adult" | "child" | "infant";
};

export type AdminCreateBookingInput = {
  admin_id: string;
  customer: CustomerInput;
  product_id: string;
  product_date_id: string;
  travelers_count: number;
  status: "pending" | "confirmed";
  total_override?: number | null;
  passengers?: ManualPassengerInput[];
};

export type AdminCreateBookingResult = {
  booking_id: string;
  total_amount: number;
  status: string;
  customer_user_id: string;
};

export const adminCreateBooking = async (
  input: AdminCreateBookingInput
): Promise<AdminCreateBookingResult> => {
  const admin = createSupabaseAdminClient() as any;

  const customerUserId = await resolveCustomerUserId(admin, input.customer);

  const { data, error } = await admin.rpc("admin_create_booking", {
    p_admin_id: input.admin_id,
    p_user_id: customerUserId,
    p_product_id: input.product_id,
    p_product_date_id: input.product_date_id,
    p_customer_name: input.customer.name,
    p_customer_email: input.customer.email,
    p_customer_phone: input.customer.phone ?? null,
    p_travelers_count: input.travelers_count,
    p_status: input.status,
    p_total_override: input.total_override ?? null,
  });

  if (error) throw mapRpcError(error.message);

  const row = firstRow(data);
  if (!row) throw new AdminBookingError("Não foi possível criar a reserva.", 500);

  const bookingId = row.booking_id as string;

  const passengers = (input.passengers ?? []).filter((p) => p.full_name?.trim());
  if (passengers.length > 0) {
    const { error: paxError } = await admin.from("passengers").insert(
      passengers.map((p) => ({
        booking_id: bookingId,
        full_name: p.full_name.trim(),
        document: p.document?.trim() || null,
        birth_date: p.birth_date || null,
        type: p.type,
      }))
    );
    // Passageiro é complementar — não desfaz a reserva se falhar.
    if (paxError) {
      console.error("Failed to insert manual booking passengers", paxError);
    }
  }

  return {
    booking_id: bookingId,
    total_amount: Number(row.total_amount),
    status: row.status as string,
    customer_user_id: customerUserId,
  };
};

export const adminConfirmManualPayment = async (input: {
  admin_id: string;
  booking_id: string;
  amount?: number | null;
  method: string;
  notes?: string | null;
}) => {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin.rpc("admin_confirm_manual_payment", {
    p_admin_id: input.admin_id,
    p_booking_id: input.booking_id,
    p_amount: input.amount ?? null,
    p_method: input.method,
    p_notes: input.notes ?? null,
  });

  if (error) throw mapRpcError(error.message);

  const row = firstRow(data);
  if (!row) {
    throw new AdminBookingError("Não foi possível confirmar o pagamento.", 500);
  }

  return {
    payment_id: row.payment_id as string,
    booking_id: row.booking_id as string,
    payment_status: row.payment_status as string,
    status: row.status as string,
  };
};

export const adminCancelBooking = async (input: {
  admin_id: string;
  booking_id: string;
  reason?: string | null;
}) => {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin.rpc("admin_cancel_booking", {
    p_admin_id: input.admin_id,
    p_booking_id: input.booking_id,
    p_reason: input.reason ?? null,
  });

  if (error) throw mapRpcError(error.message);

  const row = firstRow(data);
  if (!row) throw new AdminBookingError("Não foi possível cancelar a reserva.", 500);

  return {
    booking_id: row.booking_id as string,
    status: row.status as string,
    slots_released: Boolean(row.slots_released),
  };
};

export const adminRebook = async (input: {
  admin_id: string;
  booking_id: string;
  new_product_date_id: string;
}) => {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin.rpc("admin_rebook", {
    p_admin_id: input.admin_id,
    p_booking_id: input.booking_id,
    p_new_product_date_id: input.new_product_date_id,
  });

  if (error) throw mapRpcError(error.message);

  const row = firstRow(data);
  if (!row) throw new AdminBookingError("Não foi possível remarcar a reserva.", 500);

  return {
    booking_id: row.booking_id as string,
    old_product_date_id: row.old_product_date_id as string,
    new_product_date_id: row.new_product_date_id as string,
  };
};
