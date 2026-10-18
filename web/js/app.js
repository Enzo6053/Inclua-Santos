/* =====================================================================
   Inclua Santos — navegação, acessibilidade, favoritos, conta (Supabase),
   Comunidade, Namoro e conexões, denúncias, moderação e voluntariado.
   Dados por pessoa: localStorage sempre; na conta do Supabase quando a
   pessoa entra com o código do e-mail.
   ===================================================================== */
(function(){
  'use strict';

  var LS = 'inclua-santos:v1';
  var TELAS = {
    'scr-ativ': {nome:'Atividades',          cor:'ativ'},
    'scr-ong':  {nome:'ONGs e apoio',        cor:'ong'},
    'scr-emp':  {nome:'Emprego',             cor:'emp'},
    'scr-sau':  {nome:'Saúde',               cor:'sau'},
    'scr-ali':  {nome:'Alimentação',         cor:'ali'},
    'scr-edu':  {nome:'Faculdades e cursos', cor:'edu'},
    'scr-nam':  {nome:'Namoro e conexões',   cor:'nam'}
  };
  var NAV_DE_TELA = {'scr-home':'nav-home', 'scr-fav':'nav-fav', 'scr-chat':'nav-chat', 'scr-perfil':'nav-perfil',
                     'scr-priv':'nav-perfil', 'scr-mod':'nav-perfil', 'scr-insc':'nav-perfil', 'scr-entrar':'nav-perfil'};
  var ESTRELA_VAZIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 17.3-5.4 3 1-6.1-4.4-4.2 6.1-.9L12 3.6l2.7 5.5 6.1.9-4.4 4.2 1 6.1z"/></svg>';
  var ESTRELA_CHEIA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 17.3-5.4 3 1-6.1-4.4-4.2 6.1-.9L12 3.6l2.7 5.5 6.1.9-4.4 4.2 1 6.1z"/></svg>';
  var ICO_EXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
  var ICO_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  var ICO_BANDEIRA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/></svg>';
  var ICO_BLOQUEIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>';
  var CORES_OK = {ativ:1, ong:1, emp:1, sau:1, ali:1, edu:1, nam:1};

  var S = {chave:'', nome:'', sobre:'', aparecer:false, favoritos:{}, sessoes:0, mensagens:0, desde:0, visto:0,
           big:false, contraste:false, privacidade:0, maiorIdade:0};
  var lsOK = true;

  // Conta (Supabase)
  var CFG = window.INCLUA_CONFIG || {};
  var sb = null;
  var UID = null, EMAIL = '', PODE_MODERAR = false, BLOQUEADO = false;
  var dbResolvido = false;
  var BLOQ_PESSOAIS = {};     // contas que eu bloqueei: {uid: nome}
  var MINHAS_DENUNCIAS = {};  // chaves que eu denunciei
  var denunciasLocais = {};   // denunciadas nesta sessão, antes da resposta do banco

  // ---------------------------------------------------------- util
  function $(id){ return document.getElementById(id); }
  function texto(tag, classe, conteudo){
    var el = document.createElement(tag);
    if(classe) el.className = classe;
    if(conteudo != null) el.textContent = conteudo;
    return el;
  }
  function limpar(s, max){
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029]/g, '')
      .slice(0, max || 200);
  }
  function urlSegura(u){
    u = limpar(u, 600).trim();
    return /^https?:\/\/[^\s]+$/i.test(u) ? u : '';
  }
  function favSeguro(f){
    if(!f || typeof f !== 'object') return null;
    var titulo = limpar(f.titulo, 160).replace(/\s+/g, ' ').trim();
    if(!titulo) return null;
    var tela = limpar(f.tela, 20);
    return {
      id: limpar(f.id, 120),
      titulo: titulo,
      cat: limpar(f.cat, 40) || 'Inclua Santos',
      cor: CORES_OK[f.cor] ? f.cor : 'ativ',
      url: urlSegura(f.url),
      tela: /^scr-[a-z]+$/.test(tela) ? tela : '',
      em: Number(f.em) || 0
    };
  }
  function hash36(s){
    var h = 0x811c9dc5;
    for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function slug(s){
    return String(s||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'item';
  }
  function dataCurta(ms){
    if(!ms) return '—';
    try{
      var d = new Date(ms), hoje = new Date();
      if(d.toDateString() === hoje.toDateString()) return 'hoje';
      return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'});
    }catch(e){ return '—'; }
  }
  function quandoSalvo(ms){
    var d = dataCurta(ms);
    return d === 'hoje' ? 'salvo hoje' : ('salvo em ' + d);
  }
  function quandoFoi(ms){
    var d = dataCurta(ms);
    return d === 'hoje' ? 'hoje' : ('em ' + d);
  }
  function horaCurta(ms){
    try{ return new Date(ms).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }
    catch(e){ return ''; }
  }
  function paraIso(ms){ return ms ? new Date(ms).toISOString() : null; }
  function deIso(v){ var t = Date.parse(v || ''); return isNaN(t) ? 0 : t; }
  function objeto(v){ return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }

  // ---------------------------------------------------------- navegação
  // Cada tela entra no histórico do navegador: o botão voltar do celular
  // (e o do app Android) volta de tela em tela até a inicial.
  var pilha = ['scr-home'], pos = 0, telaAtual = 'scr-home';

  function mostrarTela(id){
    var scr = $(id);
    if(!scr) return;
    document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
    scr.classList.add('active');
    scr.scrollTop = 0;
    telaAtual = id;
    var alvo = NAV_DE_TELA[id] || '';
    Object.keys(NAV_DE_TELA).forEach(function(tela){
      var b = $(NAV_DE_TELA[tela]);
      if(!b) return;
      var on = NAV_DE_TELA[tela] === alvo;
      b.classList.toggle('on', on);
      if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    closeMenu();
    aoAbrirTela(id);
  }

  function go(id, opcoes){
    if(!$(id)) return;
    opcoes = opcoes || {};
    if(id === pilha[pos]){ mostrarTela(id); return; }
    var k = pilha.lastIndexOf(id, pos - 1);
    if(k >= 0 && pos > 0){
      try{ history.go(k - pos); return; }catch(e){}
    }
    if(opcoes.substituir){
      pilha[pos] = id;
      try{ history.replaceState({tela:id, n:pos}, '', '#' + id); }catch(e){}
    }else{
      pilha = pilha.slice(0, pos + 1);
      pilha.push(id);
      pos = pilha.length - 1;
      try{ history.pushState({tela:id, n:pos}, '', '#' + id); }catch(e){}
    }
    mostrarTela(id);
  }

  window.addEventListener('popstate', function(ev){
    var st = ev.state || {};
    if(fecharJanelaAberta()){
      try{ history.pushState({tela:pilha[pos], n:pos}, '', '#' + pilha[pos]); }catch(e){}
      return;
    }
    if(typeof st.tela !== 'string'){
      // link com #tela: entra no histórico como uma navegação nova
      var pedida = (location.hash || '').slice(1);
      var nova = (/^scr-[a-z]+$/.test(pedida) && $(pedida)) ? pedida : 'scr-home';
      pilha = pilha.slice(0, pos + 1);
      pilha.push(nova);
      pos = pilha.length - 1;
      try{ history.replaceState({tela:nova, n:pos}, '', '#' + nova); }catch(e){}
      mostrarTela(nova);
      return;
    }
    var id = $(st.tela) ? st.tela : 'scr-home';
    pos = Number(st.n) || 0;
    pilha[pos] = id;
    mostrarTela(id);
  });

  // ---------------------------------------------------------- acessibilidade
  function toggleMenu(){
    var m = $('a11yMenu');
    var open = m.classList.toggle('open');
    $('a11yBtn').setAttribute('aria-expanded', open);
  }
  function closeMenu(){
    var m = $('a11yMenu'), b = $('a11yBtn');
    if(m) m.classList.remove('open');
    if(b) b.setAttribute('aria-expanded','false');
  }
  function syncA11y(){
    var app = $('app');
    var estados = {big:app.classList.contains('big-text'), contrast:app.classList.contains('contrast')};
    Object.keys(estados).forEach(function(chave){
      document.querySelectorAll('[data-a11y="'+chave+'"] .state').forEach(function(s){
        s.textContent = estados[chave] ? 'Ligado' : 'Desligado';
      });
      document.querySelectorAll('[data-a11y="'+chave+'"]').forEach(function(b){
        b.setAttribute('aria-pressed', estados[chave] ? 'true' : 'false');
      });
    });
    return estados;
  }
  function alternarA11y(qual){
    var classe = qual === 'big' ? 'big-text' : 'contrast';
    var on = $('app').classList.toggle(classe);
    syncA11y();
    S.big = $('app').classList.contains('big-text');
    S.contraste = $('app').classList.contains('contrast');
    gravarLocal();
    if(qual === 'big') toast(on ? 'Texto grande ativado' : 'Texto grande desativado');
    else toast(on ? 'Alto contraste ativado' : 'Alto contraste desativado');
  }

  var toastTimer;
  function toast(msg){
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    var av = $('avisos');
    if(av) av.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2600);
  }

  /* Relógio da barra de status (só aparece na moldura do computador). */
  function horaDeBrasilia(){
    var el = $('hora-status');
    if(!el) return;
    var agora = new Date(), txt;
    try{ txt = agora.toLocaleTimeString('pt-BR', {timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit'}); }
    catch(e){ txt = agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }
    el.textContent = txt;
  }

  // ---------------------------------------------------------- estado local
  function lerLocal(){
    try{
      var bruto = localStorage.getItem(LS);
      if(!bruto) return;
      var d = JSON.parse(bruto);
      if(!d || typeof d !== 'object') return;
      if(typeof d.chave === 'string') S.chave = d.chave;
      if(typeof d.nome === 'string') S.nome = d.nome.slice(0,40);
      if(typeof d.sobre === 'string') S.sobre = d.sobre.slice(0,120);
      S.aparecer = !!d.aparecer;
      if(d.favoritos && typeof d.favoritos === 'object') S.favoritos = d.favoritos;
      S.sessoes     = Number(d.sessoes)     || 0;
      S.mensagens   = Number(d.mensagens)   || 0;
      S.desde       = Number(d.desde)       || 0;
      S.big         = !!d.big;
      S.contraste   = !!d.contraste;
      S.privacidade = Number(d.privacidade) || 0;
      S.maiorIdade  = Number(d.maiorIdade)  || 0;
    }catch(e){ /* modo privado ou armazenamento bloqueado */ }
  }
  function gravarLocal(){
    try{ localStorage.setItem(LS, JSON.stringify(S)); lsOK = true; }
    catch(e){ lsOK = false; }
  }
  function novaChave(){
    try{
      if(window.crypto && crypto.randomUUID) return 'v-' + crypto.randomUUID().replace(/-/g,'').slice(0,16);
    }catch(e){}
    return 'v-' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-6);
  }

  // ---------------------------------------------------------- conta e sincronização
  function rotuloSync(txt){
    ['fav-sync','prof-sync'].forEach(function(id){ var el = $(id); if(el) el.textContent = txt; });
  }
  function rotuloPadrao(){
    if(UID) return 'Salvo na sua conta';
    return lsOK ? 'Salvo no seu aparelho' : 'Só nesta sessão';
  }

  function favoritosParaConta(){
    var saida = {};
    Object.keys(S.favoritos).slice(0, 200).forEach(function(id){
      var f = favSeguro(S.favoritos[id]);
      if(f){ delete f.id; saida[id] = f; }
    });
    return saida;
  }

  function perfilParaConta(){
    return {
      id: UID,
      nome: limpar(S.nome, 40).trim(),
      sobre: limpar(S.sobre, 160).trim(),
      aparecer: !!S.aparecer,
      maior_de_idade_em: paraIso(S.maiorIdade),
      privacidade_aceita_em: paraIso(S.privacidade),
      favoritos: favoritosParaConta(),
      sessoes: Math.max(0, Number(S.sessoes) || 0),
      desde: paraIso(S.desde || Date.now())
    };
  }

  var pushT = null, ultimoEnviado = '';
  function enviarPerfil(){
    if(pushT){ clearTimeout(pushT); pushT = null; }
    if(!sb || !UID) return Promise.resolve(false);
    var dados = perfilParaConta();
    var assinatura = JSON.stringify(dados);
    if(assinatura === ultimoEnviado) return Promise.resolve(true);
    return sb.from('perfis').upsert(dados, {onConflict:'id'}).then(function(r){
      if(r.error) throw r.error;
      ultimoEnviado = assinatura;
      rotuloSync('Salvo na sua conta');
      return true;
    }).catch(function(){
      ultimoEnviado = '';
      rotuloSync('Salvo no aparelho · a conta sincroniza depois');
      return false;
    });
  }
  function agendarPush(){
    if(!sb || !UID) return;
    if(pushT) clearTimeout(pushT);
    pushT = setTimeout(enviarPerfil, 700);
  }

  function juntarPerfil(d){
    var remotos = objeto(d.favoritos);
    Object.keys(remotos).slice(0, 200).forEach(function(id){
      if(S.favoritos[id]) return;
      var f = favSeguro(remotos[id]);
      if(f){ f.id = id; S.favoritos[id] = f; }
    });
    if(!S.nome && typeof d.nome === 'string') S.nome = limpar(d.nome, 40).trim();
    if(!S.sobre && typeof d.sobre === 'string') S.sobre = limpar(d.sobre, 120).trim();
    S.aparecer = !!d.aparecer;
    S.sessoes = Math.max(S.sessoes, Number(d.sessoes) || 0);
    var desde = deIso(d.desde);
    if(desde) S.desde = S.desde ? Math.min(S.desde, desde) : desde;
    if(!S.privacidade) S.privacidade = deIso(d.privacidade_aceita_em);
    if(!S.maiorIdade) S.maiorIdade = deIso(d.maior_de_idade_em);
  }

  function iniciarConta(){
    try{
      if(window.supabase && CFG.supabaseUrl && CFG.supabaseChave){
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseChave, {
          auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:false, storageKey:'inclua-santos:sessao'}
        });
      }
    }catch(e){ sb = null; }
    if(!sb){ aplicarSessao(null); return; }
    sb.auth.onAuthStateChange(function(evento, sessao){
      // nada de chamar o Supabase dentro deste aviso: segue no próximo ciclo
      setTimeout(function(){ aplicarSessao(sessao); }, 0);
    });
    sb.auth.getSession().then(function(r){
      aplicarSessao(r && r.data ? r.data.session : null);
    }, function(){ aplicarSessao(null); });
  }

  var contaPromessa = Promise.resolve();
  function aplicarSessao(sessao){
    var uid = (sessao && sessao.user) ? sessao.user.id : null;
    EMAIL = (sessao && sessao.user && sessao.user.email) ? sessao.user.email : '';
    if(dbResolvido && uid === UID){ desenharConta(); return contaPromessa; }
    var saiu = !!UID && !uid;
    UID = uid;
    ultimoEnviado = '';
    dbResolvido = true;
    PODE_MODERAR = false; BLOQUEADO = false;
    BLOQ_PESSOAIS = {}; MINHAS_DENUNCIAS = {};
    MOD = {pendentes: [], msgs: {}, perfis: {}, ocultosMsg: [], ocultosPerfis: [], bloqueados: []};
    MOD_BLOQ = {};
    if(saiu) limparDadosDaConta();
    desenharConta();
    if(!UID){
      rotuloSync(rotuloPadrao());
      contaPromessa = Promise.resolve();
      posConta();
      return contaPromessa;
    }
    rotuloSync('Conectando à sua conta...');
    contaPromessa = carregarConta().then(posConta, posConta);
    return contaPromessa;
  }

  function carregarConta(){
    var eu = UID;
    return Promise.all([
      sb.from('perfis').select('*').eq('id', eu).maybeSingle(),
      sb.from('moderadores').select('user_id').eq('user_id', eu),
      sb.from('bloqueios').select('usuario').eq('usuario', eu),
      sb.from('bloqueios_pessoais').select('bloqueado, nome').eq('quem', eu),
      sb.from('denuncias').select('chave').eq('denunciante', eu).order('criada_em', {ascending:false}).limit(300)
    ]).then(function(r){
      if(eu !== UID) return;
      if(r[0] && !r[0].error && r[0].data) juntarPerfil(r[0].data);
      PODE_MODERAR = !!(r[1] && !r[1].error && r[1].data && r[1].data.length);
      BLOQUEADO = !!(r[2] && !r[2].error && r[2].data && r[2].data.length);
      BLOQ_PESSOAIS = {};
      ((r[3] && r[3].data) || []).forEach(function(b){ BLOQ_PESSOAIS[b.bloqueado] = limpar(b.nome, 40) || 'Pessoa bloqueada'; });
      MINHAS_DENUNCIAS = {};
      ((r[4] && r[4].data) || []).forEach(function(d){ MINHAS_DENUNCIAS[d.chave] = true; });
      if(BLOQUEADO) S.aparecer = false;
      gravarLocal();
      desenharTudo();
      return enviarPerfil();
    }).catch(function(){
      rotuloSync('Salvo no aparelho · a conta sincroniza depois');
    });
  }

  function posConta(){
    var painel = $('perfil-mod'); if(painel) painel.hidden = !PODE_MODERAR;
    desenharConta();
    desenharTudo();
    desenharBloqueados();
    atualizarComposer();
    atualizarIA();
    if(ultimaComunidade) desenharComunidade(ultimaComunidade);
    if(PODE_MODERAR) carregarModeracao();
    if(PODE_MODERAR) carregarInscricoesAdmin();
    if(telaAtual === 'scr-nam') carregarPessoas();
    if(telaAtual === 'scr-ajudar') iniciarVoluntarios();
    avisarSala();
  }

  // Ao sair da conta, o que é da conta sai do aparelho; favoritos e
  // ajustes de acessibilidade ficam.
  function limparDadosDaConta(){
    S.nome = ''; S.sobre = ''; S.aparecer = false; S.privacidade = 0; S.maiorIdade = 0; S.mensagens = 0;
    minhasInscricoes = {};
    todasInscricoes = [];
    ultimaListaPessoas = [];
    gravarLocal();
    desenharTudo();
    desenharMinhasInscricoes();
  }

  function desenharConta(){
    var entrar = $('btn-conta-entrar'), logada = $('conta-logada'), sair = $('btn-sair');
    var apagar = $('btn-apagar-conta'), email = $('conta-email');
    if(entrar) entrar.hidden = !!UID;
    if(logada) logada.hidden = !UID;
    if(sair) sair.hidden = !UID;
    if(apagar) apagar.hidden = !UID;
    if(email) email.textContent = EMAIL || 'sua conta';
    var painel = $('perfil-mod'); if(painel) painel.hidden = !PODE_MODERAR;
  }

  function sairDaConta(){
    if(!sb || !UID) return;
    sb.auth.signOut({scope:'local'}).then(function(){}, function(){}).then(function(){
      aplicarSessao(null);
      toast('Você saiu da conta');
    });
  }

  // ---------------------------------------------------------- entrar com código no e-mail
  var entrarEmail = '', depoisDoLogin = null, telaAntesEntrar = 'scr-perfil';
  var esperaAte = 0, esperaT = null;
  var MOTIVOS_ENTRAR = {
    comunidade: 'Entre para escrever na Comunidade. Ler as mensagens continua livre.',
    namoro: 'Entre para ver as pessoas da lista e aparecer nela.',
    aparecer: 'Entre para aparecer na lista de Namoro e conexões.',
    voluntario: 'Entre para enviar sua inscrição de voluntariado.',
    denunciar: 'Entre para denunciar. Assim a moderação recebe a sua denúncia.',
    assistente: 'Entre para conversar com a assistente do app.'
  };

  function abrirEntrar(motivo){
    if(!sb){ toast('Não deu para conectar agora. Confira sua internet'); return; }
    if(UID){ seguirDepoisDoLogin(motivo); return; }
    var ativa = document.querySelector('.screen.active');
    if(ativa && ativa.id !== 'scr-entrar' && ativa.id !== 'scr-priv') telaAntesEntrar = ativa.id;
    depoisDoLogin = motivo || null;
    var aviso = $('entrar-motivo');
    if(aviso){
      aviso.textContent = MOTIVOS_ENTRAR[motivo] || '';
      aviso.hidden = !MOTIVOS_ENTRAR[motivo];
    }
    passoEntrar(entrarEmail && esperaAte > Date.now() ? 'codigo' : 'email');
    go('scr-entrar');
    var campo = $(entrarEmail && esperaAte > Date.now() ? 'entrar-codigo' : 'entrar-email');
    if(campo) setTimeout(function(){ campo.focus(); }, 50);
  }

  function passoEntrar(qual){
    var fe = $('form-email'), fc = $('form-codigo');
    if(fe) fe.hidden = qual !== 'email';
    if(fc) fc.hidden = qual !== 'codigo';
    ['entrar-erro-email','entrar-erro-codigo'].forEach(function(id){ var e = $(id); if(e) e.hidden = true; });
  }

  function erroEntrar(id, msg, campo){
    var e = $(id);
    if(e){ e.textContent = msg; e.hidden = false; }
    if(campo) campo.focus();
  }

  function mensagemErroLogin(e){
    var codigo = String((e && e.code) || '');
    var msg = String((e && (e.message || e.msg)) || '').toLowerCase();
    var m = msg.match(/after (\d+) seconds?/);
    if(m) return 'Espere ' + m[1] + ' segundos para pedir outro código.';
    if(codigo === 'otp_expired' || msg.indexOf('expired') >= 0 || (msg.indexOf('invalid') >= 0 && msg.indexOf('token') >= 0))
      return 'Código errado ou vencido. Confira os números ou peça outro código.';
    if(codigo.indexOf('rate_limit') >= 0 || (e && e.status === 429) || msg.indexOf('rate limit') >= 0)
      return 'Muitos pedidos de código. Espere alguns minutos e tente de novo.';
    if(codigo === 'email_address_not_authorized' || msg.indexOf('not authorized') >= 0)
      return 'O envio de e-mail do app ainda não foi liberado para este endereço. Avise a equipe do Inclua Santos.';
    if(codigo === 'signup_disabled' || codigo === 'otp_disabled' || msg.indexOf('not allowed') >= 0)
      return 'A entrada por e-mail está desligada no momento. Avise a equipe do Inclua Santos.';
    if(codigo === 'email_address_invalid' || codigo === 'validation_failed')
      return 'Confira o e-mail: parece que falta alguma coisa.';
    if(msg.indexOf('error sending') >= 0)
      return 'Não deu para enviar o e-mail agora. Tente de novo mais tarde.';
    if(msg.indexOf('fetch') >= 0 || msg.indexOf('network') >= 0)
      return 'Sem conexão. Confira sua internet e tente de novo.';
    return 'Não deu certo agora. Tente de novo em instantes.';
  }

  function iniciarEspera(segundos){
    esperaAte = Date.now() + segundos * 1000;
    if(esperaT) clearInterval(esperaT);
    var b = $('btn-reenviar');
    function tique(){
      var faltam = Math.ceil((esperaAte - Date.now()) / 1000);
      if(!b) return;
      if(faltam > 0){ b.disabled = true; b.textContent = 'Reenviar código (' + faltam + ' s)'; }
      else{ b.disabled = false; b.textContent = 'Reenviar código'; clearInterval(esperaT); esperaT = null; }
    }
    tique();
    esperaT = setInterval(tique, 1000);
  }

  function pedirCodigo(ev){
    if(ev) ev.preventDefault();
    if(!sb) return;
    var campo = $('entrar-email');
    var email = limpar(campo.value, 120).trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      erroEntrar('entrar-erro-email', 'Escreva um e-mail completo, como voce@exemplo.com.', campo);
      return;
    }
    enviarCodigo(email, $('btn-enviar-codigo'), 'entrar-erro-email', campo);
  }

  function enviarCodigo(email, botao, idErro, campo){
    if(botao) botao.disabled = true;
    sb.auth.signInWithOtp({email: email, options: {shouldCreateUser: true}}).then(function(r){
      if(r.error) throw r.error;
      entrarEmail = email;
      passoEntrar('codigo');
      var aviso = $('entrar-enviado');
      if(aviso){
        aviso.textContent = 'Mandamos um código para ' + email + '. Abra o seu e-mail e digite os números aqui.';
        aviso.focus();
      }
      var cod = $('entrar-codigo');
      if(cod){ cod.value = ''; setTimeout(function(){ cod.focus(); }, 50); }
      iniciarEspera(60);
    }).catch(function(e){
      erroEntrar(idErro, mensagemErroLogin(e), campo);
    }).then(function(){
      if(botao) botao.disabled = false;
    });
  }

  function confirmarCodigo(ev){
    if(ev) ev.preventDefault();
    if(!sb || !entrarEmail) return;
    var campo = $('entrar-codigo');
    var codigo = String(campo.value || '').replace(/\D/g, '');
    if(codigo.length < 6){
      erroEntrar('entrar-erro-codigo', 'Digite os números do código que chegou no e-mail.', campo);
      return;
    }
    var botao = $('btn-confirmar-codigo');
    if(botao) botao.disabled = true;
    sb.auth.verifyOtp({email: entrarEmail, token: codigo, type: 'email'}).then(function(r){
      if(r.error) throw r.error;
      var sessao = r.data ? r.data.session : null;
      if(!sessao) throw new Error('sem sessão');
      entrarEmail = '';
      esperaAte = 0;
      campo.value = '';
      return aplicarSessao(sessao).then(function(){
        toast('Pronto! Você entrou na sua conta');
        seguirDepoisDoLogin(depoisDoLogin);
      });
    }).catch(function(e){
      erroEntrar('entrar-erro-codigo', mensagemErroLogin(e), campo);
    }).then(function(){
      if(botao) botao.disabled = false;
    });
  }

  function focarDepois(id){
    setTimeout(function(){ var el = $(id); if(el && !el.disabled) el.focus(); }, 80);
  }

  function seguirDepoisDoLogin(motivo){
    depoisDoLogin = null;
    var trocar = {substituir: telaAtual === 'scr-entrar'};
    if(motivo === 'comunidade'){
      go('scr-chat', trocar);
      aba('comm');
      focarDepois('comm-input');
    }else if(motivo === 'assistente'){
      go('scr-chat', trocar);
      aba('ia');
      focarDepois('ia-input');
    }else if(motivo === 'namoro'){
      go('scr-nam', trocar);
    }else if(motivo === 'aparecer'){
      go('scr-perfil', trocar);
      focarDepois('prof-aparecer');
    }else if(motivo === 'voluntario'){
      go('scr-ajudar', trocar);
      abaAjuda('vol');
    }else if(motivo === 'denunciar'){
      go(telaAntesEntrar || 'scr-chat', trocar);
    }else{
      go('scr-perfil', trocar);
    }
  }

  // ---------------------------------------------------------- janela de confirmação
  var dialogoResolver = null, focoAntesDialogo = null;

  function fundoInerte(on){
    ['.screens', '.navbar', '#a11yBtn', '#a11yMenu'].forEach(function(sel){
      var el = document.querySelector(sel);
      if(el) el.inert = on;
    });
  }

  function abrirDialogo(op){
    return new Promise(function(resolve){
      if(dialogoResolver) dialogoResolver(false);
      dialogoResolver = resolve;
      focoAntesDialogo = document.activeElement;
      $('dialogo-titulo').textContent = op.titulo || '';
      $('dialogo-texto').textContent = op.texto || '';
      var ok = $('dialogo-ok');
      ok.textContent = op.ok || 'Confirmar';
      ok.className = 'btn-line' + (op.perigo ? ' perigo' : '');
      $('dialogo-cancelar').textContent = op.cancelar || 'Cancelar';
      closeMenu();
      $('dialogo-fundo').hidden = false;
      fundoInerte(true);
      $('dialogo-cancelar').focus();
    });
  }
  function fecharDialogo(resposta){
    var f = $('dialogo-fundo');
    if(!f || f.hidden) return false;
    f.hidden = true;
    if($('denuncia-fundo').hidden) fundoInerte(false);
    var r = dialogoResolver;
    dialogoResolver = null;
    if(focoAntesDialogo && document.contains(focoAntesDialogo) && focoAntesDialogo.focus) focoAntesDialogo.focus();
    focoAntesDialogo = null;
    if(r) r(!!resposta);
    return true;
  }

  function fecharJanelaAberta(){
    if(fecharDialogo(false)) return true;
    var den = $('denuncia-fundo');
    if(den && !den.hidden){ fecharDenuncia(); return true; }
    var m = $('a11yMenu');
    if(m && m.classList.contains('open')){ closeMenu(); return true; }
    return false;
  }

  // ---------------------------------------------------------- favoritos
  function descrever(el){
    var sec = el.closest ? el.closest('section.screen') : null;
    var secId = sec ? sec.id : '';
    var cat = TELAS[secId] || {nome:'Inclua Santos', cor:'ativ'};
    var t = el.querySelector('h3, h4');
    var titulo = t ? t.textContent.replace(/\s+/g,' ').trim() : '';
    var url = urlSegura((el.tagName === 'A') ? (el.getAttribute('href') || '') : (el.getAttribute('data-fav-url') || ''));
    var id = el.getAttribute('data-fav-id') ||
             (url ? 'u-' + hash36(url) : secId.replace('scr-','') + '-' + slug(titulo));
    return {id:id, titulo:titulo || 'Item salvo', cat:cat.nome, cor:cat.cor, url:url, tela:secId};
  }

  function marcarEstrelas(){
    var itens = [];
    document.querySelectorAll('[data-fav]').forEach(function(el){ itens.push(el); });
    document.querySelectorAll('#lista-vagas a.item').forEach(function(el){
      if(!el.hasAttribute('data-fav')) itens.push(el);
    });
    itens.forEach(function(el){
      if(el.parentElement && el.parentElement.classList.contains('fav-wrap')) return;
      var meta = descrever(el);
      var caixa = document.createElement('div');
      var ehCartao = el.classList.contains('cat') && !el.classList.contains('wide');
      caixa.className = 'fav-wrap ' + (ehCartao ? 'card' : 'row');
      if(el.classList.contains('wide')) caixa.classList.add('wide');
      el.parentNode.insertBefore(caixa, el);
      caixa.appendChild(el);

      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fav-star';
      b.setAttribute('data-star-id', meta.id);
      b.setAttribute('data-star-titulo', meta.titulo);
      b.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        alternarFavorito(meta);
      });
      caixa.appendChild(b);
    });
    sincronizarEstrelas();
  }

  function sincronizarEstrelas(){
    document.querySelectorAll('.fav-star').forEach(function(b){
      var id = b.getAttribute('data-star-id');
      var titulo = b.getAttribute('data-star-titulo') || 'item';
      var on = !!S.favoritos[id];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', 'Favoritar: ' + titulo);
      b.innerHTML = on ? ESTRELA_CHEIA : ESTRELA_VAZIA;
    });
  }

  function alternarFavorito(meta){
    var removendo = !!S.favoritos[meta.id];
    if(removendo){
      delete S.favoritos[meta.id];
      toast('Removido dos favoritos');
    }else{
      S.favoritos[meta.id] = {
        id:meta.id, titulo:meta.titulo, cat:meta.cat, cor:meta.cor,
        url:meta.url, tela:meta.tela, em:Date.now()
      };
      toast('Salvo em Favoritos');
    }
    gravarLocal();
    if(removendo) enviarPerfil(); else agendarPush();
    sincronizarEstrelas();
    desenharFavoritos();
    atualizarContadores();
  }

  function listaFavoritos(){
    return Object.keys(S.favoritos).map(function(id){
        var f = favSeguro(S.favoritos[id]);
        if(f) f.id = id;
        return f;
      })
      .filter(Boolean)
      .sort(function(a,b){ return (Number(b.em)||0) - (Number(a.em)||0); });
  }

  function desenharFavoritos(){
    var lista = $('fav-list'), vazio = $('fav-empty');
    if(!lista) return;
    var itens = listaFavoritos();
    lista.textContent = '';
    if(vazio) vazio.hidden = itens.length > 0;
    var avisoVaga = $('fav-aviso-vagas');
    if(avisoVaga) avisoVaga.hidden = !itens.some(function(f){ return f.tela === 'scr-emp'; });

    itens.forEach(function(f){
      var cor = CORES_OK[f.cor] ? f.cor : 'ativ';
      var alvo = urlSegura(f.url);
      var linha, ehLink = !!alvo;
      if(ehLink){
        linha = document.createElement('a');
        linha.className = 'item';
        linha.href = alvo;
        linha.target = '_blank';
        linha.rel = 'noopener';
      }else{
        linha = document.createElement('button');
        linha.className = 'item';
        linha.type = 'button';
        linha.addEventListener('click', function(){ if(f.tela) go(f.tela); });
      }

      var ic = texto('span', 'ic');
      ic.setAttribute('style', 'background:var(--c-' + cor + '-bg); color:var(--c-' + cor + ')');
      ic.innerHTML = ESTRELA_CHEIA;
      linha.appendChild(ic);

      var meio = document.createElement('span');
      meio.appendChild(texto('h4', null, f.titulo));
      meio.appendChild(texto('p', null, f.cat + (f.em ? ' · ' + quandoSalvo(f.em) : '')));
      linha.appendChild(meio);

      var fim = texto('span', 'ext');
      fim.setAttribute('aria-hidden', 'true');
      fim.innerHTML = ehLink ? ICO_EXT : ICO_CHEV;
      linha.appendChild(fim);

      var caixa = document.createElement('div');
      caixa.className = 'fav-wrap row';
      caixa.appendChild(linha);

      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fav-star';
      b.setAttribute('data-star-id', f.id);
      b.setAttribute('data-star-titulo', f.titulo);
      b.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        alternarFavorito(f);
      });
      caixa.appendChild(b);
      lista.appendChild(caixa);
    });
    sincronizarEstrelas();
  }

  function modoEscolher(on){
    var app = $('app');
    if(app) app.classList.toggle('pick-mode', !!on);
    var b = $('btn-fav-mode');
    if(b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    var nota = $('fav-mode-note');
    if(nota) nota.hidden = !on;
  }

  // ---------------------------------------------------------- frescor das listas
  function selosDeData(){
    document.querySelectorAll('[data-conferido]').forEach(function(el){
      var bruto = String(el.getAttribute('data-conferido') || '');
      var m = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(!m) return;
      var quando = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      var dias = Math.floor((Date.now() - quando.getTime()) / 86400000);
      if(dias < 0) dias = 0;
      var data = m[3] + '/' + m[2] + '/' + m[1];
      var oque = limpar(el.getAttribute('data-oque'), 40) || 'Esta lista';
      var extra = limpar(el.getAttribute('data-extra'), 200);
      var txt;
      if(dias <= 10){
        txt = oque + ' conferida em ' + data + '.';
      }else if(dias <= 24){
        txt = oque + ' conferida em ' + data + ' — já faz ' + dias + ' dias, então algo aqui pode ter mudado.';
      }else{
        txt = oque + ' foi conferida em ' + data + ', há ' + dias + ' dias: provavelmente está desatualizada. '
            + 'Use os links de "Vagas de agora" para ver o que está aberto hoje.';
      }
      el.textContent = extra ? (txt + ' ' + extra) : txt;
      el.classList.toggle('velho', dias > 24);
    });
  }

  // ---------------------------------------------------------- contadores / perfil
  function atualizarContadores(){
    var n = listaFavoritos().length;
    var c = $('fav-count');
    if(c) c.textContent = n === 0 ? 'Nenhum item salvo' : (n === 1 ? '1 item salvo' : n + ' itens salvos');
    var stf = $('st-favoritos'); if(stf) stf.textContent = String(n);
    var res = $('perfil-fav-resumo');
    if(res) res.textContent = n === 0 ? 'Nenhum item salvo ainda'
           : (n === 1 ? '1 item guardado para abrir depois' : n + ' itens guardados para abrir depois');
  }

  function desenharPerfil(){
    var nome = S.nome || '';
    var inicial = (nome.trim().charAt(0) || 'V').toUpperCase();
    var pn = $('prof-name');    if(pn) pn.textContent = nome || 'Visitante';
    var pi = $('prof-initial'); if(pi) pi.textContent = inicial;
    var hn = $('home-name');    if(hn) hn.textContent = nome ? ('Olá, ' + nome) : 'Olá!';
    var hi = $('home-initial'); if(hi) hi.textContent = inicial;
    var inp = $('prof-input');
    if(inp && document.activeElement !== inp) inp.value = nome;
    var inpSobre = $('prof-sobre');
    if(inpSobre && document.activeElement !== inpSobre) inpSobre.value = S.sobre || '';
    sincronizarAparecer();
    var ss = $('st-sessoes'); if(ss) ss.textContent = String(S.sessoes || 1);
    var sm = $('st-msgs');    if(sm) sm.textContent = String(S.mensagens || 0);
    var sd = $('st-desde');   if(sd) sd.textContent = dataCurta(S.desde);
    atualizarContadores();
    atualizarPrivacidade();
    atualizarComposer();
  }

  function desenharTudo(){
    desenharFavoritos();
    desenharPerfil();
  }

  // ---------------------------------------------------------- bolhas de conversa
  function bolha(tipo, quem, conteudo, ts){
    var el = texto('div', 'msg ' + tipo);
    if(quem) el.appendChild(texto('span', 'who', quem + (ts ? ' · ' + horaCurta(ts) : '')));
    var t = texto('span', 'txt', conteudo || '');
    el.appendChild(t);
    el._txt = t;
    return el;
  }
  function aoFim(id){
    var log = $(id);
    if(log) log.scrollTop = log.scrollHeight;
    var tela = $('scr-chat');
    if(tela && tela.classList.contains('active')) tela.scrollTop = tela.scrollHeight;
  }

  // ---------------------------------------------------------- assistente de IA
  // A IA (Claude) roda na função "assistente" do Supabase: a chave fica lá, e
  // as regras da assistente também. Só quem entrou na conta pode perguntar.
  var turnos = [];
  var ctlIA = null, iaOcupada = false, iaDesligada = false;
  var BOAS_VINDAS = 'Oi! Sou a assistente do Inclua Santos. Posso explicar as telas do app, ajudar a entender as vagas para PCD em Santos, mostrar como salvar favoritos e ativar o texto grande. O que você quer saber?';

  function atualizarIA(){
    var semConta = dbResolvido && !UID;
    var entrar = $('ia-entrar'); if(entrar) entrar.hidden = !semConta || !sb;
    var av = $('ia-unavailable'); if(av) av.hidden = !iaDesligada;
    var ok = !!sb && !iaDesligada;
    var ponto = $('ia-dot'); if(ponto) ponto.classList.toggle('off', !ok || semConta);
    var sug = $('ia-sugestoes'); if(sug) sug.hidden = !ok;
    var inp = $('ia-input'); if(inp) inp.disabled = !ok;
    var env = $('ia-send'); if(env && !iaOcupada) env.disabled = !ok;
    var st = $('ia-status');
    if(st && !iaOcupada) st.textContent = !sb ? 'Sem conexão com a assistente agora'
      : (iaDesligada ? 'Assistente indisponível no momento'
      : (semConta ? 'Entre com seu e-mail para conversar' : 'Assistente do app · disponível 24 horas'));
  }

  function erroIA(status, erro){
    if(status === 401) return 'Sua sessão terminou. Entre de novo pelo Perfil para continuar a conversa.';
    if(status === 429) return 'Você chegou ao limite de perguntas de hoje. Amanhã a assistente volta a responder.';
    if(status === 503) return 'Muitas perguntas ao mesmo tempo. Espere um pouco e tente de novo.';
    if(status === 404 || erro === 'configuracao') return 'A assistente está sendo ligada pela equipe do app e logo volta a responder.';
    if(status === 0) return 'Sem conexão. Confira sua internet e tente de novo.';
    return 'A resposta falhou no caminho. Tente enviar de novo em instantes.';
  }

  function iaOcupar(on){
    iaOcupada = !!on;
    var env = $('ia-send'), stop = $('ia-stop'), inp = $('ia-input');
    var tinhaFoco = document.activeElement === env || document.activeElement === stop;
    if(env){ env.hidden = !!on; env.disabled = !!on || iaDesligada; }
    if(stop) stop.hidden = !on;
    if(inp) inp.readOnly = !!on;
    if(tinhaFoco){
      var alvo = on ? stop : env;
      if(alvo && !alvo.hidden && !alvo.disabled) alvo.focus();
    }
    var st = $('ia-status');
    if(st && on) st.textContent = 'Pensando na resposta...';
    if(!on) atualizarIA();
  }

  function historicoIA(){
    var lista = turnos.slice(-12);
    while(lista.length && lista[0].role !== 'user') lista.shift();
    return lista;
  }

  function perguntarIA(txt){
    txt = String(txt || '').trim().slice(0, 1000);
    var inp = $('ia-input');
    if(!txt || iaOcupada) return;
    if(!sb){ toast('Sem conexão. Tente de novo em instantes'); return; }
    if(!UID){
      if(inp && !inp.value) inp.value = txt;
      abrirEntrar('assistente');
      return;
    }
    if(iaDesligada){ atualizarIA(); return; }
    var log = $('log-ia');
    if(!log) return;
    if(inp){ inp.value = ''; inp.style.height = ''; }

    log.appendChild(bolha('me', 'Você', txt, Date.now()));
    turnos.push({role: 'user', content: txt});
    if(turnos.length > 12) turnos = turnos.slice(-12);
    var resposta = bolha('ai', 'Assistente', 'Pensando...', Date.now());
    log.appendChild(resposta);
    aoFim('log-ia');
    iaOcupar(true);

    var ctl = ctlIA = (window.AbortController ? new AbortController() : null);
    sb.auth.getSession().then(function(r){
      var sessao = r && r.data ? r.data.session : null;
      if(!sessao) throw {status: 401};
      return fetch(CFG.supabaseUrl + '/functions/v1/assistente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CFG.supabaseChave,
          'Authorization': 'Bearer ' + sessao.access_token
        },
        body: JSON.stringify({mensagens: historicoIA()}),
        signal: ctl ? ctl.signal : undefined
      });
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(corpo){
        if(res.status !== 200 || typeof corpo.texto !== 'string') throw {status: res.status, erro: corpo.erro};
        return corpo;
      });
    }).then(function(corpo){
      var texto = limpar(corpo.texto, 4000);
      resposta._txt.textContent = texto;
      turnos.push({role: 'assistant', content: texto});
      if(corpo.cortada) log.appendChild(bolha('sys', '', 'A resposta foi cortada no meio. Pergunte por partes.', 0));
      var restam = Number(corpo.restam);
      if(!isNaN(restam) && restam <= 3){
        log.appendChild(bolha('sys', '', restam === 0 ? 'Esta foi a última pergunta de hoje. Amanhã a assistente volta a responder.'
          : (restam === 1 ? 'Você ainda pode fazer 1 pergunta hoje.' : 'Você ainda pode fazer ' + restam + ' perguntas hoje.'), 0));
      }
      var live = $('ia-live'); if(live) live.textContent = 'Resposta da assistente: ' + texto;
    }).catch(function(e){
      turnos.pop();
      if(e && e.name === 'AbortError'){
        resposta._txt.textContent = 'Resposta interrompida por você.';
        return;
      }
      var status = (e && typeof e.status === 'number') ? e.status : 0;
      if(status === 404 || (e && e.erro === 'configuracao')) iaDesligada = true;
      var msg = erroIA(status, e && e.erro);
      resposta._txt.textContent = msg;
      var live2 = $('ia-live'); if(live2) live2.textContent = msg;
    }).then(function(){
      if(ctlIA === ctl) ctlIA = null;
      iaOcupar(false);
      aoFim('log-ia');
    });
  }

  // ---------------------------------------------------------- abas do chat
  var abaChat = 'ia';
  function aba(qual){
    abaChat = qual === 'comm' ? 'comm' : 'ia';
    var ehIA = abaChat === 'ia';
    var tIA = $('tab-ia'), tC = $('tab-comm'), pIA = $('panel-ia'), pC = $('panel-comm');
    if(tIA) tIA.setAttribute('aria-selected', ehIA ? 'true' : 'false');
    if(tC)  tC.setAttribute('aria-selected', ehIA ? 'false' : 'true');
    if(pIA) pIA.hidden = !ehIA;
    if(pC)  pC.hidden = ehIA;
    if(ehIA) atualizarIA();
    else { iniciarComunidade(); atualizarComposer(); }
  }

  // ---------------------------------------------------------- moderação e denúncias
  var MOTIVOS = {
    assedio: 'Assédio ou conteúdo sexual',
    ofensa:  'Ofensa, discriminação ou capacitismo',
    golpe:   'Golpe ou pedido de dinheiro',
    dados:   'Expõe ou pede dados pessoais',
    falso:   'Perfil falso ou se passando por outra pessoa',
    outro:   'Outro motivo'
  };
  // Só a moderação recebe isto do banco (as regras de acesso garantem).
  var MOD = {pendentes: [], msgs: {}, perfis: {}, ocultosMsg: [], ocultosPerfis: [], bloqueados: []};
  var MOD_BLOQ = {};

  function escondido(chave, autorUid){
    if(autorUid && (BLOQ_PESSOAIS[autorUid] || MOD_BLOQ[autorUid])) return true;
    return !!(denunciasLocais[chave] || MINHAS_DENUNCIAS[chave]);
  }

  function carregarModeracao(){
    if(!sb || !PODE_MODERAR) return Promise.resolve();
    return Promise.all([
      sb.from('denuncias').select('chave, tipo, alvo, motivo, criada_em').is('resolvida_em', null)
        .order('criada_em', {ascending:false}).limit(500),
      sb.from('mensagens').select('id, autor, autor_nome, texto, criada_em, oculta_em').not('oculta_em', 'is', null)
        .order('oculta_em', {ascending:false}).limit(20),
      sb.from('perfis').select('id, nome, sobre, oculto_em').not('oculto_em', 'is', null)
        .order('oculto_em', {ascending:false}).limit(20),
      sb.from('bloqueios').select('usuario, nome, criado_em').order('criado_em', {ascending:false}).limit(100)
    ]).then(function(r){
      r.forEach(function(x){ if(x.error) throw x.error; });
      var grupos = {};
      r[0].data.forEach(function(d){
        var g = grupos[d.chave] || (grupos[d.chave] = {chave:d.chave, tipo:d.tipo, alvo:d.alvo, qtd:0, motivos:{}, ultima:0});
        g.qtd++;
        g.motivos[d.motivo] = (g.motivos[d.motivo] || 0) + 1;
        g.ultima = Math.max(g.ultima, deIso(d.criada_em));
      });
      MOD.pendentes = Object.keys(grupos).map(function(k){ return grupos[k]; })
        .sort(function(a, b){ return (b.qtd - a.qtd) || (b.ultima - a.ultima); });
      MOD.ocultosMsg = r[1].data;
      MOD.ocultosPerfis = r[2].data;
      MOD.bloqueados = r[3].data;
      MOD_BLOQ = {};
      MOD.bloqueados.forEach(function(b){ MOD_BLOQ[b.usuario] = true; });
      var idsMsg = [], idsPerfil = [];
      MOD.pendentes.forEach(function(g){
        if(g.tipo === 'mensagem') idsMsg.push(Number(g.chave.slice(2)));
        else idsPerfil.push(g.alvo);
      });
      return Promise.all([
        idsMsg.length ? sb.from('mensagens').select('id, autor, autor_nome, texto, oculta_em').in('id', idsMsg.slice(0, 200)) : {data: []},
        idsPerfil.length ? sb.from('perfis').select('id, nome, sobre, oculto_em').in('id', idsPerfil.slice(0, 200)) : {data: []}
      ]);
    }).then(function(r){
      MOD.msgs = {}; MOD.perfis = {};
      ((r[0] && r[0].data) || []).forEach(function(m){ MOD.msgs['m:' + m.id] = m; });
      ((r[1] && r[1].data) || []).forEach(function(p){ MOD.perfis[p.id] = p; });
      MOD.ocultosMsg.forEach(function(m){ MOD.msgs['m:' + m.id] = m; });
      MOD.ocultosPerfis.forEach(function(p){ MOD.perfis[p.id] = p; });
      desenharModeracao();
      if(ultimaComunidade) desenharComunidade(ultimaComunidade);
    }).catch(function(){
      var r = $('perfil-mod-resumo');
      if(r) r.textContent = 'Não deu para carregar as denúncias agora';
    });
  }

  function rotuloMotivos(g){
    return Object.keys(g.motivos).map(function(m){
      return (MOTIVOS[m] || MOTIVOS.outro) + (g.motivos[m] > 1 ? ' (' + g.motivos[m] + ')' : '');
    }).join(' · ');
  }

  function conteudoDenunciado(chave, tipo, alvo){
    if(tipo === 'perfil'){
      var p = MOD.perfis[alvo];
      return p ? {titulo: 'Perfil de ' + (p.nome || 'conta sem nome'), texto: p.sobre || 'Sem descrição.', oculto: !!p.oculto_em}
               : {titulo: 'Perfil em Namoro e conexões', texto: 'Este perfil foi apagado ou não carregou.', oculto: false};
    }
    var m = MOD.msgs[chave];
    return m ? {titulo: 'Mensagem de ' + (m.autor_nome || 'Alguém'), texto: m.texto, oculto: !!m.oculta_em}
             : {titulo: 'Mensagem da Comunidade', texto: 'A mensagem foi apagada ou não carregou.', oculto: false};
  }

  function botaoMod(rotulo, classe, acao){
    var b = texto('button', classe, rotulo);
    b.type = 'button';
    b.addEventListener('click', acao);
    return b;
  }

  function cartaoMod(titulo, citacao, detalhe, botoes){
    var card = texto('div', 'mod-item');
    card.appendChild(texto('h4', null, titulo));
    if(citacao) card.appendChild(texto('p', 'citacao', citacao));
    card.appendChild(texto('p', null, detalhe));
    var linha = texto('div', 'mod-botoes');
    botoes.forEach(function(b){ linha.appendChild(b); });
    card.appendChild(linha);
    return card;
  }

  function desenharModeracao(){
    var lista = PODE_MODERAR ? MOD.pendentes : [];
    var resumo = $('perfil-mod-resumo');
    if(resumo) resumo.textContent = lista.length === 0 ? 'Nenhuma denúncia para revisar'
      : (lista.length === 1 ? '1 denúncia para revisar' : lista.length + ' denúncias para revisar');
    if(!PODE_MODERAR) return;

    var alvo = $('mod-pendentes');
    if(alvo){
      alvo.textContent = '';
      lista.forEach(function(g){
        var c = conteudoDenunciado(g.chave, g.tipo, g.alvo);
        var botoes = [
          botaoMod('Manter visível', null, function(){ moderar('manter', g.chave); }),
          botaoMod('Esconder para todos', null, function(){ moderar('esconder', g.chave); })
        ];
        if(g.alvo && g.alvo !== UID) botoes.push(botaoMod('Bloquear a conta', 'perigo', function(){ moderar('bloquear', g.chave); }));
        alvo.appendChild(cartaoMod(c.titulo, c.texto,
          (g.qtd === 1 ? '1 denúncia' : g.qtd + ' denúncias') + ': ' + rotuloMotivos(g)
            + ' · a última ' + quandoFoi(g.ultima) + (c.oculto ? ' · já está escondido' : ''),
          botoes));
      });
    }
    var vazio = $('mod-vazio');
    if(vazio) vazio.hidden = lista.length > 0;

    var esc = $('mod-ocultos');
    if(esc){
      esc.textContent = '';
      var ocultos = [];
      MOD.ocultosMsg.forEach(function(m){
        ocultos.push({chave: 'm:' + m.id, tipo: 'mensagem', alvo: m.autor, em: deIso(m.oculta_em)});
      });
      MOD.ocultosPerfis.forEach(function(p){
        ocultos.push({chave: 'p:' + p.id, tipo: 'perfil', alvo: p.id, em: deIso(p.oculto_em)});
      });
      ocultos.sort(function(a, b){ return b.em - a.em; }).slice(0, 20).forEach(function(o){
        var c = conteudoDenunciado(o.chave, o.tipo, o.alvo);
        esc.appendChild(cartaoMod(c.titulo, c.texto, 'Escondido ' + quandoFoi(o.em)
          + (MOD_BLOQ[o.alvo] ? ' · a conta está bloqueada' : ''),
          [botaoMod('Mostrar de novo', null, function(){ moderar('mostrar', o.chave); })]));
      });
      var vazioE = $('mod-ocultos-vazio');
      if(vazioE) vazioE.hidden = ocultos.length > 0;
    }

    var bl = $('mod-bloqueados');
    if(bl){
      bl.textContent = '';
      MOD.bloqueados.forEach(function(b){
        bl.appendChild(cartaoMod(b.nome || 'Conta sem nome visível', '', 'Bloqueada ' + quandoFoi(deIso(b.criado_em)),
          [botaoMod('Desbloquear', null, function(){ moderar('desbloquear', null, b.usuario); })]));
      });
      var vazioB = $('mod-bloq-vazio');
      if(vazioB) vazioB.hidden = MOD.bloqueados.length > 0;
    }
  }

  var AVISO_MOD = {manter: 'Visível para todos de novo', mostrar: 'Visível para todos de novo',
                   esconder: 'Escondido para todos', bloquear: 'Conta bloqueada', desbloquear: 'Conta desbloqueada'};
  function moderar(acao, chave, alvoUid){
    if(!sb || !PODE_MODERAR) return;
    var args = {p_acao: acao};
    if(chave) args.p_chave = chave;
    if(alvoUid) args.p_alvo = alvoUid;
    sb.rpc('moderar', args).then(function(r){
      if(r.error) throw r.error;
      toast(AVISO_MOD[acao]);
      return carregarModeracao();
    }).then(function(){
      var foco = document.querySelector('#mod-pendentes .mod-botoes button') || $('mod-rotulo');
      if(foco && telaAtual === 'scr-mod') foco.focus();
      if(comunidadeIniciada) recarregarComunidade();
    }).catch(function(){
      toast('Não deu para salvar. Tente de novo');
    });
  }

  // ---------------------------------------------------------- janela de denúncia
  // Abre com o conteúdo já escolhido (botão na mensagem ou no perfil) ou, pelo
  // botão do alto da Comunidade, com a lista das mensagens recentes para escolher.
  var denunciaAtual = null, focoAntesDenuncia = null, opcoesEscolha = [];
  var AJUDA_DENUNCIA = 'A pessoa denunciada não fica sabendo que foi você. Você deixa de ver o conteúdo na hora, e a moderação decide se esconde para todos.';
  var AJUDA_PROPRIA = 'Esta mensagem é sua. Ela continua aparecendo para você, e a moderação decide se esconde para todos.';

  function botaoDenunciar(rotulo, descricao, acao){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-denunciar';
    b.innerHTML = ICO_BANDEIRA;
    b.appendChild(document.createTextNode(rotulo));
    b.setAttribute('aria-label', descricao);
    b.addEventListener('click', acao);
    return b;
  }

  function mensagensDenunciaveis(){
    return (ultimaComunidade || []).filter(function(m){
      return m.autorUid !== UID && !m.oculta && !escondido(m.chave, m.autorUid);
    }).slice(-6).reverse();
  }

  function montarEscolha(lista){
    opcoesEscolha = lista || [];
    var caixa = $('denuncia-escolha'), alvo = $('denuncia-opcoes');
    if(!caixa || !alvo) return;
    caixa.hidden = !opcoesEscolha.length;
    alvo.textContent = '';
    opcoesEscolha.forEach(function(m, i){
      var rotulo = texto('label', 'motivo escolha');
      var r = document.createElement('input');
      r.type = 'radio';
      r.name = 'alvo-msg';
      r.value = String(i);
      r.addEventListener('change', atualizarEnviarDenuncia);
      rotulo.appendChild(r);
      var corpo = texto('span', 'escolha-txt');
      corpo.appendChild(texto('b', null, m.autor + ' · ' + horaCurta(m.ts)));
      corpo.appendChild(texto('span', null, m.texto.length > 120 ? m.texto.slice(0, 117) + '...' : m.texto));
      rotulo.appendChild(corpo);
      alvo.appendChild(rotulo);
    });
  }

  function atualizarEnviarDenuncia(){
    var fundo = $('denuncia-fundo');
    if(!fundo) return;
    var motivo = fundo.querySelector('input[name="motivo"]:checked');
    var alvo = denunciaAtual || fundo.querySelector('input[name="alvo-msg"]:checked');
    $('denuncia-enviar').disabled = !(motivo && alvo);
  }

  function abrirDenuncia(info){
    if(!sb){ toast('Sem conexão. Tente de novo em instantes'); return; }
    if(!UID){ abrirEntrar('denunciar'); return; }
    var fundo = $('denuncia-fundo');
    if(!fundo) return;
    var escolher = !info;
    var opcoes = escolher ? mensagensDenunciaveis() : [];
    var semNada = escolher && !opcoes.length;
    var propria = !!(info && info.alvo === UID);
    denunciaAtual = info || null;
    focoAntesDenuncia = document.activeElement;
    $('denuncia-titulo').textContent = (info && info.tipo === 'pessoa') ? 'Denunciar perfil' : 'Denunciar mensagem';
    $('denuncia-ajuda').textContent = propria ? AJUDA_PROPRIA : AJUDA_DENUNCIA;
    var resumo = $('denuncia-resumo');
    resumo.hidden = escolher;
    resumo.textContent = info ? (info.resumo.length > 160 ? info.resumo.slice(0, 157) + '...' : info.resumo) : '';
    montarEscolha(opcoes);
    $('denuncia-vazio').hidden = !semNada;
    $('denuncia-motivos').hidden = semNada;
    $('denuncia-enviar').hidden = semNada;
    $('denuncia-bloquear-linha').hidden = semNada || propria;
    $('denuncia-bloquear').checked = false;
    $('denuncia-cancelar').textContent = semNada ? 'Fechar' : 'Cancelar';
    fundo.querySelectorAll('input[name="motivo"]').forEach(function(r){ r.checked = false; });
    atualizarEnviarDenuncia();
    closeMenu();
    fundo.hidden = false;
    fundoInerte(true);
    var primeiro = semNada ? $('denuncia-cancelar') : fundo.querySelector('input[type="radio"]');
    if(primeiro) primeiro.focus();
  }

  function fecharDenuncia(reserva){
    var fundo = $('denuncia-fundo');
    if(fundo) fundo.hidden = true;
    fundoInerte(false);
    denunciaAtual = null;
    montarEscolha(null);
    var volta = (focoAntesDenuncia && document.contains(focoAntesDenuncia)) ? focoAntesDenuncia : reserva;
    if(volta && volta.focus) volta.focus();
    focoAntesDenuncia = null;
  }

  function enviarDenuncia(){
    var info = denunciaAtual;
    if(!info){
      var escolhida = document.querySelector('#denuncia-fundo input[name="alvo-msg"]:checked');
      var m = escolhida ? opcoesEscolha[Number(escolhida.value)] : null;
      if(m) info = {chave: m.chave, tipo: 'mensagem', alvo: m.autorUid, nome: m.autor, resumo: m.autor + ': ' + m.texto};
    }
    var marcado = document.querySelector('#denuncia-fundo input[name="motivo"]:checked');
    if(!info || !marcado || !sb || !UID) return;
    var bloquear = $('denuncia-bloquear').checked && info.alvo && info.alvo !== UID;
    var botao = $('denuncia-enviar');
    botao.disabled = true;
    sb.from('denuncias').insert({chave: info.chave, motivo: marcado.value}).then(function(r){
      // 23505: esta pessoa já tinha denunciado este conteúdo
      if(r.error && r.error.code !== '23505') throw r.error;
      if(!bloquear) return;
      return sb.from('bloqueios_pessoais').insert({bloqueado: info.alvo, nome: limpar(info.nome, 40)}).then(function(r2){
        if(!r2.error || r2.error.code === '23505') BLOQ_PESSOAIS[info.alvo] = limpar(info.nome, 40) || 'Pessoa bloqueada';
      });
    }).then(function(){
      denunciasLocais[info.chave] = true;
      MINHAS_DENUNCIAS[info.chave] = true;
      redesenharModerado();
      desenharBloqueados();
      fecharDenuncia(info.tipo === 'pessoa' ? $('nam-pessoas-rotulo') : $('panel-comm'));
      if(info.alvo === UID) toast('Denúncia enviada para a moderação');
      else toast(bloquear ? 'Denúncia enviada e pessoa bloqueada' : 'Denúncia enviada. Você não verá mais isso');
      if(PODE_MODERAR) carregarModeracao();
    }).catch(function(){
      botao.disabled = false;
      toast('A denúncia não foi enviada. Tente de novo');
    });
  }

  function redesenharModerado(){
    if(ultimaComunidade) desenharComunidade(ultimaComunidade);
    desenharPessoas();
    desenharModeracao();
    atualizarComposer();
  }

  // ---------------------------------------------------------- bloqueio pessoal
  function desenharBloqueados(){
    var bloco = $('bloq-bloco'), lista = $('bloq-lista');
    if(!lista) return;
    var ids = Object.keys(BLOQ_PESSOAIS);
    if(bloco) bloco.hidden = !ids.length;
    lista.textContent = '';
    ids.forEach(function(uid){
      var linha = texto('div', 'item estatico');
      var ic = texto('span', 'ic');
      ic.setAttribute('style', 'background:var(--c-sau-bg); color:var(--c-sau)');
      ic.innerHTML = ICO_BLOQUEIO;
      linha.appendChild(ic);
      var meio = document.createElement('span');
      meio.appendChild(texto('h4', null, BLOQ_PESSOAIS[uid]));
      var botoes = texto('div', 'mod-botoes');
      botoes.appendChild(botaoMod('Desbloquear', null, function(){ desbloquearPessoa(uid); }));
      meio.appendChild(botoes);
      linha.appendChild(meio);
      lista.appendChild(linha);
    });
  }

  function desbloquearPessoa(uid){
    if(!sb || !UID) return;
    sb.from('bloqueios_pessoais').delete().eq('quem', UID).eq('bloqueado', uid).then(function(r){
      if(r.error) throw r.error;
      delete BLOQ_PESSOAIS[uid];
      desenharBloqueados();
      redesenharModerado();
      toast('Pessoa desbloqueada');
    }).catch(function(){ toast('Não deu para desbloquear. Tente de novo'); });
  }

  // ---------------------------------------------------------- comunidade
  var comunidadeIniciada = false, comunidadeOk = false;
  var nosComunidade = {};
  var ultimaComunidade = null;
  var recargaT = null, recarregando = false;

  function comunidadeIndisponivel(){
    comunidadeOk = false;
    var av = $('comm-unavailable'); if(av) av.hidden = false;
    var ponto = $('comm-dot'); if(ponto) ponto.classList.add('off');
    atualizarComposer();
  }

  function atualizarComposer(){
    var semConexao = !sb || (comunidadeIniciada && !comunidadeOk && ultimaComunidade === null);
    var inp = $('comm-input'), env = $('comm-send');
    var travado = semConexao || (UID && BLOQUEADO);
    if(inp) inp.disabled = !!travado;
    if(env) env.disabled = !!travado;
    var entrar = $('comm-entrar'); if(entrar) entrar.hidden = !!UID || semConexao || !dbResolvido;
    var nome = $('comm-name'); if(nome) nome.hidden = !UID || !!S.nome || BLOQUEADO;
    var priv = $('comm-priv'); if(priv) priv.hidden = !UID || !!S.privacidade || BLOQUEADO;
    var bloq = $('comm-bloqueado'); if(bloq) bloq.hidden = !(UID && BLOQUEADO);
    var den = $('comm-denunciar'); if(den) den.hidden = !comunidadeOk;
  }

  var NOTAS_MINHAS = {
    oculta: 'Escondida pela moderação · só você vê',
    denunciada: 'Você denunciou esta mensagem'
  };

  function desenharComunidade(itens){
    var log = $('log-comm');
    if(!log) return;
    // quem escreveu sempre vê a própria mensagem, com um aviso se houver denúncia ou moderação
    var visiveis = [];
    itens.forEach(function(m){
      if(m.autorUid !== UID){
        if(!m.oculta && !escondido(m.chave, m.autorUid)) visiveis.push({m: m, meu: false, no: 'outro:' + m.chave, nota: ''});
        return;
      }
      var estado = '';
      if(BLOQUEADO || m.oculta) estado = 'oculta';
      else if(denunciasLocais[m.chave] || MINHAS_DENUNCIAS[m.chave]) estado = 'denunciada';
      visiveis.push({m: m, meu: true, no: 'eu:' + m.chave + (estado ? '#' + estado : ''), nota: NOTAS_MINHAS[estado] || ''});
    });
    var presentes = {};
    visiveis.forEach(function(v){ presentes[v.no] = true; });
    Object.keys(nosComunidade).forEach(function(k){
      if(!presentes[k]){
        var no = nosComunidade[k];
        if(no && no.parentNode) no.parentNode.removeChild(no);
        delete nosComunidade[k];
      }
    });
    var novos = 0;
    visiveis.forEach(function(v){
      if(nosComunidade[v.no]) return;
      var m = v.m;
      var el = bolha(v.meu ? 'me' : 'them', v.meu ? 'Você' : m.autor, m.texto, m.ts);
      if(v.nota){
        el.appendChild(texto('span', 'nota', v.nota));
      }else{
        var acoes = texto('span', 'acoes');
        acoes.appendChild(botaoDenunciar('Denunciar', v.meu ? 'Denunciar a sua mensagem' : 'Denunciar a mensagem de ' + m.autor, function(){
          abrirDenuncia({chave: m.chave, tipo: 'mensagem', alvo: m.autorUid, nome: m.autor,
                         resumo: (v.meu ? 'Você' : m.autor) + ': ' + m.texto});
        }));
        el.appendChild(acoes);
      }
      nosComunidade[v.no] = el;
      log.appendChild(el);
      novos++;
    });
    var fora = false, anterior = null;
    for(var i = 0; i < visiveis.length; i++){
      var no2 = nosComunidade[visiveis[i].no];
      if(!no2) continue;
      if(anterior && anterior.nextSibling !== no2){ fora = true; break; }
      anterior = no2;
    }
    if(fora) visiveis.forEach(function(v){
      var n3 = nosComunidade[v.no];
      if(n3) log.appendChild(n3);
    });
    var vazio = $('comm-vazio');
    if(visiveis.length === 0){
      if(!vazio){
        vazio = bolha('sys', '', 'Ninguém escreveu ainda. Comece a conversa!', 0);
        vazio.id = 'comm-vazio';
        log.appendChild(vazio);
      }
    }else if(vazio && vazio.parentNode){
      vazio.parentNode.removeChild(vazio);
    }
    if(novos) aoFim('log-comm');
  }

  function recarregarComunidade(){
    if(!sb) return Promise.resolve();
    if(recarregando) return Promise.resolve();
    recarregando = true;
    return sb.from('mensagens').select('id, autor, autor_nome, texto, criada_em, oculta_em')
      .order('criada_em', {ascending:false}).limit(80)
      .then(function(r){
        if(r.error) throw r.error;
        comunidadeOk = true;
        var av = $('comm-unavailable'); if(av) av.hidden = true;
        var ponto = $('comm-dot'); if(ponto && canalOnlineOk) ponto.classList.remove('off');
        ultimaComunidade = (r.data || []).map(function(m){
          return {
            chave: 'm:' + m.id,
            autorUid: m.autor,
            ts: deIso(m.criada_em),
            autor: limpar(m.autor_nome, 40).trim() || 'Alguém',
            texto: limpar(m.texto, 600),
            oculta: !!m.oculta_em
          };
        }).reverse();
        desenharComunidade(ultimaComunidade);
        atualizarComposer();
      }).catch(function(){
        comunidadeIndisponivel();
      }).then(function(){ recarregando = false; });
  }

  function agendarRecarga(){
    if(recargaT) clearTimeout(recargaT);
    recargaT = setTimeout(function(){ recargaT = null; recarregarComunidade(); }, 400);
  }

  function tirarCarregando(){
    var c = $('comm-carregando');
    if(c && c.parentNode) c.parentNode.removeChild(c);
  }

  function iniciarComunidade(){
    if(comunidadeIniciada){ recarregarComunidade(); return; }
    comunidadeIniciada = true;
    if(!sb){ comunidadeIndisponivel(); return; }
    var log = $('log-comm');
    if(log && !ultimaComunidade){
      var carregando = bolha('sys', '', 'Carregando a conversa...', 0);
      carregando.id = 'comm-carregando';
      log.appendChild(carregando);
    }
    recarregarComunidade().then(tirarCarregando);
    try{
      sb.channel('comunidade-mensagens')
        .on('postgres_changes', {event: '*', schema: 'public', table: 'mensagens'}, agendarRecarga)
        .subscribe();
    }catch(e){}
    setInterval(function(){
      if(telaAtual === 'scr-chat' && !document.hidden) recarregarComunidade();
    }, 45000);
  }

  function pedirAceite(){
    var av = $('comm-priv');
    if(av) av.hidden = false;
    var b = $('btn-comm-aceitar');
    if(b) b.focus();
    toast('Aceite a política de privacidade para escrever');
  }

  function erroComunidade(e){
    var msg = String((e && e.message) || '');
    if(msg.indexOf('Muitas mensagens') >= 0) return 'Muitas mensagens em pouco tempo. Espere um minuto e envie de novo.';
    if((e && e.code === '42501') || msg.indexOf('row-level security') >= 0)
      return 'Sua mensagem não foi enviada. Confira se você aceitou a política de privacidade e tente de novo.';
    return 'Sua mensagem não foi enviada. Tente de novo.';
  }

  function enviarComunidade(){
    var inp = $('comm-input');
    if(!inp || !sb) return;
    var txt = String(inp.value || '').trim().slice(0, 600);
    if(!txt) return;
    if(!UID){ abrirEntrar('comunidade'); return; }
    if(!S.privacidade){ pedirAceite(); return; }
    if(BLOQUEADO){ atualizarComposer(); return; }
    var env = $('comm-send');
    if(env) env.disabled = true;
    inp.value = '';
    inp.style.height = '';
    enviarPerfil().then(function(){
      return sb.from('mensagens').insert({texto: txt});
    }).then(function(r){
      if(r.error) throw r.error;
      S.mensagens = (S.mensagens || 0) + 1;
      gravarLocal();
      desenharPerfil();
      return recarregarComunidade();
    }).catch(function(e){
      var log = $('log-comm');
      if(log) log.appendChild(bolha('sys', '', erroComunidade(e), 0));
      inp.value = txt;
      aoFim('log-comm');
    }).then(function(){
      atualizarComposer();
    });
  }

  // ---------------------------------------------------------- quem está online
  var canalOnline = null, canalOnlineOk = false, online = {};

  function iniciarSala(){
    if(canalOnline) return;
    var el = $('comm-online');
    if(!sb){ if(el) el.textContent = 'Quem está online não aparece agora'; return; }
    try{
      canalOnline = sb.channel('inclua-online', {config: {presence: {key: S.chave || novaChave()}}});
      canalOnline.on('presence', {event: 'sync'}, function(){
        var estado = canalOnline.presenceState() || {};
        var chaves = Object.keys(estado);
        online = {};
        chaves.forEach(function(k){
          (estado[k] || []).forEach(function(meta){
            if(meta && typeof meta.pub === 'string' && meta.pub) online[meta.pub] = true;
          });
        });
        var n = chaves.length;
        var t = $('comm-online');
        if(t) t.textContent = (n <= 1) ? 'Você está aqui agora' : (n + ' pessoas aqui agora');
        desenharPessoas();
      }).subscribe(function(status){
        var t = $('comm-online'), ponto = $('comm-dot');
        if(status === 'SUBSCRIBED'){
          canalOnlineOk = true;
          if(ponto && comunidadeOk) ponto.classList.remove('off');
          avisarSala();
        }else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
          canalOnlineOk = false;
          if(t) t.textContent = 'Quem está online não aparece agora';
          if(ponto) ponto.classList.add('off');
        }
      });
    }catch(e){
      if(el) el.textContent = 'Quem está online não aparece agora';
    }
  }

  // Só quem ligou "Aparecer na lista" mostra no próprio cartão que está online.
  function avisarSala(){
    if(!canalOnline || !canalOnlineOk) return;
    try{
      var pr = canalOnline.track({pub: (UID && S.aparecer) ? UID : ''});
      if(pr && pr.catch) pr.catch(function(){});
    }catch(e){}
  }

  // ---------------------------------------------------------- pessoas (só quem opta)
  var ultimaListaPessoas = [], pessoasCarregadas = false;

  function carregarPessoas(){
    var entrar = $('nam-entrar'), indisp = $('nam-indisponivel');
    if(!dbResolvido) return;
    if(!sb || !UID){
      ultimaListaPessoas = [];
      pessoasCarregadas = false;
      if(entrar) entrar.hidden = !sb ? true : false;
      if(indisp) indisp.hidden = !!sb;
      desenharPessoas();
      return;
    }
    if(entrar) entrar.hidden = true;
    sb.rpc('pessoas_visiveis').then(function(r){
      if(r.error) throw r.error;
      if(indisp) indisp.hidden = true;
      ultimaListaPessoas = (r.data || []).map(function(p){
        return {id: p.id, nome: limpar(p.nome, 40).trim(), sobre: limpar(p.sobre, 160).trim(), oculto: !!p.oculto};
      }).filter(function(p){ return p.nome; });
      pessoasCarregadas = true;
      desenharPessoas();
    }).catch(function(){
      pessoasCarregadas = false;
      if(indisp) indisp.hidden = false;
      desenharPessoas();
    });
  }

  function desenharPessoas(){
    var alvo = $('nam-pessoas');
    if(!alvo) return;
    var lista = ultimaListaPessoas.filter(function(p){
      return p.id === UID || !escondido('p:' + p.id, p.id);
    });
    alvo.textContent = '';
    var vazio = $('nam-pessoas-vazio');
    if(vazio) vazio.hidden = !(UID && pessoasCarregadas && lista.length === 0);
    lista.forEach(function(p){
      var eu = p.id === UID;
      var caixa = texto('div', 'pessoa-linha');
      var linha = document.createElement('button');
      linha.className = 'item';
      linha.type = 'button';
      linha.addEventListener('click', function(){ go('scr-chat'); aba('comm'); });

      var ic = texto('span', 'ic', (p.nome.charAt(0) || '?').toUpperCase());
      ic.setAttribute('style', 'background:var(--c-nam-bg); color:var(--c-nam); font-weight:700');
      linha.appendChild(ic);

      var meio = document.createElement('span');
      meio.appendChild(texto('h4', null, p.nome + (eu ? ' (você)' : '')));
      meio.appendChild(texto('p', null, p.sobre || 'Sem descrição.'));
      if(eu && p.oculto){
        var t0 = texto('span', 'tag', 'Escondido pela moderação');
        t0.setAttribute('style', 'background:var(--c-sau-bg); color:var(--c-sau)');
        meio.appendChild(t0);
      }else if(online[p.id]){
        var t = texto('span', 'tag', 'Online agora');
        t.setAttribute('style', 'background:var(--c-nam-bg); color:var(--c-nam)');
        meio.appendChild(t);
      }
      linha.appendChild(meio);

      var fim = texto('span', 'ext');
      fim.setAttribute('aria-hidden', 'true');
      fim.innerHTML = ICO_CHEV;
      linha.appendChild(fim);
      caixa.appendChild(linha);

      if(!eu){
        caixa.appendChild(botaoDenunciar('Denunciar perfil', 'Denunciar o perfil de ' + p.nome, function(){
          abrirDenuncia({chave: 'p:' + p.id, tipo: 'pessoa', alvo: p.id, nome: p.nome,
                         resumo: p.nome + (p.sobre ? ': ' + p.sobre : '')});
        }));
      }
      alvo.appendChild(caixa);
    });
  }

  function sincronizarAparecer(){
    var b = $('prof-aparecer');
    if(!b) return;
    b.setAttribute('aria-pressed', S.aparecer ? 'true' : 'false');
    var st = b.querySelector('.state');
    if(st) st.textContent = S.aparecer ? 'Ligado' : 'Desligado';
  }

  function ligarAparecer(){
    if(!UID || !S.nome || !S.privacidade || !S.maiorIdade || BLOQUEADO) return false;
    S.aparecer = true;
    gravarLocal();
    sincronizarAparecer();
    enviarPerfil().then(function(){ avisarSala(); if(telaAtual === 'scr-nam') carregarPessoas(); });
    return true;
  }

  function confirmarIdade(){
    if(S.maiorIdade) return Promise.resolve(true);
    return abrirDialogo({
      titulo: 'Só para maiores de 18 anos',
      texto: 'Namoro e conexões é só para quem tem 18 anos ou mais. Você confirma que tem 18 anos ou mais?',
      ok: 'Tenho 18 anos ou mais',
      cancelar: 'Não tenho'
    }).then(function(ok){
      if(ok){ S.maiorIdade = Date.now(); gravarLocal(); }
      return ok;
    });
  }

  function clicarAparecer(){
    if(S.aparecer){
      S.aparecer = false;
      gravarLocal();
      sincronizarAparecer();
      enviarPerfil().then(function(){ avisarSala(); });
      toast('Você saiu da lista');
      return;
    }
    if(!UID){ abrirEntrar('aparecer'); return; }
    if(!S.nome){
      toast('Escreva seu nome antes de aparecer na lista');
      var campo = $('prof-input'); if(campo) campo.focus();
      return;
    }
    if(BLOQUEADO){ toast('A moderação bloqueou sua conta'); return; }
    if(!S.privacidade){
      abrirPolitica('aparecer');
      toast('Leia e aceite a política para aparecer na lista');
      return;
    }
    confirmarIdade().then(function(ok){
      if(!ok){ toast('Namoro e conexões é só para maiores de 18 anos'); return; }
      if(ligarAparecer()) toast('Agora você aparece na lista');
    });
  }

  // ---------------------------------------------------------- política de privacidade
  var depoisDoAceite = null, telaAntesPolitica = 'scr-perfil', politicaCarregada = false;

  function abrirPolitica(depois){
    var ativa = document.querySelector('.screen.active');
    if(ativa && ativa.id !== 'scr-priv') telaAntesPolitica = ativa.id;
    depoisDoAceite = depois || null;
    go('scr-priv');
  }

  // O texto vem de privacidade.html, a mesma página pública que vai na Play.
  function carregarPolitica(){
    if(politicaCarregada) return;
    var alvo = $('politica-app');
    if(!alvo || !window.fetch || !window.DOMParser) return;
    fetch('privacidade.html', {cache: 'no-cache'}).then(function(r){
      if(!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function(html){
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var corpo = doc.getElementById('politica-texto');
      if(!corpo) throw new Error('sem texto');
      alvo.textContent = '';
      Array.prototype.slice.call(corpo.children).forEach(function(no){
        alvo.appendChild(document.importNode(no, true));
      });
      var v = corpo.getAttribute('data-versao');
      var chip = $('priv-versao');
      if(v && chip) chip.textContent = 'Versão de ' + v;
      politicaCarregada = true;
    }).catch(function(){
      alvo.textContent = '';
      alvo.appendChild(texto('p', 'notice', 'Não deu para carregar a política agora. Confira sua internet ou use o link abaixo.'));
    });
  }

  function atualizarPrivacidade(){
    var ok = !!S.privacidade;
    var bt = $('btn-priv-aceitar'); if(bt) bt.hidden = ok;
    var feito = $('priv-aceito');
    if(feito){
      feito.hidden = !ok;
      if(ok) feito.textContent = 'Você aceitou esta política ' + quandoFoi(S.privacidade)
        + '. Para retirar o aceite, use "Apagar meus dados" no Perfil.';
    }
    var res = $('perfil-priv-resumo');
    if(res) res.textContent = ok ? ('Você aceitou ' + quandoFoi(S.privacidade))
      : 'Leia e aceite para escrever na Comunidade e aparecer em Namoro';
  }

  function aceitarPolitica(){
    S.privacidade = Date.now();
    gravarLocal();
    enviarPerfil();
    atualizarPrivacidade();
    atualizarComposer();
    var seguir = depoisDoAceite;
    depoisDoAceite = null;
    if(seguir === 'aparecer'){
      go('scr-perfil');
      var b = $('prof-aparecer');
      if(b) b.focus();
      confirmarIdade().then(function(ok){
        if(!ok){ toast('Política aceita'); return; }
        toast(ligarAparecer() ? 'Pronto! Agora você aparece na lista' : 'Política aceita');
      });
    }else if(seguir === 'comunidade'){
      go('scr-chat');
      aba('comm');
      var inp = $('comm-input');
      if(inp && !inp.disabled) inp.focus();
      toast('Pronto! Agora você pode escrever');
    }else if(seguir === 'voluntario'){
      go('scr-ajudar');
      abaAjuda('vol');
      var enviar = $('vol-enviar');
      if(enviar) enviar.focus();
      toast('Pronto! Agora é só enviar a inscrição');
    }else{
      var feito = $('priv-aceito');
      if(feito){ feito.tabIndex = -1; feito.focus(); }
      toast('Política aceita');
    }
  }

  // ---------------------------------------------------------- seja voluntário ou doe
  // Doação: só os canais oficiais de cada instituição; o app não recebe dinheiro nem dados de cartão.
  // stripe: cole o link de pagamento (Stripe Payment Link) que a própria instituição enviar.
  var ONGS = {
    tamtam:  {nome: 'TamTam', stripe: '', encaminhar: {site: 'https://tamtam.art.br/'}},
    autismo: {nome: 'Instituto Autismo do Brasil', stripe: '', encaminhar: {site: 'https://institutoautismobrasil.com.br/'}},
    lmc:     {nome: 'Lar das Moças Cegas', stripe: '', encaminhar: {tel: '+551332262760', telTexto: '(13) 3226-2760, ramal 2782'}},
    apae:    {nome: 'Apae Santos', stripe: '', encaminhar: {email: 'apae@apaesantos.org.br'}}
  };
  var QUANDO = {
    'semana-manha': 'Dias de semana, de manhã', 'semana-tarde': 'Dias de semana, à tarde',
    'semana-noite': 'Dias de semana, à noite', 'fim-de-semana': 'Fins de semana'
  };
  var COMO = {
    atividades: 'Atividades com as pessoas atendidas', eventos: 'Eventos e bazar',
    divulgacao: 'Divulgação e redes sociais', administrativo: 'Apoio administrativo', outra: 'Outra forma'
  };
  var ICO_CARTAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/></svg>';
  var ICO_CORACAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9A5.2 5.2 0 0 1 12 7a5.2 5.2 0 0 1 9.5 5c-2 4.4-9.5 9-9.5 9z"/></svg>';
  var ongAtual = '';
  var minhasInscricoes = {};
  var todasInscricoes = [];

  function listaDe(valores, mapa){
    return (Array.isArray(valores) ? valores : []).filter(function(v){ return mapa[v]; });
  }
  function rotulos(valores, mapa){
    return valores.map(function(v){ return mapa[v]; }).join(', ');
  }

  function escolherOng(id){
    ongAtual = ONGS[id] ? id : '';
    document.querySelectorAll('[data-doar]').forEach(function(b){ b.hidden = b.getAttribute('data-doar') !== ongAtual; });
    document.querySelectorAll('[data-vol-nota]').forEach(function(b){ b.hidden = b.getAttribute('data-vol-nota') !== ongAtual; });
    var e1 = $('doar-escolha'); if(e1) e1.hidden = !!ongAtual;
    var e2 = $('vol-escolha'); if(e2) e2.hidden = !!ongAtual;
    var ok = $('vol-ok'); if(ok) ok.hidden = true;
    desenharStripe();
    atualizarFormVoluntario();
  }

  function desenharStripe(){
    var alvo = $('doar-stripe'), sem = $('doar-sem-stripe');
    if(!alvo) return;
    var ong = ONGS[ongAtual];
    var link = ong ? urlSegura(ong.stripe) : '';
    if(!/^https:\/\/(buy|donate)\.stripe\.com\//.test(link)) link = '';
    alvo.textContent = '';
    alvo.hidden = !link;
    if(sem) sem.hidden = !ong || !!link;
    if(!link) return;
    var a = document.createElement('a');
    a.className = 'item';
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener';
    var ic = texto('span', 'ic');
    ic.setAttribute('style', 'background:var(--c-ong-bg); color:var(--c-ong)');
    ic.innerHTML = ICO_CARTAO;
    a.appendChild(ic);
    var meio = document.createElement('span');
    meio.appendChild(texto('h4', null, 'Doar com cartão de crédito'));
    meio.appendChild(texto('p', null, 'Você digita o cartão na página segura do Stripe e o valor vai para ' + ong.nome));
    a.appendChild(meio);
    var fim = texto('span', 'ext');
    fim.setAttribute('aria-hidden', 'true');
    fim.innerHTML = ICO_EXT;
    a.appendChild(fim);
    alvo.appendChild(a);
  }

  function abaAjuda(qual){
    var doar = qual !== 'vol';
    var tD = $('tab-doar'), tV = $('tab-vol'), pD = $('panel-doar'), pV = $('panel-vol');
    if(tD) tD.setAttribute('aria-selected', doar ? 'true' : 'false');
    if(tV) tV.setAttribute('aria-selected', doar ? 'false' : 'true');
    if(pD) pD.hidden = !doar;
    if(pV) pV.hidden = doar;
    if(!doar) iniciarVoluntarios();
  }

  function atualizarFormVoluntario(){
    var semConta = dbResolvido && !UID;
    var indisp = $('vol-indisponivel'); if(indisp) indisp.hidden = !semConta || !ongAtual;
    var ok = $('vol-ok');
    var form = $('vol-form');
    if(form) form.hidden = !ongAtual || semConta || !!(ok && !ok.hidden);
    var alvoNome = $('vol-ong-nome');
    if(alvoNome) alvoNome.textContent = ongAtual ? ONGS[ongAtual].nome : 'a instituição escolhida';
    var nome = $('vol-nome');
    if(nome && !nome.value && S.nome) nome.value = S.nome;
  }

  function contatoValido(c){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || c.replace(/\D/g, '').length >= 8;
  }

  function marcados(id, mapa){
    var lista = [];
    document.querySelectorAll('#' + id + ' input:checked').forEach(function(c){
      if(mapa[c.value]) lista.push(c.value);
    });
    return lista;
  }

  function enviarVoluntario(e){
    if(e) e.preventDefault();
    var erro = $('vol-erro');
    if(erro) erro.hidden = true;
    function falha(msg, campo){
      if(erro){ erro.textContent = msg; erro.hidden = false; }
      if(campo) campo.focus();
    }
    if(!ongAtual){ falha('Escolha uma instituição no alto da tela.', document.querySelector('input[name="ong"]')); return; }
    if(!sb){ falha('Sem conexão. Confira sua internet e tente de novo.'); return; }
    if(!UID){ abrirEntrar('voluntario'); return; }
    var nome = limpar($('vol-nome').value, 60).trim();
    var contato = limpar($('vol-contato').value, 80).trim();
    var quando = marcados('vol-quando', QUANDO), como = marcados('vol-como', COMO);
    if(!nome){ falha('Escreva seu nome.', $('vol-nome')); return; }
    if(!contatoValido(contato)){ falha('Deixe um WhatsApp, telefone ou e-mail para a instituição falar com você.', $('vol-contato')); return; }
    if(!quando.length){ falha('Marque quando você pode ajudar.', document.querySelector('#vol-quando input')); return; }
    if(!como.length){ falha('Marque como você quer ajudar.', document.querySelector('#vol-como input')); return; }
    if(!S.privacidade){
      abrirPolitica('voluntario');
      toast('Leia e aceite a política para se inscrever');
      return;
    }
    var ong = ongAtual;
    var dados = {
      ong: ong, nome: nome, contato: contato, quando: quando, como: como,
      acessibilidade: limpar($('vol-acess').value, 160).trim(),
      mensagem: limpar($('vol-msg').value, 400).trim()
    };
    var botao = $('vol-enviar');
    if(botao) botao.disabled = true;
    enviarPerfil().then(function(){
      return sb.from('voluntarios').upsert(dados, {onConflict: 'usuario,ong'});
    }).then(function(r){
      if(r.error) throw r.error;
      var form = $('vol-form');
      if(form){ form.reset(); form.hidden = true; }
      var t = $('vol-ok-texto');
      if(t) t.textContent = 'A equipe do Inclua Santos recebeu sua inscrição e encaminha para a ONG responsável: '
        + ONGS[ong].nome + '. Ela fala com você pelo contato que você deixou. Acompanhe o andamento aqui embaixo.';
      var ok = $('vol-ok');
      if(ok){ ok.hidden = false; ok.focus(); }
      toast('Inscrição enviada');
      carregarMinhasInscricoes();
      if(PODE_MODERAR) carregarInscricoesAdmin();
    }).catch(function(){
      falha('A inscrição não foi enviada. Tente de novo.');
    }).then(function(){
      if(botao) botao.disabled = false;
    });
  }

  function iniciarVoluntarios(){
    atualizarFormVoluntario();
    carregarMinhasInscricoes();
  }

  function carregarMinhasInscricoes(){
    if(!sb || !UID){ minhasInscricoes = {}; desenharMinhasInscricoes(); return; }
    sb.from('voluntarios').select('ong, criada_em, encaminhada_em').eq('usuario', UID).then(function(r){
      if(r.error) throw r.error;
      minhasInscricoes = {};
      (r.data || []).forEach(function(i){ minhasInscricoes[i.ong] = i; });
      desenharMinhasInscricoes();
    }).catch(function(){});
  }

  function desenharMinhasInscricoes(){
    var alvo = $('vol-minhas'), bloco = $('vol-minhas-bloco');
    if(!alvo) return;
    alvo.textContent = '';
    var ids = Object.keys(minhasInscricoes).filter(function(k){ return ONGS[k]; }).sort(function(a, b){
      return deIso(minhasInscricoes[b].criada_em) - deIso(minhasInscricoes[a].criada_em);
    });
    if(bloco) bloco.hidden = !ids.length;
    ids.forEach(function(k){
      var it = minhasInscricoes[k];
      var enviada = deIso(it.encaminhada_em);
      var linha = texto('div', 'item estatico');
      var ic = texto('span', 'ic');
      ic.setAttribute('style', 'background:var(--c-ong-bg); color:var(--c-ong)');
      ic.innerHTML = ICO_CORACAO;
      linha.appendChild(ic);
      var meio = document.createElement('span');
      meio.appendChild(texto('h4', null, ONGS[k].nome));
      meio.appendChild(texto('p', null, 'Inscrição feita ' + quandoFoi(deIso(it.criada_em))));
      var tag = texto('span', 'tag', enviada ? 'Enviado para a ONG responsável · ' + dataCurta(enviada) : 'Aguardando encaminhamento');
      tag.setAttribute('style', enviada ? 'background:var(--fav-bg); color:var(--fav)' : 'background:var(--c-ong-bg); color:var(--c-ong)');
      meio.appendChild(tag);
      linha.appendChild(meio);
      alvo.appendChild(linha);
    });
  }

  // ---------------------------------------------------------- inscrições (equipe do app)
  function carregarInscricoesAdmin(){
    if(!sb || !PODE_MODERAR) return;
    sb.from('voluntarios')
      .select('id, usuario, ong, nome, contato, quando, como, acessibilidade, mensagem, criada_em, encaminhada_em')
      .order('criada_em', {ascending:false}).limit(300)
      .then(function(r){
        if(r.error) throw r.error;
        todasInscricoes = (r.data || []).filter(function(it){ return ONGS[it.ong]; }).map(function(it){
          return {
            id: it.id, uid: it.usuario, ong: it.ong,
            nome: limpar(it.nome, 60).trim() || 'Sem nome',
            contato: limpar(it.contato, 80).trim(),
            quando: listaDe(it.quando, QUANDO),
            como: listaDe(it.como, COMO),
            acessibilidade: limpar(it.acessibilidade, 160).trim(),
            mensagem: limpar(it.mensagem, 400).trim(),
            em: deIso(it.criada_em),
            encaminhadoEm: deIso(it.encaminhada_em)
          };
        });
        desenharInscricoesAdmin();
      }).catch(function(){
        var res = $('perfil-insc-resumo');
        if(res) res.textContent = 'Não deu para carregar as inscrições agora';
      });
  }

  function textoInscricao(i){
    return [
      'Inscrição de voluntariado recebida pelo app Inclua Santos',
      '',
      'Instituição: ' + ONGS[i.ong].nome,
      'Nome: ' + i.nome,
      'Contato: ' + i.contato,
      'Quando pode ajudar: ' + rotulos(i.quando, QUANDO),
      'Como quer ajudar: ' + rotulos(i.como, COMO),
      i.acessibilidade ? 'Acessibilidade: ' + i.acessibilidade : '',
      i.mensagem ? 'Mensagem: ' + i.mensagem : '',
      'Enviada em: ' + new Date(i.em).toLocaleString('pt-BR')
    ].filter(function(l, n){ return l || n === 1; }).join('\n');
  }

  function cartaoInscricao(i){
    var ong = ONGS[i.ong];
    var card = texto('div', 'mod-item');
    card.appendChild(texto('h4', null, ong.nome + ' · ' + i.nome));
    card.appendChild(texto('p', null, 'Contato: ' + i.contato));
    card.appendChild(texto('p', null, 'Quando pode ajudar: ' + rotulos(i.quando, QUANDO)));
    card.appendChild(texto('p', null, 'Como quer ajudar: ' + rotulos(i.como, COMO)));
    if(i.acessibilidade) card.appendChild(texto('p', null, 'Acessibilidade: ' + i.acessibilidade));
    if(i.mensagem) card.appendChild(texto('p', 'citacao', i.mensagem));
    card.appendChild(texto('p', null, i.encaminhadoEm
      ? 'Enviada para a instituição ' + quandoFoi(i.encaminhadoEm)
      : 'Recebida ' + quandoFoi(i.em) + ', às ' + horaCurta(i.em)));
    var botoes = texto('div', 'mod-botoes');
    var enc = ong.encaminhar || {};
    var a = null;
    if(enc.email){
      a = texto('a', null, 'Enviar por e-mail para a instituição');
      a.href = 'mailto:' + enc.email + '?subject=' + encodeURIComponent('Inscrição de voluntariado · Inclua Santos')
        + '&body=' + encodeURIComponent(textoInscricao(i));
    }else if(enc.tel){
      a = texto('a', null, 'Ligar: ' + enc.telTexto);
      a.href = 'tel:' + enc.tel;
    }else if(enc.site){
      a = texto('a', null, 'Contato no site da instituição');
      a.href = enc.site;
    }
    if(a){
      a.target = '_blank';
      a.rel = 'noopener';
      botoes.appendChild(a);
    }
    if(!i.encaminhadoEm) botoes.appendChild(botaoMod('Marcar como enviada', null, function(){ marcarEncaminhada(i); }));
    card.appendChild(botoes);
    return card;
  }

  function desenharInscricoesAdmin(){
    var novas = todasInscricoes.filter(function(i){ return !i.encaminhadoEm; });
    var enviadas = todasInscricoes.filter(function(i){ return i.encaminhadoEm; })
      .sort(function(a, b){ return b.encaminhadoEm - a.encaminhadoEm; }).slice(0, 20);
    var res = $('perfil-insc-resumo');
    if(res) res.textContent = !novas.length ? 'Nenhuma inscrição nova'
      : (novas.length === 1 ? '1 inscrição nova' : novas.length + ' inscrições novas');
    [['insc-pendentes', novas, 'insc-vazio'], ['insc-enviadas', enviadas, 'insc-enviadas-vazio']].forEach(function(c){
      var alvo = $(c[0]);
      if(!alvo) return;
      alvo.textContent = '';
      c[1].forEach(function(i){ alvo.appendChild(cartaoInscricao(i)); });
      var vazio = $(c[2]);
      if(vazio) vazio.hidden = c[1].length > 0;
    });
  }

  function marcarEncaminhada(i){
    if(!sb || !PODE_MODERAR) return;
    sb.rpc('marcar_encaminhada', {p_id: i.id}).then(function(r){
      if(r.error) throw r.error;
      toast('Marcada como enviada para a instituição');
      i.encaminhadoEm = Date.now();
      desenharInscricoesAdmin();
      var foco = document.querySelector('#insc-pendentes .mod-botoes button') || $('insc-rotulo');
      if(foco) foco.focus();
    }).catch(function(){
      toast('Não deu para salvar. Tente de novo');
    });
  }

  // ---------------------------------------------------------- apagar dados e conta
  var wipeArmado = false, wipeT = null;
  var SUB_WIPE = 'Remove seu nome, favoritos, estatísticas, seu cartão em Namoro, suas mensagens na Comunidade e suas inscrições de voluntariado.';

  function zerarLocal(tudo){
    S.nome = ''; S.sobre = ''; S.aparecer = false; S.privacidade = 0; S.maiorIdade = 0;
    S.favoritos = {}; S.mensagens = 0; S.sessoes = 1; S.desde = Date.now();
    if(tudo){ S.big = false; S.contraste = false; }
    gravarLocal();
    minhasInscricoes = {};
    desenharMinhasInscricoes();
    sincronizarEstrelas();
    desenharTudo();
  }

  function apagarDados(){
    var titulo = $('wipe-title'), sub = $('wipe-sub');
    if(!wipeArmado){
      wipeArmado = true;
      if(titulo) titulo.textContent = 'Toque de novo para confirmar';
      if(sub) sub.textContent = 'Isso apaga seu nome, favoritos, estatísticas, seu cartão em Namoro, suas mensagens na Comunidade, suas inscrições de voluntariado e o aceite da política.';
      toast('Toque de novo em Apagar para confirmar');
      if(wipeT) clearTimeout(wipeT);
      wipeT = setTimeout(function(){
        wipeArmado = false;
        if(titulo) titulo.textContent = 'Apagar meus dados deste app';
        if(sub) sub.textContent = SUB_WIPE;
      }, 10000);
      return;
    }
    if(wipeT) clearTimeout(wipeT);
    wipeArmado = false;
    if(titulo) titulo.textContent = 'Apagar meus dados deste app';
    if(sub) sub.textContent = SUB_WIPE;
    var noBanco = (sb && UID) ? sb.rpc('apagar_meus_dados').then(function(r){ if(r.error) throw r.error; }) : Promise.resolve();
    noBanco.then(function(){
      zerarLocal(false);
      BLOQ_PESSOAIS = {};
      desenharBloqueados();
      avisarSala();
      if(comunidadeIniciada) recarregarComunidade();
      toast('Seus dados foram apagados');
    }).catch(function(){
      toast('Não deu para apagar agora. Confira sua internet e tente de novo');
    });
  }

  function apagarConta(){
    if(!sb || !UID) return;
    abrirDialogo({
      titulo: 'Apagar sua conta?',
      texto: 'Isso apaga sua conta de login, seu perfil, seus favoritos, suas mensagens, seu cartão em Namoro e suas inscrições de voluntariado. Não dá para desfazer.',
      ok: 'Apagar minha conta',
      perigo: true
    }).then(function(ok){
      if(!ok) return;
      sb.rpc('apagar_minha_conta').then(function(r){
        if(r.error) throw r.error;
        return sb.auth.signOut({scope: 'local'}).then(function(){}, function(){});
      }).then(function(){
        aplicarSessao(null);
        zerarLocal(false);
        BLOQ_PESSOAIS = {};
        desenharBloqueados();
        if(comunidadeIniciada) recarregarComunidade();
        go('scr-home');
        toast('Sua conta foi apagada');
      }).catch(function(){
        toast('Não deu para apagar a conta agora. Tente de novo');
      });
    });
  }

  // ---------------------------------------------------------- ao abrir cada tela
  function aoAbrirTela(id){
    if(id === 'scr-fav'){ desenharFavoritos(); atualizarContadores(); }
    else if(id === 'scr-perfil'){ desenharPerfil(); desenharConta(); desenharBloqueados(); }
    else if(id === 'scr-nam'){ iniciarSala(); carregarPessoas(); }
    else if(id === 'scr-priv'){ carregarPolitica(); atualizarPrivacidade(); }
    else if(id === 'scr-mod'){ carregarModeracao(); }
    else if(id === 'scr-ajudar'){ iniciarVoluntarios(); }
    else if(id === 'scr-insc'){ carregarInscricoesAdmin(); }
    else if(id === 'scr-chat'){ iniciarSala(); aba(abaChat); }
  }

  // ---------------------------------------------------------- ligações de tela
  function crescer(t){
    t.style.height = 'auto';
    t.style.height = Math.max(46, Math.min(t.scrollHeight, 130)) + 'px';
  }

  function ligar(){
    // botões com data-go, data-toast e data-entrar no HTML
    document.addEventListener('click', function(ev){
      var el = ev.target.closest ? ev.target.closest('[data-go],[data-toast],[data-entrar],[data-a11y]') : null;
      if(!el) return;
      if(el.hasAttribute('data-go')){ ev.preventDefault(); go(el.getAttribute('data-go')); }
      else if(el.hasAttribute('data-entrar')){ ev.preventDefault(); abrirEntrar(el.getAttribute('data-entrar')); }
      else if(el.hasAttribute('data-a11y')){ ev.preventDefault(); alternarA11y(el.getAttribute('data-a11y')); }
      else if(el.hasAttribute('data-toast')){ toast(el.getAttribute('data-toast')); }
    });
    var a11y = $('a11yBtn');
    if(a11y) a11y.addEventListener('click', toggleMenu);
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && $('a11yMenu').classList.contains('open')){ closeMenu(); $('a11yBtn').focus(); }
    });

    var cta = $('btn-fav-mode');
    if(cta) cta.addEventListener('click', function(){
      var ligando = cta.getAttribute('aria-pressed') !== 'true';
      modoEscolher(ligando);
      if(ligando){
        go('scr-ativ');
        var primeira = document.querySelector('#scr-ativ .fav-star');
        if(primeira) primeira.focus();
        toast('Toque na estrela de qualquer item para salvar');
      }
    });
    var off = $('btn-fav-mode-off');
    if(off) off.addEventListener('click', function(){
      modoEscolher(false);
      if(cta) cta.focus();
    });

    // abas do chat (setas do teclado trocam de aba)
    var tIA = $('tab-ia'), tC = $('tab-comm');
    if(tIA) tIA.addEventListener('click', function(){ aba('ia'); });
    if(tC)  tC.addEventListener('click', function(){ aba('comm'); });
    [tIA, tC].forEach(function(t){
      if(!t) return;
      t.addEventListener('keydown', function(e){
        if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var outro = (t === tIA) ? tC : tIA;
        if(!outro) return;
        aba(outro === tIA ? 'ia' : 'comm');
        outro.focus();
      });
    });

    // assistente
    var iaInp = $('ia-input'), iaEnv = $('ia-send'), iaStop = $('ia-stop');
    if(iaEnv) iaEnv.addEventListener('click', function(){ if(iaInp) perguntarIA(iaInp.value); });
    if(iaStop) iaStop.addEventListener('click', function(){ if(ctlIA) ctlIA.abort(); });
    if(iaInp){
      iaInp.addEventListener('input', function(){ crescer(iaInp); });
      iaInp.addEventListener('keydown', function(e){
        if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); perguntarIA(iaInp.value); }
      });
    }
    var sug = $('ia-sugestoes');
    if(sug) sug.querySelectorAll('.chip-ask').forEach(function(b){
      b.addEventListener('click', function(){ perguntarIA(b.textContent); });
    });
    var bIA = $('btn-perfil-ia');
    if(bIA) bIA.addEventListener('click', function(){ go('scr-chat'); aba('ia'); });

    var cInp = $('comm-input'), cEnv = $('comm-send');
    if(cEnv) cEnv.addEventListener('click', enviarComunidade);
    if(cInp){
      cInp.addEventListener('input', function(){ crescer(cInp); });
      cInp.addEventListener('keydown', function(e){
        if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); enviarComunidade(); }
      });
    }
    var bPerfil = $('btn-comm-perfil');
    if(bPerfil) bPerfil.addEventListener('click', function(){
      go('scr-perfil');
      var campo = $('prof-input'); if(campo) campo.focus();
    });

    var salvar = $('prof-save'), campo = $('prof-input'), campoSobre = $('prof-sobre');
    function salvarNome(){
      if(!campo) return;
      S.nome = limpar(campo.value, 40).trim();
      if(campoSobre) S.sobre = limpar(campoSobre.value, 120).trim();
      if(!S.nome && S.aparecer) S.aparecer = false;
      gravarLocal();
      enviarPerfil().then(function(){ if(telaAtual === 'scr-nam') carregarPessoas(); });
      desenharPerfil();
      sincronizarAparecer();
      avisarSala();
      toast(S.nome ? 'Perfil salvo' : 'Nome removido');
    }
    if(salvar) salvar.addEventListener('click', salvarNome);
    [campo, campoSobre].forEach(function(c){
      if(c) c.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){ e.preventDefault(); salvarNome(); }
      });
    });

    var bAparecer = $('prof-aparecer');
    if(bAparecer) bAparecer.addEventListener('click', clicarAparecer);

    var bNamAparecer = $('btn-nam-aparecer');
    if(bNamAparecer) bNamAparecer.addEventListener('click', function(){
      go('scr-perfil');
      var alvo = $('prof-aparecer');
      if(alvo) alvo.focus();
      toast('Ative "Aparecer na lista de pessoas"');
    });

    var bPriv = $('btn-perfil-priv');
    if(bPriv) bPriv.addEventListener('click', function(){ abrirPolitica(null); });
    var bCommAceitar = $('btn-comm-aceitar');
    if(bCommAceitar) bCommAceitar.addEventListener('click', function(){ abrirPolitica('comunidade'); });
    var bAceitar = $('btn-priv-aceitar');
    if(bAceitar) bAceitar.addEventListener('click', aceitarPolitica);
    var bPrivVoltar = $('btn-priv-voltar');
    if(bPrivVoltar) bPrivVoltar.addEventListener('click', function(){
      depoisDoAceite = null;
      go(telaAntesPolitica || 'scr-perfil');
    });
    var bMod = $('btn-perfil-mod');
    if(bMod) bMod.addEventListener('click', function(){ go('scr-mod'); });
    var bInsc = $('btn-perfil-insc');
    if(bInsc) bInsc.addEventListener('click', function(){ go('scr-insc'); });

    // entrar
    var fEmail = $('form-email'), fCodigo = $('form-codigo');
    if(fEmail) fEmail.addEventListener('submit', pedirCodigo);
    if(fCodigo) fCodigo.addEventListener('submit', confirmarCodigo);
    var bReenviar = $('btn-reenviar');
    if(bReenviar) bReenviar.addEventListener('click', function(){
      if(entrarEmail) enviarCodigo(entrarEmail, bReenviar, 'entrar-erro-codigo', $('entrar-codigo'));
    });
    var bTrocar = $('btn-trocar-email');
    if(bTrocar) bTrocar.addEventListener('click', function(){
      passoEntrar('email');
      var em = $('entrar-email'); if(em) em.focus();
    });
    var bEntrarVoltar = $('btn-entrar-voltar');
    if(bEntrarVoltar) bEntrarVoltar.addEventListener('click', function(){
      depoisDoLogin = null;
      go(telaAntesEntrar || 'scr-perfil');
    });
    var bEntrarPol = $('btn-entrar-politica');
    if(bEntrarPol) bEntrarPol.addEventListener('click', function(){ abrirPolitica(null); });
    var bSair = $('btn-sair');
    if(bSair) bSair.addEventListener('click', sairDaConta);
    var bApagarConta = $('btn-apagar-conta');
    if(bApagarConta) bApagarConta.addEventListener('click', apagarConta);

    // voluntariado
    document.querySelectorAll('input[name="ong"]').forEach(function(r){
      r.addEventListener('change', function(){ if(r.checked) escolherOng(r.value); });
    });
    var tDoar = $('tab-doar'), tVol = $('tab-vol');
    if(tDoar) tDoar.addEventListener('click', function(){ abaAjuda('doar'); });
    if(tVol) tVol.addEventListener('click', function(){ abaAjuda('vol'); });
    [tDoar, tVol].forEach(function(t){
      if(!t) return;
      t.addEventListener('keydown', function(e){
        if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var outro = (t === tDoar) ? tVol : tDoar;
        if(!outro) return;
        abaAjuda(outro === tDoar ? 'doar' : 'vol');
        outro.focus();
      });
    });
    var formVol = $('vol-form');
    if(formVol) formVol.addEventListener('submit', enviarVoluntario);
    var bNova = $('vol-nova');
    if(bNova) bNova.addEventListener('click', function(){
      var ok = $('vol-ok'); if(ok) ok.hidden = true;
      atualizarFormVoluntario();
      var nomeVol = $('vol-nome'); if(nomeVol) nomeVol.focus();
    });

    // denúncia
    var bDenunciar = $('comm-denunciar');
    if(bDenunciar) bDenunciar.addEventListener('click', function(){ abrirDenuncia(null); });
    var fundoDen = $('denuncia-fundo');
    if(fundoDen){
      fundoDen.querySelectorAll('input[name="motivo"]').forEach(function(r){
        r.addEventListener('change', atualizarEnviarDenuncia);
      });
      fundoDen.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){ e.preventDefault(); fecharDenuncia(); }
      });
      fundoDen.addEventListener('click', function(e){
        if(e.target === fundoDen) fecharDenuncia();
      });
      var cancelar = $('denuncia-cancelar');
      if(cancelar) cancelar.addEventListener('click', function(){ fecharDenuncia(); });
      var enviarDen = $('denuncia-enviar');
      if(enviarDen) enviarDen.addEventListener('click', enviarDenuncia);
    }

    // janela de confirmação
    var fundoDlg = $('dialogo-fundo');
    if(fundoDlg){
      fundoDlg.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){ e.preventDefault(); fecharDialogo(false); }
      });
      fundoDlg.addEventListener('click', function(e){
        if(e.target === fundoDlg) fecharDialogo(false);
      });
      $('dialogo-cancelar').addEventListener('click', function(){ fecharDialogo(false); });
      $('dialogo-ok').addEventListener('click', function(){ fecharDialogo(true); });
    }

    var bFav = $('btn-perfil-fav');
    if(bFav) bFav.addEventListener('click', function(){ go('scr-fav'); });
    var bWipe = $('btn-wipe');
    if(bWipe) bWipe.addEventListener('click', apagarDados);

    // favoritos salvos em outra aba
    window.addEventListener('storage', function(ev){
      if(ev.key !== LS || !ev.newValue) return;
      try{
        var d = JSON.parse(ev.newValue);
        if(!d || typeof d !== 'object') return;
        var outros = objeto(d.favoritos);
        Object.keys(outros).slice(0, 200).forEach(function(id){
          if(S.favoritos[id]) return;
          var f = favSeguro(outros[id]);
          if(f){ f.id = id; S.favoritos[id] = f; }
        });
        if(!S.nome && typeof d.nome === 'string') S.nome = limpar(d.nome, 40).trim();
        S.mensagens = Math.max(S.mensagens, Number(d.mensagens) || 0);
        if(!S.privacidade && Number(d.privacidade)) S.privacidade = Number(d.privacidade);
        sincronizarEstrelas();
        desenharTudo();
      }catch(e){}
    });

    document.addEventListener('visibilitychange', function(){
      if(!document.hidden && telaAtual === 'scr-chat' && abaChat === 'comm' && comunidadeIniciada) recarregarComunidade();
    });
  }

  // ---------------------------------------------------------- início
  function iniciar(){
    lerLocal();
    if(!S.chave) S.chave = novaChave();
    if(!S.desde) S.desde = Date.now();
    S.sessoes = (Number(S.sessoes) || 0) + 1;
    S.visto = Date.now();
    gravarLocal();

    var app = $('app');
    if(app){
      if(S.big) app.classList.add('big-text');
      if(S.contraste) app.classList.add('contrast');
    }
    syncA11y();

    horaDeBrasilia();
    setTimeout(function(){
      horaDeBrasilia();
      setInterval(horaDeBrasilia, 60000);
    }, (60 - new Date().getSeconds()) * 1000);

    selosDeData();
    marcarEstrelas();
    ligar();
    desenharTudo();
    rotuloSync(rotuloPadrao());
    var logIA = $('log-ia');
    if(logIA && !logIA.childNodes.length) logIA.appendChild(bolha('ai', 'Assistente', BOAS_VINDAS, 0));
    atualizarIA();

    var pedida = (location.hash || '').slice(1);
    try{ history.replaceState({tela:'scr-home', n:0}, '', location.pathname + location.search); }catch(e){}
    if(pedida && /^scr-[a-z]+$/.test(pedida) && $(pedida) && pedida !== 'scr-home') go(pedida);

    iniciarConta();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
