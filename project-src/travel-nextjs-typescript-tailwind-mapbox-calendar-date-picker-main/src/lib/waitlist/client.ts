import { createSupabaseBrowserClient } from "../supabase/browser";

export type JoinWaitlistInput = {
  product_id: string;
  product_date_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  travelers_count?: number;
};

// Entra na lista de espera de um pacote/saída. Aberto a visitantes (RLS
// permite insert anônimo com status pending); se houver sessão, vincula o
// user_id para o cliente acompanhar depois.
export const joinWaitlist = async (input: JoinWaitlistInput): Promise<void> => {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();

  const { error } = await (supabase as any).from("waitlist").insert({
    product_id: input.product_id,
    product_date_id: input.product_date_id ?? null,
    user_id: data.user?.id ?? null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    travelers_count:
      Number.isFinite(input.travelers_count) && (input.travelers_count ?? 0) > 0
        ? input.travelers_count
        : 1,
    status: "pending",
  });

  if (error) throw error;
};
