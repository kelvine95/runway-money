import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps the build portable (works on GitHub Pages subpaths too)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
