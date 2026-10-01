// Conta do aluno: criar conta / entrar com apelido + PIN, e resumo do perfil.
(() => {
  const h = (tag, p = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e[k] = v;
    }
    e.append(...kids); return e;
  };
  const ERROS = {
    apelido_invalido: 'Apelido: de 3 a 20 letras, números, _ . ou - (sem espaços).',
    pin_invalido: 'PIN: de 4 a 6 números.',
    apelido_em_uso: 'Esse apelido já existe. Escolha outro.',
    credenciais_invalidas: 'Apelido ou PIN incorretos.',
    muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos.',
  };

  function montar(el, { aluno, aoMudar }) {
    if (aluno) {
      el.replaceChildren(
        h('h2', { textContent: `Olá, ${aluno.apelido}!` }),
        h('p', { textContent: `Nível ${aluno.nivel} · ${aluno.pontos} pontos` }),
        h('p', { class: 'vazio', textContent: 'Seu histórico de partidas aparecerá aqui em breve.' }),
        h('button', { class: 'sec', textContent: 'Sair da conta', onclick: () => { Api.aluno.sair(); aoMudar(null); } }));
      return;
    }
    let modo = 'entrar';
    const ap = h('input', { placeholder: 'Apelido', maxlength: 20, autocomplete: 'username', required: true });
    const pin = h('input', { placeholder: 'PIN (4 a 6 números)', type: 'password', inputMode: 'numeric', maxLength: 6, pattern: '[0-9]{4,6}', autocomplete: 'current-password', required: true });
    const msg = h('p', { class: 'msg', role: 'status' });
    const dica = h('p', { class: 'vazio' });
    const ok = h('button', { class: 'grande' });
    const abas = ['entrar', 'cadastrar'].map(m => h('button', { type: 'button', class: 'sec', onclick: () => { modo = m; pintar(); } }));
    const pintar = () => {
      abas[0].textContent = 'Entrar'; abas[1].textContent = 'Criar conta';
      abas.forEach((b, i) => { b.setAttribute('aria-pressed', String(modo === ['entrar', 'cadastrar'][i])); b.style.opacity = modo === ['entrar', 'cadastrar'][i] ? 1 : .6; });
      ok.textContent = modo === 'entrar' ? 'Entrar' : 'Criar minha conta';
      dica.textContent = modo === 'cadastrar' ? 'Não use seu nome completo. Anote seu PIN: ele não pode ser recuperado por e-mail.' : '';
      pin.autocomplete = modo === 'entrar' ? 'current-password' : 'new-password';
      msg.textContent = '';
    };
    const form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = 'Aguarde…'; ok.disabled = true;
      try {
        const a = modo === 'entrar' ? await Api.aluno.entrar(ap.value.trim(), pin.value) : await Api.aluno.cadastrar(ap.value.trim(), pin.value);
        aoMudar(a);
      } catch (err) { msg.textContent = ERROS[err.message] || 'Não foi possível conectar. Tente novamente.'; }
      ok.disabled = false;
    } }, ap, pin, ok);
    el.replaceChildren(h('h2', { textContent: 'Conta do aluno' }), h('div', { class: 'acoes' }, ...abas), form, dica, msg);
    pintar();
  }
  window.Conta = { montar };
})();
