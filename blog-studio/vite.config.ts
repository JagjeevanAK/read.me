import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { studioApi } from "./server/api.ts";

export default defineConfig({
  plugins: [react(), studioApi()],
  server: { port: 5178, open: true },
});
