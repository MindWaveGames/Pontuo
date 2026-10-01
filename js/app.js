const $ = (s) => document.querySelector(s);
const VIEWS = ['menu', 'entrar', 'quizz', 'ranking', 'perfil'];
const ERROS = {
  chave_invalida: 'Chave não encontrada. Confira e tente de novo.',
  licenca_bloqueada: 'Esta licença está bloqueada. Fale com o administrador.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos.',
};
let prof = null; // { nome } quando o professor está logado

function render() {
  const on = !!prof;
  $('#card-papel').textContent = on ? 'PROFESSOR' : 'VISITANTE';
  $('#card-nome').textContent = on ? prof.nome : 'Anônimo'; // textContent: nunca interpreta HTML
  $('#card-nivel').textContent = on ? '1' : '—';
  $('#card-pts').textContent = on ? '0' : '—';
  $('#quizz-bloq').hidden = on;
  $('#quizz-ok').hidden = !on;
  $('#btn-sair').hidden = !on;
}

function ir(v) {
  if (!VIEWS.includes(v)) v = 'menu';
  VIEWS.forEach(n => { $('#v-' + n).hidden = n !== v; });
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  render();
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

$('#f-sala').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#msg-sala').textContent = 'A conexão com a sala (P2P) será ligada na próxima etapa.';
});

(async () => {
  const s = Api.sessao();
  if (s && await Api.valida()) prof = { nome: s.nome }; else Api.sair();
  ir(location.hash.slice(1));
})();
