import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Separate from vite.config.ts so `tsc -b` (frontend build) never has to
// type-check Vitest-only config, while tests still get the same plugins
// and path aliases the app is built with.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    // Only collected when run with `--coverage` (`npm run test:coverage`).
    coverage: {
      provider: "v8",
      // Every source file counts, including ones no test imports, so the
      // numbers describe the whole app rather than just the tested parts.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        "src/types/**",
        "src/main.tsx",
      ],
      reporter: ["text", "text-summary"],
      // Floors, set about five points under what was measured when they were
      // added (statements 59.9, branches 55.9, functions 52.0, lines 59.3).
      // Raise them as coverage improves.
      thresholds: {
        statements: 55,
        branches: 50,
        functions: 47,
        lines: 55,
      },
    },
  },
})
