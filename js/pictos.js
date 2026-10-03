// Figuras do modo Kids (a mesma lista permitida no PHP: KIDS_PICTOS). Não há upload de imagem: só estas figuras.
(() => {
  const GRUPOS = [["animais", "Animais", ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦉", "🦋", "🐢", "🐟", "🐙", "🐘", "🦒", "🦓", "🐴", "🐝", "🐞", "🐌"]], ["comidas", "Comidas", ["🍎", "🍌", "🍇", "🍓", "🍉", "🍊", "🍋", "🍐", "🍒", "🍍", "🥕", "🌽", "🍞", "🧀", "🍕", "🍦"]], ["natureza", "Natureza", ["☀️", "🌙", "⭐", "🌈", "☁️", "🌧️", "🌸", "🌳", "🌻", "🔥", "💧"]], ["objetos", "Objetos", ["⚽", "🚗", "🚌", "🚲", "✈️", "🚀", "🏠", "🎈", "🎁", "📚", "✏️", "🔔", "🎵", "🎨", "🧸", "👑"]], ["numeros", "Números e sinais", ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "➕", "➖", "❓", "✅", "❌", "❤️"]], ["cores", "Cores", ["cor-vermelho", "cor-laranja", "cor-amarelo", "cor-verde", "cor-azul", "cor-roxo", "cor-rosa", "cor-marrom", "cor-preto", "cor-branco"]], ["formas", "Formas", ["⭕", "🔺", "🔷", "⬛", "⬜", "🔶"]]].map(([id, nome, itens]) => ({ id, nome, itens }));
  const TODOS = new Set(GRUPOS.flatMap((g) => g.itens));
  const CORES = { vermelho: '#e53935', laranja: '#fb8c00', amarelo: '#fdd835', verde: '#43a047', azul: '#1e88e5',
    roxo: '#8e24aa', rosa: '#ec407a', marrom: '#795548', preto: '#212121', branco: '#ffffff' };

  // Elemento visual da figura (emoji, ou bolinha colorida para "cor-xxx"). Nunca interpreta HTML.
  function el(id, tam = 48) {
    const s = document.createElement('span');
    s.className = 'picto';
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.8)}px`;
    if (id && id.startsWith('cor-') && CORES[id.slice(4)]) { s.classList.add('cor'); s.style.background = CORES[id.slice(4)]; }
    else if (TODOS.has(id)) s.textContent = id;
    return s;
  }
  const nome = (id) => (id && id.startsWith('cor-') ? 'cor ' + id.slice(4) : id || '');
  window.Picto = { grupos: GRUPOS, valido: (id) => TODOS.has(id), el, nome };
})();
