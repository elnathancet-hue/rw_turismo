import type { NextApiRequest, NextApiResponse } from "next";
import {
  CustomerAccountError,
  resolveCustomerUserId,
} from "../../../../lib/auth/customerAccount";
import { requireStaff } from "../../../../lib/server/adminAuth";
import { checkRateLimit } from "../../../../lib/server/rateLimit";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

// POST /api/admin/clients/import — grava um lote de clientes vindo de planilha.
//
// PRECISA SER SERVIDOR: criar cliente significa criar conta de autenticação, e
// isso só o service role faz. A tela do navegador não tem — nem deve ter — essa
// chave.
//
// A CONFERÊNCIA JÁ ACONTECEU NA TELA, mas nada aqui confia nela: cada linha é
// revalidada antes de gravar. Entre a conferência e o clique podem ter passado
// minutos, e nesse intervalo alguém pode ter se cadastrado sozinho no site com
// um dos e-mails da lista.

type LinhaParaGravar = {
  numeroNoArquivo: number;
  // Vazio quando a pessoa não tem e-mail: entra como contato, sem login.
  email: string | null;
  name: string;
  phone: string | null;
  birth_date: string | null;
  document: string | null;
  // "novo" cria; "existente" só atualiza o que a planilha traz preenchido.
  acao: "criar" | "atualizar";
  // Quem a conferência identificou como sendo esta pessoa. A tela compara só os
  // dígitos de documento e telefone, coisa que o banco não faz por igualdade —
  // por isso o id vem de lá em vez de ser procurado de novo aqui.
  idAlvo?: string | null;
};

