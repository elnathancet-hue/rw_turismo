import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do admin client (service role). h.client é trocado por teste.
const h = vi.hoisted(() => ({ client: null as any }));
vi.mock("../supabase/admin", () => ({
  createSupabaseAdminClient: () => h.client,
}));

import { confirmInternalPayment } from "./confirmInternalPayment";

type Row = Record<string, unknown> | null;

// Fake do query builder do supabase-js cobrindo só o que a função usa:
//   from(t).select().eq().maybeSingle()          → leitura
//   from(t).update().eq()...[.select()]          → escrita
//   from(t).insert()                             → log (awaitable)
//   rpc(name, args)                              → cupom (awaitable)
//
// Os filtros da ESCRITA são avaliados de verdade contra a linha em memória.
// Sem isso o mock aceitaria qualquer condição e os testes não provariam nada
// sobre as guardas de estado — que são justamente o que impede um evento
// atrasado da Stripe de rebaixar uma reserva já confirmada.
const casa = (linha: any, filtros: any[][]): boolean =>
  filtros.every(([op, coluna, valor, valor2]) => {
    const atual = linha?.[coluna];
    if (op === "eq") return atual === valor;
    if (op === "neq") return atual !== valor;
    if (op === "in") return (valor as unknown[]).includes(atual);
    if (op === "is") return atual === valor;
    // .not(coluna, "eq", valor) → nega o operador informado
    if (op === "not") return valor === "eq" ? atual !== valor2 : true;
    throw new Error(`operador nao suportado no mock: ${op}`);
  });
