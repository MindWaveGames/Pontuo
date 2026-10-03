const $ = (s) => document.querySelector(s);
const h = (tag, p = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(p)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k.includes('-')) e.setAttribute(k, v); else e[k] = v;
  }
  e.append(...kids); return e;
};
const VIEWS = ['menu', 'entrar', 'quizz', 'ranking', 'perfil'];
const ERROS = {
  chave_invalida: 'Chave não encontrada. Confira e tente de novo.',
  licenca_bloqueada: 'Esta licença está bloqueada. Fale com o administrador.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos.',
};
let prof = null;  // professor logado: { nome, avatar, nivel, pontos, de, ate, partidas, jogadores }
let aluno = null; // aluno logado: { apelido, avatar, nivel, pontos, de, ate, historico }
const PROF_BASE = { avatar: null, nivel: 1, pontos: 0, de: 0, ate: 5000, partidas: 0, jogadores: 0 };

// ---------- Carregamento sob demanda ----------
// Suba este número a cada atualização do site: força o navegador a baixar os arquivos novos (sem depender de Ctrl+F5).
const VERSAO = '6';
const comVersao = (u) => (u && !/^https?:/.test(u) ? `${u}?v=${VERSAO}` : u);
const carregar = (tag, attrs) => new Promise((ok, no) => {
  const real = { ...attrs };
  if (real.src) real.src = comVersao(real.src);
  if (real.href) real.href = comVersao(real.href);
  const e = Object.assign(document.createElement(tag), real);
  e.onload = ok; e.onerror = () => no(new Error('arquivo não encontrado: ' + (attrs.src || attrs.href))); document.head.append(e);
});
console.info('Pontuô front, versão', VERSAO);
let _av, _jogo, _editor, _conta;
const carregarAvatares = () => _av || (_av = carregar('script', { src: 'js/avatares.js' }).then(() => carregar('script', { src: 'js/podio.js' }))
  .then(() => carregar('script', { src: 'js/som.js' }).catch((e) => console.warn('Som indisponível:', e.message))));
const carregarJogo = () => _jogo || (_jogo = Promise.all([
  carregar('link', { rel: 'stylesheet', href: 'css/jogo.css' }),
  carregar('script', { src: 'js/vendor/peerjs.min.js' }),   // local: redes de escola costumam bloquear CDNs
  carregar('script', { src: 'js/vendor/qrcode.js' }).catch((e) => console.warn('QR code indisponível:', e.message)), // opcional: sem ele a sala abre igual
]).then(() => carregar('script', { src: 'js/jogo.js' })).then(() => window.Jogo));
const carregarEditor = () => _editor || (_editor = Promise.all([
  carregar('link', { rel: 'stylesheet', href: 'css/kids.css' }),
  carregar('script', { src: 'js/pictos.js' }),
  carregar('script', { src: 'js/kids.js' }),
  carregar('script', { src: 'js/editor.js' }),
]));

// ---------- Cartão do usuário e telas ----------
function pintarAvatar(el, id) {
  const a = window.Avatar && Avatar.info(id);
  el.classList.toggle('tem', !!a);
  el.textContent = a ? a.e : '';
  el.style.background = a ? a.cor : '';
}

function renderHist() {
  const el = $('#hist'), hs = aluno && aluno.historico;
  el.replaceChildren();
  if (prof) {
    el.append(h('p', { class: 'vazio', textContent: `${prof.partidas} sala(s) abertas · ${prof.jogadores} aluno(s) com conta participaram.` }));
    return;
  }
  if (!hs || !hs.length) {
    el.append(h('p', { class: 'vazio', textContent: aluno ? 'Nenhuma partida ainda.' : 'Entre na sua conta para ver seu histórico.' }));
    return;
  }
  el.append(h('ul', { class: 'hist' }, ...hs.map((x) =>
    h('li', { textContent: `${new Date(x.em * 1000).toLocaleDateString('pt-BR')} · ${x.posicao}º de ${x.total} · +${x.pontos} pts` }))));
}

function renderSala() {
  const quem = $('#quem-sala');
  $('#apelido').hidden = !!aluno; // logado: o nome vem da conta
  quem.hidden = !aluno;
  if (aluno) quem.replaceChildren('Você vai entrar como ', Avatar.el(aluno.avatar, 26), h('strong', { textContent: aluno.apelido }));
}

