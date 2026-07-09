import { createSupabaseBrowserClient } from "../supabase/browser";
import type { BookingStatus, PaymentStatus } from "../bookings/types";
import type { Category, Product, ProductDate, ProductType } from "../products/types";

export type ProductFormValues = {
  title: string;
  slug: string;
  description: string;
  type: ProductType;
  destination: string;
  origin: string;
  price: number;
  promotional_price: number | null;
  cover_image: string;
  gallery: string[];
  active: boolean;
};

export type ProductDateFormValues = {
  product_id: string;
  start_date: string;
  end_date: string;
  available_slots: number;
  price_override: number | null;
  active: boolean;
};

export type CategoryFormValues = {
  name: string;
  slug: string;
  active: boolean;
};

export type ProductDateWithProduct = ProductDate & {
  products?: {
    title: string;
  } | null;
};

export type AdminBooking = {
  id: string;
  user_id: string;
  product_id: string;
  product_date_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  travelers_count: number;
  total_amount: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  slots_released: boolean;
  created_at: string;
  updated_at: string;
  products?: {
    title: string;
    destination: string;
    cover_image: string | null;
  } | null;
  product_dates?: {
    start_date: string;
    end_date: string;
    available_slots?: number;
  } | null;
};

export type AdminPayment = {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  bookings?: {
    id: string;
    customer_name: string;
    customer_email: string;
    status: BookingStatus;
    payment_status: PaymentStatus;
    products?: {
      title: string;
      destination: string;
    } | null;
  } | null;
};

export type AdminPassenger = {
  id: string;
  booking_id: string;
  full_name: string;
  document: string | null;
  birth_date: string | null;
  type: string;
  checked_in_at?: string | null;
  seat_number?: string | null;
  room_label?: string | null;
  created_at: string;
};

export type AdminSystemLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminBookingDetail = AdminBooking & {
  payments: AdminPayment[];
  passengers: AdminPassenger[];
  logs: AdminSystemLog[];
};

export type AdminPaymentDetail = AdminPayment & {
  logs: AdminSystemLog[];
};

const supabase = () => createSupabaseBrowserClient() as any;

const throwIfError = (error: unknown) => {
  if (error) throw error;
};

export const listAdminProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase()
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data ?? []) as Product[];
};

export const getAdminProduct = async (id: string): Promise<Product | null> => {
  const { data, error } = await supabase()
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfError(error);
  return data as Product | null;
};

export const createAdminProduct = async (
  values: ProductFormValues
): Promise<Product> => {
  const { data, error } = await supabase()
    .from("products")
    .insert(values)
    .select("*")
    .single();

  throwIfError(error);
  return data as Product;
};

export const updateAdminProduct = async (
  id: string,
  values: ProductFormValues
): Promise<Product> => {
  const { data, error } = await supabase()
    .from("products")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return data as Product;
};

export const deleteAdminProduct = async (id: string): Promise<void> => {
  const { error } = await supabase().from("products").delete().eq("id", id);
  throwIfError(error);
};

export const listAdminProductDates = async (): Promise<ProductDateWithProduct[]> => {
  const { data, error } = await supabase()
    .from("product_dates")
    .select("*, products(title)")
    .order("start_date", { ascending: true });

  throwIfError(error);
  return (data ?? []) as ProductDateWithProduct[];
};

export const getAdminProductDate = async (
  id: string
): Promise<ProductDate | null> => {
  const { data, error } = await supabase()
    .from("product_dates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfError(error);
  return data as ProductDate | null;
};

export const createAdminProductDate = async (
  values: ProductDateFormValues
): Promise<ProductDate> => {
  const { data, error } = await supabase()
    .from("product_dates")
    .insert(values)
    .select("*")
    .single();

  throwIfError(error);
  return data as ProductDate;
};

export const updateAdminProductDate = async (
  id: string,
  values: ProductDateFormValues
): Promise<ProductDate> => {
  const { data, error } = await supabase()
    .from("product_dates")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return data as ProductDate;
};

export const deleteAdminProductDate = async (id: string): Promise<void> => {
  const { error } = await supabase().from("product_dates").delete().eq("id", id);
  throwIfError(error);
};

export const listAdminCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase()
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  throwIfError(error);
  return (data ?? []) as Category[];
};

