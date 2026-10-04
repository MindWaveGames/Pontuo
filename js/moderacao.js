// Filtro de nomes (heurístico). A MESMA lógica e as MESMAS listas estão em moderacao.php (servidor, apelidos de conta).
// Aqui ele protege a tela da sala: nomes digitados por alunos anônimos passam por esta checagem no navegador do professor.
// Para incluir/retirar uma palavra, edite a lista aqui E no moderacao.php. Palavras em minúsculas, sem acento.
(() => {
  const SUBSTR = ["caralho", "buceta", "bucetao", "porra", "merda", "punheta", "xoxota", "xereca", "piroca", "viado", "viadinh", "viadao", "vagabund", "arrombad", "filhodaputa", "filhadaputa", "estupr", "pedofil", "nazi", "hitler", "prostitut", "sexo", "porn", "fuck", "shit", "bitch", "nigg", "pussy", "cunt", "whore"];
  const EXATAS = ["puta", "puto", "putinha", "putaria", "cu", "cus", "cuzao", "cuzinho", "foda", "fodase", "foder", "fodido", "fodida", "rola", "pau", "bosta", "idiota", "imbecil", "retardado", "mongol", "fdp", "pqp", "vsf", "tnc", "vtnc", "sex", "anal", "nude", "nudes", "teta", "tetas", "dick", "cock", "rape"];
  const RESERVADOS = ["admin", "administrador", "pontuo", "professor", "professora", "professores", "moderador", "moderadora", "suporte", "anonimo", "oficial", "sistema", "root"];
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

  const colapsa = (t) => t.replace(/(.)\1+/g, '$1');
  const base = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = (s) => s.split(/[^a-z0-9]+/).map(colapsa).filter(Boolean);
  const SUB = SUBSTR.map(colapsa), EXA = EXATAS.map(colapsa), RES = RESERVADOS.map(colapsa);

  function tokensOk(tk, exigirTexto) {
    const junto = tk.join('');
    if (!junto) return !exigirTexto;
    if (RES.includes(junto) || junto.startsWith('admin') || EXA.includes(junto) || tk.some((t) => EXA.includes(t))) return false;
    return !SUB.some((p) => junto.includes(p));
  }

  function permitido(nome) {
    const s = String(nome || '');
    if ((s.match(/[0-9]/g) || []).length >= 5) return false;
    const b = base(s);
    const leet = b.replace(/[01347@$5]/g, (c) => LEET[c] || c); // c4r4lh0 -> caralho
    return tokensOk(tokens(leet), true) && tokensOk(tokens(b.replace(/[0-9]+/g, ' ')), false); // putaria2 -> putaria
  }

  // Nome seguro para exibir na sala: o original se passar no filtro; senão "Jogador N".
  const limpar = (nome, n) => { const t = String(nome || '').trim().slice(0, 20); return t && permitido(t) ? t : `Jogador ${n}`; };

  window.Moderacao = { permitido, limpar };
})();
