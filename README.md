# CRM Dra. Larissa Lima — arquivos iniciais

Interface estática em HTML, CSS e JavaScript, preparada para Supabase Auth e tabela `public.leads`.

## Importante antes de usar com dados reais
1. Configure autenticação por e-mail/senha no Supabase.
2. Configure políticas RLS para que somente o usuário autorizado possa ler/atualizar leads.
3. Em `app.js`, preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com URL e chave publicável.
4. Nunca coloque `service_role` ou chave secreta no navegador.
5. Teste permissões e login antes de publicar para uso real.

## GitHub Pages
Em Settings → Pages, escolha `Deploy from a branch`, branch `main` e pasta `/ (root)` depois de enviar estes arquivos.
