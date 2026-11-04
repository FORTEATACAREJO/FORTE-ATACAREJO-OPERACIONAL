import React from 'react';
import { createRoot } from 'react-dom/client';
import { startAccess } from '../access-standard.js';
import { supabase } from '../supabase.js';
import { hasModuleAccess } from './areas.js';
import '../forte-ui.css';

const app = document.body.dataset.modulo;
const content = document.getElementById('root');
const load = {
  'venda-externa': () => import('./VendasExternas.jsx'),
  'carga-direta': () => import('./CargaDireta.jsx'),
}[app];

if (supabase && load) {
  let root;
  let authorized = false;
  startAccess({
    client: supabase,
    app,
    content,
    onAllowed: async () => {
      authorized = true;
      try {
        const [{ default: Workspace }, canReturn] = await Promise.all([
          load(),
          hasModuleAccess(supabase, 'vendas'),
        ]);
        if (!authorized) return;
        root = createRoot(content);
        root.render(<>
          {canReturn && <nav aria-label="Plataforma Forte"><a href="/">Voltar ao FORTE VENDAS</a></nav>}
          <Workspace />
        </>);
      } catch {
        if (authorized) content.textContent = 'Não foi possível abrir o módulo. Atualize a página para tentar novamente.';
      }
    },
    onBlocked: () => {
      authorized = false;
      content.hidden = true;
      root?.unmount();
      content.replaceChildren();
    },
  });
} else {
  content.hidden = false;
  content.textContent = 'Conexão não configurada. Contate o administrador.';
}
