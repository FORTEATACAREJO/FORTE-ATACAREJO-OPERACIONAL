import { startAccess } from '../access-standard.js';
import { supabase } from '../supabase.js';

const access = document.getElementById('access');
const content = document.getElementById('protected-content');
const profile = document.getElementById('master-profile');
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
    },
    onBlocked() {
      content.hidden = true;
      profile.textContent = '';
      exit.hidden = true;
    },
  });
} else {
  access.textContent = 'Conexão não configurada. Contate o administrador.';
}
