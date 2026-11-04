import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({define:{"import.meta.env.VITE_APP_RELEASE":JSON.stringify(process.env.RENDER_GIT_COMMIT||process.env.GITHUB_SHA||"local")},plugins:[react()],server:{port:5178,strictPort:true},build:{rollupOptions:{input:{vendas:resolve(__dirname,"index.html"),financeiro:resolve(__dirname,"financeiro.html"),externas:resolve(__dirname,"venda-externa.html"),cargaDireta:resolve(__dirname,"carga-direta.html"),site:resolve(__dirname,"site.html"),siteAdmin:resolve(__dirname,"admin.html"),cff:resolve(__dirname,"cff.html")}}}});
