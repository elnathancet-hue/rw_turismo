import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Fase 5.5 — Vitest. Extensão .mts para carregar o plugin ESM-only. Ambiente
// jsdom para testes de componente; os testes puros (rateLimit, mapRpcError,
// confirmInternalPayment com client mockado) também rodam nesse ambiente.
export default defineConfig({
  plugins: [react()],
  // O tsconfig usa "jsx": "preserve" porque quem compila o app é o Next, que
  // aplica o runtime automático. Fora do Next, o esbuild do Vitest cairia no
  // transform clássico e todo teste de componente estouraria com
  // "React is not defined" — mesmo com o componente correto.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