function render() {
  const u = prof || aluno;
  // textContent: nomes nunca são interpretados como HTML
  $('#card-papel').textContent = prof ? 'PROFESSOR' : aluno ? 'ALUNO' : 'VISITANTE';
  $('#card-nome').textContent = prof ? prof.nome : aluno ? aluno.apelido : 'Anônimo';
  $('#card-nivel').textContent = u ? u.nivel : '—';
  $('#card-pts').textContent = u ? u.pontos : '—';
  document.querySelectorAll('.avatar').forEach((el) => pintarAvatar(el, u && u.avatar));
  const pg = $('#prog');
  pg.hidden = !u;
  if (u) {
    const pct = Math.min(100, Math.max(0, Math.round((u.pontos - u.de) / Math.max(1, u.ate - u.de) * 100)));
    pg.querySelector('i').style.width = pct + '%';
    pg.querySelector('small').textContent = `${u.ate - u.pontos} pts para o nível ${u.nivel + 1}`;
  }
  $('#quizz-bloq').hidden = !!prof;
  $('#quizz-ok').hidden = !prof;
  $('#btn-sair').hidden = !prof;
  renderSala(); renderHist();
  if (prof && !$('#quizz-ok').dataset.pronto) {
    $('#quizz-ok').dataset.pronto = '1';
    carregarJogo().then(async (J) => { await carregarEditor(); Editor.montar($('#quizz-ok'), J.abrirSala); })
      .catch((err) => {
        console.error('Criador de quizz:', err);
        _jogo = _editor = null; // permite tentar de novo sem recarregar a página
        const q = $('#quizz-ok'); delete q.dataset.pronto;
        q.replaceChildren(h('p', { textContent: 'Não foi possível carregar o criador de quizz.' }),
          h('p', { class: 'vazio', textContent: `Motivo: ${(err && err.message) || 'erro desconhecido'}` }),
          h('button', { class: 'sec', type: 'button', textContent: 'Tentar de novo', onclick: render }));
      });
  }
}

function ir(v) {
  if (!VIEWS.includes(v)) v = 'menu';
  VIEWS.forEach((n) => { $('#v-' + n).hidden = n !== v; });
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  render();
  if (v === 'perfil') { atualizarUsuario(); montarConta(); }
  if (v === 'ranking') carregarRanking();
}

async function atualizarUsuario() {
  if (prof) { const p = await Api.professor.perfil(); if (p) prof = p; }
  if (aluno) { const a = await Api.aluno.perfil(); if (a) aluno = a; }
  render();
  if (!$('#v-perfil').hidden) montarConta();
}
addEventListener('pontuo:atualizar', atualizarUsuario);

async function montarConta() {
  try {
    await (_conta || (_conta = carregar('script', { src: 'js/conta.js' })));
    Conta.montar($('#conta'), { aluno, prof, aoMudar: (tipo, dados, op) => {
      if (tipo === 'aluno') aluno = { ...(aluno || {}), ...dados };
      else if (tipo === 'prof') prof = { ...(prof || {}), ...dados };
      else if (tipo === 'sair') aluno = null;
      render();
      if (!(op && op.manter)) { montarConta(); if (tipo === 'aluno') atualizarUsuario(); } // login/cadastro: busca o histórico completo
    } });
  } catch (err) { console.error('Conta:', err); _conta = null; $('#conta').textContent = `Não foi possível carregar a conta (${(err && err.message) || 'erro'}).`; }
}

// ---------- Ranking: pódio (top 3) em colunas + lista com avatar ----------
let rkAba = 'alunos', rkDados = null;

function prepararRanking() {
  const sec = $('#v-ranking');
  if (sec.dataset.pronto) return;
  sec.dataset.pronto = '1';
  const antigo = sec.querySelector('.duas'); if (antigo) antigo.remove();
  sec.append(
    h('div', { class: 'abas', role: 'tablist' }, ...[['alunos', 'Alunos'], ['professores', 'Professores']].map(([k, t]) =>
      h('button', { type: 'button', class: 'aba', role: 'tab', textContent: t, 'data-k': k, onclick: () => { rkAba = k; desenharRanking(); } }))),
    h('div', { id: 'rk-area' }));
}

