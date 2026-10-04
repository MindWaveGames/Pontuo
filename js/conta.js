// Perfil: entrar/criar conta (visitante) e, logado, editar avatar, apelido e PIN.
(() => {
  const h = (tag, p = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k.includes('-')) e.setAttribute(k, v); else e[k] = v;
    }
    e.append(...kids); return e;
  };
  const ERROS = {
    apelido_invalido: 'Apelido: de 3 a 20 letras, números, _ . ou - (sem espaços).',
    pin_invalido: 'PIN: de 4 a 6 números.',
    apelido_em_uso: 'Esse apelido já existe. Escolha outro.',
    apelido_proibido: 'Esse apelido não pode ser usado. Escolha outro.',
    conta_bloqueada: 'Esta conta foi bloqueada. Fale com o seu professor ou com a escola.',
    credenciais_invalidas: 'Apelido ou PIN incorretos. Esqueceu o PIN? Peça ao seu professor para falar com a administração.',
    pin_atual_incorreto: 'O PIN atual está incorreto.',
    token_invalido: 'Sua sessão expirou. Entre novamente.',
    avatar_invalido: 'Esse avatar não está disponível.',
    muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos.',
  };
  const falou = (err) => ERROS[err.message] || 'Não foi possível conectar. Tente novamente.';

  function seletorAvatar(atual, salvar) {
    const msg = h('p', { class: 'msg', role: 'status' });
    const botoes = Avatar.lista.map((a) => h('button', {
      type: 'button', class: 'avbtn', 'aria-pressed': String(a.id === atual), 'aria-label': `Avatar ${a.id}`, title: a.id,
      onclick: async () => {
        msg.textContent = 'Salvando…';
        try {
          await salvar(a.id);
          botoes.forEach((b) => b.setAttribute('aria-pressed', String(b === btnDe(a.id))));
          msg.textContent = 'Avatar atualizado ✓';
        } catch (err) { msg.textContent = falou(err); }
      },
    }, Avatar.el(a.id, 44)));
    const btnDe = (id) => botoes[Avatar.lista.findIndex((a) => a.id === id)];
    return h('div', { class: 'bloco' }, h('h3', { textContent: 'Escolha seu avatar' }), h('div', { class: 'avs', role: 'group', 'aria-label': 'Avatares' }, ...botoes), msg);
  }

  function formApelido(aluno, aoMudar) {
    const inp = h('input', { type: 'text', value: aluno.apelido, maxLength: 20, autocomplete: 'username', required: true, 'aria-label': 'Apelido' });
    const msg = h('p', { class: 'msg', role: 'status' });
    const form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = 'Salvando…';
      try { const a = await Api.aluno.editar({ apelido: inp.value.trim() }); aoMudar('aluno', a, { manter: true }); msg.textContent = 'Apelido atualizado ✓'; }
      catch (err) { msg.textContent = falou(err); }
    } }, inp, h('button', { class: 'sec', textContent: 'Salvar apelido' }), msg);
    return h('div', { class: 'bloco' }, h('h3', { textContent: 'Apelido' }), form);
  }

  function trocarPin(aoMudar) {
    const campo = (ph, ac) => h('input', { type: 'password', placeholder: ph, inputMode: 'numeric', maxLength: 6, pattern: '[0-9]{4,6}', autocomplete: ac, required: true });
    const atual = campo('PIN atual', 'current-password'), novo = campo('PIN novo (4 a 6 números)', 'new-password'), conf = campo('Repita o PIN novo', 'new-password');
    const msg = h('p', { class: 'msg', role: 'status' }), ok = h('button', { class: 'sec', textContent: 'Trocar PIN' });
    const form = h('form', { onsubmit: async (e) => {
      e.preventDefault();
      if (novo.value !== conf.value) { msg.textContent = 'O PIN novo e a repetição não são iguais.'; return; }
      msg.textContent = 'Aguarde…'; ok.disabled = true;
      try {
        await Api.aluno.trocarPin(atual.value, novo.value);
        form.reset(); msg.textContent = 'PIN alterado! Nos outros aparelhos será preciso entrar de novo. ✓';
      } catch (err) {
        msg.textContent = falou(err);
        if (err.message === 'token_invalido') { Api.aluno.sair(); aoMudar('sair'); }
      }
      ok.disabled = false;
    } }, atual, novo, conf, ok, msg);
    return h('details', { class: 'trocar bloco' }, h('summary', { textContent: 'Trocar meu PIN' }), form);
  }

  function topo(u, papel) {
    return h('div', { class: 'perfil-topo' }, Avatar.el(u.avatar, 64),
      h('div', {}, h('strong', { textContent: papel === 'prof' ? u.nome : u.apelido }), h('br'), h('small', { textContent: `${papel === 'prof' ? 'Professor' : 'Aluno'} · nível ${u.nivel} · ${u.pontos} pts` })));
  }

  function visitante(el, aoMudar) {
    let modo = 'entrar';
    const ap = h('input', { placeholder: 'Apelido', maxlength: 20, autocomplete: 'username', required: true });
    const pin = h('input', { placeholder: 'PIN (4 a 6 números)', type: 'password', inputMode: 'numeric', maxLength: 6, pattern: '[0-9]{4,6}', autocomplete: 'current-password', required: true });
    const msg = h('p', { class: 'msg', role: 'status' }), dica = h('p', { class: 'vazio' }), ok = h('button', { class: 'grande' });
    const abas = ['entrar', 'cadastrar'].map((m) => h('button', { type: 'button', class: 'sec', onclick: () => { modo = m; pintar(); } }));
    const pintar = () => {
      abas[0].textContent = 'Entrar'; abas[1].textContent = 'Criar conta';
      abas.forEach((b, i) => { const on = modo === ['entrar', 'cadastrar'][i]; b.setAttribute('aria-pressed', String(on)); b.style.opacity = on ? 1 : .6; });
      ok.textContent = modo === 'entrar' ? 'Entrar' : 'Criar minha conta';
      dica.textContent = modo === 'cadastrar' ? 'Não use seu nome completo. Anote seu PIN: ele não pode ser recuperado por e-mail.' : '';
      pin.autocomplete = modo === 'entrar' ? 'current-password' : 'new-password'; msg.textContent = '';
    };
    const form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = 'Aguarde…'; ok.disabled = true;
      try { aoMudar('aluno', modo === 'entrar' ? await Api.aluno.entrar(ap.value.trim(), pin.value) : await Api.aluno.cadastrar(ap.value.trim(), pin.value)); }
      catch (err) { msg.textContent = falou(err); }
      ok.disabled = false;
    } }, ap, pin, ok);
    el.replaceChildren(h('h2', { textContent: 'Conta do aluno' }), h('div', { class: 'acoes' }, ...abas), form, dica, msg);
    pintar();
  }

  function montar(el, { aluno, prof, aoMudar }) {
    if (prof) {
      el.replaceChildren(h('h2', { textContent: 'Meu perfil' }), topo(prof, 'prof'),
        seletorAvatar(prof.avatar, async (id) => { const p = await Api.professor.editar({ avatar: id }); aoMudar('prof', p, { manter: true }); }));
      return;
    }
    if (aluno) {
      el.replaceChildren(h('h2', { textContent: 'Meu perfil' }), topo(aluno, 'aluno'),
        seletorAvatar(aluno.avatar, async (id) => { const a = await Api.aluno.editar({ avatar: id }); aoMudar('aluno', a, { manter: true }); }),
        formApelido(aluno, aoMudar), trocarPin(aoMudar),
        h('button', { class: 'sec', textContent: 'Sair da conta', onclick: () => { Api.aluno.sair(); aoMudar('sair'); } }));
      return;
    }
    visitante(el, aoMudar);
  }
  window.Conta = { montar };
})();
