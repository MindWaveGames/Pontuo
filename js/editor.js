// Editor visual de quizzes. Os quizzes ficam salvos NA CONTA do professor (servidor): até 5, em qualquer computador.
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
  const LOCAL = 'pontuo_quizzes'; // formato antigo (salvo só no navegador), importável uma vez
  const MAXQ = 100, LET = ['A', 'B', 'C', 'D'], TEMPOS = [10, 15, 20, 30, 45, 60];
  let cache = [], max = 5, maxKids = 3;

  const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('');
  const vazia = () => ({ q: '', op: ['', '', '', ''], c: 0, seg: 0, fixa: false });
  const novoQuiz = () => ({ qid: novoId(), tipo: 'normal', titulo: 'Novo quizz', seg: 20, perguntas: [vazia()] });
  const MSG = {
    limite_quizzes: () => `Você atingiu o limite deste tipo de quizz (${max} normais e ${maxKids} Kids). Exclua um para criar outro.`,
    token_invalido: () => 'Sua sessão expirou. Entre com a chave novamente.',
  };
  const erroTexto = (e) => (MSG[e.message] ? MSG[e.message]() : 'Sem conexão com o servidor. Tente novamente.');

  // Aceita só o formato esperado e limita tamanhos (vale para arquivo importado).
  function normalizar(o) {
    if (o && o.tipo === 'kids' && window.Kids) return Kids.normalizar(o);
    const src = o && typeof o === 'object' ? o : {};
    const z = { qid: novoId(), tipo: 'normal', titulo: String(src.titulo || 'Quizz importado').slice(0, 60), seg: TEMPOS.includes(+src.seg) ? +src.seg : 20, perguntas: [] };
    for (const p of (Array.isArray(src.perguntas) ? src.perguntas : []).slice(0, MAXQ)) {
      const x = p && typeof p === 'object' ? p : {};
      z.perguntas.push({
        q: String(x.q || '').slice(0, 200),
        op: [0, 1, 2, 3].map((i) => String((Array.isArray(x.op) && x.op[i]) || '').slice(0, 80)),
        c: Math.min(3, Math.max(0, parseInt(x.c, 10) || 0)),
        seg: TEMPOS.includes(+x.seg) ? +x.seg : 0,
        fixa: !!x.fixa,
      });
    }
    return z;
  }

  // Formato em texto: blocos separados por linha em branco; 1ª linha = pergunta; "*" marca a certa.
  function deTexto(txt) {
    return txt.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((l) => l.length >= 3).map((l) => {
      const [q, ...r] = l, o = r.slice(0, 4), c = o.findIndex((x) => x.startsWith('*'));
      if (c < 0) return null;
      return { q: q.slice(0, 200), op: [0, 1, 2, 3].map((i) => (o[i] || '').replace(/^\*/, '').trim().slice(0, 80)), c, seg: 0 };
    }).filter(Boolean);
  }

  function problema(z) {
    if (!z.perguntas.length) return { k: -1, msg: 'Adicione pelo menos uma pergunta.' };
    for (let k = 0; k < z.perguntas.length; k++) {
      const p = z.perguntas[k];
      if (!p.q.trim()) return { k, msg: `Pergunta ${k + 1}: escreva o enunciado.` };
      if (p.op.filter((t) => t.trim()).length < 2) return { k, msg: `Pergunta ${k + 1}: preencha pelo menos 2 alternativas.` };
      if (!p.op[p.c].trim()) return { k, msg: `Pergunta ${k + 1}: marque como certa uma alternativa preenchida.` };
    }
    return null;
  }

  // Converte para o formato que o jogo usa (alternativas vazias saem; o índice da certa é recalculado).
  const paraJogo = (z) => z.perguntas.map((p) => {
    const idx = []; p.op.forEach((t, i) => { if (t.trim()) idx.push(i); });
    return { q: p.q.trim(), op: idx.map((i) => p.op[i].trim()), c: idx.indexOf(p.c), seg: p.seg || 0, fixa: !!p.fixa };
  });

  // ---------- Servidor ----------
  const api = (acao, extra) => Api.professor.quizzes(acao, extra);
  async function carregarLista() { const d = await api('listar'); cache = d.quizzes || []; max = d.max || 5; maxKids = d.max_kids || 3; }
  async function gravar(z) {
    await api('salvar', { quiz: z });
    const i = cache.findIndex((x) => x.qid === z.qid);
    if (i >= 0) cache[i] = z; else cache.unshift(z);
  }
  async function excluir(qid) { await api('excluir', { qid }); cache = cache.filter((x) => x.qid !== qid); }
  const legados = () => { try { const l = JSON.parse(localStorage.getItem(LOCAL)); return Array.isArray(l) ? l : []; } catch (e) { return []; } };

  function montar(el, abrirSala) {
    el.replaceChildren(h('p', { class: 'vazio', textContent: 'Carregando seus quizzes…' }));
    carregarLista().then(biblioteca).catch((e) => el.replaceChildren(h('p', { class: 'msg', textContent: erroTexto(e) }),
      h('button', { class: 'sec', textContent: 'Tentar de novo', onclick: () => montar(el, abrirSala) })));

    // Abre a sala (normal) ou o jogo conduzido pelo professor (Kids). Devolve um texto de erro, ou null.
    const iniciar = async (z) => {
      if (z.tipo !== 'kids') return abrirSala(paraJogo(z), z.seg);
      if (!(await Api.valida())) return MSG.token_invalido();
      Kids.jogar(z); return null;
    };

    // ---------- Biblioteca ----------
    function biblioteca() {
      const msg = h('p', { class: 'msg', role: 'status' });
      const normais = cache.filter((z) => z.tipo !== 'kids'), kids = cache.filter((z) => z.tipo === 'kids');
      const cheioN = normais.length >= max, cheioK = kids.length >= maxKids, antigos = legados();
      const cheioDe = (z) => (z.tipo === 'kids' ? cheioK : cheioN);
      const arq = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
        const f = arq.files[0]; if (!f) return;
        try {
          if (f.size > 500000) throw new Error('grande');
          const z = normalizar(JSON.parse(await f.text()));
          if (!z.perguntas.length) throw new Error('vazio');
          if (cheioDe(z)) throw new Error('limite_quizzes');
          await gravar(z); biblioteca();
        } catch (e) { msg.textContent = e.message === 'limite_quizzes' ? MSG.limite_quizzes() : 'Arquivo inválido. Use um arquivo exportado pelo Pontuô.'; }
      } });
      const jogar = async (z) => {
        const pr = z.tipo === 'kids' ? Kids.problema(z) : problema(z);
        if (pr) { msg.textContent = `"${z.titulo}" — ${pr.msg} Abra para editar.`; return; }
        msg.textContent = 'Verificando licença…';
        msg.textContent = (await iniciar(z)) || '';
      };
      const duplicar = async (z) => {
        const c = JSON.parse(JSON.stringify(z)); c.qid = novoId(); c.titulo = (z.titulo + ' (cópia)').slice(0, 60);
        try { await gravar(c); biblioteca(); } catch (e) { msg.textContent = erroTexto(e); }
      };
      const apagar = async (z) => {
        if (!confirm(`Excluir "${z.titulo}"?`)) return;
        try { await excluir(z.qid); biblioteca(); } catch (e) { msg.textContent = erroTexto(e); }
      };
      const importarAntigos = async () => {
        msg.textContent = 'Importando…';
        let n = 0;
        for (const q of antigos) {
          if (cache.filter((x) => x.tipo !== 'kids').length >= max) break;
          const z = normalizar({ titulo: q.titulo, seg: q.seg, perguntas: q.perguntas });
          if (!z.perguntas.length) continue;
          try { await gravar(z); n++; } catch (e) { break; }
        }
        if (n === antigos.length || cache.filter((x) => x.tipo !== 'kids').length >= max) { try { localStorage.removeItem(LOCAL); } catch (e) {} }
        biblioteca();
      };
      el.replaceChildren(
        h('p', { class: 'vazio', textContent: `Quizzes: ${normais.length} de ${max} · Kids 🧸: ${kids.length} de ${maxKids}. Ficam salvos na sua conta e aparecem em qualquer computador.` }),
        h('div', { class: 'acoes' },
          h('button', { class: 'grande', textContent: 'Novo quizz', disabled: cheioN, onclick: () => editar(novoQuiz(), true) }),
          h('button', { class: 'grande kids-btn', textContent: '🧸 Nova atividade Kids', disabled: cheioK, onclick: () => editar(Kids.novoQuiz(), true) }),
          h('button', { class: 'sec', textContent: 'Importar arquivo', disabled: cheioN && cheioK, onclick: () => arq.click() }), arq),
        antigos.length && !cheioN ? h('div', { class: 'acoes' }, h('button', { class: 'sec', textContent: `Importar ${antigos.length} quizz(es) que estavam salvos neste navegador`, onclick: importarAntigos })) : '',
        cache.length ? h('div', { class: 'biblio' }, ...cache.map((z) => h('div', { class: 'bq' },
          h('strong', { textContent: (z.tipo === 'kids' ? '🧸 ' : '') + z.titulo }), h('small', { textContent: `${z.perguntas.length} pergunta(s)` }),
          h('button', { class: 'sec mini', textContent: 'Jogar', onclick: () => jogar(z) }),
          h('button', { class: 'sec mini', textContent: 'Editar', onclick: () => editar(z, false) }),
          h('button', { class: 'sec mini', textContent: 'Duplicar', disabled: cheioDe(z), onclick: () => duplicar(z) }),
          h('button', { class: 'sec mini perigo', textContent: 'Excluir', onclick: () => apagar(z) }))))
          : h('p', { class: 'vazio', textContent: 'Você ainda não tem quizzes. Crie o primeiro!' }),
        msg);
    }

    // ---------- Editor de um quizz ----------
    function editar(z, novo) {
      if (z.tipo === 'kids') return Kids.editar(el, z, { gravar, voltar: biblioteca, jogar: iniciar, erroTexto, novo });
      let t = null;
      const status = h('small', { class: 'status', role: 'status' }), msg = h('p', { class: 'msg', role: 'status' });
      const salvarJa = async () => {
        clearTimeout(t); status.textContent = 'Salvando…';
        try { await gravar(z); status.textContent = 'Salvo ✓'; return true; }
        catch (e) { status.textContent = erroTexto(e); return false; }
      };
      const salvar = () => { status.textContent = 'Alterações pendentes…'; clearTimeout(t); t = setTimeout(salvarJa, 1200); };
      const lista = h('div', { class: 'perguntas' });

      const tempoSel = (valor, aoMudar, padrao) => h('select', { onchange: (e) => aoMudar(+e.target.value) },
        ...(padrao ? [h('option', { value: 0, textContent: 'Tempo do quizz', selected: !valor })] : []),
        ...TEMPOS.map((s) => h('option', { value: s, textContent: `${s} s`, selected: valor === s })));

      function desenhar() {
        lista.replaceChildren(...z.perguntas.map((p, k) => {
          const enun = h('textarea', { rows: 2, maxLength: 200, placeholder: 'Escreva a pergunta', value: p.q, 'aria-label': `Pergunta ${k + 1}`, oninput: () => { p.q = enun.value; salvar(); } });
          const alts = [0, 1, 2, 3].map((i) => {
            const txt = h('input', { type: 'text', maxLength: 80, value: p.op[i], placeholder: `Alternativa ${LET[i]}${i > 1 ? ' (opcional)' : ''}`, 'aria-label': `Alternativa ${LET[i]} da pergunta ${k + 1}`, oninput: () => { p.op[i] = txt.value; salvar(); } });
            const rd = h('input', { type: 'radio', name: 'certa' + k, checked: p.c === i, 'aria-label': `Alternativa ${LET[i]} é a correta`, onchange: () => { p.c = i; salvar(); } });
            return h('div', { class: 'alt a' + i }, h('b', { textContent: LET[i] }), txt, h('label', { class: 'marca' }, rd, h('span', { textContent: 'certa' })));
          });
          const mover = (d) => { const j = k + d; [z.perguntas[k], z.perguntas[j]] = [z.perguntas[j], z.perguntas[k]]; salvar(); desenhar(); };
          return h('div', { class: 'qcard', id: 'q' + k },
            h('div', { class: 'qcab' }, h('strong', { textContent: `Pergunta ${k + 1}` }),
              tempoSel(p.seg, (v) => { p.seg = v; salvar(); }, true),
              h('label', { class: 'fixa', title: 'Mantém as alternativas sempre nesta ordem' }, h('input', { type: 'checkbox', checked: !!p.fixa, onchange: (e) => { p.fixa = e.target.checked; salvar(); } }), '🔒 ordem fixa'),
              h('button', { class: 'sec mini', type: 'button', textContent: '↑', disabled: k === 0, 'aria-label': 'Mover para cima', onclick: () => mover(-1) }),
              h('button', { class: 'sec mini', type: 'button', textContent: '↓', disabled: k === z.perguntas.length - 1, 'aria-label': 'Mover para baixo', onclick: () => mover(1) }),
              h('button', { class: 'sec mini', type: 'button', textContent: 'Duplicar', onclick: () => { if (z.perguntas.length < MAXQ) { z.perguntas.splice(k + 1, 0, JSON.parse(JSON.stringify(p))); salvar(); desenhar(); } } }),
              h('button', { class: 'sec mini perigo', type: 'button', textContent: 'Excluir', onclick: () => { z.perguntas.splice(k, 1); salvar(); desenhar(); } })),
            enun, ...alts);
        }));
        cont.textContent = `${z.perguntas.length} pergunta(s)`;
      }

      const titulo = h('input', { type: 'text', maxLength: 60, value: z.titulo, 'aria-label': 'Título do quizz', oninput: () => { z.titulo = titulo.value; salvar(); } });
      const cont = h('small', { class: 'status' });
      const colar = h('textarea', { rows: 6, placeholder: 'Qual é a capital do Brasil?\nRio de Janeiro\n*Brasília\nSalvador\nSão Paulo\n\n2 + 2 = ?\n3\n*4\n5' });

      el.replaceChildren(
        h('div', { class: 'edtopo' }, titulo, h('label', { class: 'tpadrao' }, 'Tempo padrão ', tempoSel(z.seg, (v) => { z.seg = v || 20; salvar(); }, false)), cont, status),
        lista,
        h('div', { class: 'acoes ordem' },
          h('span', { class: 'vazio', textContent: 'As alternativas mudam de posição a cada jogo. Marque 🔒 para manter a ordem (perguntas com "todas as anteriores" ou "ambas" já ficam fixas sozinhas).' }),
          h('button', { class: 'sec mini', type: 'button', textContent: '🔀 Embaralhar todas', onclick: () => { z.perguntas.forEach((p) => { p.fixa = false; }); salvar(); desenhar(); } }),
          h('button', { class: 'sec mini', type: 'button', textContent: '🔒 Fixar todas', onclick: () => { z.perguntas.forEach((p) => { p.fixa = true; }); salvar(); desenhar(); } })),
        h('div', { class: 'acoes' }, h('button', { class: 'sec', type: 'button', textContent: '+ Adicionar pergunta', onclick: () => {
          if (z.perguntas.length >= MAXQ) { msg.textContent = `Limite de ${MAXQ} perguntas.`; return; }
          z.perguntas.push(vazia()); salvar(); desenhar(); const u = lista.lastElementChild; if (u) u.querySelector('textarea').focus();
        } })),
        h('details', { class: 'trocar' }, h('summary', { textContent: 'Colar várias perguntas em texto' }),
          h('p', { class: 'vazio', textContent: 'Uma pergunta por bloco (separe com uma linha em branco). 1ª linha = pergunta, depois 2 a 4 alternativas. Marque a certa com *' }),
          colar, h('button', { class: 'sec', type: 'button', textContent: 'Adicionar ao quizz', onclick: () => {
            const novas = deTexto(colar.value);
            if (!novas.length) { msg.textContent = 'Nenhuma pergunta válida no texto. Confira o formato.'; return; }
            z.perguntas.push(...novas.slice(0, MAXQ - z.perguntas.length)); colar.value = ''; msg.textContent = `${novas.length} pergunta(s) adicionada(s).`; salvar(); desenhar();
          } })),
        h('div', { class: 'acoes' },
          h('button', { class: 'grande', type: 'button', textContent: 'Jogar', onclick: async () => {
            const pr = problema(z);
            if (pr) { msg.textContent = pr.msg; const c = pr.k >= 0 && document.getElementById('q' + pr.k); if (c) { c.classList.add('invalida'); c.scrollIntoView({ block: 'center' }); setTimeout(() => c.classList.remove('invalida'), 2500); } return; }
            msg.textContent = 'Salvando e verificando licença…';
            if (!(await salvarJa())) { msg.textContent = 'Não foi possível salvar o quizz. Verifique a internet.'; return; }
            const erro = await abrirSala(paraJogo(z), z.seg); msg.textContent = erro || '';
          } }),
          h('button', { class: 'sec', type: 'button', textContent: 'Exportar arquivo', onclick: () => {
            const blob = new Blob([JSON.stringify({ titulo: z.titulo, seg: z.seg, perguntas: z.perguntas }, null, 1)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: (z.titulo || 'quizz').replace(/[^\w-]+/g, '_') + '.json' });
            document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          } }),
          h('button', { class: 'sec', type: 'button', textContent: 'Voltar', onclick: async () => { await salvarJa(); biblioteca(); } })),
        msg);
      desenhar();
      if (novo) salvarJa(); // reserva a vaga já na criação
    }
  }

  window.Editor = { montar, _teste: { normalizar, deTexto, problema, paraJogo } };
})();
