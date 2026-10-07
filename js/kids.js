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
  const vazia = () => ({ q: '', vis: [], op: [0, 1, 2, 3].map(() => ({ vis: '', txt: '' })), c: 0, fixa: false });
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
        fixa: !!x.fixa,
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
      perguntas.push({ q: q.texto.slice(0, 100), vis: q.figs.slice(0, 5), op: ops.map((o) => ({ vis: o.vis, txt: o.txt })), c, fixa: false });
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
            h('label', { class: 'fixa', title: 'Mantém as alternativas sempre nesta ordem' }, h('input', { type: 'checkbox', checked: !!p.fixa, onchange: (e) => { p.fixa = e.target.checked; salvar(); } }), '🔒 ordem fixa'),
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
      h('div', { class: 'acoes ordem' },
        h('span', { class: 'vazio', textContent: 'As alternativas mudam de lugar (e de cor) a cada jogo. Marque 🔒 para manter a ordem, por exemplo em contagens 1, 2, 3.' }),
        h('button', { class: 'sec mini', type: 'button', textContent: '🔀 Embaralhar todas', onclick: () => { z.perguntas.forEach((p) => { p.fixa = false; }); salvar(); desenhar(); } }),
        h('button', { class: 'sec mini', type: 'button', textContent: '🔒 Fixar todas', onclick: () => { z.perguntas.forEach((p) => { p.fixa = true; }); salvar(); desenhar(); } })),
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
  const FALAS_OK = ['Muito bem!', 'Parabéns!', 'Isso mesmo!', 'Você acertou!', 'Que demais!', 'Mandou bem!', 'Isso aí!', 'Excelente!'];
  const FALAS_ERRO = ['Quase! Tente de novo.', 'Ops! Vamos tentar outra vez?', 'Tente de novo, você consegue!', 'Não foi dessa vez. Escolha outra opção!'];
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
  // ---------- Leitura em voz alta mais natural ----------
  // Usa a voz do próprio aparelho. O que a deixa mais humana aqui: escolher a melhor voz em português (as "naturais"),
  // falar em frases curtas com pausas, dizer a cor de cada botão em vez de "alternativa A", destacar a opção que está
  // sendo lida, ler contas como gente (2+3 = "2 mais 3") e dar entusiasmo nos incentivos.
  const KEY = { auto: 'pontuo_kids_voz', nome: 'pontuo_kids_voz_nome', vel: 'pontuo_kids_voz_vel' };
  const lerLS = (k, padrao = '') => { try { const v = localStorage.getItem(k); return v === null ? padrao : v; } catch (e) { return padrao; } };
  const gravarLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  let vozAuto = lerLS(KEY.auto) === '1';
  const temVoz = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  const COR_OP = ['vermelha', 'azul', 'amarela', 'verde']; // cor do botão de cada alternativa
  let seq = 0; // cada leitura tem um número: calar ou trocar de pergunta invalida as pendentes

  function notaVoz(v) {
    const nome = `${v.name} ${v.lang}`;
    let n;
    if (/^pt[-_]br/i.test(v.lang)) n = 100; else if (/^pt/i.test(v.lang)) n = 50; else return -1;
    if (/natural|neural|online/i.test(nome)) n += 40;
    if (/google/i.test(nome)) n += 25;
    if (/premium|enhanced|aprimorad|siri/i.test(nome)) n += 30;
    if (/compact|compacta/i.test(nome)) n -= 10;
    return n;
  }
  const vozesPt = () => (speechSynthesis.getVoices ? speechSynthesis.getVoices() : []).filter((v) => notaVoz(v) >= 0).sort((a, b) => notaVoz(b) - notaVoz(a));
  function vozEscolhida() { const l = vozesPt(), salva = lerLS(KEY.nome); return l.find((v) => v.name === salva) || l[0] || null; }
  const velocidade = () => { const v = parseFloat(lerLS(KEY.vel, '0.9')); return v >= 0.6 && v <= 1.3 ? v : 0.9; };
  // Símbolos viram palavras: "2+3=?" -> "2 mais 3 igual a ?"
  const paraFala = (t) => String(t)
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, '$1 menos ').replace(/(\d)\s*[x×*]\s*(?=\d)/gi, '$1 vezes ')
    .replace(/\+/g, ' mais ').replace(/÷/g, ' dividido por ').replace(/=/g, ' igual a ').replace(/%/g, ' por cento ').replace(/\s+/g, ' ').trim();
  const nomeOp = (op) => (op.txt.trim() || Picto.nome(op.vis));

  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  function falando(ligado) {
    const m = document.querySelector('#kids .masc'); if (m) m.classList.toggle('falando', ligado);
    if (!ligado) document.querySelectorAll('#kids .kop.lendo').forEach((e) => e.classList.remove('lendo'));
  }
  // Fala uma frase e avisa quando termina (alguns navegadores não avisam: há um tempo máximo de segurança).
  function dizer(texto, { rate, pitch = 1 } = {}) {
    return new Promise((ok) => {
      if (!temVoz() || !String(texto).trim()) return ok();
      const u = new SpeechSynthesisUtterance(paraFala(texto));
      u.lang = 'pt-BR'; u.rate = rate || velocidade(); u.pitch = pitch;
      const v = vozEscolhida(); if (v) { u.voice = v; u.lang = v.lang; }
      let feito = false, t;
      const fim = () => { if (!feito) { feito = true; clearTimeout(t); ok(); } };
      u.onend = fim; u.onerror = fim;
      t = setTimeout(fim, Math.max(2500, String(texto).length * 110) + 1500);
      try { speechSynthesis.speak(u); } catch (e) { fim(); }
    });
  }
  function calar() { seq++; try { if (temVoz()) speechSynthesis.cancel(); } catch (e) {} falando(false); }
  // Frase solta (incentivos, resultado): interrompe o que estiver sendo lido.
  function falar(texto, opcoes) { if (!temVoz() || !texto) return; calar(); const id = seq; falando(true); dizer(texto, opcoes).then(() => { if (id === seq) falando(false); }); }
  const ANIMADO = { pitch: 1.15, rate: 1.0 }; // incentivos soam mais alegres

  // Lê a pergunta, as figuras e cada opção, destacando o botão que está sendo lido.
  async function lerPergunta(p, lista) {
    if (!temVoz()) return;
    calar(); const id = seq;
    const passos = [];
    if (p.q.trim()) passos.push({ t: p.q.trim() });
    if (p.vis.length) passos.push({ t: (p.vis.length > 1 ? 'Veja as figuras: ' : 'Veja a figura: ') + p.vis.map((f) => Picto.nome(f)).join(', ') + '.' });
    passos.push({ t: 'Escolha uma opção.' });
    lista.forEach(({ k, b }) => passos.push({ t: `${COR_OP[k]}: ${nomeOp(p.op[k])}.`, el: b }));
    falando(true);
    for (const passo of passos) {
      if (id !== seq) return;
      if (passo.el) passo.el.classList.add('lendo');
      await dizer(passo.t);
      if (passo.el) passo.el.classList.remove('lendo');
      if (id !== seq) return;
      await pausa(passo.el ? 200 : 350);
    }
    if (id === seq) falando(false);
  }

  // Janela de ajustes da voz (escolha da voz, velocidade e teste). Vale só para este aparelho.
  function configVoz() {
    const dlg = h('dialog', { class: 'kcfg' });
    const sel = h('select', { 'aria-label': 'Voz de leitura' }), aviso = h('p', { class: 'vazio' });
    const vel = h('select', { 'aria-label': 'Velocidade da fala' }, ...[['Devagar', 0.75], ['Normal', 0.9], ['Rápida', 1.05]].map(([n, v]) =>
      h('option', { value: v, textContent: n, selected: Math.abs(velocidade() - v) < 0.01 })));
    const preencher = () => {
      const l = vozesPt(), atual = vozEscolhida();
      sel.replaceChildren(...l.map((v) => h('option', { value: v.name, textContent: `${v.name} (${v.lang})`, selected: !!atual && v.name === atual.name })));
      sel.disabled = !l.length;
      aviso.textContent = l.length ? '' : 'Este aparelho não tem voz em português instalada. Instale uma nas configurações de voz do sistema.';
    };
    preencher();
    const ouvirMudar = () => preencher();
    try { speechSynthesis.addEventListener('voiceschanged', ouvirMudar); } catch (e) {}
    sel.addEventListener('change', () => gravarLS(KEY.nome, sel.value));
    vel.addEventListener('change', () => gravarLS(KEY.vel, vel.value));
    const fechar = h('button', { type: 'button', class: 'sec', textContent: 'Fechar', onclick: () => dlg.close() });
    dlg.append(h('h3', { textContent: 'Voz de leitura' }),
      h('label', {}, 'Voz', sel), h('label', {}, 'Velocidade', vel), aviso,
      h('button', { type: 'button', class: 'sec', textContent: '▶ Testar a voz', onclick: () => falar('Olá! Eu sou o lápis do Pontuô. Vamos aprender brincando?', ANIMADO) }),
      h('details', { class: 'dicas' }, h('summary', { textContent: 'Como deixar a voz mais natural' }),
        h('ul', {},
          h('li', { textContent: 'Computador com Windows: use o Microsoft Edge. Ele tem vozes "Natural" em português (como Francisca e Antonio), bem mais humanas.' }),
          h('li', { textContent: 'Android: o Chrome usa a voz "Google português do Brasil".' }),
          h('li', { textContent: 'iPhone e iPad: Ajustes > Acessibilidade > Conteúdo Falado > Vozes > Português (Brasil) e baixe a versão "Aprimorada".' }))),
      h('div', { class: 'acoes' }, fechar));
    dlg.addEventListener('close', () => { try { speechSynthesis.removeEventListener('voiceschanged', ouvirMudar); } catch (e) {} calar(); dlg.remove(); });
    document.body.append(dlg); dlg.showModal();
  }

  function jogar(z) {
    // Cada partida embaralha as alternativas de novo (a certa acompanha o texto); "Jogar de novo" também.
    const preparar = () => z.perguntas.map((p) => (window.Ordem ? Ordem.embaralhar(p, preenchida, (op) => op.txt) : p));
    let ps = preparar();
    const ganhou = ps.map(() => false);
    let i = 0, erros = 0, travado = false;
    let o = document.getElementById('kids');
    if (!o) { o = h('div', { id: 'kids', class: 'jogo kids' }); document.body.append(o); }
    o.hidden = false;
    let atual = null; // pergunta em exibição: { p, lista } (para a voz automática)
    const sair = () => { calar(); o.hidden = true; o.replaceChildren(); };
    const estrelas = () => ganhou.filter(Boolean).length;

    function topo() {
      return h('div', { class: 'ktopo' },
        h('div', { class: 'kpontos', 'aria-label': `${estrelas()} estrelas` }, h('span', { textContent: '⭐' }), h('b', { class: 'kn', textContent: estrelas() })),
        h('div', { class: 'kprog', 'aria-hidden': 'true' }, ...ps.map((_, n) => h('i', { class: n < i ? 'feito' : n === i ? 'atual' : '' }))),
        ...(temVoz() ? [h('button', { class: 'sec mini kvoz', type: 'button', 'aria-pressed': String(vozAuto),
          textContent: vozAuto ? '🗣️ Voz automática: ligada' : '🗣️ Voz automática: desligada',
          onclick: (e) => {
            vozAuto = !vozAuto; gravarLS(KEY.auto, vozAuto ? '1' : '0');
            e.currentTarget.setAttribute('aria-pressed', String(vozAuto));
            e.currentTarget.textContent = vozAuto ? '🗣️ Voz automática: ligada' : '🗣️ Voz automática: desligada';
            if (vozAuto && atual) lerPergunta(atual.p, atual.lista); else calar();
          } }),
          h('button', { class: 'sec mini', type: 'button', textContent: '⚙️ Voz', 'aria-label': 'Ajustes da voz de leitura', onclick: configVoz })] : []));
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
      const ouvir = temVoz() ? h('button', { class: 'sec', type: 'button', textContent: '🔊 Ouvir a pergunta e as opções', onclick: () => lerPergunta(p, atual.lista) }) : '';
      const botoes = p.op.map((op, k) => ({ op, k })).filter(({ op }) => preenchida(op)).map(({ op, k }) => {
        const b = h('button', { type: 'button', class: 'kop a' + k, 'data-k': k, 'aria-label': nomeOp(op) },
          ...(op.vis ? [Picto.el(op.vis, 72)] : []), ...(op.txt ? [h('span', { class: 'ktxt', textContent: op.txt })] : []));
        b.addEventListener('click', () => {
          if (travado) return;
          if (k === p.c) {
            travado = true; b.classList.add('acertou'); confete(b); som('acerto');
            if (!erros) { ganhou[i] = true; const n = o.querySelector('.kn'); if (n) { n.textContent = estrelas(); n.parentElement.classList.remove('pop'); void n.parentElement.offsetWidth; n.parentElement.classList.add('pop'); } }
            fala.textContent = sorteia(FALAS_OK); fala.className = 'fala ok'; proximo.hidden = false; proximo.focus();
            if (vozAuto) falar(fala.textContent, ANIMADO);
          } else {
            erros++; b.classList.add('errou'); b.disabled = true; som('erro');
            fala.textContent = sorteia(FALAS_ERRO); fala.className = 'fala tente';
            if (vozAuto) falar(fala.textContent, { pitch: 1.0, rate: 0.9 });
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
      atual = { p, lista: botoes.map((b) => ({ k: +b.dataset.k, b })) };
      calar(); if (vozAuto) setTimeout(() => { if (!o.hidden && i < ps.length && ps[i] === p) lerPergunta(p, atual.lista); }, 700);
    }

    function final() {
      const total = ps.length, n = estrelas();
      const linha = h('div', { class: 'kestrelas', 'aria-label': `${n} de ${total} estrelas` }, ...ganhou.map((g) => h('span', { class: 'kest' + (g ? '' : ' off'), textContent: '⭐' })));
      tela(h('h2', { class: 'kfim', textContent: n === total ? '🎉 Perfeito! 🎉' : n ? '🎉 Parabéns! 🎉' : 'Muito bem por tentar!' }), linha,
        h('p', { class: 'kq', textContent: `Você ganhou ${n} de ${total} estrelas!` }),
        h('div', { class: 'acoes' }, h('button', { class: 'grande', type: 'button', textContent: '🔁 Jogar de novo', onclick: () => { ps = preparar(); ganhou.fill(false); i = 0; pergunta(); } }),
          h('button', { class: 'sec', type: 'button', textContent: 'Sair', onclick: sair })));
      som('vitoria');
      if (vozAuto) falar(`Você ganhou ${n} de ${total} estrelas!`, ANIMADO);
      [...linha.children].forEach((s, k) => setTimeout(() => { s.classList.add('on'); if (ganhou[k]) som('estrela', k); if (k === 0 || k === total - 1) confete(s); }, 400 + k * 350));
    }
    pergunta();
  }

  window.Kids = { editar, jogar, normalizar, problema, novoQuiz, deTexto, _teste: { escolher, MODELO } };
})();
