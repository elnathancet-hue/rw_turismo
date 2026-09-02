import type { NextApiRequest, NextApiResponse } from "next";
import {
  CustomerAccountError,
  resolveCustomerUserId,
} from "../../../../lib/auth/customerAccount";
import { validarCliente } from "../../../../lib/admin/validacaoCliente";
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
  /**
   * Confirmacao explicita de que o operador VIU que este e-mail ja tem ficha e
   * quer atualiza-la. Sem ela a rota recusa com 409 em vez de gravar por cima
   * — e a mesma regra da importacao, que so mexe em ficha existente quando o
   * operador marca "atualizar" (import.ts:190).
   */
  atualizar_existente?: unknown;
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

  // MESMAS REGRAS DA TELA, do mesmo modulo. Antes a rota so conferia o e-mail,
  // entao nome "A" com CPF "123" entrava por aqui mesmo com a tela consertada —
  // e quem chega por fora nao passa pela tela nenhuma.
  const erros = validarCliente({
    name: nome,
    email,
    phone: telefone,
    document: documento,
    birth_date: nascimento,
  });
  const primeiro = Object.entries(erros)[0];
  if (primeiro) {
    return res.status(400).json({ error: primeiro[1], campo: primeiro[0], erros });
  }

  const admin = createSupabaseAdminClient() as any;

  try {
    if (email) {
      // OLHAR ANTES DE ESCREVER.
      //
      // resolveCustomerUserId ADOTA a ficha existente e devolve o dono — o que
      // e certo para identidade, mas apaga a diferenca entre "criei" e
      // "escrevi na ficha de outra pessoa". Sem esta consulta a rota gravava
      // CPF e nascimento por cima de quem ja estava la, respondia
      // `criou_conta: true` sem ter criado nada, e levava o operador para a
      // ficha alterada como se fosse o cadastro novo dele.
      const { data: existente } = await admin
        .from("users_profiles")
        .select("id, role, name")
        .eq("email", email)
        .maybeSingle();

      // Nunca mexer em conta de equipe, pela mesma razao da importacao
      // (import.ts:135): o papel dela decide acesso ao painel, e o aviso de
      // "parecidos" da tela nem mostra funcionario, porque filtra role
      // 'customer' — este caso seria 100% silencioso.
      if (existente && existente.role !== "customer") {
        return res.status(409).json({
          error: "Este e-mail é de um usuário da equipe, não de cliente.",
        });
      }

      // Existe e o operador ainda nao decidiu: devolve quem e, e para por aqui.
      if (existente && corpo.atualizar_existente !== true) {
        return res.status(409).json({
          error: `${existente.name || "Alguém"} já está cadastrado com este e-mail.`,
          existente: { id: existente.id, name: existente.name },
        });
      }

      const idDaConta = await resolveCustomerUserId(admin, {
        user_id: null,
        name: nome,
        email,
        phone: telefone || null,
      });

      // So o que veio PREENCHIDO. Campo vazio nao apaga dado bom — o estrago
      // mais comum de cadastro em cima de ficha que ja existe.
      const extras: Record<string, unknown> = {};
      if (documento) extras.document = documento;
      if (nascimento) extras.birth_date = nascimento;
      // resolveCustomerUserId so grava telefone ao CRIAR a ficha; adotando uma
      // existente, ele retorna antes e o telefone digitado se perdia calado.
      if (telefone) extras.phone = telefone;
      // A ORIGEM SO VALE PARA FICHA NOVA. Reescreve-la numa ficha antiga apaga
      // a procedencia do consentimento de quem entrou por outro caminho — e e
      // justamente ela que responde por que aquela pessoa esta na base.
      if (!existente) extras.contact_origin = origem;

      const { data: perfil, error } = await admin
        .from("users_profiles")
        .update(extras)
        .eq("user_id", idDaConta)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!perfil) {
        // maybeSingle devolve null sem erro quando nada casa. Responder 201
        // aqui mandaria a tela para /admin/clients/undefined.
        return res
          .status(500)
          .json({ error: "O cadastro não pôde ser confirmado." });
      }
      return res
        .status(201)
        .json({ client: perfil, criou_conta: !existente });
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
