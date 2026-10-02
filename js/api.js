const Api = (() => {
  const K = 'pontuo_sessao', KA = 'pontuo_aluno';
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
  // Aluno fica logado neste aparelho (localStorage); professor só na aba (sessionStorage).
  const guarda = (st, k) => ({
    ler() { try { return JSON.parse(st.getItem(k)); } catch (e) { return null; } },
    gravar(v) { try { st.setItem(k, JSON.stringify(v)); } catch (e) {} },
    apagar() { try { st.removeItem(k); } catch (e) {} },
  });
  const prof = guarda(sessionStorage, K), alu = guarda(localStorage, KA);

  return {
    async entrar(chave) {
      const d = await post('validar.php', { chave });
      prof.gravar({ token: d.token, nome: d.professor });
      return d;
    },
    sessao() { return prof.ler(); },
    async valida() {
      const s = prof.ler();
      if (!s) return false;
      try { return (await post('verificar.php', { token: s.token })).valido === true; } catch (e) { return false; }
    },
    sair() { prof.apagar(); },
    async partida(corpo) {
      const s = prof.ler();
      if (!s) throw new Error('sem_sessao');
      return post('partida_registrar.php', { ...corpo, token: s.token });
    },
    ranking() { return post('ranking.php', {}); },

    aluno: {
      async cadastrar(apelido, pin) {
        const d = await post('aluno_cadastrar.php', { apelido, pin });
        alu.gravar({ token: d.token }); return d.aluno;
      },
      async entrar(apelido, pin) {
        const d = await post('aluno_entrar.php', { apelido, pin });
        alu.gravar({ token: d.token }); return d.aluno;
      },
      async perfil() {
        const s = alu.ler();
        if (!s) return null;
        try { return (await post('aluno_perfil.php', { token: s.token })).aluno; }
        catch (e) { if (e.message === 'token_invalido') alu.apagar(); return null; }
      },
      async trocarPin(pinAtual, pinNovo) {
        const s = alu.ler();
        if (!s) throw new Error('token_invalido');
        const d = await post('aluno_pin.php', { token: s.token, pin_atual: pinAtual, pin_novo: pinNovo });
        alu.gravar({ token: d.token });
      },
      async ficha() {
        const s = alu.ler();
        if (!s) return null;
        try { return (await post('aluno_ficha.php', { token: s.token })).ficha; } catch (e) { return null; }
      },
      sair() { alu.apagar(); },
    },
  };
})();
