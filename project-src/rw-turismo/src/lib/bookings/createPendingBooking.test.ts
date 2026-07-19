import { describe, expect, it } from "vitest";
import { mapRpcError, PendingBookingError } from "./createPendingBooking";

describe("createPendingBooking mapRpcError", () => {
  it("AUTH_REQUIRED → 401", () => {
    const err = mapRpcError("erro: AUTH_REQUIRED foo");
    expect(err).toBeInstanceOf(PendingBookingError);
    expect(err?.statusCode).toBe(401);
  });

  it("PRODUCT_NOT_AVAILABLE → 404", () => {
    expect(mapRpcError("PRODUCT_NOT_AVAILABLE")?.statusCode).toBe(404);
  });

  it("NOT_ENOUGH_SLOTS → 409", () => {
    expect(mapRpcError("NOT_ENOUGH_SLOTS")?.statusCode).toBe(409);
  });

  it("cupom expirado tem mensagem amigável e 400", () => {
    const err = mapRpcError("COUPON_EXPIRED");
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toBe("Cupom expirado.");
  });

  it("mensagem desconhecida → null", () => {
    expect(mapRpcError("qualquer coisa aleatória")).toBeNull();
  });
});
