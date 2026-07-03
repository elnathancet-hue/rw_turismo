import { createSupabaseBrowserClient } from "../supabase/browser";
import type { BookingStatus, PaymentStatus } from "../bookings/types";
import type { Category, Product, ProductDate, ProductType } from "../products/types";

export type ProductFormValues = {
  title: string;
  slug: string;
  description: string;
  type: ProductType;
  destination: string;
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
