const $ = (s) => document.querySelector(s);
const VIEWS = ['menu', 'entrar', 'quizz', 'ranking', 'perfil'];
const ERROS = {
  chave_invalida: 'Chave não encontrada. Confira e tente de novo.',
  licenca_bloqueada: 'Esta licença está bloqueada. Fale com o administrador.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos.',
};
let prof = null;  // { nome } quando o professor está logado
let aluno = null; // { apelido, nivel, pontos } quando o aluno está logado

function render() {
  const on = !!prof;
  // textContent: nomes nunca são interpretados como HTML
  $('#card-papel').textContent = on ? 'PROFESSOR' : aluno ? 'ALUNO' : 'VISITANTE';
  $('#card-nome').textContent = on ? prof.nome : aluno ? aluno.apelido : 'Anônimo';
  $('#card-nivel').textContent = on ? '1' : aluno ? aluno.nivel : '—';
  $('#card-pts').textContent = on ? '0' : aluno ? aluno.pontos : '—';
  $('#conta').hidden = on;
  renderHist();
  $('#quizz-bloq').hidden = on;
  $('#quizz-ok').hidden = !on;
  $('#btn-sair').hidden = !on;
  if (on && !$('#quizz-ok').dataset.pronto) {
    $('#quizz-ok').dataset.pronto = 1;
    carregarJogo().then(J => J.editor($('#quizz-ok'))).catch(() => { $('#quizz-ok').textContent = 'Não foi possível carregar o criador de quizz.'; });
  }
}

function ir(v) {
  if (!VIEWS.includes(v)) v = 'menu';
  VIEWS.forEach(n => { $('#v-' + n).hidden = n !== v; });
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  render();
  if (v === 'perfil') { atualizarAluno(); montarConta(); }
  if (v === 'ranking') carregarRanking();
}

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => ir(b.dataset.go)));
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
    prof = { nome: d.professor };
    $('#dlg').close();
    ir('quizz');
  } catch (err) {
    msg.textContent = ERROS[err.message] || 'Não foi possível conectar. Tente novamente.';
  }
});

$('#btn-sair').addEventListener('click', () => { Api.sair(); prof = null; ir('menu'); });

// O jogo (PeerJS + jogo.js) só é baixado quando alguém usa a sala.
let _jogo;
const carregar = (tag, attrs) => new Promise((ok, no) => {
  const e = Object.assign(document.createElement(tag), attrs);
  e.onload = ok; e.onerror = no; document.head.append(e);
});
const carregarJogo = () => _jogo || (_jogo = Promise.all([
  carregar('link', { rel: 'stylesheet', href: 'css/jogo.css' }),
  carregar('script', { src: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js' }),
]).then(() => carregar('script', { src: 'js/jogo.js' })).then(() => window.Jogo));

$('#f-sala').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { (await carregarJogo()).entrar($('#sala').value.trim(), aluno ? aluno.apelido : $('#apelido').value.trim(), aluno ? await Api.aluno.ficha() : null); }
  catch (err) { $('#msg-sala').textContent = 'Não foi possível carregar o jogo. Verifique a internet.'; }
});

function renderHist() {
  const el = $('#hist'), hs = aluno && aluno.historico;
  el.replaceChildren();
  if (!hs || !hs.length) {
    const p = document.createElement('p'); p.className = 'vazio';
    p.textContent = aluno ? 'Nenhuma partida ainda.' : prof ? 'Histórico do professor em breve.' : 'Entre na sua conta para ver seu histórico.';
    el.append(p); return;
  }
  const ul = document.createElement('ul'); ul.className = 'hist';
  for (const x of hs) {
    const li = document.createElement('li');
    li.textContent = `${new Date(x.em * 1000).toLocaleDateString('pt-BR')} · ${x.posicao}º de ${x.total} · +${x.pontos} pts`;
    ul.append(li);
  }
  el.append(ul);
}

async function atualizarAluno() {
  if (!aluno) return;
  const a = await Api.aluno.perfil();
  if (a) { aluno = a; render(); if (!$('#v-perfil').hidden) montarConta(); }
}
addEventListener('pontuo:atualizar', atualizarAluno);

function lista(col, itens, linha, vazio) {
  const antigo = col.querySelector('.vazio, ol'); if (antigo) antigo.remove();
  if (!itens.length) { const p = document.createElement('p'); p.className = 'vazio'; p.textContent = vazio; col.append(p); return; }
  const ol = document.createElement('ol'); ol.className = 'rk';
  itens.forEach((it, n) => {
    const [nome, valor] = linha(it);
    const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('b');
    a.textContent = `${n + 1}. ${nome}`; b.textContent = valor; li.append(a, b); ol.append(li);
  });
  col.append(ol);
}

async function carregarRanking() {
  const cols = document.querySelectorAll('#v-ranking .duas > div');
  try {
    const d = await Api.ranking();
    lista(cols[0], d.professores, (p) => [p.nome, `${p.partidas} partida(s)`], 'Sem dados ainda.');
    lista(cols[1], d.alunos, (a) => [a.apelido, `${a.pontos} pts`], 'Apenas alunos cadastrados aparecem aqui.');
  } catch (e) { /* mantém o texto anterior se a API estiver fora do ar */ }
}

let _conta;
async function montarConta() {
  if (prof) return;
  try {
    await (_conta || (_conta = carregar('script', { src: 'js/conta.js' })));
    Conta.montar($('#conta'), { aluno, aoMudar: (a) => { aluno = a; render(); montarConta(); } });
  } catch (err) { $('#conta').textContent = 'Não foi possível carregar a conta. Verifique a internet.'; }
}

(async () => {
  const caixa = document.createElement('div');
  caixa.id = 'conta';
  $('#v-perfil').insertBefore(caixa, $('#btn-sair'));
  const aviso = $('#v-perfil p'); if (aviso) aviso.remove(); // texto provisório da etapa anterior
  const hist = document.createElement('div'); hist.id = 'hist';
  const vazio = document.querySelector('.interno .vazio'); if (vazio) vazio.replaceWith(hist); else document.querySelector('.interno').append(hist);
  const s = Api.sessao();
  if (s && await Api.valida()) prof = { nome: s.nome }; else Api.sair();
  aluno = await Api.aluno.perfil();
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { $('#sala').value = sala.toUpperCase().slice(0, 8); ir('entrar'); } else ir(location.hash.slice(1));
})();
