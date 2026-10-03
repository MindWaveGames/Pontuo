// Pódio em colunas (top 3) + lista do restante. Com animar=true as colunas sobem e os pontos contam até o valor final.
(() => {
  const h = (tag, p = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v;
      else if (k.includes('-')) e.setAttribute(k, v);
      else e[k] = v;
    }
    e.append(...kids);
    return e;
  };
  const reduz = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const raf = (f) => (window.requestAnimationFrame ? requestAnimationFrame(f) : setTimeout(f, 16));
  const av = (id, t) => (window.Avatar ? Avatar.el(id, t) : h('span'));

  function contar(el, ate, dur) {
    const t0 = performance.now();
    (function passo() {
      const p = Math.min(1, (performance.now() - t0) / dur);
      el.textContent = `${Math.round(ate * (1 - Math.pow(1 - p, 3)))} pts`;
      if (p < 1) raf(passo);
    })();
  }

  // itens: [{ nome, pontos, avatar }] já ordenados do maior para o menor.
  function criar(itens, { animar = false, altura = 150 } = {}) {
    animar = animar && !reduz();
    const max = Math.max(1, itens[0] ? itens[0].pontos : 1);
    const col = (k) => {
      const x = itens[k];
      if (!x) return h('div', { class: 'col vazia' });
      const alt = Math.max(30, Math.round(x.pontos / max * altura)); // altura proporcional aos pontos
      const pts = h('small', { class: 'pts', textContent: animar ? '0 pts' : `${x.pontos} pts` });
      const bar = h('div', { class: 'bar', style: animar ? '' : `height:${alt}px` }, h('span', { textContent: `${k + 1}º` }));
      const c = h('div', { class: 'col lugar' + (k + 1) },
        ...(k === 0 ? [h('span', { class: 'coroa', textContent: '👑', 'aria-hidden': 'true' })] : []),
        av(x.avatar, 52), h('strong', { textContent: x.nome }), pts, bar);
      c._a = { bar, alt, pts, ate: x.pontos };
      return c;
    };
    const cols = [col(1), col(0), col(2)]; // ordem visual: 2º, 1º, 3º
    const podio = h('div', { class: 'podio' + (animar ? ' anim' : ''), role: 'group',
      'aria-label': 'Top 3: ' + itens.slice(0, 3).map((x, k) => `${k + 1}º ${x.nome} com ${x.pontos} pontos`).join('; ') }, ...cols);
    if (animar) {
      // Suspense: o 3º lugar sobe primeiro, depois o 2º, e por último o campeão.
      [[cols[2], 300, 0], [cols[0], 1500, 1], [cols[1], 2700, 2]].forEach(([c, atraso, n]) => {
        if (!c._a) return;
        setTimeout(() => {
          c.classList.add('on');
          if (window.Som) { Som.tocar('coluna', n); if (n === 2) setTimeout(() => Som.tocar('vitoria'), 700); }
          raf(() => { c._a.bar.style.height = c._a.alt + 'px'; });
          contar(c._a.pts, c._a.ate, 1300);
        }, atraso);
      });
    }
    return podio;
  }

  // Lista (4º em diante) com avatar; "inicio" é a posição (0-based) do primeiro item; "destaque" marca a linha do próprio jogador.
  function lista(itens, { inicio = 3, animar = false, atraso = 0, destaque = -1, valor = (x) => `${x.pontos} pts`, max = 50 } = {}) {
    animar = animar && !reduz();
    return h('ul', { class: 'rk' }, ...itens.slice(0, max).map((x, i) => h('li', {
      class: (animar ? 'surge ' : '') + (inicio + i === destaque ? 'me' : ''),
      style: animar ? `animation-delay:${atraso + i * 90}ms` : '',
    }, h('span', { class: 'nm' }, av(x.avatar, 34), h('span', { textContent: x.nome })), h('b', { textContent: valor(x) }))));
  }

  window.Podio = { criar, lista };
})();
