# Inclua Santos

Aplicativo para pessoas com deficiência de Santos e região: atividades, ONGs, vagas de emprego, saúde, alimentação, cursos, Comunidade e Namoro e conexões.

- **Site:** https://enzo6053.github.io/Inclua-Santos/
- **Política de privacidade:** https://enzo6053.github.io/Inclua-Santos/privacidade.html
- **Excluir conta:** https://enzo6053.github.io/Inclua-Santos/excluir-conta.html

## Como está organizado

| Pasta | O que tem |
|---|---|
| `web/` | O site (HTML, CSS e JavaScript, sem etapa de build). É publicado no GitHub Pages a cada mudança na `main`. |
| `web/index.html` | Todas as telas do app, com as listas de vagas, notícias e eventos. |
| `web/js/app.js` | Navegação, favoritos, conta, Comunidade, Namoro, denúncias, moderação e voluntariado. |
| `web/js/config.js` | Endereço do Supabase e a chave **publicável** (pode ser pública). |
| `web/privacidade.html` | Política de privacidade. O app mostra este mesmo texto na tela Política. |
| `supabase/schema.sql` | Banco de dados: tabelas, regras de acesso (RLS) e funções. |
| `.github/workflows/pages.yml` | Publica o site no GitHub Pages. |

## Banco de dados (Supabase)

1. No Supabase, abra **SQL Editor**, cole `supabase/schema.sql` inteiro e clique em **Run**. Pode rodar de novo depois sem perder dados.
2. **Código no e-mail:** em **Authentication > Email Templates**, nos modelos **Magic Link** e **Confirm signup**, troque o link por `{{ .Token }}` (o código de 6 dígitos).
3. **E-mails para o público:** o envio padrão do Supabase só manda e-mail para quem é da equipe do projeto. Configure um SMTP próprio em **Authentication > Emails > SMTP Settings** (Resend e Brevo têm plano grátis).
4. **Moderadores:** entre no app uma vez com o seu e-mail e rode, no SQL Editor:
   ```sql
   insert into public.moderadores (user_id)
   select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
   on conflict do nothing;
   ```
   Moderadores veem o Painel de moderação e as Inscrições de voluntariado no Perfil.

Nunca coloque no site a chave `secret` nem a `service_role`.

## Atualização semanal das listas

As listas ficam em `web/index.html`, com os mesmos IDs do protótipo:

- `#lista-vagas` e `#vagas-stamp` (Emprego)
- `#lista-noticias` e `#noticias-stamp` (Notícias e direitos)
- `#nam-eventos-lista` e `#nam-stamp` (Encontros em Santos)
- o `.banner` da tela inicial

A estrela de favoritar é colocada sozinha pelo `js/app.js`. Um push na `main` publica o site, e o app Android mostra a novidade sem precisar de versão nova na Play.

## Testar no computador

```bash
npx http-server web -p 8080 -c-1
```

e abra http://localhost:8080.
