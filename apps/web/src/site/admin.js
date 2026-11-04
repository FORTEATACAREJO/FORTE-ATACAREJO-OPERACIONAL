import { mountCatalogAdmin } from './catalog-admin.js';
import { startAccess } from '../access-standard.js';
import { supabase } from '../supabase.js';

const access = document.getElementById('access');
const content = document.getElementById('protected-content');
const profile = document.getElementById('master-profile');
let stopCatalog;
if (supabase) {
  access.hidden = true;
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.textContent = 'Sair';
  exit.hidden = true;
  exit.onclick = () => supabase.auth.signOut();
  document.querySelector('[data-forte-top-actions]').appendChild(exit);
  startAccess({
    client: supabase,
    app: 'site',
    content,
    onAllowed(status) {
      profile.textContent = status.name || 'Acesso autorizado';
      exit.hidden = false;
      if (['MASTER','ADMINISTRADOR'].includes(status.role)) {
        stopCatalog = mountCatalogAdmin(document.getElementById('catalog-admin'),supabase);
      }
    },
    onBlocked() {
      stopCatalog?.();
      stopCatalog = undefined;
      content.hidden = true;
      profile.textContent = '';
      exit.hidden = true;
    },
  });
} else {
  access.textContent = 'Conexão não configurada. Contate o administrador.';
}
