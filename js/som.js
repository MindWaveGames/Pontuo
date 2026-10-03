// Efeitos sonoros gerados no próprio navegador (Web Audio): sem arquivos de áudio. O botão 🔊/🔇 guarda a escolha.
(() => {
  let ctx = null, mudo = false;
  try { mudo = localStorage.getItem('pontuo_mudo') === '1'; } catch (e) {}

  const audio = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  // Uma nota: frequência, início (s), duração (s); "fim" faz a nota deslizar até outra frequência.
  function nota(freq, t0, dur, { tipo = 'sine', vol = 0.16, fim = 0 } = {}) {
    if (mudo) return;
    const c = audio(); if (!c) return;
    const t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const efeitos = {
    toque: () => nota(520, 0, 0.08, { tipo: 'triangle' }),
    inicio: () => [392, 523].forEach((f, i) => nota(f, i * 0.1, 0.18, { tipo: 'triangle' })),
    acerto: () => [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.09, 0.22, { tipo: 'triangle' })),
    erro: () => nota(300, 0, 0.35, { tipo: 'sawtooth', vol: 0.07, fim: 190 }), // suave, nunca assusta
    estrela: (i = 0) => nota(660 + i * 90, 0, 0.25),
    coluna: (k = 0) => nota([392, 494, 659][k] || 440, 0, 0.5, { tipo: 'triangle' }),
    vitoria: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.12, 0.3, { tipo: 'triangle' })),
  };

  const rotulo = () => (mudo ? 'Ligar o som' : 'Desligar o som');
  function botao() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'som';
    const pintar = () => { b.textContent = mudo ? '🔇' : '🔊'; b.setAttribute('aria-label', rotulo()); b.title = rotulo(); };
    b.addEventListener('click', () => { mudo = !mudo; try { localStorage.setItem('pontuo_mudo', mudo ? '1' : '0'); } catch (e) {} pintar(); if (!mudo) efeitos.toque(); });
    pintar();
    return b;
  }
  window.Som = { tocar: (nome, ...a) => { try { if (efeitos[nome]) efeitos[nome](...a); } catch (e) {} }, mudo: () => mudo, botao };
})();
