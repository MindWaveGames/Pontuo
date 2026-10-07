// Embaralha a posição das alternativas de uma pergunta (a certa acompanha o texto dela).
// Fica fixa quando o professor marca 🔒 ou quando alguma alternativa depende da posição ("todas as anteriores", "ambas"...).
(() => {
  const DEPENDE = /todas as|todos os|nenhuma d|nenhum d|ambas|ambos|as duas|os dois|as tr[êe]s|os tr[êe]s|anterior|acima|abaixo|alternativas? [a-d]\b|^\s*[a-d]\s*(e|,|\+)\s*[a-d]\s*$/i;

  // p: { op: [...], c: índice da certa, fixa?: boolean }. preenchida(o): quais slots contam (padrão: todos).
  // texto(o): texto de uma alternativa, para detectar "todas as anteriores". Devolve uma cópia; nunca altera o original.
  function embaralhar(p, preenchida = () => true, texto = (o) => String(o)) {
    const slots = p.op.map((o, k) => (preenchida(o) ? k : -1)).filter((k) => k >= 0);
    if (p.fixa || slots.length < 2 || !slots.includes(p.c)) return p;
    if (slots.some((k) => DEPENDE.test(texto(p.op[k])))) return p;
    const ordem = slots.slice();
    for (let k = ordem.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [ordem[k], ordem[j]] = [ordem[j], ordem[k]]; }
    const op = p.op.slice();
    slots.forEach((slot, n) => { op[slot] = p.op[ordem[n]]; });
    return { ...p, op, c: slots[ordem.indexOf(p.c)] };
  }
  window.Ordem = { embaralhar, depende: (t) => DEPENDE.test(String(t)) };
})();
