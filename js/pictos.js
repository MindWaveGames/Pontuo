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
    s.style.cssText = `width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.62)}px`;
    if (id && id.startsWith('cor-') && CORES[id.slice(4)]) { s.classList.add('cor'); s.style.background = CORES[id.slice(4)]; }
    else if (TODOS.has(id)) s.textContent = id;
    return s;
  }
  // Nome em português de cada figura: usado por leitores de tela e pela leitura em voz alta do modo Kids.
  const NOMES = {"🐶": "cachorro", "🐱": "gato", "🐭": "rato", "🐰": "coelho", "🦊": "raposa", "🐻": "urso", "🐼": "panda", "🐨": "coala", "🐯": "tigre", "🦁": "leão", "🐮": "vaca", "🐷": "porco", "🐸": "sapo", "🐵": "macaco", "🐔": "galinha", "🐧": "pinguim", "🐦": "passarinho", "🦆": "pato", "🦉": "coruja", "🦋": "borboleta", "🐢": "tartaruga", "🐟": "peixe", "🐙": "polvo", "🐘": "elefante", "🦒": "girafa", "🦓": "zebra", "🐴": "cavalo", "🐝": "abelha", "🐞": "joaninha", "🐌": "caracol", "🍎": "maçã", "🍌": "banana", "🍇": "uva", "🍓": "morango", "🍉": "melancia", "🍊": "laranja", "🍋": "limão", "🍐": "pera", "🍒": "cereja", "🍍": "abacaxi", "🥕": "cenoura", "🌽": "milho", "🍞": "pão", "🧀": "queijo", "🍕": "pizza", "🍦": "sorvete", "☀️": "sol", "🌙": "lua", "⭐": "estrela", "🌈": "arco-íris", "☁️": "nuvem", "🌧️": "chuva", "🌸": "flor", "🌳": "árvore", "🌻": "girassol", "🔥": "fogo", "💧": "gota d'água", "⚽": "bola", "🚗": "carro", "🚌": "ônibus", "🚲": "bicicleta", "✈️": "avião", "🚀": "foguete", "🏠": "casa", "🎈": "balão", "🎁": "presente", "📚": "livros", "✏️": "lápis", "🔔": "sino", "🎵": "música", "🎨": "tinta", "🧸": "ursinho", "👑": "coroa", "0️⃣": "zero", "1️⃣": "um", "2️⃣": "dois", "3️⃣": "três", "4️⃣": "quatro", "5️⃣": "cinco", "6️⃣": "seis", "7️⃣": "sete", "8️⃣": "oito", "9️⃣": "nove", "🔟": "dez", "➕": "mais", "➖": "menos", "❓": "interrogação", "✅": "certo", "❌": "errado", "❤️": "coração", "cor-vermelho": "vermelho", "cor-laranja": "laranja", "cor-amarelo": "amarelo", "cor-verde": "verde", "cor-azul": "azul", "cor-roxo": "roxo", "cor-rosa": "rosa", "cor-marrom": "marrom", "cor-preto": "preto", "cor-branco": "branco", "⭕": "círculo", "🔺": "triângulo", "🔷": "losango azul", "⬛": "quadrado preto", "⬜": "quadrado branco", "🔶": "losango laranja"};
  const nome = (id) => NOMES[id] || id || '';
  window.Picto = { grupos: GRUPOS, valido: (id) => TODOS.has(id), el, nome };
})();
