// Relatório da sala: tela, CSV (planilha) e histórico das salas do professor.
// Na tela do fim do jogo o relatório tem os nomes que o professor viu (só no navegador dele). O que vai para o servidor
// é apenas o resumo por pergunta, SEM nomes nem respostas individuais.
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
  const LET = ['A', 'B', 'C', 'D'];
  const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : 0);
  const seg1 = (ms) => (ms / 1000).toFixed(1).replace('.', ',');
  const data = (s) => new Date(s * 1000).toLocaleDateString('pt-BR');

  // Faz as contas do relatório (vale para o do jogo e para o que vem do histórico).
  // rel: { titulo, sala, quando, participantes, perguntas: [{ q, op[4], c, n[4], sem, ms }], jogadores?: [...] }
  function completar(rel) {
    const ps = rel.perguntas.map((p) => {
      const respondidas = p.n.reduce((a, b) => a + b, 0), acertos = p.n[p.c] || 0;
      return { ...p, respondidas, acertos, erros: respondidas - acertos, pAcerto: pct(acertos, rel.participantes) };
    });
    const total = rel.participantes * ps.length;
    const acertos = ps.reduce((a, p) => a + p.acertos, 0), resp = ps.reduce((a, p) => a + p.respondidas, 0);
    const msTotal = ps.reduce((a, p) => a + p.ms * p.respondidas, 0);
    let dificil = -1, facil = -1;
    if (ps.length >= 2) { // só destaca quando há diferença que valha a pena (10 pontos ou mais)
      const min = Math.min(...ps.map((p) => p.pAcerto)), max = Math.max(...ps.map((p) => p.pAcerto));
      if (max - min >= 10) { dificil = ps.findIndex((p) => p.pAcerto === min); facil = ps.findIndex((p) => p.pAcerto === max); }
    }
    return { ...rel, perguntas: ps, dificil, facil, resumo: { acerto: pct(acertos, total), participacao: pct(resp, total), ms: resp ? msTotal / resp : 0 } };
  }

  const cartao = (valor, rotulo) => h('div', { class: 'rcard' }, h('b', { textContent: valor }), h('span', { textContent: rotulo }));

  function pergunta(p, k, rel) {
    const selos = [];
    if (k === rel.dificil) selos.push(h('span', { class: 'selo ruim', textContent: 'Mais difícil' }));
    if (k === rel.facil) selos.push(h('span', { class: 'selo bom', textContent: 'Mais fácil' }));
    if (p.pAcerto < 50) selos.push(h('span', { class: 'selo atencao', textContent: 'Revisar o conteúdo' }));
    // alternativa errada mais marcada (só vale destacar se foi escolhida por boa parte da turma)
    let erradaMax = -1;
    p.n.forEach((n, i) => { if (i !== p.c && p.op[i] && n > 0 && (erradaMax < 0 || n > p.n[erradaMax])) erradaMax = i; });
    // só vale destacar se pelo menos 2 alunos marcaram e foi 25% ou mais da turma (1 aluno só não é padrão de erro)
    if (erradaMax >= 0 && (p.n[erradaMax] < 2 || pct(p.n[erradaMax], rel.participantes) < 25)) erradaMax = -1;
    const linhas = p.op.map((t, i) => (!t ? null : h('div', { class: 'ropc' + (i === p.c ? ' certa' : i === erradaMax ? ' errada' : '') },
      h('span', { class: 'rl', textContent: `${LET[i]}) ${t}` }),
      h('span', { class: 'rbarra', 'aria-hidden': 'true' }, h('i', { style: `width:${pct(p.n[i], rel.participantes)}%` })),
      h('span', { class: 'rn', textContent: `${p.n[i]} (${pct(p.n[i], rel.participantes)}%)` }),
      i === p.c ? h('span', { class: 'rtag', textContent: '✓ certa' }) : i === erradaMax ? h('span', { class: 'rtag', textContent: 'mais marcada entre as erradas' }) : ''))).filter(Boolean);
    return h('article', { class: 'rperg' },
      h('div', { class: 'rcab' }, h('strong', { textContent: `${k + 1}. ${p.q || '(sem texto)'}` }), ...selos),
      h('p', { class: 'rmeta', textContent: `${p.acertos} de ${rel.participantes} acertaram (${p.pAcerto}%) · ${p.sem} sem resposta · tempo médio ${p.respondidas ? seg1(p.ms) + ' s' : '—'}` }),
      ...linhas);
  }

  function tabelaAlunos(rel) {
    const N = rel.perguntas.length;
    const linhas = rel.jogadores.map((j) => {
      const pa = pct(j.acertos, N), atencao = pa < 50;
      return h('tr', { class: atencao ? 'atencao' : '' },
        h('td', {}, h('span', { class: 'nm' }, window.Avatar ? Avatar.el(j.av, 28) : '', h('span', { textContent: j.nome }))),
        h('td', { textContent: j.pontos }), h('td', { textContent: `${j.acertos}/${N}` }), h('td', { textContent: `${pa}%` }),
        h('td', { textContent: j.respondidas ? seg1(j.ms) + ' s' : '—' }),
        h('td', {}, atencao ? h('span', { class: 'selo atencao', textContent: 'Atenção' }) : ''));
    });
    return h('div', { class: 'rolar' }, h('table', { class: 'rtab' },
      h('caption', { textContent: 'Por aluno (nomes como apareceram na sala)' }),
      h('thead', {}, h('tr', {}, ...['Aluno', 'Pontos', 'Acertos', '%', 'Tempo médio', ''].map((t) => h('th', { scope: 'col', textContent: t })))),
      h('tbody', {}, ...linhas)));
  }

  // Monta a tela do relatório. opc.nota: texto de rodapé.
  function criar(rel0, opc = {}) {
    const rel = completar(rel0), r = rel.resumo;
    return h('section', { class: 'relatorio' },
      h('h3', { textContent: rel.titulo || 'Relatório da sala' }),
      h('p', { class: 'rmeta', textContent: `Sala ${rel.sala || ''} · ${rel.quando ? data(rel.quando) : ''}`.replace(/ · $/, '') }),
      h('div', { class: 'rcards' }, cartao(rel.participantes, 'participantes'), cartao(r.acerto + '%', 'de acertos da turma'),
        cartao(r.ms ? seg1(r.ms) + ' s' : '—', 'tempo médio por resposta'), cartao(r.participacao + '%', 'responderam')),
      h('h4', { textContent: 'Pergunta por pergunta' }), ...rel.perguntas.map((p, k) => pergunta(p, k, rel)),
      ...(rel.jogadores && rel.jogadores.length ? [h('h4', { textContent: 'Alunos' }), tabelaAlunos(rel)] : []),
      ...(opc.nota ? [h('p', { class: 'rmeta', textContent: opc.nota })] : []));
  }

  // ---------- CSV (abre direto no Excel/Planilhas; separador ";" e vírgula decimal, como no Brasil) ----------
  const celula = (v) => {
    let t = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // evita que um nome vire fórmula na planilha
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const linha = (cols) => cols.map(celula).join(';');
  const RES = { c: 'Certa', e: 'Errada', s: 'Sem resposta' };

  function csvAlunos(rel0) {
    const rel = completar(rel0), N = rel.perguntas.length;
    const cab = ['Aluno', 'Pontos', 'Acertos', 'Respondidas', 'Perguntas', '% de acerto', 'Tempo médio (s)', ...rel.perguntas.map((_, k) => `P${k + 1}`)];
    return [linha(cab), ...(rel.jogadores || []).map((j) => linha([j.nome, j.pontos, j.acertos, j.respondidas, N, pct(j.acertos, N),
      j.respondidas ? seg1(j.ms) : '', ...j.res.map((x) => RES[x] || '')]))].join('\r\n');
  }
  function csvPerguntas(rel0) {
    const rel = completar(rel0);
    const cab = ['Nº', 'Pergunta', 'Resposta certa', 'Participantes', 'Acertos', 'Erros', 'Sem resposta', '% de acerto', 'Tempo médio (s)',
      ...LET.flatMap((l) => [`Alternativa ${l}`, `Marcaram ${l}`])];
    return [linha(cab), ...rel.perguntas.map((p, k) => linha([k + 1, p.q, p.op[p.c], rel.participantes, p.acertos, p.erros, p.sem, p.pAcerto,
      p.respondidas ? seg1(p.ms) : '', ...[0, 1, 2, 3].flatMap((i) => [p.op[i] || '', p.op[i] ? p.n[i] : ''])]))].join('\r\n');
  }
  const slug = (t) => (String(t || 'quizz').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'quizz');
  function baixarCsv(nome, texto) { // BOM: o Excel reconhece acentos em UTF-8
    const a = h('a', { href: URL.createObjectURL(new Blob(['\uFEFF' + texto], { type: 'text/csv;charset=utf-8' })), download: nome });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function botoesCsv(rel) {
    const base = `${slug(rel.titulo)}-${rel.sala || 'sala'}`;
    return h('div', { class: 'acoes' },
      ...(rel.jogadores && rel.jogadores.length ? [h('button', { class: 'sec', type: 'button', textContent: '⬇️ Planilha dos alunos (CSV)', onclick: () => baixarCsv(`${base}-alunos.csv`, csvAlunos(rel)) })] : []),
      h('button', { class: 'sec', type: 'button', textContent: '⬇️ Planilha das perguntas (CSV)', onclick: () => baixarCsv(`${base}-perguntas.csv`, csvPerguntas(rel)) }));
  }

  // ---------- Histórico das salas (guardado na conta do professor) ----------
  async function historico(el) {
    el.replaceChildren(h('p', { class: 'vazio', textContent: 'Carregando relatórios…' }));
    let dados;
    try { dados = await Api.professor.relatorios('listar'); }
    catch (e) { el.replaceChildren(h('p', { class: 'msg', textContent: 'Não foi possível carregar os relatórios. Verifique a internet.' }), h('button', { class: 'sec', type: 'button', textContent: 'Tentar de novo', onclick: () => historico(el) })); return; }
    const lista = dados.relatorios || [];
    if (!lista.length) { el.replaceChildren(h('p', { class: 'vazio', textContent: 'Nenhum relatório ainda. Ao fim de cada sala o resumo é guardado aqui automaticamente.' })); return; }

    const sel = h('select', { 'aria-label': 'Filtrar por quizz' }, h('option', { value: '', textContent: 'Todos os quizzes' }),
      ...[...new Set(lista.map((r) => r.titulo || ''))].map((t) => h('option', { value: t, textContent: t || '(sem título)' })));
    const evo = h('div'), itens = h('div', { class: 'rlista' });
    const desenhar = () => {
      const mostrar = sel.value === '' ? lista : lista.filter((r) => (r.titulo || '') === sel.value);
      itens.replaceChildren(...mostrar.map((r) => h('button', { type: 'button', class: 'ritem', onclick: () => abrir(r.id) },
        h('span', { class: 'rdata', textContent: data(r.quando) }), h('strong', { textContent: r.titulo || '(sem título)' }),
        h('span', { class: 'rmeta', textContent: `Sala ${r.sala} · ${r.participantes} participante(s) · ${r.perguntas} pergunta(s)` }),
        h('span', { class: 'selo ' + (r.acerto === null ? '' : r.acerto >= 70 ? 'bom' : r.acerto >= 50 ? '' : 'atencao'), textContent: r.acerto === null ? '—' : r.acerto + '% de acertos' }))));
      const serie = mostrar.filter((r) => r.acerto !== null).slice(0, 12).reverse();
      evo.replaceChildren(sel.value !== '' && serie.length >= 2 ? h('div', { class: 'revo' }, h('h4', { textContent: 'Evolução do acerto neste quizz' }),
        h('div', { class: 'rgraf', role: 'img', 'aria-label': 'Acerto por sala: ' + serie.map((r) => `${data(r.quando)} ${r.acerto}%`).join(', ') },
          ...serie.map((r) => h('div', { class: 'rbar' }, h('small', { textContent: r.acerto + '%' }), h('i', { style: `height:${Math.max(4, r.acerto)}px` }), h('small', { textContent: data(r.quando).slice(0, 5) }))))) : '');
    };
    sel.addEventListener('change', desenhar);
    el.replaceChildren(h('p', { class: 'vazio', textContent: `Resumos das suas salas (sem nomes de alunos), guardados por ${dados.dias || 365} dias.` }), sel, evo, itens);
    desenhar();

    async function abrir(id) {
      el.replaceChildren(h('p', { class: 'vazio', textContent: 'Abrindo…' }));
      try {
        const rel = (await Api.professor.relatorios('ver', { id })).relatorio;
        el.replaceChildren(h('button', { class: 'sec', type: 'button', textContent: '← Voltar à lista', onclick: () => historico(el) }),
          criar(rel, { nota: 'Resumo guardado no servidor: não inclui nomes nem respostas individuais.' }), botoesCsv(rel),
          h('button', { class: 'sec perigo', type: 'button', textContent: '🗑️ Excluir este relatório', onclick: async () => {
            if (!confirm('Excluir este relatório? Os pontos da sala continuam valendo.')) return;
            try { await Api.professor.relatorios('excluir', { id }); historico(el); } catch (e) { alert('Não foi possível excluir agora.'); }
          } }));
      } catch (e) { el.replaceChildren(h('p', { class: 'msg', textContent: 'Não foi possível abrir este relatório.' }), h('button', { class: 'sec', type: 'button', textContent: '← Voltar', onclick: () => historico(el) })); }
    }
  }

  window.Relatorio = { criar, completar, csvAlunos, csvPerguntas, botoesCsv, baixarCsv, historico, _teste: { celula, slug } };
})();
