import type { NextApiRequest, NextApiResponse } from "next";
import {
  CustomerAccountError,
  resolveCustomerUserId,
} from "../../../../lib/auth/customerAccount";
import { requireStaff } from "../../../../lib/server/adminAuth";
import { checkRateLimit } from "../../../../lib/server/rateLimit";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

// POST /api/admin/clients/create — cadastra UMA pessoa na agenda.
//
// POR QUE EXISTE: até aqui só havia dois jeitos de criar cliente — planilha ou
// reserva. Quem atende no balcão e só quer guardar o contato tinha que inventar
// uma venda ou montar um CSV de uma linha.
//
// PRECISA SER SERVIDOR: quando a pessoa tem e-mail, cadastrá-la significa criar
// conta de autenticação, e isso só o service role faz. A tela do navegador não
// tem — nem deve ter — essa chave. E pelo RLS, inserir em users_profiles pelo
// navegador só funcionaria para admin: `operacoes` não tem policy de INSERT.
//
// POR QUE ADMIN **E** OPERAÇÕES, diferente de clients/import.ts:
// aquele arquivo é admin-only porque importar planilha é construir a base, e o
// comentário dele diz isso. Cadastrar uma pessoa no balcão é outra coisa — é
// rotina de atendimento. E não concede poder novo: `operacoes` JÁ cria cliente
// hoje, implicitamente, toda vez que monta uma reserva manual
// (api/admin/bookings/create.ts usa os mesmos dois papéis e chama o mesmo
// resolveCustomerUserId). Isto só tira a exigência de inventar uma reserva
// para conseguir guardar um contato.

type Corpo = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  document?: unknown;
  birth_date?: unknown;
  contact_origin?: unknown;
};

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const staff = await requireStaff(req, res, ["admin", "operacoes"]);
  if (!staff) return;

  const limite = checkRateLimit(`admin-clients-create:${staff.userId}`, {
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!limite.allowed) {
    res.setHeader("Retry-After", String(limite.retryAfterSeconds));
    return res.status(429).json({
      error: "Muitos cadastros seguidos. Aguarde um instante.",
    });
  }

  const corpo = (req.body ?? {}) as Corpo;
  const nome = texto(corpo.name);
  const email = texto(corpo.email).toLowerCase();
  const telefone = texto(corpo.phone);
  const documento = texto(corpo.document);
  const nascimento = texto(corpo.birth_date);
  // De onde veio este contato. É o que permite responder, depois, por que
  // aquela pessoa está na base — a mesma razão pela qual a importação exige.
  const origem = texto(corpo.contact_origin) || "cadastro manual";

  if (!nome) {
    return res.status(400).json({ error: "O nome é obrigatório." });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }

  const admin = createSupabaseAdminClient() as any;

  try {
    // COM E-MAIL: mesmo caminho da importação e da reserva manual. Se já existe
    // ficha com este e-mail, resolveCustomerUserId ADOTA em vez de duplicar —
    // e devolve o dono. Por isso não há checagem de duplicata aqui: ela está
    // dentro dele, e é a mesma dos outros dois caminhos.
    if (email) {
      const idDaConta = await resolveCustomerUserId(admin, {
        user_id: null,
        name: nome,
        email,
        phone: telefone || null,
      });

      // Documento e nascimento não passam por resolveCustomerUserId: ela cuida
      // de identidade, não de cadastro. Só grava o que veio preenchido — célula
      // vazia não apaga dado bom.
      const extras: Record<string, unknown> = { contact_origin: origem };
      if (documento) extras.document = documento;
      if (nascimento) extras.birth_date = nascimento;

      const { data: perfil, error } = await admin
        .from("users_profiles")
        .update(extras)
        .eq("user_id", idDaConta)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return res.status(201).json({ client: perfil, criou_conta: true });
    }

    // SEM E-MAIL: entra só na agenda, sem conta de autenticação. É o cliente
    // antigo — a pessoa existe para a equipe encontrar e reconhecer, e não
    // enxerga nada no site porque não tem login.
    //
    // O email fica NULL de propósito, e não vazio: a constraint
    // users_profiles_orfao_sem_email_check exige que perfil sem dono não tenha
    // e-mail, porque órfão COM e-mail é reivindicável por quem provar aquele
    // endereço.
    const { data: perfil, error } = await admin
      .from("users_profiles")
      .insert({
        user_id: null,
        name: nome,
        email: null,
        phone: telefone || null,
        document: documento || null,
        birth_date: nascimento || null,
        role: "customer",
        // Quem é cadastrado pela equipe não pediu nada. Sem isto, o cron de
        // aniversário passaria a mandar WhatsApp e e-mail para alguém que
        // nunca autorizou.
        marketing_opt_in: false,
        contact_origin: origem,
      })
      .select("*")
      .single();

    if (error) throw error;
    return res.status(201).json({ client: perfil, criou_conta: false });
  } catch (erro) {
    if (erro instanceof CustomerAccountError) {
      return res.status(erro.statusCode).json({ error: erro.message });
    }
    console.error("admin client create failed", erro);
    return res
      .status(500)
      .json({ error: "Não foi possível cadastrar o cliente." });
  }
};

export default handler;
