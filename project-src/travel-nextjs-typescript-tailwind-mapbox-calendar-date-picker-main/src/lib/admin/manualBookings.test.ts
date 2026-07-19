import { describe, expect, it } from "vitest";
import { AdminBookingError, mapRpcError } from "./manualBookings";

describe("manualBookings mapRpcError", () => {
  it("ALREADY_PAID → 409 (idempotência do pagamento manual)", () => {
    const err = mapRpcError("ALREADY_PAID");
    expect(err).toBeInstanceOf(AdminBookingError);
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("Esta reserva já está paga.");
  });

  it("ADMIN_REQUIRED → 403", () => {
    expect(mapRpcError("... ADMIN_REQUIRED ...").statusCode).toBe(403);
  });

  it("NOT_ENOUGH_SLOTS → 409", () => {
    expect(mapRpcError("NOT_ENOUGH_SLOTS").statusCode).toBe(409);
  });

  it("código desconhecido → 500 genérico", () => {
    const err = mapRpcError("algo inesperado");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Não foi possível concluir a operação.");
  });
});
