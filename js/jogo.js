// Jogo ao vivo em P2P (PeerJS). O navegador do professor é o host; o PHP só registra a partida (abertura e fim).
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
  const LETRAS = ['A', 'B', 'C', 'D'];
  const av = (id, t = 28) => (window.Avatar ? Avatar.el(id, t) : h('span'));
  const som = (n, ...a) => { if (window.Som) Som.tocar(n, ...a); };

  // ---------- Rede (PeerJS) ----------
  const limpezas = [];
  let peer = null, msgRede = '';
  const ice = () => [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    ...((window.PONTUO && PONTUO.ICE_EXTRA) || []),
  ];
  const novoPeer = (id) => new Peer(id, { config: { iceServers: ice(), sdpSemantics: 'unified-plan' } });
  const rede = (m) => { msgRede = m; const e = document.querySelector('#jogo .rede'); if (e) { e.textContent = m; e.hidden = !m; } };
  const fechar = () => {
    limpezas.splice(0).forEach((f) => { try { f(); } catch (e) {} });
    try { peer && peer.destroy(); } catch (e) {}
    peer = null; rede('');
  };

  // ---------- Telas ----------
  const tela = (...n) => {
    let o = document.getElementById('jogo');
    if (!o) { o = h('div', { id: 'jogo', class: 'jogo' }); document.body.append(o); }
    o.hidden = false;
    o.replaceChildren(
      h('button', { class: 'sair', textContent: 'Sair', onclick: () => { fechar(); o.hidden = true; } }),
      ...(window.Som ? [Som.botao()] : []),
      h('div', { class: 'rede', role: 'status', hidden: !msgRede, textContent: msgRede }),
      h('div', { class: 'jogo-in' }, ...n));
  };
  const opcoes = (ops, onclick, extra = {}) => h('div', { class: 'ops' }, ...ops.map((t, i) =>
    h('button', { class: 'op op' + i + (extra.c === i ? ' certa' : ''), disabled: !onclick, onclick: () => onclick && onclick(i) },
      h('b', { textContent: LETRAS[i] }), h('span', { textContent: t }), extra.n ? h('em', { textContent: extra.n[i] }) : '')));
  const lista = (rk, max = 5) => h('ol', { class: 'rk' }, ...rk.slice(0, max).map((j) =>
    h('li', {}, h('span', { class: 'nm' }, av(j.av, 30), h('span', { textContent: j.nome })), h('b', { textContent: j.pts }))));

  // ---------- QR code (biblioteca local js/vendor/qrcode.js) ----------
  function qrSvg(texto) {
    const indisponivel = h('p', { class: 'vazio', textContent: 'QR code indisponível agora: passe o código ou o link aos alunos.' });
    if (typeof qrcode !== 'function') { console.warn('QR: biblioteca js/vendor/qrcode.js não carregou'); return indisponivel; }
    try { return desenharQr(texto); } catch (e) { console.warn('QR:', e); return indisponivel; }
  }
  function desenharQr(texto) {
    const q = qrcode(0, 'M'); q.addData(texto); q.make();
    const n = q.getModuleCount(), m = 4, tam = n + 2 * m, ns = 'http://www.w3.org/2000/svg';
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    const svg = document.createElementNS(ns, 'svg'), fundo = document.createElementNS(ns, 'rect'), cod = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', `0 0 ${tam} ${tam}`); svg.setAttribute('class', 'qr'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'QR code para entrar na sala'); svg.setAttribute('shape-rendering', 'crispEdges');
    fundo.setAttribute('width', tam); fundo.setAttribute('height', tam); fundo.setAttribute('fill', '#fff');
    cod.setAttribute('d', d); cod.setAttribute('fill', '#17134e');
    svg.append(fundo, cod);
    return svg;
  }

  // Confere a licença no servidor e abre a sala. Devolve um texto de erro, ou null se abriu.
  async function abrirSala(quiz, seg) {
    if (!(await Api.valida())) return 'Sua sessão expirou. Entre com a chave novamente.';
    hospedar(quiz, seg);
    return null;
  }

  // ---------- Host (professor) ----------
  function hospedar(quiz, segPadrao) {
    let seg = segPadrao; // tempo da pergunta atual (cada pergunta pode ter o seu)
    const jog = new Map(); // jid -> { nome, av, tk, pts, r, g, res, fim, c }
    const banidos = new Set(); // jid de quem foi removido pelo professor: não entra de novo
    let i = -1, t0 = 0, timer = null, fase = 'lobby', codigo = '', aberta = false, registrouAbertura = false;
    const pid = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    const cod = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const on = (j) => !!(j.c && j.c.open);
    const enviar = (j, m) => { try { if (on(j)) j.c.send(m); } catch (e) { console.warn('envio falhou', e); } };
    const todos = (m) => jog.forEach((j) => enviar(j, m));
    const rank = () => [...jog.values()].sort((a, b) => b.pts - a.pts);
    const todosResponderam = () => { const v = [...jog.values()].filter(on); return v.length > 0 && v.every((x) => x.r); };
    limpezas.push(() => clearTimeout(timer));

    // Estado atual para quem (re)entra: o aluno que caiu volta exatamente para onde estava.
    const estado = (j) => {
      if (fase === 'pergunta') {
        if (j.r) return { t: 'recebida' };
        const p = quiz[i];
        return { t: 'pergunta', i, total: quiz.length, q: p.q, op: p.op, seg: Math.max(1, Math.round(seg - (Date.now() - t0) / 1000)) };
      }
      if (fase === 'resultado') return j.res || { t: 'ok' };
      if (fase === 'fim') return j.fim || { t: 'ok' };
      return { t: 'ok' };
    };
    const redesenhar = () => { if (fase === 'lobby') lobby(); else if (fase === 'pergunta') pergunta(); };

    function entrou(c, m) {
      const jid = typeof m.jid === 'string' && /^[a-z0-9]{8,16}$/.test(m.jid) ? m.jid : null;
      if (!jid) return;
      if (banidos.has(jid)) { try { c.send({ t: 'removido' }); } catch (e) {} return; }
      let j = jog.get(jid);
      if (j) { // reconexão do mesmo aluno
        if (j.c && j.c !== c) { try { j.c.close(); } catch (e) {} }
        j.c = c; c._jid = jid; enviar(j, estado(j)); redesenhar(); return;
      }
      if (fase !== 'lobby') { try { c.send({ t: 'fechada' }); } catch (e) {} return; }
      j = {
        // Nomes impróprios (de alunos anônimos) viram "Jogador N" antes de aparecer no telão.
        nome: window.Moderacao ? Moderacao.limpar(m.nome, jog.size + 1) : String(m.nome || '').trim().slice(0, 20) || 'Anônimo',
        av: window.Avatar && Avatar.valido(m.av) ? m.av : '',
        tk: typeof m.tk === 'string' && m.tk.length <= 300 ? m.tk : '',
        pts: 0, r: null, g: 0, c,
      };
      jog.set(jid, j); c._jid = jid; enviar(j, { t: 'ok' }); lobby();
    }

    function abrir() {
      fechar(); limpezas.push(() => clearTimeout(timer));
      codigo = cod(); aberta = false;
      const meu = peer = novoPeer('pontuo-' + codigo);
      meu.on('open', () => { aberta = true; rede(''); lobby(); registrarAbertura(); });
      // O servidor de sinalização pode derrubar o host: sem reconectar, ninguém mais consegue entrar.
      meu.on('disconnected', () => {
        rede('Reconectando ao servidor da sala…');
        (function tentar() {
          if (peer !== meu || meu.destroyed) return;
          if (!meu.disconnected) { rede(''); return; }
          try { meu.reconnect(); } catch (e) {}
          setTimeout(tentar, 3000);
        })();
      });
      meu.on('error', (e) => {
        if (peer !== meu) return;
        if (e.type === 'unavailable-id' && !aberta) return abrir();
        if (!aberta) return tela(h('h2', { textContent: 'Não foi possível abrir a sala.' }), h('p', { textContent: 'Verifique a internet e tente de novo.' }));
        // Depois de aberta, a falha de UM aluno (webrtc, peer-unavailable...) NÃO pode derrubar a sala.
        if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) rede('Conexão instável. Tentando recuperar…');
        else console.warn('PeerJS:', e.type, e.message || e);
      });
      meu.on('connection', (c) => {
        c.on('error', (e) => console.warn('conexão de aluno:', e));
        c.on('data', (m) => {
          if (!m || typeof m !== 'object') return;
          if (m.t === 'ping') { try { c.send({ t: 'pong' }); } catch (e) {} return; }
          if (m.t === 'entrar') return entrou(c, m);
          const j = jog.get(c._jid);
          if (!j || j.c !== c) return;
          if (m.t === 'resp' && fase === 'pergunta' && m.i === i && !j.r && Number.isInteger(m.op) && m.op >= 0 && m.op < quiz[i].op.length) {
            j.r = { op: m.op, ms: Date.now() - t0 }; enviar(j, { t: 'recebida' }); pergunta();
            if (todosResponderam()) encerrar();
          }
        });
        c.on('close', () => {
          const j = jog.get(c._jid);
          if (!j || j.c !== c) return; // já foi substituída por uma reconexão
          if (fase === 'lobby') setTimeout(() => { if (jog.get(c._jid) === j && j.c === c && fase === 'lobby') { jog.delete(c._jid); lobby(); } }, 20000);
          redesenhar();
          if (fase === 'pergunta' && todosResponderam()) encerrar();
        });
      });
      const vis = () => { if (!document.hidden && meu.disconnected && !meu.destroyed) { try { meu.reconnect(); } catch (e) {} } };
      document.addEventListener('visibilitychange', vis); limpezas.push(() => document.removeEventListener('visibilitychange', vis));
    }

    // A abertura vale pontos para o professor; se a internet falhar, o fim da partida registra tudo de uma vez.
    async function registrarAbertura() {
      if (registrouAbertura) return;
      try { await Api.abrirPartida({ pid, sala: codigo, perguntas: quiz.length }); registrouAbertura = true; } catch (e) { console.warn('abertura não registrada', e); }
    }

    function lobby() {
      if (fase !== 'lobby' || !aberta) return;
      const link = location.origin + location.pathname + '?sala=' + codigo + '#entrar';
      const js = [...jog.values()];
      tela(h('p', { textContent: 'Código da sala' }), h('div', { class: 'codigo', textContent: codigo }), qrSvg(link),
        h('p', { class: 'link', textContent: link }),
        h('p', { textContent: js.length + ' jogador(es) na sala' }),
        h('div', { class: 'nomes' }, ...[...jog.entries()].map(([jid, j]) => h('span', { class: 'chip' + (on(j) ? '' : ' off'), title: on(j) ? '' : 'Reconectando…' }, av(j.av, 24), h('span', { textContent: j.nome }),
          h('button', { type: 'button', class: 'xis', textContent: '✕', title: `Remover ${j.nome}`, 'aria-label': `Remover ${j.nome} da sala`, onclick: () => remover(jid) })))),
        h('button', { class: 'grande', textContent: 'Iniciar', disabled: !js.length, onclick: proxima }));
    }
    function remover(jid) {
      const j = jog.get(jid); if (!j) return;
      banidos.add(jid); enviar(j, { t: 'removido' });
      setTimeout(() => { try { j.c && j.c.close(); } catch (e) {} }, 200);
      jog.delete(jid); lobby();
    }
    function proxima() {
      i++; if (i >= quiz.length) return fim();
      seg = quiz[i].seg || segPadrao; fase = 'pergunta'; jog.forEach((j) => { j.r = null; j.g = 0; j.res = null; }); t0 = Date.now();
      registrarAbertura(); som('inicio');
      const p = quiz[i]; todos({ t: 'pergunta', i, total: quiz.length, q: p.q, op: p.op, seg });
      clearTimeout(timer); timer = setTimeout(encerrar, seg * 1000); pergunta();
    }
    function pergunta() {
      if (fase !== 'pergunta') return;
      const p = quiz[i], n = [...jog.values()].filter((j) => j.r).length;
      tela(h('small', { textContent: `Pergunta ${i + 1} de ${quiz.length}` }), h('h2', { textContent: p.q }),
        h('div', { class: 'barra' }, h('i', { style: `animation-duration:${seg}s` })),
        opcoes(p.op), h('p', { textContent: `${n} de ${jog.size} responderam` }),
        h('button', { class: 'sec', textContent: 'Encerrar agora', onclick: encerrar }));
    }
    function encerrar() {
      if (fase !== 'pergunta') return; clearTimeout(timer); fase = 'resultado';
      const p = quiz[i], n = p.op.map(() => 0);
      jog.forEach((j) => { if (j.r) { n[j.r.op]++; if (j.r.op === p.c) { j.g = Math.round(1000 * (1 - .5 * Math.min(j.r.ms, seg * 1000) / (seg * 1000))); j.pts += j.g; } } });
      const rk = rank();
      jog.forEach((j) => { j.res = { t: 'resultado', c: p.c, ok: !!j.r && j.r.op === p.c, g: j.g, pts: j.pts, pos: rk.indexOf(j) + 1, de: rk.length }; enviar(j, j.res); });
      tela(h('h2', { textContent: p.q }), opcoes(p.op, null, { c: p.c, n }), h('h3', { textContent: 'Ranking' }), lista(rk),
        h('button', { class: 'grande', textContent: i + 1 < quiz.length ? 'Próxima' : 'Ver resultado final', onclick: proxima }));
    }
    function fim() {
      fase = 'fim'; const rk = rank(), top = rk.slice(0, 10).map((j) => ({ nome: j.nome, pts: j.pts, av: j.av }));
      rk.forEach((j, n) => { j.fim = { t: 'fim', top, pts: j.pts, pos: n + 1, de: rk.length }; enviar(j, j.fim); });
      const jogadores = rk.map((j, n) => ({ tk: j.tk, pontos: j.pts, pos: n + 1 })).filter((j) => j.tk);
      const estadoReg = h('p', { class: 'msg', role: 'status' });
      const tentar = h('button', { class: 'sec', textContent: 'Tentar registrar de novo', hidden: true, onclick: () => salvar() });
      async function salvar() {
        estadoReg.textContent = 'Registrando a partida…'; tentar.hidden = true;
        try {
          const d = await Api.partida({ pid, sala: codigo, perguntas: quiz.length, total: rk.length, jogadores });
          estadoReg.textContent = d.ja_registrada ? 'Partida já estava registrada. ✓'
            : `Partida registrada! Você ganhou ${d.pontos_professor} pontos${d.creditados ? ` e ${d.creditados} aluno(s) com conta pontuaram` : ''}. ✓`;
          window.dispatchEvent(new Event('pontuo:atualizar'));
        } catch (e) { estadoReg.textContent = 'Não foi possível registrar a partida (internet ou sessão expirada).'; tentar.hidden = false; }
      }
      const todos = rk.map((j) => ({ nome: j.nome, pontos: j.pts, avatar: j.av }));
      tela(h('h2', { textContent: 'Resultado final' }),
        ...(window.Podio ? [Podio.criar(todos.slice(0, 3), { animar: true }), Podio.lista(todos.slice(3), { inicio: 3, animar: true, atraso: 4200 })] : [lista(rk, 10)]),
        estadoReg, tentar,
        h('button', { class: 'grande', textContent: 'Fechar', onclick: () => { fechar(); document.getElementById('jogo').hidden = true; } }));
      salvar();
    }
    abrir();
  }

  // ---------- Jogador (aluno) ----------
  function entrar(codigo, nome, ficha, avatar) {
    codigo = (codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!codigo) return;
    fechar(); tela(h('h2', { textContent: 'Conectando…' }));
    // Identidade estável na sala: se a conexão cair, o professor reconhece o mesmo aluno ao voltar.
    const jid = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('');
    let conn = null, ok = false, fim = false, ultima = Date.now(), tentativas = 0, esperando = false;

    const falha = (t, p) => {
      fim = true;
      tela(h('h2', { textContent: t || 'Não foi possível entrar na sala.' }), h('p', { textContent: p || 'Confira o código e a internet e tente de novo.' }));
    };
    const receber = (m) => {
      if (!m || typeof m !== 'object' || m.t === 'pong') return;
      if (m.t === 'fechada') return falha('Esta sala já começou.');
      if (m.t === 'removido') return falha('Você foi removido da sala.', 'Fale com o seu professor.');
      ok = true;
      if (m.t === 'ok') tela(h('h2', { textContent: 'Você entrou!' }), h('p', { textContent: 'Aguarde o professor iniciar.' }));
      else if (m.t === 'recebida') tela(h('h2', { textContent: 'Resposta enviada!' }), h('p', { textContent: 'Aguarde o resultado.' }));
      else if (m.t === 'pergunta') {
        som('inicio');
        tela(h('small', { textContent: `Pergunta ${m.i + 1} de ${m.total}` }), h('h2', { textContent: m.q }),
          h('div', { class: 'barra' }, h('i', { style: `animation-duration:${m.seg}s` })),
          opcoes(m.op, (op) => {
            try { conn.send({ t: 'resp', i: m.i, op }); } catch (e) {}
            tela(h('h2', { textContent: 'Resposta enviada!' }), h('p', { textContent: 'Aguarde o resultado.' }));
          }));
      } else if (m.t === 'resultado') {
        som(m.ok ? 'acerto' : 'erro');
        tela(h('h2', { class: m.ok ? 'acerto' : 'erro', textContent: m.ok ? 'Acertou! 🎉' : 'Errou…' }), h('p', { textContent: `+${m.g} pontos · total ${m.pts}` }),
          h('p', { textContent: `Você está em ${m.pos}º de ${m.de}` }));
      } else if (m.t === 'fim') {
        fim = true; som(m.pos === 1 ? 'vitoria' : 'estrela');
        [4000, 12000].forEach((ms) => setTimeout(() => window.dispatchEvent(new Event('pontuo:atualizar')), ms));
        const top = (m.top || []).map((x) => ({ nome: x.nome, pontos: x.pts, avatar: x.av }));
        tela(h('h2', { textContent: `Você terminou em ${m.pos}º lugar!` }), h('p', { textContent: `${m.pts} pontos` }),
          ...(window.Podio ? [Podio.criar(top.slice(0, 3), { animar: true }), Podio.lista(top.slice(3), { inicio: 3, animar: true, atraso: 4200, destaque: m.pos - 1 }),
            m.pos > top.length ? h('p', { class: 'vazio', textContent: `Você: ${m.pos}º de ${m.de} · ${m.pts} pts` }) : ''] : [lista(top.map((x) => ({ nome: x.nome, pts: x.pontos, av: x.avatar })), 5)]));
      }
    };

    const conectar = () => {
      if (fim || !peer || (conn && conn.open && ok)) return;
      const c = conn = peer.connect('pontuo-' + codigo, { reliable: true });
      c.on('open', () => { tentativas = 0; ultima = Date.now(); c.send({ t: 'entrar', jid, nome, tk: ficha || undefined, av: avatar || undefined }); });
      c.on('data', (m) => { if (c === conn) { ultima = Date.now(); receber(m); } });
      c.on('close', () => { if (c === conn && !fim) religar('Conexão perdida. Reconectando…'); });
      c.on('error', () => { if (c === conn && !fim) religar('Conexão instável. Tentando de novo…'); });
    };
    const religar = (msg) => {
      if (fim || esperando) return;
      if (++tentativas > (ok ? 15 : 5)) {
        return ok ? falha('A sala foi encerrada.', 'Se a partida ainda estiver acontecendo, entre de novo com o código.')
          : falha('Não foi possível entrar na sala.', 'Confira o código. Em algumas redes de escola a conexão direta é bloqueada: tente usar os dados móveis.');
      }
      esperando = true;
      if (ok) tela(h('h2', { textContent: 'Reconectando…' }), h('p', { textContent: msg || '' }));
      setTimeout(() => {
        esperando = false; if (fim) return;
        try {
          if (!peer || peer.destroyed) iniciarPeer();
          else if (peer.disconnected) peer.reconnect();
          else { const velha = conn; conn = null; try { velha && velha.close(); } catch (e) {} conectar(); }
        } catch (e) { religar(); }
      }, 2000);
    };
    const iniciarPeer = () => {
      const meu = peer = novoPeer(undefined);
      meu.on('open', () => { if (peer === meu) conectar(); });
      meu.on('disconnected', () => { if (peer === meu && !fim) { try { meu.reconnect(); } catch (e) {} } });
      meu.on('error', (e) => {
        if (peer !== meu || fim) return;
        if (e.type === 'peer-unavailable') return ok ? religar('A sala não responde. Tentando de novo…') : falha('Sala não encontrada.', 'Confira o código com o professor.');
        religar('Conexão instável. Tentando de novo…');
      });
    };

    // Batimento: detecta conexão "morta" (celular que dormiu, troca de Wi-Fi) e religa sozinho.
    const bat = setInterval(() => {
      if (fim) return;
      if (conn && conn.open) { try { conn.send({ t: 'ping' }); } catch (e) {} }
      if (ok && !esperando && Date.now() - ultima > 25000) religar('Sem resposta da sala. Reconectando…');
    }, 8000);
    const vis = () => { if (!document.hidden && !fim && !esperando && (!conn || !conn.open)) religar('Reconectando…'); };
    document.addEventListener('visibilitychange', vis);
    limpezas.push(() => { clearInterval(bat); document.removeEventListener('visibilitychange', vis); fim = true; });
    setTimeout(() => { if (!ok && !fim && !esperando) religar(); }, 12000);
    iniciarPeer();
  }

  window.Jogo = { abrirSala, entrar };
})();
