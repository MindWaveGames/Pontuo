// Jogo ao vivo em P2P (PeerJS). O navegador do professor é o host; o PHP não participa da partida.
(() => {
  const h = (tag, p = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e[k] = v;
    }
    e.append(...kids);
    return e;
  };
  const LETRAS = ['A', 'B', 'C', 'D'];
  let peer = null;
  const fechar = () => { try { peer && peer.destroy(); } catch (e) {} peer = null; };
  const tela = (...n) => {
    let o = document.getElementById('jogo');
    if (!o) { o = h('div', { id: 'jogo', class: 'jogo' }); document.body.append(o); }
    o.hidden = false;
    const sair = h('button', { class: 'sair', textContent: 'Sair', onclick: () => { fechar(); o.hidden = true; } });
    o.replaceChildren(sair, h('div', { class: 'jogo-in' }, ...n));
  };
  const opcoes = (ops, onclick, extra = {}) => h('div', { class: 'ops' }, ...ops.map((t, i) =>
    h('button', { class: 'op op' + i + (extra.c === i ? ' certa' : ''), disabled: !onclick, onclick: () => onclick && onclick(i) },
      h('b', { textContent: LETRAS[i] }), h('span', { textContent: t }), extra.n ? h('em', { textContent: extra.n[i] }) : '')));
  const lista = (rk, max = 5) => h('ol', { class: 'rk' }, ...rk.slice(0, max).map((j, n) =>
    h('li', {}, h('span', { textContent: `${n + 1}. ${j.nome}` }), h('b', { textContent: j.pts }))));

  // ---------- Quiz em texto: blocos separados por linha em branco; "*" marca a certa ----------
  function parse(txt) {
    return txt.split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean))
      .filter(l => l.length >= 3).map(l => {
        const [q, ...r] = l, o = r.slice(0, 4), c = o.findIndex(x => x.startsWith('*'));
        return c < 0 ? null : { q: q.slice(0, 200), op: o.map(x => x.replace(/^\*/, '').trim().slice(0, 80)), c };
      }).filter(Boolean);
  }
  const EXEMPLO = 'Qual é a capital do Brasil?\nRio de Janeiro\n*Brasília\nSalvador\nSão Paulo\n\n2 + 2 = ?\n3\n*4\n5\n22';

  function editor(el) {
    let salvo = ''; try { salvo = localStorage.getItem('pontuo_quiz') || ''; } catch (e) {}
    const ta = h('textarea', { rows: 12, placeholder: EXEMPLO, value: salvo });
    const tempo = h('select', {}, ...[10, 20, 30].map(s => h('option', { value: s, textContent: s + ' s por pergunta', selected: s === 20 })));
    const msg = h('p', { class: 'msg' });
    el.replaceChildren(
      h('p', {}, 'Uma pergunta por bloco (separe os blocos com uma linha em branco). Primeira linha = pergunta, depois 2 a 4 alternativas. Marque a certa com *'),
      ta, h('div', { class: 'acoes' }, tempo,
        h('button', { class: 'grande', textContent: 'Abrir sala', onclick: async () => {
          const quiz = parse(ta.value);
          if (!quiz.length) { msg.textContent = 'Nenhuma pergunta válida. Veja o formato de exemplo no campo.'; return; }
          msg.textContent = 'Verificando licença…';
          if (!(await Api.valida())) { msg.textContent = 'Sua sessão expirou. Entre com a chave novamente.'; return; }
          msg.textContent = '';
          try { localStorage.setItem('pontuo_quiz', ta.value); } catch (e) {}
          hospedar(quiz, +tempo.value);
        } })), msg);
  }

  // ---------- Host (professor) ----------
  function hospedar(quiz, seg) {
    const jog = new Map(); // id do peer -> { nome, pts, r, g, c }
    let i = -1, t0 = 0, timer = null, fase = 'lobby', codigo = '';
    const pid = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    const todos = (m) => jog.forEach(j => j.c.open && j.c.send(m));
    const rank = () => [...jog.values()].sort((a, b) => b.pts - a.pts);
    const cod = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

    function abrir() {
      fechar(); codigo = cod(); peer = new Peer('pontuo-' + codigo);
      peer.on('error', (e) => e.type === 'unavailable-id' ? abrir() : tela(h('h2', { textContent: 'Não foi possível abrir a sala.' }), h('p', { textContent: 'Verifique a internet e tente de novo.' })));
      peer.on('open', lobby);
      peer.on('connection', (c) => {
        c.on('data', (m) => {
          if (!m || typeof m !== 'object') return;
          if (m.t === 'entrar') {
            if (fase !== 'lobby') return c.send({ t: 'fechada' });
            jog.set(c.peer, { nome: String(m.nome || '').trim().slice(0, 20) || 'Anônimo', tk: typeof m.tk === 'string' && m.tk.length <= 300 ? m.tk : '', pts: 0, r: null, g: 0, c });
            c.send({ t: 'ok' }); if (fase === 'lobby') lobby();
          } else if (m.t === 'resp' && fase === 'pergunta' && m.i === i) {
            const j = jog.get(c.peer);
            if (j && !j.r && Number.isInteger(m.op) && m.op >= 0 && m.op < quiz[i].op.length) {
              j.r = { op: m.op, ms: Date.now() - t0 }; c.send({ t: 'recebida' }); pergunta();
              if ([...jog.values()].every(x => x.r)) encerrar();
            }
          }
        });
        c.on('close', () => { if (fase === 'lobby') { jog.delete(c.peer); lobby(); } });
      });
    }
    function lobby() {
      if (fase !== 'lobby') return;
      const link = location.origin + location.pathname + '?sala=' + codigo + '#entrar';
      tela(h('p', { textContent: 'Código da sala' }), h('div', { class: 'codigo', textContent: codigo }),
        h('p', { class: 'link', textContent: link }),
        h('p', { textContent: jog.size + ' jogador(es) na sala' }),
        h('div', { class: 'nomes' }, ...[...jog.values()].map(j => h('span', { textContent: j.nome }))),
        h('button', { class: 'grande', textContent: 'Iniciar', disabled: !jog.size, onclick: proxima }));
    }
    function proxima() { i++; if (i >= quiz.length) return fim(); fase = 'pergunta'; jog.forEach(j => { j.r = null; j.g = 0; }); t0 = Date.now();
      const p = quiz[i]; todos({ t: 'pergunta', i, total: quiz.length, q: p.q, op: p.op, seg });
      clearTimeout(timer); timer = setTimeout(encerrar, seg * 1000); pergunta(); }
    function pergunta() {
      if (fase !== 'pergunta') return;
      const p = quiz[i], n = [...jog.values()].filter(j => j.r).length;
      tela(h('small', { textContent: `Pergunta ${i + 1} de ${quiz.length}` }), h('h2', { textContent: p.q }),
        h('div', { class: 'barra' }, h('i', { style: `animation-duration:${seg}s` })),
        opcoes(p.op), h('p', { textContent: `${n} de ${jog.size} responderam` }),
        h('button', { class: 'sec', textContent: 'Encerrar agora', onclick: encerrar }));
    }
    function encerrar() {
      if (fase !== 'pergunta') return; clearTimeout(timer); fase = 'resultado';
      const p = quiz[i], n = p.op.map(() => 0);
      jog.forEach(j => { if (j.r) { n[j.r.op]++; if (j.r.op === p.c) { j.g = Math.round(1000 * (1 - .5 * Math.min(j.r.ms, seg * 1000) / (seg * 1000))); j.pts += j.g; } } });
      const rk = rank();
      jog.forEach(j => j.c.open && j.c.send({ t: 'resultado', c: p.c, ok: !!j.r && j.r.op === p.c, g: j.g, pts: j.pts, pos: rk.indexOf(j) + 1, de: rk.length }));
      tela(h('h2', { textContent: p.q }), opcoes(p.op, null, { c: p.c, n }), h('h3', { textContent: 'Ranking' }), lista(rk),
        h('button', { class: 'grande', textContent: i + 1 < quiz.length ? 'Próxima' : 'Ver resultado final', onclick: proxima }));
    }
    function fim() {
      fase = 'fim'; const rk = rank(), top = rk.slice(0, 5).map(j => ({ nome: j.nome, pts: j.pts }));
      jog.forEach(j => j.c.open && j.c.send({ t: 'fim', top, pts: j.pts, pos: rk.indexOf(j) + 1, de: rk.length }));
      const jogadores = rk.map((j, n) => ({ tk: j.tk, pontos: j.pts, pos: n + 1 })).filter((j) => j.tk);
      const estado = h('p', { class: 'msg', role: 'status' });
      const tentar = h('button', { class: 'sec', textContent: 'Tentar salvar de novo', hidden: true, onclick: () => salvar() });
      async function salvar() {
        if (!jogadores.length) { estado.textContent = 'Nenhum aluno com conta nesta partida.'; return; }
        estado.textContent = 'Salvando a pontuação dos alunos com conta…'; tentar.hidden = true;
        try {
          const d = await Api.partida({ pid, sala: codigo, perguntas: quiz.length, total: rk.length, jogadores });
          estado.textContent = d.ja_registrada ? 'Pontuação já estava salva. ✓' : `Pontuação salva para ${d.creditados} aluno(s) com conta. ✓`;
        } catch (e) { estado.textContent = 'Não foi possível salvar a pontuação (internet ou sessão expirada).'; tentar.hidden = false; }
      }
      tela(h('h2', { textContent: 'Resultado final' }), lista(rk, 10), estado, tentar,
        h('button', { class: 'grande', textContent: 'Fechar', onclick: () => { fechar(); document.getElementById('jogo').hidden = true; } }));
      salvar();
    }
    abrir();
  }

  // ---------- Jogador (aluno) ----------
  function entrar(codigo, nome, ficha) {
    codigo = (codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!codigo) return;
    fechar(); tela(h('h2', { textContent: 'Conectando…' }));
    let ok = false, conn;
    const falha = (t) => tela(h('h2', { textContent: t || 'Não foi possível entrar na sala.' }), h('p', { textContent: 'Confira o código e a internet e tente de novo.' }));
    peer = new Peer();
    peer.on('error', () => !ok && falha());
    peer.on('open', () => {
      conn = peer.connect('pontuo-' + codigo, { reliable: true });
      conn.on('open', () => conn.send({ t: 'entrar', nome, tk: ficha || undefined }));
      conn.on('close', () => tela(h('h2', { textContent: 'A sala foi encerrada.' })));
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'ok') { ok = true; tela(h('h2', { textContent: 'Você entrou!' }), h('p', { textContent: 'Aguarde o professor iniciar.' })); }
        else if (m.t === 'fechada') falha('Esta sala já começou.');
        else if (m.t === 'pergunta') {
          tela(h('small', { textContent: `Pergunta ${m.i + 1} de ${m.total}` }), h('h2', { textContent: m.q }),
            h('div', { class: 'barra' }, h('i', { style: `animation-duration:${m.seg}s` })),
            opcoes(m.op, (op) => { conn.send({ t: 'resp', i: m.i, op }); tela(h('h2', { textContent: 'Resposta enviada!' }), h('p', { textContent: 'Aguarde o resultado.' })); }));
        } else if (m.t === 'resultado') {
          tela(h('h2', { class: m.ok ? 'acerto' : 'erro', textContent: m.ok ? 'Acertou! 🎉' : 'Errou…' }), h('p', { textContent: `+${m.g} pontos · total ${m.pts}` }),
            h('p', { textContent: `Você está em ${m.pos}º de ${m.de}` }));
        } else if (m.t === 'fim') {
          [4000, 12000].forEach((ms) => setTimeout(() => window.dispatchEvent(new Event('pontuo:atualizar')), ms));
          tela(h('h2', { textContent: `Você terminou em ${m.pos}º lugar!` }), h('p', { textContent: `${m.pts} pontos` }), h('h3', { textContent: 'Top 5' }), lista(m.top));
        }
      });
    });
    setTimeout(() => { if (!ok && peer) falha(); }, 10000);
  }

  window.Jogo = { editor, entrar };
})();
