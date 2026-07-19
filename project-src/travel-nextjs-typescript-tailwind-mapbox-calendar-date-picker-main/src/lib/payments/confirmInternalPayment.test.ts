import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do admin client (service role). h.client é trocado por teste.
const h = vi.hoisted(() => ({ client: null as any }));
vi.mock("../supabase/admin", () => ({
  createSupabaseAdminClient: () => h.client,
}));

import { confirmInternalPayment } from "./confirmInternalPayment";

type Row = Record<string, unknown> | null;

// Fake do query builder do supabase-js cobrindo só o que a função usa:
//   from(t).select().eq().maybeSingle()  → leitura
//   from(t).update().eq()                → escrita (awaitable)
//   from(t).insert()                     → log (awaitable)
//   rpc(name, args)                      → cupom (awaitable)
const makeClient = ({
  payment,
  booking,
}: {
  payment: Row;
  booking: Row;
}) => {
  const calls = {
    updates: [] as { table: string; payload: any }[],
    inserts: [] as { table: string; payload: any }[],
    rpc: [] as { name: string; args: any }[],
  };
  const data: Record<string, Row> = { payments: payment, bookings: booking };

  const builder = (table: string) => {
    let mode: "read" | "update" = "read";
    let updatePayload: any = null;
    const b: any = {
      select: () => b,
      update: (payload: any) => {
        mode = "update";
        updatePayload = payload;
        return b;
      },
      insert: (payload: any) => {
        calls.inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      eq: () => {
        if (mode === "update") {
          calls.updates.push({ table, payload: updatePayload });
          return Promise.resolve({ error: null });
        }
        return b;
      },
      maybeSingle: () =>
        Promise.resolve({ data: data[table] ?? null, error: null }),
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

  it("metadata não-interna → ignored", async () => {
    const result = await confirmInternalPayment(
      makeSession({ metadata: { source: "outro" } })
    );
    expect(result.status).toBe("ignored");
  });
});
