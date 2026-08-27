// Resolve (ou cria) a conta do cliente a partir do e-mail, sem senha.
//
// Era código interno da reserva manual do admin. Virou compartilhado porque é
// exatamente o que a compra sem cadastro precisa: a especificação pede que o
// cliente não seja obrigado a criar conta antes de pagar, mas `bookings.user_id`
// é `not null references auth.users` e TODO o RLS de reservas, pagamentos e
// passageiros depende dele.
//
// A saída é criar a conta nos bastidores: do ponto de vista de quem compra não
// existe cadastro (nenhuma senha, nenhum formulário a mais), e tecnicamente a
// reserva continua tendo dono — nenhuma policy precisa ser afrouxada. O acesso
// posterior é pelo magic link que o site já usa.

export class CustomerAccountError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "CustomerAccountError";
    this.statusCode = statusCode;
  }
}

export type CustomerInput = {
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

// Fallback para o caso raro de existir auth.users SEM users_profiles (ex.: o
// perfil falhou de ser criado num login social). Pagina de verdade: a versão
// anterior pedia uma página de 1000 e desistia, então acima disso a conta
// existente não era encontrada e a criação falhava em looping.
const PAGE_SIZE = 200;
const MAX_PAGES = 50; // 10 mil contas; acima disso o custo não compensa varrer

const findAuthUserByEmail = async (
  admin: any,
  email: string
): Promise<string | null> => {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) return null;

    const users = data?.users ?? [];
    const match = users.find(
      (user: any) => (user.email ?? "").toLowerCase() === email
    );
    if (match) return match.id;

    // Última página: veio menos gente do que cabia.
    if (users.length < PAGE_SIZE) return null;
  }
  return null;
};

// Retorna o auth.users id do cliente: usa o informado, procura por e-mail ou
// cria a conta sem senha, garantindo o users_profiles para a reserva aparecer
// em /account/bookings.
export const resolveCustomerUserId = async (
  admin: any,
  input: CustomerInput
): Promise<string> => {
  if (input.user_id) return input.user_id;

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;

  if (!email) {
    throw new CustomerAccountError("E-mail do cliente é obrigatório.", 400);
  }

  // Caminho normal: o perfil tem e-mail único e indexado.
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
    throw new CustomerAccountError(
      `Não foi possível criar a conta do cliente: ${createError.message}`,
      400
    );
  }

  throw new CustomerAccountError(
    "Não foi possível criar a conta do cliente.",
    500
  );
};