const makeClient = ({
  payment,
  booking,
}: {
  payment: Row;
  booking: Row;
}) => {
  const calls = {
    updates: [] as { table: string; payload: any; filtros: any[][] }[],
    inserts: [] as { table: string; payload: any }[],
    rpc: [] as { name: string; args: any }[],
  };
  const data: Record<string, Row> = { payments: payment, bookings: booking };

  const builder = (table: string) => {
    let mode: "read" | "update" = "read";
    let updatePayload: any = null;
    const filtros: any[][] = [];

    // Resultado da escrita: aplica os filtros na linha atual e, se casar,
    // registra a chamada e atualiza a linha em memória (para o próximo passo
    // enxergar o estado novo, como aconteceria no banco).
    const aplicar = () => {
      const linha = data[table];
      const casou = Boolean(linha) && casa(linha, filtros);
      if (casou) {
        calls.updates.push({ table, payload: updatePayload, filtros: [...filtros] });
        data[table] = { ...(linha as object), ...updatePayload };
      }
      return casou ? [{ id: (linha as any)?.id ?? "x" }] : [];
    };

    const filtro = (op: string) => (...args: any[]) => {
      filtros.push([op, ...args]);
      return b;
    };

    const b: any = {
      select: (..._args: any[]) => {
        if (mode === "update") {
          return Promise.resolve({ data: aplicar(), error: null });
        }
        return b;
      },
      update: (payload: any) => {
        mode = "update";
        updatePayload = payload;
        return b;
      },
      insert: (payload: any) => {
        calls.inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      eq: filtro("eq"),
      neq: filtro("neq"),
      in: filtro("in"),
      is: filtro("is"),
      not: filtro("not"),
      maybeSingle: () =>
        Promise.resolve({ data: data[table] ?? null, error: null }),
      // Escrita sem .select() é aguardada direto: o await cai aqui.
      then: (resolve: any) => {
        if (mode !== "update") return resolve({ data: null, error: null });
        aplicar();
        return resolve({ error: null });
      },
    };
    return b;
  };

  return {
    client: {
      from: (table: string) => builder(table),
      rpc: (name: string, args: any) => {
        calls.rpc.push({ name, args });
        return Promise.resolve({ error: null });
      },
    },
    calls,
  };
};

const futureIso = () => new Date(Date.now() + 3_600_000).toISOString();
const pastIso = () => new Date(Date.now() - 3_600_000).toISOString();

const makeSession = (over: Record<string, unknown> = {}): any => ({
  id: "cs_test_1",
  metadata: {
    source: "internal_booking",
    booking_id: "b1",
    payment_id: "p1",
    user_id: "u1",
  },
  amount_total: 50_000, // R$ 500,00 em centavos
  currency: "brl",
  // Cartão sempre chega assim. O campo é o que separa "a sessão terminou" de
  // "o dinheiro entrou" — com Pix os dois deixam de ser a mesma coisa.
  payment_status: "paid",
  payment_intent: "pi_1",
  ...over,
});

const basePayment = {
  id: "p1",
  booking_id: "b1",
  user_id: "u1",
  amount: 500,
  currency: "BRL",
  status: "pending",
};
const baseBooking = {
  id: "b1",
  user_id: "u1",
  total_amount: 500,
  status: "pending",
  payment_status: "pending",
  expires_at: futureIso(),
  coupon_id: null as string | null,
};

describe("confirmInternalPayment", () => {
  beforeEach(() => {
    h.client = makeClient({ payment: null, booking: null }).client;
  });

  it("caminho feliz: confirma reserva e pagamento", async () => {
    const mock = makeClient({
      payment: { ...basePayment },
      booking: { ...baseBooking, expires_at: futureIso() },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(makeSession());

    expect(result.status).toBe("confirmed");
    expect(
      mock.calls.updates.some(
        (u) => u.table === "bookings" && u.payload.status === "confirmed"
      )
    ).toBe(true);
    expect(
      mock.calls.updates.some(
        (u) => u.table === "payments" && u.payload.status === "paid"
      )
    ).toBe(true);
  });

  it("incrementa o cupom quando a reserva tem coupon_id", async () => {
    const mock = makeClient({
      payment: { ...basePayment },
      booking: { ...baseBooking, coupon_id: "c1", expires_at: futureIso() },
    });
    h.client = mock.client;

    await confirmInternalPayment(makeSession());

    expect(
      mock.calls.rpc.some(
        (r) =>
          r.name === "increment_coupon_usage" && r.args.p_coupon_id === "c1"
      )
    ).toBe(true);
  });

  it("valor divergente → requires_review", async () => {
    const mock = makeClient({
      payment: { ...basePayment },
      booking: { ...baseBooking, expires_at: futureIso() },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(
      makeSession({ amount_total: 40_000 })
    );

    expect(result.status).toBe("requires_review");
    expect(
      mock.calls.updates.every(
        (u) => u.payload.status !== "confirmed" && u.payload.status !== "paid"
      )
    ).toBe(true);
  });

  it("reserva expirada → requires_review", async () => {
    const mock = makeClient({
      payment: { ...basePayment },
      booking: { ...baseBooking, expires_at: pastIso() },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(makeSession());
    expect(result.status).toBe("requires_review");
  });

  it("já pago/confirmado → duplicate (idempotência)", async () => {
    const mock = makeClient({
      payment: { ...basePayment, status: "paid" },
      booking: {
        ...baseBooking,
        status: "confirmed",
        payment_status: "paid",
        expires_at: futureIso(),
      },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(makeSession());
    expect(result.status).toBe("duplicate");
  });

  // ---------------------------------------------------------------- Pix
  // O cenário que motivou o portão: a sessão do Pix CONCLUI quando o QR é
  // emitido, com amount_total e currency perfeitos e nenhum centavo recebido.
  // Sem a checagem de payment_status, tudo abaixo confirmaria a reserva.
  it("Pix emitido e não pago → processing, sem confirmar nem queimar cupom", async () => {
    const mock = makeClient({
      payment: { ...basePayment },
      booking: { ...baseBooking, coupon_id: "c1", expires_at: futureIso() },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(
      makeSession({ payment_status: "unpaid" })
    );

    expect(result.status).toBe("processing");
    expect(
      mock.calls.updates.some(
        (u) => u.table === "bookings" && u.payload.status === "confirmed"
      )
    ).toBe(false);
    expect(
      mock.calls.updates.some(
        (u) => u.table === "bookings" && u.payload.payment_status === "processing"
      )
    ).toBe(true);
    // O cupom é o dano irreversível: used_count é incremento cego, então
    // queimá-lo por um Pix que ninguém pagou tira o desconto de outra pessoa.
    expect(
      mock.calls.rpc.some((r) => r.name === "increment_coupon_usage")
    ).toBe(false);
  });

  it("Pix pago depois (async_payment_succeeded) confirma a partir de processing", async () => {
    const mock = makeClient({
      payment: { ...basePayment, status: "processing" },
      booking: {
        ...baseBooking,
        payment_status: "processing",
        expires_at: futureIso(),
      },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(makeSession());

    expect(result.status).toBe("confirmed");
  });

  // A Stripe não garante ordem de entrega: o completed (não pago) do Pix pode
  // chegar DEPOIS do async_payment_succeeded. Rebaixar uma reserva já
  // confirmada para "aguardando" seria pior que o problema original.
  it("evento não pago atrasado não rebaixa reserva já confirmada", async () => {
    const mock = makeClient({
      payment: { ...basePayment, status: "paid" },
      booking: {
        ...baseBooking,
        status: "confirmed",
        payment_status: "paid",
        expires_at: futureIso(),
      },
    });
    h.client = mock.client;

    const result = await confirmInternalPayment(
      makeSession({ payment_status: "unpaid" })
    );

    expect(result.status).toBe("duplicate");
    expect(
      mock.calls.updates.some(
        (u) => u.table === "bookings" && u.payload.payment_status === "processing"
      )
    ).toBe(false);
  });

  it("metadata não-interna → ignored", async () => {
    const result = await confirmInternalPayment(
      makeSession({ metadata: { source: "outro" } })
    );
    expect(result.status).toBe("ignored");
  });
});