export const createAdminCategory = async (
  values: CategoryFormValues
): Promise<Category> => {
  const { data, error } = await supabase()
    .from("categories")
    .insert(values)
    .select("*")
    .single();

  throwIfError(error);
  return data as Category;
};

export const updateAdminCategory = async (
  id: string,
  values: CategoryFormValues
): Promise<Category> => {
  const { data, error } = await supabase()
    .from("categories")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return data as Category;
};

export const deleteAdminCategory = async (id: string): Promise<void> => {
  const { error } = await supabase().from("categories").delete().eq("id", id);
  throwIfError(error);
};

export const getAdminLogsByEntity = async (
  entity: string,
  entityId: string
): Promise<AdminSystemLog[]> => {
  const { data, error } = await supabase()
    .from("system_logs")
    .select("*")
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data ?? []) as AdminSystemLog[];
};

export const getAdminBookings = async (): Promise<AdminBooking[]> => {
  const { data, error } = await supabase()
    .from("bookings")
    .select(
      "*, products(title, destination, cover_image), product_dates(start_date, end_date, available_slots)"
    )
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data ?? []) as AdminBooking[];
};

export const getAdminBookingById = async (
  id: string
): Promise<AdminBookingDetail | null> => {
  const { data: booking, error: bookingError } = await supabase()
    .from("bookings")
    .select(
      "*, products(title, destination, cover_image), product_dates(start_date, end_date, available_slots)"
    )
    .eq("id", id)
    .maybeSingle();

  throwIfError(bookingError);

  if (!booking) {
    return null;
  }

  const [paymentsResult, passengersResult, logs] = await Promise.all([
    supabase()
      .from("payments")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    supabase()
      .from("passengers")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: true }),
    getAdminLogsByEntity("booking", id),
  ]);

  throwIfError(paymentsResult.error);
  throwIfError(passengersResult.error);

  return {
    ...(booking as AdminBooking),
    payments: (paymentsResult.data ?? []) as AdminPayment[],
    passengers: (passengersResult.data ?? []) as AdminPassenger[],
    logs,
  };
};

export const getAdminPayments = async (): Promise<AdminPayment[]> => {
  const { data, error } = await supabase()
    .from("payments")
    .select(
      "*, bookings(id, customer_name, customer_email, status, payment_status, products(title, destination))"
    )
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data ?? []) as AdminPayment[];
};

// ---------------------------------------------------------------------------
// Fase 1 — Operação: saídas, passageiros/check-in, aniversariantes e busca
// paginada de reservas.
// ---------------------------------------------------------------------------

export type AdminDeparture = ProductDate & {
  products?: {
    title: string;
    destination: string;
    origin?: string | null;
  } | null;
};

export type DeparturePassenger = AdminPassenger & {
  bookings?: {
    id: string;
    status: BookingStatus;
    payment_status: PaymentStatus;
    customer_name: string;
    customer_phone: string | null;
    product_date_id: string;
  } | null;
};

export const listAdminDepartures = async (
  includePast = false
): Promise<AdminDeparture[]> => {
  let query = supabase()
    .from("product_dates")
    .select("*, products(title, destination, origin)")
    .order("start_date", { ascending: !includePast });

  if (!includePast) {
    query = query.gte("end_date", new Date().toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []) as AdminDeparture[];
};

export const getAdminDeparture = async (
  id: string
): Promise<AdminDeparture | null> => {
  const { data, error } = await supabase()
    .from("product_dates")
    .select("*, products(title, destination, origin)")
    .eq("id", id)
    .maybeSingle();

  throwIfError(error);
  return data as AdminDeparture | null;
};

// Pax reservados (pendentes + confirmados) por saída, para a lista de saídas.
export const getDepartureBookingTotals = async (): Promise<
  Record<string, number>
> => {
  const { data, error } = await supabase()
    .from("bookings")
    .select("product_date_id, travelers_count, status");

  throwIfError(error);

  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as {
    product_date_id: string;
    travelers_count: number;
    status: BookingStatus;
  }[]) {
    if (row.status !== "pending" && row.status !== "confirmed") continue;
    totals[row.product_date_id] =
      (totals[row.product_date_id] ?? 0) + row.travelers_count;
  }
  return totals;
};

