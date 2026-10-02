// Avatares predefinidos (emoji sobre fundo colorido). O id é o que vai para o banco; a lista é a mesma do PHP (AVATARES).
(() => {
  const LISTA = [
    ['raposa', '🦊', '#ffb347'], ['panda', '🐼', '#e6e6f5'], ['sapo', '🐸', '#7ddc6f'], ['leao', '🦁', '#ffd166'],
    ['polvo', '🐙', '#ff8fab'], ['unicornio', '🦄', '#d0b3ff'], ['tartaruga', '🐢', '#7bd8b0'], ['macaco', '🐵', '#d9a066'],
    ['coelho', '🐰', '#ffd6e0'], ['tigre', '🐯', '#ffa94d'], ['pinguim', '🐧', '#9ed0ff'], ['coruja', '🦉', '#c9a27a'],
    ['cachorro', '🐶', '#f2c48d'], ['gato', '🐱', '#ffe08a'], ['dino', '🦖', '#8fe388'], ['foguete', '🚀', '#a5b4fc'],
  ].map(([id, e, cor]) => ({ id, e, cor }));
  const MAPA = new Map(LISTA.map((a) => [a.id, a]));

  // Elemento redondo com o avatar (ou a silhueta padrão quando o id é vazio/desconhecido).
  function el(id, tam = 40) {
    const a = MAPA.get(id), s = document.createElement('span');
    s.className = 'av' + (a ? '' : ' sem');
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.55)}px` + (a ? `;background:${a.cor}` : '');
    if (a) s.textContent = a.e;
    return s;
  }
  window.Avatar = { lista: LISTA, valido: (id) => MAPA.has(id), info: (id) => MAPA.get(id), el };
})();
