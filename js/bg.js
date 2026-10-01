// Fundo interativo: partículas que fogem do cursor/dedo.
(() => {
  const c = document.getElementById('bg'), x = c.getContext('2d');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w, h, p = [], m = { x: -999, y: -999 };
  const fit = () => {
    w = c.width = innerWidth; h = c.height = innerHeight;
    p = Array.from({ length: Math.min(70, Math.floor(w * h / 18000)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 2 + Math.random() * 4,
      vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
    }));
  };
  addEventListener('resize', fit); fit();
  addEventListener('pointermove', e => { m.x = e.clientX; m.y = e.clientY; });
  (function frame() {
    x.clearRect(0, 0, w, h);
    for (const a of p) {
      const dx = a.x - m.x, dy = a.y - m.y, d = Math.hypot(dx, dy);
      if (d < 120 && d > 0) { a.x += dx / d * 2; a.y += dy / d * 2; }
      if (!reduz) { a.x += a.vx; a.y += a.vy; }
      if (a.x < 0) a.x = w; if (a.x > w) a.x = 0;
      if (a.y < 0) a.y = h; if (a.y > h) a.y = 0;
      x.beginPath(); x.arc(a.x, a.y, a.r, 0, 7); x.fillStyle = 'rgba(255,255,255,.22)'; x.fill();
    }
    if (!reduz) requestAnimationFrame(frame);
  })();
})();
