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
  if (v === 'perfil') montarConta();
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
  try { (await carregarJogo()).entrar($('#sala').value.trim(), aluno ? aluno.apelido : $('#apelido').value.trim()); }
  catch (err) { $('#msg-sala').textContent = 'Não foi possível carregar o jogo. Verifique a internet.'; }
});

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
  const s = Api.sessao();
  if (s && await Api.valida()) prof = { nome: s.nome }; else Api.sair();
  aluno = await Api.aluno.perfil();
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { $('#sala').value = sala.toUpperCase().slice(0, 8); ir('entrar'); } else ir(location.hash.slice(1));
})();
