import deno from "@deno/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [deno()],
  server: {
    host: "0.0.0.0",
    port: 8000,
  },
  preview: {
    host: "0.0.0.0",
    port: 8000,
  },
});