type Resultado = {
  criados: number;
  atualizados: number;
  falhas: { numeroNoArquivo: number; email: string; motivo: string }[];
};

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const LIMITE_POR_LOTE = 500;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Importar cadastro de pessoa é ação de administrador. Operações e Financeiro
  // trabalham com quem já está no sistema; criar base nova é outra coisa.
  const staff = await requireStaff(req, res, ["admin"]);
  if (!staff) return;

  const rate = checkRateLimit(`import-clients:${staff.userId}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Muitas importações seguidas. Aguarde." });
  }

  const linhas = Array.isArray(req.body?.linhas)
    ? (req.body.linhas as LinhaParaGravar[])
    : [];
  const origem = texto(req.body?.origem);

  if (linhas.length === 0) {
    return res.status(400).json({ error: "Nenhuma linha para importar." });
  }

  if (linhas.length > LIMITE_POR_LOTE) {
    return res.status(400).json({
      error: `Máximo de ${LIMITE_POR_LOTE} clientes por vez. Divida a planilha.`,
    });
  }

  // A política de privacidade que o próprio site publica promete contato
  // "apenas com o seu consentimento". Não há coluna de consentimento em
  // users_profiles, então o mínimo honesto é registrar DE ONDE a lista veio —
  // é o que permite responder, depois, por que aquele contato está na base.
  if (!origem) {
    return res.status(400).json({
      error: "Diga de onde veio esta lista antes de importar.",
    });
  }

  const admin = createSupabaseAdminClient() as any;
  const resultado: Resultado = { criados: 0, atualizados: 0, falhas: [] };

  for (const linha of linhas) {
    const email = texto(linha.email).toLowerCase();
    const nome = texto(linha.name);

    if (!nome) {
      resultado.falhas.push({
        numeroNoArquivo: linha.numeroNoArquivo,
        email,
        motivo: "nome vazio",
      });
      continue;
    }

    try {
      let existente: any = null;

      if (linha.idAlvo) {
        const { data } = await admin
          .from("users_profiles")
          .select("id, name, email, phone, birth_date, document, role")
          .eq("id", linha.idAlvo)
          .maybeSingle();
        existente = data;
      }

      // Mesmo para linha nova: alguem pode ter se cadastrado sozinho no site
      // com este e-mail entre a conferencia e o clique.
      if (!existente && email) {
        const { data } = await admin
          .from("users_profiles")
          .select("id, name, email, phone, birth_date, document, role")
          .eq("email", email)
          .maybeSingle();
        existente = data;
      }

      // Nunca mexer em conta de equipe por importação de cliente. Um e-mail de
      // funcionário numa planilha de mala direta sobrescreveria o cadastro dele
      // — e o papel dele decide acesso ao painel.
      if (existente && existente.role !== "customer") {
        resultado.falhas.push({
          numeroNoArquivo: linha.numeroNoArquivo,
          email,
          motivo: "este e-mail é de um usuário da equipe, não de cliente",
        });
        continue;
      }

      if (!existente) {
        if (email) {
          // COM e-mail: cria a conta de login também. É a mesma função que a
          // reserva manual e o checkout usam — sem senha, e-mail já confirmado.
          await resolveCustomerUserId(admin, {
            user_id: null,
            name: nome,
            email,
            phone: linha.phone,
          });

          // Nascimento e documento não passam por resolveCustomerUserId: ela
          // cuida de identidade, não de cadastro.
          await admin
            .from("users_profiles")
            .update({
              ...(linha.birth_date ? { birth_date: linha.birth_date } : {}),
              ...(linha.document ? { document: linha.document } : {}),
              contact_origin: origem,
            })
            .eq("email", email);
        } else {
          // SEM e-mail: entra só na agenda, sem conta de autenticação. É o
          // cliente antigo — a pessoa existe para a equipe encontrar e
          // reconhecer, e não enxerga nada no site porque não tem login.
          const { error } = await admin.from("users_profiles").insert({
            user_id: null,
            name: nome,
            email: null,
            phone: linha.phone,
            birth_date: linha.birth_date || null,
            document: linha.document || null,
            role: "customer",
            // Quem chega por planilha NÃO consentiu com nada. Sem isto, o cron
            // de aniversário passaria a mandar WhatsApp e e-mail de verdade
            // para uma base que nunca pediu.
            marketing_opt_in: false,
            contact_origin: origem,
          });
          if (error) throw error;
        }

        resultado.criados += 1;
        continue;
      }

      if (linha.acao !== "atualizar") {
        // Existia e o operador escolheu não mexer.
        continue;
      }

      // Só o que a planilha traz PREENCHIDO. Célula vazia não apaga dado bom —
      // é o estrago mais comum de importação de cadastro.
      const mudancas: Record<string, string> = {};
      if (nome) mudancas.name = nome;
      // Completar o e-mail de quem não tinha é o único caso em que a
      // importação pode dar login a alguém. A conta em si não é criada aqui —
      // ela nasce quando a pessoa entrar pelo site com esse endereço.
      if (email && !existente.email) mudancas.email = email;
      if (linha.phone) mudancas.phone = linha.phone;
      if (linha.birth_date) mudancas.birth_date = linha.birth_date;
      if (linha.document) mudancas.document = linha.document;

      if (Object.keys(mudancas).length > 0) {
        const { error } = await admin
          .from("users_profiles")
          .update(mudancas)
          .eq("id", existente.id);
        if (error) throw error;
        resultado.atualizados += 1;
      }
    } catch (erro) {
      resultado.falhas.push({
        numeroNoArquivo: linha.numeroNoArquivo,
        email,
        motivo:
          erro instanceof CustomerAccountError
            ? erro.message
            : erro instanceof Error
              ? erro.message
              : "erro ao gravar",
      });
    }
  }

  // Auditoria: quem importou, quantos, e de onde veio a lista.
  await admin.from("system_logs").insert({
    user_id: staff.userId,
    action: "import_clients",
    entity: "users_profiles",
    entity_id: null,
    metadata: {
      origem,
      criados: resultado.criados,
      atualizados: resultado.atualizados,
      falhas: resultado.falhas.length,
      total_enviado: linhas.length,
    },
  });

  return res.status(200).json(resultado);
};

export default handler;
