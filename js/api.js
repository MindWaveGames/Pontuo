const Api = (() => {
  const K = 'pontuo_sessao';
  const post = async (rota, corpo) => {
    const r = await fetch(`${PONTUO.API}/${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || 'erro_rede');
    return d;
  };
  return {
    async entrar(chave) {
      const d = await post('validar.php', { chave });
      try { sessionStorage.setItem(K, JSON.stringify({ token: d.token, nome: d.professor })); } catch (e) {}
      return d;
    },
    sessao() { try { return JSON.parse(sessionStorage.getItem(K)); } catch (e) { return null; } },
    async valida() {
      const s = this.sessao();
      if (!s) return false;
      try { return (await post('verificar.php', { token: s.token })).valido === true; } catch (e) { return false; }
    },
    sair() { try { sessionStorage.removeItem(K); } catch (e) {} },
  };
})();
