// Inclua Santos — assistente de IA (Supabase Edge Function "assistente").
//
// Fica no servidor do Supabase para a chave da IA nunca ir para o site.
// Segredos (Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  obrigatório: chave da API da Anthropic (console.anthropic.com)
//   MODELO_IA          opcional: modelo do Claude (padrão claude-opus-5-5)
// Só responde a quem entrou na conta, com limite diário por pessoa
// (função usar_assistente, em supabase/schema.sql).

import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const MODELO = Deno.env.get("MODELO_IA") || "claude-opus-5-5";
// Haiku não tem troca automática de modelo quando a IA recusa um pedido.
const COM_FALLBACK = !MODELO.startsWith("claude-haiku");

const ORIGENS = new Set([
  "https://enzo6053.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const REGRAS = `Você é a assistente virtual do aplicativo "Inclua Santos", um app gratuito para pessoas com deficiência (PCD) de Santos e região, no litoral de São Paulo.

O app tem estas telas:
- Atividades: surf adaptado, teatro e música.
- ONGs e apoio: TamTam, Instituto Autismo do Brasil, Lar das Moças Cegas e Apae Santos, com a opção "Seja voluntário ou doe".
- Emprego: vagas para PCD em Santos atualizadas toda semana, links que mostram as vagas abertas no momento, notícias e direitos.
- Saúde: psiquiatra, psicólogo, nutricionista, terapia ocupacional, fisioterapia e teleconsulta com Libras. O agendamento por estas telas ainda não funciona: a pessoa pode salvar a especialidade nos Favoritos.
- Alimentação: restaurante acessível e padaria sem glúten.
- Faculdades e cursos: PIP TEA, Unifesp Santos e Senac Santos.
- Namoro e conexões: encontros em Santos e a lista de pessoas que escolheram aparecer, só para maiores de 18 anos.
- Favoritos, Chat (esta assistente e a Comunidade) e Perfil.

Como o app funciona:
- Para ler as listas não precisa de conta. Para escrever na Comunidade, aparecer em Namoro, denunciar, se inscrever como voluntário ou conversar com esta assistente, a pessoa entra com o e-mail em Perfil > Entrar com seu e-mail: chega um código de 6 dígitos, sem senha.
- Para favoritar, a pessoa toca na estrela de qualquer item; os favoritos aparecem na tela Favoritos.
- O botão Aa, no canto da tela, liga texto grande e alto contraste. Os mesmos ajustes ficam no Perfil.
- Na Comunidade e em Namoro, o botão "Denunciar" fica em cada mensagem e em cada perfil; na denúncia dá para também bloquear a pessoa. A moderação decide se esconde o conteúdo para todos ou bloqueia a conta.
- Para escrever na Comunidade, aparecer em Namoro ou se inscrever como voluntário, é preciso aceitar a Política de privacidade, no Perfil.
- Em "Seja voluntário ou doe", a doação é feita direto no canal oficial de cada instituição (o app não recebe dinheiro), e a inscrição de voluntariado é encaminhada pela equipe do app para a instituição escolhida.
- No Perfil, "Apagar meus dados" e "Apagar minha conta" apagam os dados da pessoa.

Como responder:
- Sempre em português do Brasil, com frases curtas e linguagem simples e acolhedora. No máximo 4 frases ou uma lista de até 4 itens.
- Nunca invente vagas, endereços, telefones, valores nem datas. Se não souber, diga que não sabe e indique a tela do app que tem a informação ou o Polo de Empregabilidade Inclusiva da Prefeitura de Santos.
- Se a pergunta for sobre emergência médica ou risco de vida, oriente ligar para o SAMU 192 ou procurar o serviço de saúde mais próximo.
- O app não precisa de documentos, diagnóstico nem dados de saúde: se a pessoa contar esse tipo de dado, lembre com gentileza que não precisa.`;

const RECUSA = "Não consigo responder isso. Pergunte de outro jeito, por favor.";
const VAZIA = "Não consegui montar uma resposta. Tente perguntar de forma mais simples.";

const anthropic = new Anthropic(); // usa o segredo ANTHROPIC_API_KEY

function cabecalhos(req: Request): Record<string, string> {
  const origem = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.has(origem) ? origem : "https://enzo6053.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function resposta(req: Request, status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhos(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Aceita só {mensagens: [{role, content}]} com texto curto; começa e termina na pessoa. */
function lerMensagens(corpo: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  const lista = (corpo as { mensagens?: unknown } | null)?.mensagens;
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 12) return null;
  const saida: Anthropic.Beta.BetaMessageParam[] = [];
  for (const item of lista) {
    const papel = (item as { role?: unknown })?.role;
    const texto = (item as { content?: unknown })?.content;
    if ((papel !== "user" && papel !== "assistant") || typeof texto !== "string") return null;
    const limpo = texto.trim().slice(0, 1000);
    if (!limpo) return null;
    saida.push({ role: papel, content: limpo });
  }
  while (saida.length && saida[0].role !== "user") saida.shift();
  if (!saida.length || saida[saida.length - 1].role !== "user") return null;
  return saida;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos(req) });
  if (req.method !== "POST") return resposta(req, 405, { erro: "metodo" });

  // Quem pergunta: a sessão de login da pessoa, conferida pelo próprio Supabase.
  const autorizacao = req.headers.get("Authorization") ?? "";
  const token = autorizacao.replace(/^Bearer\s+/i, "");
  if (!token) return resposta(req, 401, { erro: "entrar" });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "",
    {
      global: { headers: { Authorization: autorizacao } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: conta, error: erroConta } = await supa.auth.getUser(token);
  if (erroConta || !conta?.user) return resposta(req, 401, { erro: "entrar" });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return resposta(req, 400, { erro: "pedido" });
  }
  const mensagens = lerMensagens(corpo);
  if (!mensagens) return resposta(req, 400, { erro: "pedido" });

  const { data: restam, error: erroLimite } = await supa.rpc("usar_assistente");
  if (erroLimite || typeof restam !== "number") {
    console.error("usar_assistente falhou", erroLimite);
    return resposta(req, 500, { erro: "limite_indisponivel" });
  }
  if (restam < 0) return resposta(req, 429, { erro: "limite" });

  try {
    const r = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system: REGRAS,
      output_config: { effort: "low" },
      messages: mensagens,
      ...(COM_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (r.stop_reason === "refusal") return resposta(req, 200, { texto: RECUSA, restam });
    const texto = r.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    return resposta(req, 200, { texto: texto || VAZIA, cortada: r.stop_reason === "max_tokens", restam });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return resposta(req, 503, { erro: "ocupada" });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("Chave da Anthropic recusada: confira o segredo ANTHROPIC_API_KEY", e.status);
      return resposta(req, 500, { erro: "configuracao" });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Erro da API da Anthropic", e.status, e.message);
      return resposta(req, 502, { erro: "ia" });
    }
    console.error("Erro inesperado", e);
    return resposta(req, 500, { erro: "interno" });
  }
});
