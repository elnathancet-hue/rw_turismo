export type BookingStatus = "pending" | "confirmed" | "cancelled" | "expired";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled"
  | "requires_review";

export type CreatePendingBookingInput = {
  user_id: string;
  product_id: string;
  product_date_id: string;
  travelers_count: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
};

export type CreatePendingBookingResult = {
  booking_id: string;
  total_amount: number;
  expires_at: string;
};

export type ExpirePendingBookingResult = {
  booking_id: string;
  expired: boolean;
  slots_released: boolean;
};

export type BookingSummary = {
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
  } | null;
};