export const listDeparturePassengers = async (
  productDateId: string
): Promise<DeparturePassenger[]> => {
  const { data, error } = await supabase()
    .from("passengers")
    .select(
      "*, bookings!inner(id, status, payment_status, customer_name, customer_phone, product_date_id)"
    )
    .eq("bookings.product_date_id", productDateId)
    .order("full_name", { ascending: true });

  throwIfError(error);

  const rows = (data ?? []) as DeparturePassenger[];
  return rows.filter(
    (row) =>
      row.bookings &&
      row.bookings.status !== "cancelled" &&
      row.bookings.status !== "expired"
  );
};

export const setAdminPassengerCheckin = async (
  id: string,
  checkedIn: boolean
): Promise<void> => {
  const { error } = await supabase()
    .from("passengers")
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq("id", id);

  throwIfError(error);
};

export type BirthdayPerson = {
  name: string;
  birth_date: string;
  phone: string | null;
  source: "passageiro" | "cliente";
};

export const listBirthdayPeople = async (): Promise<BirthdayPerson[]> => {
  const people: BirthdayPerson[] = [];

  const { data: pax, error: paxError } = await supabase()
    .from("passengers")
    .select("full_name, birth_date, bookings(customer_phone)")
    .not("birth_date", "is", null);
  throwIfError(paxError);
  for (const row of (pax ?? []) as {
    full_name: string;
    birth_date: string;
    bookings?: { customer_phone: string | null } | null;
  }[]) {
    people.push({
      name: row.full_name,
      birth_date: row.birth_date,
      phone: row.bookings?.customer_phone ?? null,
      source: "passageiro",
    });
  }

  // Clientes: a coluna birth_date chega com a migration da Fase 1 — se ainda
  // não existir no banco, seguimos só com os passageiros.
  try {
    const { data: clients, error: clientsError } = await supabase()
      .from("users_profiles")
      .select("name, phone, birth_date")
      .not("birth_date", "is", null);
    if (!clientsError) {
      for (const row of (clients ?? []) as {
        name: string | null;
        phone: string | null;
        birth_date: string | null;
      }[]) {
        if (row.name && row.birth_date) {
          people.push({
            name: row.name,
            birth_date: row.birth_date,
            phone: row.phone ?? null,
            source: "cliente",
          });
        }
      }
    }
  } catch {
    // coluna ausente — ignora até a migration rodar
  }

  return people;
};

export type AdminBookingSearch = {
  status?: BookingStatus | "all";
  paymentStatus?: PaymentStatus | "all";
  search?: string;
  page?: number;
  limit?: number;
};

export const searchAdminBookings = async (
  q: AdminBookingSearch = {}
): Promise<{ bookings: AdminBooking[]; count: number }> => {
  const limit = q.limit ?? 25;
  const page = Math.max(q.page ?? 1, 1);

  let query = supabase()
    .from("bookings")
    .select(
      "*, products(title, destination, cover_image), product_dates(start_date, end_date, available_slots)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (q.status && q.status !== "all") {
    query = query.eq("status", q.status);
  }
  if (q.paymentStatus && q.paymentStatus !== "all") {
    query = query.eq("payment_status", q.paymentStatus);
  }
  const term = (q.search ?? "").replace(/[(),%]/g, " ").trim();
  if (term) {
    query = query.or(
      `customer_name.ilike.%${term}%,customer_email.ilike.%${term}%`
    );
  }

  const { data, error, count } = await query;
  throwIfError(error);
  return { bookings: (data ?? []) as AdminBooking[], count: count ?? 0 };
};

