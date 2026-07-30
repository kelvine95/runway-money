import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project Pages URL: https://kelvine95.github.io/runway-money/
export default defineConfig({
  plugins: [react()],
  base: "/runway-money/",
});
