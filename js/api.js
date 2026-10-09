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
  const comProf = (rota, corpo) => {
    const s = prof.ler();
    if (!s) return Promise.reject(new Error('token_invalido'));
    return post(rota, { ...corpo, token: s.token });
  };
  const comAluno = (rota, corpo) => {
    const s = alu.ler();
    if (!s) return Promise.reject(new Error('token_invalido'));
    return post(rota, { ...corpo, token: s.token });
  };

  return {
    // ----- professor -----
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
    abrirPartida: (c) => comProf('partida_abrir.php', c),
    partida: (c) => comProf('partida_registrar.php', c),
    ranking: () => post('ranking.php', {}),
    professor: {
      async perfil() { try { return (await comProf('professor_perfil.php', {})).professor; } catch (e) { return null; } },
      async editar(c) { return (await comProf('perfil_editar.php', c)).professor; },
      quizzes: (acao, extra = {}) => comProf('quizzes.php', { acao, ...extra }),
      relatorios: (acao, extra = {}) => comProf('relatorios.php', { acao, ...extra }),
    },

    // ----- aluno -----
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
      async editar(c) { return (await comAluno('perfil_editar.php', c)).aluno; },
      async trocarPin(pinAtual, pinNovo) {
        const d = await comAluno('aluno_pin.php', { pin_atual: pinAtual, pin_novo: pinNovo });
        alu.gravar({ token: d.token });
      },
      async ficha() {
        try { return (await comAluno('aluno_ficha.php', {})).ficha; } catch (e) { return null; }
      },
      token() { const s = alu.ler(); return s ? s.token : null; },
      sair() { alu.apagar(); },
    },
  };
})();