export const getAdminPaymentById = async (
  id: string
): Promise<AdminPaymentDetail | null> => {
  const { data: payment, error: paymentError } = await supabase()
    .from("payments")
    .select(
      "*, bookings(id, customer_name, customer_email, status, payment_status, products(title, destination))"
    )
    .eq("id", id)
    .maybeSingle();

  throwIfError(paymentError);

  if (!payment) {
    return null;
  }

  const logs = await getAdminLogsByEntity("payment", id);

  return {
    ...(payment as AdminPayment),
    logs,
  };
};

// ---------------------------------------------------------------------------
// Fase 1B — Clientes, fornecedores e lista de espera.
// ---------------------------------------------------------------------------

export type AdminClient = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  birth_date?: string | null;
  document?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminClientSearch = {
  search?: string;
  page?: number;
  limit?: number;
};

export const searchAdminClients = async (
  q: AdminClientSearch = {}
): Promise<{ clients: AdminClient[]; count: number }> => {
  const limit = q.limit ?? 25;
  const page = Math.max(q.page ?? 1, 1);

  let query = supabase()
    .from("users_profiles")
    .select("*", { count: "exact" })
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  const term = (q.search ?? "").replace(/[(),%]/g, " ").trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error, count } = await query;
  throwIfError(error);
  return { clients: (data ?? []) as AdminClient[], count: count ?? 0 };
};

export const getAdminClient = async (
  id: string
): Promise<AdminClient | null> => {
  const { data, error } = await supabase()
    .from("users_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfError(error);
  return data as AdminClient | null;
};

export const updateAdminClient = async (
  id: string,
  values: {
    name?: string | null;
    phone?: string | null;
    birth_date?: string | null;
    document?: string | null;
  }
): Promise<AdminClient> => {
  const { data, error } = await supabase()
    .from("users_profiles")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return data as AdminClient;
};

// Total de reservas (qualquer status) por usuário, para a lista de clientes.
export const getClientBookingCounts = async (): Promise<
  Record<string, number>
> => {
  const { data, error } = await supabase().from("bookings").select("user_id");
  throwIfError(error);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { user_id: string }[]) {
    counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
  }
  return counts;
};

export const listClientBookings = async (
  userId: string
): Promise<AdminBooking[]> => {
  const { data, error } = await supabase()
    .from("bookings")
    .select(
      "*, products(title, destination, cover_image), product_dates(start_date, end_date)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data ?? []) as AdminBooking[];
};

export type Supplier = {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplierFormValues = {
  name: string;
  category: string;
  contact_name: string;
  phone: string;
  email: string;
  city: string;
  notes: string;
  active: boolean;
};

export const listAdminSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase()
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });

  throwIfError(error);
  return (data ?? []) as Supplier[];
};

export const createAdminSupplier = async (
  values: SupplierFormValues
): Promise<Supplier> => {
  const { data, error } = await supabase()
    .from("suppliers")
    .insert(values)
    .select("*")
    .single();

  throwIfError(error);
  return data as Supplier;
};

export const updateAdminSupplier = async (
  id: string,
  values: SupplierFormValues
): Promise<Supplier> => {
  const { data, error } = await supabase()
    .from("suppliers")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return data as Supplier;
};

export const deleteAdminSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase().from("suppliers").delete().eq("id", id);
  throwIfError(error);
};

export type WaitlistStatus =
  | "pending"
  | "contacted"
  | "converted"
  | "cancelled";

export type WaitlistEntry = {
  id: string;
  product_id: string;
  product_date_id: string | null;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  travelers_count: number;
  status: WaitlistStatus;
  notes: string | null;
  created_at: string;
  products?: { title: string } | null;
  product_dates?: { start_date: string; end_date: string } | null;
};

