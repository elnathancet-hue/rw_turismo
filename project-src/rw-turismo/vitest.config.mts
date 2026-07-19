import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Fase 5.5 — Vitest. Extensão .mts para carregar o plugin ESM-only. Ambiente
// jsdom para testes de componente; os testes puros (rateLimit, mapRpcError,
// confirmInternalPayment com client mockado) também rodam nesse ambiente.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
