import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served at https://jeffreycoen.github.io/coldsnap/
export default defineConfig({
  base: "/coldsnap/",
  plugins: [react()],
});