export const listAdminWaitlist = async (
  status: WaitlistStatus | "all" = "all"
): Promise<WaitlistEntry[]> => {
  let query = supabase()
    .from("waitlist")
    .select("*, products(title), product_dates(start_date, end_date)")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []) as WaitlistEntry[];
};

export const updateAdminWaitlistStatus = async (
  id: string,
  status: WaitlistStatus
): Promise<void> => {
  const { error } = await supabase()
    .from("waitlist")
    .update({ status })
    .eq("id", id);
  throwIfError(error);
};

export const deleteAdminWaitlist = async (id: string): Promise<void> => {
  const { error } = await supabase().from("waitlist").delete().eq("id", id);
  throwIfError(error);
};

// ---------------------------------------------------------------------------
// Fase 2 — Logística da saída: assentos, quartos e transfers.
// ---------------------------------------------------------------------------

export const setPassengerSeat = async (
  id: string,
  seatNumber: string | null
): Promise<void> => {
  const { error } = await supabase()
    .from("passengers")
    .update({ seat_number: seatNumber })
    .eq("id", id);
  throwIfError(error);
};

export const setPassengerRoom = async (
  id: string,
  roomLabel: string | null
): Promise<void> => {
  const { error } = await supabase()
    .from("passengers")
    .update({ room_label: roomLabel })
    .eq("id", id);
  throwIfError(error);
};

export const updateDepartureTotalSeats = async (
  productDateId: string,
  totalSeats: number | null
): Promise<void> => {
  const { error } = await supabase()
    .from("product_dates")
    .update({ total_seats: totalSeats })
    .eq("id", productDateId);
  throwIfError(error);
};

export type Transfer = {
  id: string;
  product_date_id: string;
  title: string;
  transfer_date: string | null;
  transfer_time: string | null;
  meeting_point: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle: string | null;
  supplier_id: string | null;
  capacity: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: { name: string } | null;
};

export type TransferFormValues = {
  title: string;
  transfer_date: string;
  transfer_time: string;
  meeting_point: string;
  driver_name: string;
  driver_phone: string;
  vehicle: string;
  supplier_id: string;
  capacity: number | null;
  notes: string;
};

const transferPayload = (
  productDateId: string,
  values: TransferFormValues
) => ({
  product_date_id: productDateId,
  title: values.title.trim(),
  transfer_date: values.transfer_date || null,
  transfer_time: values.transfer_time || null,
  meeting_point: values.meeting_point.trim() || null,
  driver_name: values.driver_name.trim() || null,
  driver_phone: values.driver_phone.trim() || null,
  vehicle: values.vehicle.trim() || null,
  supplier_id: values.supplier_id || null,
  capacity: values.capacity,
  notes: values.notes.trim() || null,
});

export const listDepartureTransfers = async (
  productDateId: string
): Promise<Transfer[]> => {
  const { data, error } = await supabase()
    .from("transfers")
    .select("*, suppliers(name)")
    .eq("product_date_id", productDateId)
    .order("transfer_date", { ascending: true })
    .order("transfer_time", { ascending: true });

  throwIfError(error);
  return (data ?? []) as Transfer[];
};

export const createAdminTransfer = async (
  productDateId: string,
  values: TransferFormValues
): Promise<Transfer> => {
  const { data, error } = await supabase()
    .from("transfers")
    .insert(transferPayload(productDateId, values))
    .select("*, suppliers(name)")
    .single();

  throwIfError(error);
  return data as Transfer;
};

export const updateAdminTransfer = async (
  id: string,
  productDateId: string,
  values: TransferFormValues
): Promise<Transfer> => {
  const { data, error } = await supabase()
    .from("transfers")
    .update(transferPayload(productDateId, values))
    .eq("id", id)
    .select("*, suppliers(name)")
    .single();

  throwIfError(error);
  return data as Transfer;
};

export const deleteAdminTransfer = async (id: string): Promise<void> => {
  const { error } = await supabase().from("transfers").delete().eq("id", id);
  throwIfError(error);
};