async function carregarRanking() {
  prepararRanking();
  try { rkDados = await Api.ranking(); }
  catch (e) { if (!rkDados) { $('#rk-area').textContent = 'Não foi possível carregar o ranking agora.'; return; } }
  desenharRanking();
}

function desenharRanking() {
  document.querySelectorAll('#v-ranking .aba').forEach((b) => {
    const on = b.dataset.k === rkAba; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
  });
  const eProf = rkAba === 'professores', area = $('#rk-area'), itens = (rkDados && rkDados[rkAba]) || [];
  if (!itens.length) {
    area.replaceChildren(h('p', { class: 'vazio', textContent: eProf ? 'Nenhum professor pontuou ainda.' : 'Apenas alunos cadastrados aparecem aqui.' }));
    return;
  }
  if (!window.Podio) { area.textContent = 'Não foi possível carregar o ranking (arquivo js/podio.js).'; return; }
  const lista = itens.map((x) => ({ nome: eProf ? x.nome : x.apelido, pontos: x.pontos, avatar: x.avatar, x }));
  const resto = lista.slice(3);
  area.replaceChildren(Podio.criar(lista, { altura: 140 }),
    resto.length ? Podio.lista(resto, { inicio: 3, valor: (y) => (eProf ? `${y.pontos} pts · ${y.x.partidas} sala(s)` : `${y.pontos} pts · nível ${y.x.nivel}`) }) : '');
}

// ---------- Eventos ----------
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.go)));
addEventListener('hashchange', () => ir(location.hash.slice(1)));

const abrirLogin = () => { $('#msg-chave').textContent = ''; $('#dlg').showModal(); $('#chave').focus(); };
$('#abrir-prof').addEventListener('click', abrirLogin);
$('#abrir-prof2').addEventListener('click', abrirLogin);
$('#fechar').addEventListener('click', () => $('#dlg').close());

$('#f-chave').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#msg-chave');
  msg.textContent = 'Verificando…';
  try {
    const d = await Api.entrar($('#chave').value.trim());
    prof = { nome: d.professor, ...PROF_BASE };
    const p = await Api.professor.perfil(); if (p) prof = p;
    $('#dlg').close();
    ir('quizz');
  } catch (err) {
    msg.textContent = ERROS[err.message] || 'Não foi possível conectar. Tente novamente.';
  }
});

$('#btn-sair').addEventListener('click', () => {
  Api.sair(); prof = null;
  const q = $('#quizz-ok'); delete q.dataset.pronto; q.replaceChildren(); // o próximo professor começa limpo
  ir('menu');
});

$('#f-sala').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const J = await carregarJogo();
    J.entrar($('#sala').value.trim(), aluno ? aluno.apelido : $('#apelido').value.trim(),
      aluno ? await Api.aluno.ficha() : null, aluno ? aluno.avatar : null);
  } catch (err) { console.error('Jogo:', err); _jogo = null; $('#msg-sala').textContent = `Não foi possível carregar o jogo (${(err && err.message) || 'erro'}). Verifique a internet e tente de novo.`; }
});

// ---------- Início ----------
(async () => {
  try { await carregarAvatares(); } catch (e) {}
  $('#v-perfil').insertBefore(h('div', { id: 'conta' }), $('#btn-sair'));
  const aviso = $('#v-perfil p'); if (aviso) aviso.remove(); // texto provisório de versões antigas
  const interno = document.querySelector('.interno');
  interno.insertBefore(h('div', { id: 'prog', class: 'prog', hidden: true }, h('div', { class: 'trilho' }, h('i')), h('small')), interno.querySelector('h2'));
  const vazio = interno.querySelector('.vazio'); const hist = h('div', { id: 'hist' });
  if (vazio) vazio.replaceWith(hist); else interno.append(hist);
  $('#f-sala').insertBefore(h('p', { id: 'quem-sala', class: 'quem-sala', hidden: true }), $('#apelido'));

  const s = Api.sessao();
  if (s && await Api.valida()) {
    prof = { nome: s.nome, ...PROF_BASE };
    const p = await Api.professor.perfil(); if (p) prof = p;
  } else Api.sair();
  aluno = await Api.aluno.perfil();

  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { $('#sala').value = sala.toUpperCase().slice(0, 8); ir('entrar'); } else ir(location.hash.slice(1));
})();
