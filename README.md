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
| `android/` | App Android (`br.com.incluasantos.app`) que abre o site em tela cheia. |
| `.github/workflows/android.yml` | Gera o APK (para testar) e o AAB (para a Play), assinados, a cada mudança no app. |

## App Android

- Pacote `br.com.incluasantos.app`, Android 8 em diante (minSdk 26), targetSdk 36.
- O app abre https://enzo6053.github.io/Inclua-Santos/ em tela cheia. Links de fora do site, telefone e e-mail abrem nos apps do celular. O botão voltar anda pelas telas do site, e sem internet aparece uma tela com "Tentar de novo".
- **APK e AAB:** cada execução do workflow "App Android" guarda os arquivos em **Actions > (a execução) > Artifacts**. Na `main`, o APK também fica em **Releases > Versão de teste**, para baixar direto no celular.
- **Assinatura:** o workflow usa a chave de upload guardada em 4 segredos do repositório (**Settings > Secrets and variables > Actions**): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. Sem eles, sai só um APK de teste (debug), que não serve para a Play. A chave nunca entra no repositório.

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

## Assistente de IA (Claude)

A aba **Assistente IA** do Chat conversa com a função `supabase/functions/assistente`, que roda no Supabase e chama a API da Anthropic. A chave da IA fica só no Supabase, nunca no site. Só quem entrou na conta pode perguntar, com limite de 30 perguntas por pessoa por dia (função `usar_assistente` em `schema.sql`).

Para ligar:

1. Em https://console.anthropic.com, crie uma chave em **API Keys** e coloque créditos em **Billing**.
2. No Supabase, em **Edge Functions > Secrets**, crie o segredo `ANTHROPIC_API_KEY` com essa chave.
3. Em **Edge Functions > Deploy a new function > Via Editor**, dê o nome `assistente`, cole o conteúdo de `supabase/functions/assistente/index.ts` e clique em **Deploy**.
4. Rode `supabase/schema.sql` de novo no SQL Editor (cria a contagem de perguntas).

O modelo padrão é `claude-opus-5-5`. Para gastar menos, crie também o segredo `MODELO_IA` com o valor `claude-haiku-5-5`.

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
