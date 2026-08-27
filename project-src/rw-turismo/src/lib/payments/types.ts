export type PaymentStatus =
  | "pending"
  // Pix emitido, transferência ainda não caiu. Estado que só existe porque
  // método assíncrono conclui a sessão antes de o dinheiro entrar.
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled"
  | "requires_review";

export type CreateCheckoutInput = {
  booking_id: string;
  user_id: string;
  // Compra sem cadastro: o retorno da Stripe precisa levar o token, senão o
  // cliente cai numa tela de login logo depois de pagar.
  is_guest?: boolean;
};

export type CreateCheckoutResult = {
  checkout_url: string;
};

export type InternalStripeMetadata = {
  booking_id: string;
  payment_id: string;
  user_id: string;
  source: "internal_booking";
};

export type ConfirmInternalPaymentResult = {
  booking_id?: string;
  payment_id?: string;
  status:
    | "confirmed"
    | "processing"
    | "duplicate"
    | "ignored"
    | "requires_review";
  reason?: string;
};

export type HandleInternalPaymentNegativeEventResult = {
  booking_id?: string;
  payment_id?: string;
  status: "expired" | "updated" | "duplicate" | "skipped" | "ignored";
  slots_released?: boolean;
  reason?: string;
};
