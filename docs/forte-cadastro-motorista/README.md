# FORTE CADASTRO — Motorista
Página pública isolada, sem sessão de usuário; link individual com token aleatório de 256 bits (somente hash no banco), expiração de 7 dias, revogação e até 12 etapas. Nenhuma leitura pública de cadastro ou documentos. Sem Pix e sem comprovante de endereço.
Admin autenticado com perfil MASTER/ADMINISTRADOR ativo e aprovado cria o link no diretório de motoristas, consulta recebimentos e gera downloads privados de 60 segundos; validação de empresa e motorista no servidor. Dados e fotos ficam em triagem, nunca substituem automaticamente o cadastro nem a aprovação de expedição.
## Antes de publicar
- Homologar schema.sql em banco isolado, verificar RLS, grants e políticas gerais de storage (inclusive acesso por outros usuários).
- Testar função com token válido, expirado, revogado, limite de envios, concorrência, arquivos falsos/grandes, autenticação e isolamento entre empresas. Conferir limpeza de uploads interrompidos e definir retenção dos dados.
- Executar node --test checks/driver-cadastro.test.mjs e build do frontend; testar no celular com dados fictícios.
- Só após aprovação: aplicar schema via migração, publicar função com validação própria (verify_jwt=false nesta função exclusivamente), publicar frontend Render. Não alterar autenticação dos outros módulos.
- Conferir acesso ao link, envio parcial e download com admin, e negar leitura anônima de documentos.
