// Modo Kids: editor de atividades com figuras e jogo conduzido pelo professor (sem alunos na sala).
(() => {
  const h = (tag, p = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k.includes('-')) e.setAttribute(k, v);
      else e[k] = v;
    }
    e.append(...kids);
    return e;
  };
  const MAXQ = 30, LET = ['A', 'B', 'C', 'D'];
  const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('');
  const som = (n, ...a) => { if (window.Som) Som.tocar(n, ...a); };
  const reduz = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const vazia = () => ({ q: '', vis: [], op: [0, 1, 2, 3].map(() => ({ vis: '', txt: '' })), c: 0 });
  const novoQuiz = () => ({ qid: novoId(), tipo: 'kids', titulo: 'Nova atividade Kids', seg: 0, perguntas: [vazia()] });
  const preenchida = (o) => !!(o.vis || o.txt.trim());

  // Aceita só o formato esperado, com figuras da lista permitida (vale para arquivo importado).
  function normalizar(o) {
    const src = o && typeof o === 'object' ? o : {};
    const z = { qid: novoId(), tipo: 'kids', titulo: String(src.titulo || 'Atividade Kids').slice(0, 60), seg: 0, perguntas: [] };
    for (const p of (Array.isArray(src.perguntas) ? src.perguntas : []).slice(0, MAXQ)) {
      const x = p && typeof p === 'object' ? p : {};
      z.perguntas.push({
        q: String(x.q || '').slice(0, 100),
        vis: (Array.isArray(x.vis) ? x.vis : []).filter((v) => Picto.valido(v)).slice(0, 5),
        op: [0, 1, 2, 3].map((i) => { const a = (Array.isArray(x.op) && x.op[i]) || {}; return { vis: Picto.valido(a.vis) ? a.vis : '', txt: String(a.txt || '').slice(0, 20) }; }),
        c: Math.min(3, Math.max(0, parseInt(x.c, 10) || 0)),
      });
    }
    return z;
  }

  function problema(z) {
    if (!z.perguntas.length) return { k: -1, msg: 'Adicione pelo menos uma pergunta.' };
    for (let k = 0; k < z.perguntas.length; k++) {
      const p = z.perguntas[k];
      if (!p.q.trim() && !p.vis.length) return { k, msg: `Pergunta ${k + 1}: escreva um texto ou escolha pelo menos uma figura.` };
      if (p.op.filter(preenchida).length < 2) return { k, msg: `Pergunta ${k + 1}: preencha pelo menos 2 alternativas (figura ou texto).` };
      if (!preenchida(p.op[p.c])) return { k, msg: `Pergunta ${k + 1}: marque como certa uma alternativa preenchida.` };
    }
    return null;
  }

  // ---------- Importar perguntas de um texto ----------
  // Formato: blocos separados por linha em branco. 1ª linha = texto e/ou figuras da pergunta; depois 2 a 4 alternativas
  // (uma por linha, com figura e/ou texto curto). "*" no começo marca a certa. Linhas com # são comentários.
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // sem escapar "-": no modo unicode isso é inválido fora de classes
  let _fig = null;
  function figuras() { // mapa "emoji sem seletor de variação" -> id oficial, e a expressão que os encontra
    if (_fig) return _fig;
    const mapa = new Map();
    Picto.grupos.forEach((g) => g.itens.forEach((id) => mapa.set(id.replace(/\uFE0F/g, ''), id)));
    const chaves = [...mapa.keys()].sort((a, b) => b.length - a.length);
    return (_fig = { mapa, re: new RegExp(chaves.map(esc).join('|'), 'giu') });
  }
  function separar(linha) {
    const { mapa, re } = figuras(), figs = [];
    const texto = linha.replace(/\uFE0F/g, '').replace(re, (m) => { const id = mapa.get(m.toLowerCase()) || mapa.get(m); if (id) figs.push(id); return ' '; }).replace(/\s+/g, ' ').trim();
    return { figs, texto };
  }
  function deTexto(txt) {
    const linhas = String(txt || '').replace(/\r/g, '').split('\n').filter((l) => !l.trim().startsWith('#'));
    const blocos = linhas.join('\n').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
    const perguntas = [], ignorados = []; let cortados = 0;
    blocos.forEach((b, n) => {
      const ign = (motivo) => ignorados.push({ n: n + 1, inicio: b[0].slice(0, 28), motivo });
      if (b.length < 3) return ign('precisa de uma pergunta e pelo menos 2 alternativas');
      const q = separar(b[0]);
      if (!q.texto && !q.figs.length) return ign('a pergunta está vazia');
      const ops = b.slice(1, 5).map((l) => {
        let t = l, certa = false;
        if (t.startsWith('*')) { certa = true; t = t.slice(1).trim(); }
        t = t.replace(/^(?:[A-Da-d][).:]|[1-4][).])\s*/, '');
        if (t.startsWith('*')) { certa = true; t = t.slice(1).trim(); }
        const x = separar(t);
        if (x.texto.length > 20) cortados++;
        return { certa, vis: x.figs[0] || '', txt: x.texto.slice(0, 20) };
      });
      const c = ops.findIndex((o) => o.certa);
      if (c < 0) return ign('faltou marcar a alternativa certa com *');
      if (ops.filter((o) => o.vis || o.txt).length < 2 || !(ops[c].vis || ops[c].txt)) return ign('as alternativas estão vazias');
      while (ops.length < 4) ops.push({ vis: '', txt: '' });
      perguntas.push({ q: q.texto.slice(0, 100), vis: q.figs.slice(0, 5), op: ops.map((o) => ({ vis: o.vis, txt: o.txt })), c });
    });
    return { perguntas, ignorados, cortados };
  }
  const MODELO = [
    '# Modelo de importação: Atividade Kids',
    '# Cada pergunta é um bloco; separe os blocos com uma linha em branco.',
    '# 1ª linha: texto da pergunta e/ou figuras (cole emojis da lista do editor, até 5).',
    '# Depois, de 2 a 4 alternativas, uma por linha. Marque a certa com * no começo.',
    '# Cada alternativa pode ter 1 figura e/ou um texto curto (até 20 letras).',
    '# Linhas que começam com # são ignoradas. Pode usar A) B) C) D) antes das alternativas.',
    '',
    'Qual animal faz miau? 🐱',
    'A) 🐶 cachorro',
    '*B) 🐱 gato',
    'C) 🐮 vaca',
    '',
    '🍎🍎 + 🍎 = ?',
    'A) 2',
    '*B) 3',
    'C) 4',
    '',
    'Qual é a cor do céu?',
    'A) cor-verde',
    '*B) cor-azul',
    'C) cor-vermelho',
    'D) cor-amarelo',
    '',
    'Quem voa? 🦆',
    '*🐦 passarinho',
    '🐘 elefante',
    '🐢 tartaruga',
  ].join('\n');
  const baixar = (nome, texto, tipo) => {
    const a = h('a', { href: URL.createObjectURL(new Blob([texto], { type: tipo })), download: nome });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---------- Escolha de figura (janela com abas por categoria) ----------
  function escolher(aoEscolher, { podeLimpar = false } = {}) {
    const dlg = h('dialog', { class: 'picker' });
    const grade = h('div', { class: 'pgrade' });
    const abas = h('div', { class: 'pabas', role: 'tablist' });
    const mostrar = (g) => {
      [...abas.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.g === g.id)));
      grade.replaceChildren(...g.itens.map((id) => h('button', { type: 'button', class: 'pbtn', title: Picto.nome(id), 'aria-label': Picto.nome(id),
        onclick: () => { aoEscolher(id); dlg.close(); } }, Picto.el(id, 44))));
    };
    Picto.grupos.forEach((g) => abas.append(h('button', { type: 'button', class: 'paba', role: 'tab', 'data-g': g.id, textContent: g.nome, onclick: () => mostrar(g) })));
    dlg.append(h('h3', { textContent: 'Escolha uma figura' }), abas, grade,
      h('div', { class: 'acoes' },
        ...(podeLimpar ? [h('button', { type: 'button', class: 'sec', textContent: 'Tirar figura', onclick: () => { aoEscolher(''); dlg.close(); } })] : []),
        h('button', { type: 'button', class: 'sec', textContent: 'Fechar', onclick: () => dlg.close() })));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg); mostrar(Picto.grupos[0]); dlg.showModal();
  }

  // ---------- Editor ----------
  // ctx: { gravar(z) -> Promise, voltar(), jogar(z) -> Promise<texto de erro | null>, erroTexto(e), novo }
  function editar(el, z, ctx) {
    let t = null;
    const status = h('small', { class: 'status', role: 'status' }), msg = h('p', { class: 'msg', role: 'status' });
    const salvarJa = async () => {
      clearTimeout(t); status.textContent = 'Salvando…';
      try { await ctx.gravar(z); status.textContent = 'Salvo ✓'; return true; } catch (e) { status.textContent = ctx.erroTexto(e); return false; }
    };
    const salvar = () => { status.textContent = 'Alterações pendentes…'; clearTimeout(t); t = setTimeout(salvarJa, 1200); };
    const lista = h('div', { class: 'perguntas' });
    const cont = h('small', { class: 'status' });

    function desenhar() {
      lista.replaceChildren(...z.perguntas.map((p, k) => {
        const enun = h('input', { type: 'text', maxLength: 100, value: p.q, placeholder: 'Texto da pergunta (opcional)', 'aria-label': `Texto da pergunta ${k + 1}`, oninput: () => { p.q = enun.value; salvar(); } });
        const figuras = h('div', { class: 'figuras' },
          ...p.vis.map((id, n) => h('button', { type: 'button', class: 'fig', title: 'Tirar esta figura', 'aria-label': `Tirar ${Picto.nome(id)}`, onclick: () => { p.vis.splice(n, 1); salvar(); desenhar(); } }, Picto.el(id, 44))),
          p.vis.length < 5 ? h('button', { type: 'button', class: 'sec mini', textContent: '＋ figura', onclick: () => escolher((id) => { if (id) { p.vis.push(id); salvar(); desenhar(); } }) }) : '');
        const alts = [0, 1, 2, 3].map((i) => {
          const o = p.op[i];
          const fig = h('button', { type: 'button', class: 'figop', 'aria-label': `Figura da alternativa ${LET[i]}`,
            onclick: () => escolher((id) => { o.vis = id; salvar(); desenhar(); }, { podeLimpar: !!o.vis }) }, o.vis ? Picto.el(o.vis, 40) : '＋');
          const txt = h('input', { type: 'text', maxLength: 20, value: o.txt, placeholder: `Texto ${LET[i]} (opcional)`, 'aria-label': `Texto da alternativa ${LET[i]} da pergunta ${k + 1}`, oninput: () => { o.txt = txt.value; salvar(); } });
          const rd = h('input', { type: 'radio', name: 'kc' + k, checked: p.c === i, 'aria-label': `Alternativa ${LET[i]} é a correta`, onchange: () => { p.c = i; salvar(); } });
          return h('div', { class: 'alt a' + i }, h('b', { textContent: LET[i] }), fig, txt, h('label', { class: 'marca' }, rd, h('span', { textContent: 'certa' })));
        });
        const mover = (d) => { const j = k + d; [z.perguntas[k], z.perguntas[j]] = [z.perguntas[j], z.perguntas[k]]; salvar(); desenhar(); };
        return h('div', { class: 'qcard', id: 'q' + k },
          h('div', { class: 'qcab' }, h('strong', { textContent: `Pergunta ${k + 1}` }),
            h('button', { class: 'sec mini', type: 'button', textContent: '↑', disabled: k === 0, 'aria-label': 'Mover para cima', onclick: () => mover(-1) }),
            h('button', { class: 'sec mini', type: 'button', textContent: '↓', disabled: k === z.perguntas.length - 1, 'aria-label': 'Mover para baixo', onclick: () => mover(1) }),
            h('button', { class: 'sec mini', type: 'button', textContent: 'Duplicar', onclick: () => { if (z.perguntas.length < MAXQ) { z.perguntas.splice(k + 1, 0, JSON.parse(JSON.stringify(p))); salvar(); desenhar(); } } }),
            h('button', { class: 'sec mini perigo', type: 'button', textContent: 'Excluir', onclick: () => { z.perguntas.splice(k, 1); salvar(); desenhar(); } })),
          h('p', { class: 'vazio', textContent: 'Figuras que aparecem grandes na tela:' }), figuras, enun, ...alts);
      }));
      cont.textContent = `${z.perguntas.length} pergunta(s)`;
    }

    const colar = h('textarea', { rows: 8, placeholder: 'Qual animal faz miau? 🐱\nA) 🐶 cachorro\n*B) 🐱 gato\nC) 🐮 vaca\n\n🍎🍎 + 🍎 = ?\nA) 2\n*B) 3\nC) 4', 'aria-label': 'Perguntas para importar' });
    const importMsg = h('p', { class: 'importmsg', role: 'status' });
    const arq = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true, onchange: async () => {
      const f = arq.files[0]; if (!f) return;
      if (f.size > 200000) { importMsg.textContent = 'Arquivo grande demais (máximo 200 KB).'; return; }
      colar.value = await f.text(); importMsg.textContent = 'Arquivo carregado. Confira o texto e clique em "Adicionar ao quizz".'; arq.value = '';
    } });
    const vazio = (p) => !p.q.trim() && !p.vis.length && p.op.every((o) => !o.vis && !o.txt.trim());
    function adicionar() {
      const r = deTexto(colar.value);
      const linhas = [];
      if (!r.perguntas.length) linhas.push('Nenhuma pergunta válida no texto. Baixe o modelo para ver o formato.');
      else {
        if (z.perguntas.length && z.perguntas.every(vazio)) z.perguntas = []; // a pergunta em branco do início sai
        const cabem = MAXQ - z.perguntas.length, novas = r.perguntas.slice(0, Math.max(0, cabem));
        z.perguntas.push(...novas); colar.value = ''; salvar(); desenhar();
        linhas.push(`${novas.length} pergunta(s) adicionada(s).`);
        if (novas.length < r.perguntas.length) linhas.push(`Limite de ${MAXQ} perguntas: ${r.perguntas.length - novas.length} ficaram de fora.`);
      }
      r.ignorados.slice(0, 5).forEach((g) => linhas.push(`Bloco ${g.n} ("${g.inicio}"): ${g.motivo}.`));
      if (r.ignorados.length > 5) linhas.push(`...e mais ${r.ignorados.length - 5} bloco(s) ignorado(s).`);
      if (r.cortados) linhas.push(`${r.cortados} texto(s) de alternativa foram cortados em 20 letras.`);
      importMsg.textContent = linhas.join('\n');
    }
    const titulo = h('input', { type: 'text', maxLength: 60, value: z.titulo, 'aria-label': 'Título da atividade', oninput: () => { z.titulo = titulo.value; salvar(); } });
    el.replaceChildren(
      h('p', { class: 'vazio', textContent: '🧸 Atividade Kids: o professor conduz com as crianças, sem alunos conectados. Pergunte em voz alta e toque na resposta que a turma escolher.' }),
      h('div', { class: 'edtopo' }, titulo, cont, status), lista,
      h('div', { class: 'acoes' }, h('button', { class: 'sec', type: 'button', textContent: '+ Adicionar pergunta', onclick: () => {
        if (z.perguntas.length >= MAXQ) { msg.textContent = `Limite de ${MAXQ} perguntas.`; return; }
        z.perguntas.push(vazia()); salvar(); desenhar();
      } })),
      h('details', { class: 'trocar importar' }, h('summary', { textContent: 'Importar perguntas (colar texto ou arquivo .txt)' }),
        h('p', { class: 'vazio', textContent: 'Cole várias perguntas de uma vez. Figuras: cole os emojis direto (🐱 🍎 ⭐...), só as da lista do editor são aceitas. Marque a certa com *. Baixe o modelo para ver o formato.' }),
        colar,
        h('div', { class: 'acoes' },
          h('button', { class: 'sec', type: 'button', textContent: '📄 Carregar arquivo .txt', onclick: () => arq.click() }), arq,
          h('button', { class: 'sec', type: 'button', textContent: '⬇️ Baixar modelo', onclick: () => baixar('modelo-kids.txt', MODELO, 'text/plain') }),
          h('button', { class: 'grande', type: 'button', textContent: 'Adicionar ao quizz', onclick: adicionar })),
        importMsg),
      h('div', { class: 'acoes' },
        h('button', { class: 'grande', type: 'button', textContent: 'Jogar', onclick: async () => {
          const pr = problema(z);
          if (pr) { msg.textContent = pr.msg; const c = pr.k >= 0 && document.getElementById('q' + pr.k); if (c) { c.classList.add('invalida'); c.scrollIntoView({ block: 'center' }); setTimeout(() => c.classList.remove('invalida'), 2500); } return; }
          msg.textContent = 'Salvando…';
          if (!(await salvarJa())) { msg.textContent = 'Não foi possível salvar. Verifique a internet.'; return; }
          msg.textContent = (await ctx.jogar(z)) || '';
        } }),
        h('button', { class: 'sec', type: 'button', textContent: 'Exportar arquivo', onclick: () => baixar((z.titulo || 'atividade').replace(/[^\w-]+/g, '_') + '.json', JSON.stringify({ tipo: 'kids', titulo: z.titulo, perguntas: z.perguntas }, null, 1), 'application/json') }),
        h('button', { class: 'sec', type: 'button', textContent: 'Voltar', onclick: async () => { await salvarJa(); ctx.voltar(); } })),
      msg);
    desenhar();
    if (ctx.novo) salvarJa(); // reserva a vaga já na criação
  }

  // ---------- Jogo (conduzido pelo professor) ----------
  const FALAS_OK = ['Muito bem!', 'Parabéns!', 'Isso mesmo!', 'Você acertou!', 'Que demais!'];
  const FALAS_ERRO = ['Quase! Tente de novo.', 'Ops! Vamos tentar outra vez?', 'Tente de novo, você consegue!'];
  const sorteia = (l) => l[Math.floor(Math.random() * l.length)];

  function confete(origem) {
    if (reduz()) return;
    const r = origem.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, em = ['⭐', '🎉', '✨', '🎈', '💛', '🌟'];
    for (let n = 0; n < 22; n++) {
      const s = h('span', { class: 'conf', textContent: em[n % em.length] }), ang = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
      s.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.round(Math.cos(ang) * d)}px;--dy:${Math.round(Math.sin(ang) * d - 80)}px;--rot:${Math.round(Math.random() * 540 - 270)}deg;animation-delay:${Math.round(Math.random() * 120)}ms`;
      document.body.append(s); setTimeout(() => s.remove(), 1700);
    }
  }
  // Leitura em voz alta (voz do próprio navegador, sem internet extra). Ajuda crianças que ainda não leem e leitores de tela.
  const VOZ_KEY = 'pontuo_kids_voz';
  let vozAuto = false;
  try { vozAuto = localStorage.getItem(VOZ_KEY) === '1'; } catch (e) {}
  const temVoz = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  const falar = (texto) => {
    if (!temVoz() || !texto) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR'; 
      u.rate = 0.95; // Um pouco mais natural que 0.9 (ajuste entre 0.9 e 1.0)
      u.pitch = 1.05; // Levemente mais agudo, o que costuma soar mais amigável para crianças
      const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
      // Tenta encontrar a melhor voz em pt-BR (priorizando Google, Microsoft ou termos "natural")
      const voz = voices.find(v => /pt-BR|pt_BR/i.test(v.lang) && /google|microsoft|natural|online/i.test(v.name)) ||
                  voices.find(v => /^pt/i.test(v.lang));
      if (voz) u.voice = voz;
      speechSynthesis.speak(u);
    } catch (e) { /* sem voz disponível */ }
  };
  const calar = () => { try { if (temVoz()) speechSynthesis.cancel(); } catch (e) {} };
  const nomeOp = (op) => (op.txt.trim() || Picto.nome(op.vis));
  // Texto lido: pergunta, figuras e todas as alternativas ("Alternativa A: cachorro. Alternativa B: gato.").
  function textoCompleto(p) {
    const partes = [];
    if (p.q.trim()) partes.push(p.q.trim());
    if (p.vis.length) partes.push((p.q.trim() ? 'Figuras: ' : 'Olhe as figuras: ') + p.vis.map((id) => Picto.nome(id)).join(', '));
    const ops = p.op.map((op, k) => ({ op, k })).filter(({ op }) => preenchida(op));
    partes.push('Escolha. ' + ops.map(({ op, k }) => `Alternativa ${LET[k]}: ${nomeOp(op)}`).join('. '));
    return partes.join('. ');
  }

  function jogar(z) {
    const ps = z.perguntas, ganhou = ps.map(() => false);
    let i = 0, erros = 0, travado = false;
    let o = document.getElementById('kids');
    if (!o) { o = h('div', { id: 'kids', class: 'jogo kids' }); document.body.append(o); }
    o.hidden = false;
    const sair = () => { calar(); o.hidden = true; o.replaceChildren(); };
    const estrelas = () => ganhou.filter(Boolean).length;

    function topo() {
      return h('div', { class: 'ktopo' },
        h('div', { class: 'kpontos', 'aria-label': `${estrelas()} estrelas` }, h('span', { textContent: '⭐' }), h('b', { class: 'kn', textContent: estrelas() })),
        h('div', { class: 'kprog', 'aria-hidden': 'true' }, ...ps.map((_, n) => h('i', { class: n < i ? 'feito' : n === i ? 'atual' : '' }))),
        ...(temVoz() ? [h('button', { class: 'sec mini kvoz', type: 'button', 'aria-pressed': String(vozAuto),
          textContent: vozAuto ? '🗣️ Voz automática: ligada' : '🗣️ Voz automática: desligada',
          onclick: (e) => {
            vozAuto = !vozAuto; try { localStorage.setItem(VOZ_KEY, vozAuto ? '1' : '0'); } catch (x) {}
            e.currentTarget.setAttribute('aria-pressed', String(vozAuto));
            e.currentTarget.textContent = vozAuto ? '🗣️ Voz automática: ligada' : '🗣️ Voz automática: desligada';
            if (vozAuto) falar(textoCompleto(ps[i])); else calar();
          } })] : []));
    }
    function tela(...filhos) {
      o.replaceChildren(h('button', { class: 'sair', type: 'button', textContent: 'Sair', onclick: sair }),
        ...(window.Som ? [Som.botao()] : []), h('div', { class: 'jogo-in kids-in' }, ...filhos));
    }

    function pergunta() {
      const p = ps[i]; travado = false; erros = 0;
      const fala = h('div', { class: 'fala', role: 'status', textContent: 'Vamos lá!' });
      const proximo = h('button', { class: 'kprox', type: 'button', hidden: true, textContent: i + 1 < ps.length ? '➡️' : '🏆', 'aria-label': i + 1 < ps.length ? 'Próxima pergunta' : 'Ver resultado',
        onclick: () => { i++; if (i < ps.length) { som('toque'); pergunta(); } else final(); } });
      const ouvir = temVoz() ? h('button', { class: 'sec', type: 'button', textContent: '🔊 Ouvir a pergunta e as opções', onclick: () => falar(textoCompleto(p)) }) : '';
      const botoes = p.op.map((op, k) => ({ op, k })).filter(({ op }) => preenchida(op)).map(({ op, k }) => {
        const b = h('button', { type: 'button', class: 'kop a' + k, 'aria-label': nomeOp(op) },
          ...(op.vis ? [Picto.el(op.vis, 72)] : []), ...(op.txt ? [h('span', { class: 'ktxt', textContent: op.txt })] : []));
        b.addEventListener('click', () => {
          if (travado) return;
          if (k === p.c) {
            travado = true; b.classList.add('acertou'); confete(b); som('acerto');
            if (!erros) { ganhou[i] = true; const n = o.querySelector('.kn'); if (n) { n.textContent = estrelas(); n.parentElement.classList.remove('pop'); void n.parentElement.offsetWidth; n.parentElement.classList.add('pop'); } }
            fala.textContent = sorteia(FALAS_OK); fala.className = 'fala ok'; proximo.hidden = false; proximo.focus();
            if (vozAuto) falar(fala.textContent);
          } else {
            erros++; b.classList.add('errou'); b.disabled = true; som('erro');
            fala.textContent = sorteia(FALAS_ERRO); fala.className = 'fala tente';
            if (vozAuto) falar(fala.textContent);
          }
        });
        return b;
      });
      tela(topo(),
        h('div', { class: 'kmasc' }, h('span', { class: 'masc', textContent: '✏️', 'aria-hidden': 'true' }), fala),
        h('div', { class: 'kfigs' }, ...p.vis.map((id, n) => { const f = Picto.el(id, 96); f.style.animationDelay = `${n * 120}ms`; return f; })),
        ...(p.q.trim() ? [h('h2', { class: 'kq', textContent: p.q })] : []), ouvir,
        h('div', { class: 'kops n' + botoes.length }, ...botoes), proximo);
      som('inicio');
      calar(); if (vozAuto) setTimeout(() => { if (!o.hidden && i < ps.length && ps[i] === p) falar(textoCompleto(p)); }, 700);
    }

    function final() {
      const total = ps.length, n = estrelas();
      const linha = h('div', { class: 'kestrelas', 'aria-label': `${n} de ${total} estrelas` }, ...ganhou.map((g) => h('span', { class: 'kest' + (g ? '' : ' off'), textContent: '⭐' })));
      tela(h('h2', { class: 'kfim', textContent: n === total ? '🎉 Perfeito! 🎉' : n ? '🎉 Parabéns! 🎉' : 'Muito bem por tentar!' }), linha,
        h('p', { class: 'kq', textContent: `Você ganhou ${n} de ${total} estrelas!` }),
        h('div', { class: 'acoes' }, h('button', { class: 'grande', type: 'button', textContent: '🔁 Jogar de novo', onclick: () => { ganhou.fill(false); i = 0; pergunta(); } }),
          h('button', { class: 'sec', type: 'button', textContent: 'Sair', onclick: sair })));
      som('vitoria');
      if (vozAuto) falar(`Você ganhou ${n} de ${total} estrelas!`);
      [...linha.children].forEach((s, k) => setTimeout(() => { s.classList.add('on'); if (ganhou[k]) som('estrela', k); if (k === 0 || k === total - 1) confete(s); }, 400 + k * 350));
    }
    pergunta();
  }

  window.Kids = { editar, jogar, normalizar, problema, novoQuiz, deTexto, _teste: { escolher, MODELO } };
})();
