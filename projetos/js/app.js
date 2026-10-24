/*
 * Núcleo da aplicação: rotas, menu, Portfólio, Novo projeto (com adaptação
 * da abordagem), Guia PMBOK 8 e Configurações/backup.
 * As telas de cada projeto ficam em projeto.js.
 */
(function () {
  'use strict';
  const { el, fill } = UI;

  let state = { view: 'portfolio', id: null, tab: 'visao' };
  const filtros = { busca: '', tipo: '', abordagem: '', status: 'ativos' };

  const App = {
    state: () => state,
    go(view, id, tab) {
      state = { view, id: id || null, tab: tab || 'visao' };
      try { history.pushState(null, '', hashOf(state)); } catch (e) { /* ambiente sem histórico */ }
      render();
      window.scrollTo(0, 0);
    },
    render: () => render(),
    save(p) { Store.save(p); },
  };

  function hashOf(s) {
    if (s.view === 'projeto') return `#projeto.${s.id}.${s.tab}`;
    return `#${s.view}`;
  }
  function fromHash() {
    const h = (location.hash || '').replace(/^#/, '');
    const [view, id, tab] = h.split('.');
    if (view === 'projeto' && Store.get(id)) return { view, id, tab: tab || 'visao' };
    if (['portfolio', 'novo', 'guia', 'config'].includes(view)) return { view, id: null, tab: 'visao' };
    return { view: 'portfolio', id: null, tab: 'visao' };
  }

  // ---------- Layout ----------

  function renderNav() {
    const ativos = Store.projetos().filter((p) => !['concluido', 'cancelado'].includes(p.status));
    const link = (label, view, icon, active) => el('button', {
      class: `nav-link${active ? ' active' : ''}`, onclick: () => App.go(view),
      'aria-current': active ? 'page' : null,
    }, el('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon), label);
    const hoje = UI.today();
    fill(document.getElementById('nav'),
      link('Portfólio', 'portfolio', '▦', state.view === 'portfolio'),
      link('Novo projeto', 'novo', '+', state.view === 'novo'),
      el('div', { class: 'nav-group' }, `Projetos ativos (${ativos.length})`),
      ativos.map((p) => {
        const h = Calc.health(p, hoje);
        const active = state.view === 'projeto' && state.id === p.id;
        return el('button', {
          class: `nav-link nav-proj${active ? ' active' : ''}`, title: p.nome,
          onclick: () => App.go('projeto', p.id, active ? state.tab : 'visao'),
        }, UI.health(h.geral, true), el('span', { class: 'nav-proj-name' }, p.nome));
      }),
      el('div', { class: 'nav-group' }, 'Referência'),
      link('Guia PMBOK 8', 'guia', '§', state.view === 'guia'),
      link('Configurações e backup', 'config', '⚙', state.view === 'config'));
  }

  function render() {
    document.body.classList.remove('nav-open');
    const s = Store.settings();
    document.getElementById('brand-company').textContent = s.empresa || '';
    renderNav();
    const main = document.getElementById('main');
    main.replaceChildren();
    if (s.exemplo && state.view !== 'config') {
      main.append(el('div', { class: 'banner' },
        el('span', null, el('strong', null, 'Dados de exemplo. '), 'Os projetos abaixo são fictícios e servem para conhecer o sistema.'),
        el('button', { class: 'btn btn-sm', onclick: limparExemplos }, 'Apagar exemplos e começar')));
    }
    if (state.view === 'projeto') {
      const p = Store.get(state.id);
      if (!p) { state = { view: 'portfolio' }; return render(); }
      main.append(Projeto.render(p, state.tab));
    } else if (state.view === 'novo') main.append(novoProjeto());
    else if (state.view === 'guia') main.append(guia());
    else if (state.view === 'config') main.append(config());
    else main.append(portfolio());
  }

  function pageHead(title, subtitle, actions) {
    return el('div', { class: 'page-head' },
      el('div', null, el('h1', null, title), subtitle ? el('p', { class: 'muted' }, subtitle) : null),
      el('div', { class: 'page-actions' }, actions || []));
  }
  App.pageHead = pageHead;

  function limparExemplos() {
    UI.confirmAction('Apagar dados de exemplo', 'Todos os projetos serão apagados deste navegador. Deseja continuar?', 'Apagar tudo', () => {
      Store.clear();
      UI.toast('Exemplos apagados. Crie seu primeiro projeto.');
      App.go('portfolio');
    });
  }
  function carregarExemplos() {
    Store.replaceAll(Sample.projetos(UI.today()), { exemplo: true });
    UI.toast('Dados de exemplo carregados.');
    App.go('portfolio');
  }

  // ---------- Portfólio ----------

  function portfolio() {
    const hoje = UI.today();
    const todos = Store.projetos().map((p) => ({ p, h: Calc.health(p, hoje) }));
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Portfólio de projetos', 'Visão consolidada de saúde, prazo e custo pelos domínios de desempenho do PMBOK 8.', [
      todos.length ? el('button', { class: 'btn', onclick: () => exportarPortfolio(todos) }, 'Exportar CSV') : null,
      el('button', { class: 'btn btn-primary', onclick: () => App.go('novo') }, 'Novo projeto'),
    ]));

    if (!todos.length) {
      wrap.append(el('section', { class: 'card empty-state' },
        el('h2', null, 'Nenhum projeto cadastrado'),
        el('p', null, 'Cadastre um projeto de novo produto, melhoria, manutenção, investimento, segurança ou automação. O sistema sugere a abordagem (preditiva, híbrida ou ágil) e monta fases, gates e tarefas a partir de um modelo.'),
        el('div', { class: 'row' },
          el('button', { class: 'btn btn-primary', onclick: () => App.go('novo') }, 'Criar primeiro projeto'),
          el('button', { class: 'btn', onclick: carregarExemplos }, 'Carregar projetos de exemplo'))));
      return wrap;
    }

    const ativos = todos.filter(({ p }) => !['concluido', 'cancelado'].includes(p.status));
    const crit = ativos.filter(({ h }) => h.geral === 'critico').length;
    const aten = ativos.filter(({ h }) => h.geral === 'atencao').length;
    const orc = ativos.reduce((s, { p }) => s + Calc.num(p.orcamento), 0);
    const riscosAltos = ativos.reduce((s, { p }) => s + (p.riscos || []).filter((r) => Calc.riskOpen(r) && r.tipo !== 'oportunidade' && Calc.riskScore(r) >= 15).length, 0);
    const atrasadas = ativos.reduce((s, { h }) => s + h.atrasadas, 0);
    wrap.append(el('div', { class: 'kpis' },
      kpi('Projetos ativos', UI.n0(ativos.length), `${todos.length - ativos.length} encerrado(s) ou cancelado(s)`),
      kpi('Precisam de atenção', `${crit} crítico${crit === 1 ? '' : 's'}`, `${aten} em atenção`, crit ? 'bad' : aten ? 'warn' : 'ok'),
      kpi('Orçamento em execução', UI.moneyK(orc), 'Soma dos projetos ativos'),
      kpi('Riscos altos abertos', UI.n0(riscosAltos), 'Ameaças com P × I ≥ 15', riscosAltos ? 'warn' : 'ok'),
      kpi('Tarefas atrasadas', UI.n0(atrasadas), 'Em todos os projetos ativos', atrasadas ? 'warn' : 'ok')));

    const lista = el('div');
    const bar = el('div', { class: 'filters' },
      filtroInput(), filtroSelect('tipo', 'Tipo', Object.entries(Ref.TIPOS).map(([k, t]) => [k, t.curto])),
      filtroSelect('abordagem', 'Abordagem', Object.entries(Ref.ABORDAGENS).map(([k, a]) => [k, a.nome])),
      filtroSelect('status', 'Situação', [['ativos', 'Ativos'], ...Ref.STATUS_PROJETO], true));
    function desenhar() {
      const q = filtros.busca.toLowerCase();
      const rows = todos.filter(({ p }) => (!q || `${p.codigo} ${p.nome} ${p.gerente} ${p.area}`.toLowerCase().includes(q))
        && (!filtros.tipo || p.tipo === filtros.tipo)
        && (!filtros.abordagem || p.abordagem === filtros.abordagem)
        && (!filtros.status || (filtros.status === 'ativos' ? !['concluido', 'cancelado'].includes(p.status) : p.status === filtros.status)));
      const ordem = { critico: 0, atencao: 1, ok: 2 };
      rows.sort((a, b) => ordem[a.h.geral] - ordem[b.h.geral] || String(a.p.fim).localeCompare(String(b.p.fim)));
      fill(lista, UI.table([
        { label: 'Saúde', get: ({ h }) => UI.health(h.geral) },
        { label: 'Projeto', get: ({ p }) => el('div', { class: 'cell-title' }, el('strong', null, p.nome),
          el('small', { class: 'muted' }, el('span', { class: 'mono' }, p.codigo), ` · ${(Ref.TIPOS[p.tipo] || Ref.TIPOS.outro).curto} · ${(Ref.ABORDAGENS[p.abordagem] || {}).nome || '—'}`)) },
        { label: 'Área de foco', get: ({ p }) => (Ref.AREAS_FOCO.find((a) => a.key === p.fase) || {}).nome || '—' },
        { label: 'Gerente', get: ({ p }) => p.gerente || '—' },
        { label: 'Avanço real / plan.', get: ({ h }) => el('div', { class: 'progress-cell' }, UI.bar(h.evm.avancoReal), el('small', { class: 'mono' }, `${UI.pct(h.evm.avancoReal)} / ${UI.pct(h.evm.avancoPlanejado)}`)) },
        { label: 'IDP', cls: 'num', get: ({ h }) => indice(h.evm.SPI) },
        { label: 'IDC', cls: 'num', get: ({ h }) => indice(h.evm.CPI) },
        { label: 'Domínios', get: ({ h }) => strip(h) },
        { label: 'Término', cls: 'num', get: ({ p }) => UI.date(p.fim) },
      ], rows, ({ p }) => App.go('projeto', p.id), 'Nenhum projeto com esses filtros.'));
    }
    function filtroInput() {
      return el('label', { class: 'filter' }, el('span', null, 'Buscar'),
        el('input', { id: 'filtro-busca', type: 'search', placeholder: 'Nome, código, gerente', value: filtros.busca, oninput: (e) => { filtros.busca = e.target.value; desenhar(); } }));
    }
    function filtroSelect(key, label, opts, semTodos) {
      const s = el('select', { id: `filtro-${key}`, onchange: (e) => { filtros[key] = e.target.value; desenhar(); } },
        semTodos ? [el('option', { value: '' }, 'Todas')] : el('option', { value: '' }, 'Todos'),
        opts.map(([v, l]) => el('option', { value: v }, l)));
      s.value = filtros[key];
      return el('label', { class: 'filter' }, el('span', null, label), s);
    }
    desenhar();
    wrap.append(el('section', { class: 'card' }, bar, lista,
      el('p', { class: 'legend muted' }, 'Domínios, na ordem: ', Ref.DOMINIOS.map((d) => d.nome).join(' · '), '. IDP = índice de desempenho de prazo; IDC = índice de desempenho de custo (1,00 = conforme o planejado).')));
    return wrap;
  }

  function kpi(label, value, sub, tone) {
    return el('div', { class: `kpi${tone ? ` tone-${tone}` : ''}` },
      el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, value), el('small', { class: 'muted' }, sub));
  }
  App.kpi = kpi;
  function indice(v) {
    if (v == null) return el('span', { class: 'muted' }, '—');
    return el('span', { class: `mono idx ${v < 0.8 ? 'bad' : v < 0.95 ? 'warn' : 'ok'}` }, UI.idx(v));
  }
  App.indice = indice;
  function strip(h) {
    return el('span', { class: 'strip', role: 'img', 'aria-label': Ref.DOMINIOS.map((d) => `${d.nome}: ${nivelTxt(h.dominios[d.key].nivel)}`).join('; ') },
      Ref.DOMINIOS.map((d) => el('span', { class: `sq sq-${h.dominios[d.key].nivel}`, title: `${d.nome}: ${nivelTxt(h.dominios[d.key].nivel)}` })));
  }
  const nivelTxt = (n) => ({ ok: 'no rumo', atencao: 'atenção', critico: 'crítico' })[n];

  function exportarPortfolio(todos) {
    UI.csv(`portfolio-projetos-${UI.today()}.csv`,
      ['Código', 'Projeto', 'Tipo', 'Abordagem', 'Situação', 'Gerente', 'Patrocinador', 'Início', 'Término', 'Orçamento', 'Avanço real', 'Avanço planejado', 'IDP', 'IDC', 'Saúde', ...Ref.DOMINIOS.map((d) => d.nome)],
      todos.map(({ p, h }) => [p.codigo, p.nome, (Ref.TIPOS[p.tipo] || {}).curto, (Ref.ABORDAGENS[p.abordagem] || {}).nome, Ref.label(Ref.STATUS_PROJETO, p.status),
        p.gerente, p.patrocinador, UI.date(p.inicio), UI.date(p.fim), p.orcamento, UI.pct(h.evm.avancoReal), UI.pct(h.evm.avancoPlanejado),
        h.evm.SPI == null ? '' : UI.idx(h.evm.SPI), h.evm.CPI == null ? '' : UI.idx(h.evm.CPI), nivelTxt(h.geral),
        ...Ref.DOMINIOS.map((d) => nivelTxt(h.dominios[d.key].nivel))]));
  }

  // ---------- Novo projeto ----------

  function novoProjeto() {
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Novo projeto', 'Iniciação: dados básicos, adaptação da abordagem e estrutura inicial.'));
    const basico = UI.form([
      { key: 'nome', label: 'Nome do projeto', required: true, full: true, placeholder: 'Ex.: Novo suporte estampado do eixo traseiro' },
      { key: 'tipo', label: 'Tipo de projeto', type: 'select', options: Object.entries(Ref.TIPOS).map(([k, t]) => [k, t.nome]), required: true },
      { key: 'area', label: 'Área / planta', placeholder: 'Ex.: Estamparia' },
      { key: 'gerente', label: 'Gerente do projeto', required: true },
      { key: 'patrocinador', label: 'Patrocinador', help: 'Quem autoriza o projeto e decide nos gates.' },
      { key: 'cliente', label: 'Cliente (interno ou externo)' },
      { key: 'inicio', label: 'Data de início', type: 'date', required: true },
      { key: 'orcamento', label: 'Orçamento aprovado (R$)', type: 'money', min: 0 },
    ], { tipo: 'npd', inicio: UI.today() }, 'novo');

    const respostas = {};
    const recomendacao = el('div', { class: 'reco' });
    const abordagem = el('select', { id: 'novo-abordagem' }, Object.entries(Ref.ABORDAGENS).map(([k, a]) => el('option', { value: k }, a.nome)));
    const usarModelo = el('input', { id: 'novo-modelo', type: 'checkbox', checked: true });
    const modeloTxt = el('span');
    let escolhida = false;
    abordagem.addEventListener('change', () => { escolhida = true; });

    function atualizar() {
      const tipo = basico.inputs.tipo.input.value;
      const t = Ref.TIPOS[tipo];
      const r = Calc.tailoring(respostas, Ref.TAILORING);
      const sugerida = r.abordagem || t.abordagem;
      if (!escolhida) abordagem.value = sugerida;
      const n = Ref.MODELOS[tipo].length;
      modeloTxt.textContent = `Criar fases, gates e tarefas a partir do modelo "${t.metodo}" (${n} fases)`;
      fill(recomendacao,
        el('span', { class: 'eyebrow' }, r.abordagem ? `Sugestão com ${r.respondidas} de ${Ref.TAILORING.length} respostas` : 'Sugestão pelo tipo de projeto'),
        el('strong', { class: 'reco-title' }, Ref.ABORDAGENS[sugerida].nome),
        el('p', null, Ref.ABORDAGENS[sugerida].texto),
        r.abordagem ? el('div', { class: 'gauge', role: 'img', 'aria-label': `Média ${UI.idx(r.media)} numa escala de 1 (preditiva) a 5 (adaptativa)` },
          el('span', { class: 'gauge-mark', style: { left: `${(r.media - 1) / 4 * 100}%` } }),
          el('span', { class: 'gauge-labels' }, el('span', null, 'Preditiva'), el('span', null, 'Híbrida'), el('span', null, 'Adaptativa'))) : null,
        r.pred && r.pred.length ? el('p', { class: 'small' }, el('strong', null, 'Puxa para preditiva: '), r.pred.join(', '), '.') : null,
        r.adapt && r.adapt.length ? el('p', { class: 'small' }, el('strong', null, 'Puxa para adaptativa: '), r.adapt.join(', '), '.') : null,
        sugerida === 'hibrido' ? el('p', { class: 'small muted' }, 'Planeje de forma preditiva o que é caro mudar (ferramental, obras, compras longas) e use ciclos iterativos para o que ainda tem incerteza.') : null);
    }
    basico.inputs.tipo.input.addEventListener('change', atualizar);

    const perguntas = el('div', { class: 'tailoring' }, Ref.TAILORING.map((q) => {
      const id = `tail-${q.key}`;
      const s = el('select', { id, onchange: (e) => { respostas[q.key] = e.target.value; atualizar(); } },
        el('option', { value: '' }, 'Não sei / não se aplica'),
        q.opcoes.map((o, i) => el('option', { value: String(i + 1) }, o)));
      return el('div', { class: 'field' }, el('label', { for: id }, q.pergunta), s);
    }));
    atualizar();

    function criar() {
      if (!basico.validate()) return;
      const d = basico.read();
      const p = Object.assign({
        codigo: Store.nextCode(), status: 'proposta', fase: 'iniciacao', abordagem: abordagem.value,
        tailoring: Object.assign({}, respostas),
        justificativa: '', objetivos: '', escopoIncluido: '', escopoExcluido: '', entregaveis: '', premissas: '', restricoes: '',
        criteriosSucesso: '', sustentabilidade: '', aprovadoEm: '',
        indicadores: [], equipe: [], partes: [], riscos: [], marcos: [], sprints: [], tarefas: [],
        mudancas: [], questoes: [], licoes: [], raci: {}, encerramento: {},
      }, d);
      if (usarModelo.checked) {
        const m = Ref.buildFromTemplate(d.tipo, d.inicio);
        Object.assign(p, { tarefas: m.tarefas, marcos: m.marcos, sprints: m.sprints, fim: m.fim });
        if (p.abordagem === 'adaptativo') p.tarefas.forEach((t) => { if (!t.sprint) t.status = 'backlog'; });
      }
      if (d.gerente) p.equipe.push({ id: Ref.uid(), nome: d.gerente, papel: 'Gerente de projeto', area: d.area || '', alocacao: 50, custoHora: '', contato: '' });
      if (d.patrocinador) p.partes.push({ id: Ref.uid(), nome: d.patrocinador, cargo: 'Patrocinador', poder: 5, interesse: 4, atitude: 'apoiador', desejada: 'apoiador', estrategia: 'Decisão nos gates e relatório de status', frequencia: 'Quinzenal' });
      Store.save(p);
      UI.toast('Projeto criado. Complete o termo de abertura.');
      App.go('projeto', p.id, 'termo');
    }

    wrap.append(
      el('section', { class: 'card' }, el('h2', null, '1. Dados básicos'), basico.node),
      el('section', { class: 'card' },
        el('h2', null, '2. Adaptação da abordagem (tailoring)'),
        el('p', { class: 'muted' }, 'O PMBOK 8 recomenda ajustar a abordagem ao contexto. Responda o que souber; a sugestão é atualizada a cada resposta.'),
        el('div', { class: 'split' }, perguntas, recomendacao),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', { for: 'novo-abordagem' }, 'Abordagem adotada'), abordagem,
            el('small', { class: 'muted' }, 'Pode ser diferente da sugestão; você conhece o contexto.')))),
      el('section', { class: 'card' },
        el('h2', null, '3. Estrutura inicial'),
        el('label', { class: 'check', for: 'novo-modelo' }, usarModelo, modeloTxt),
        el('p', { class: 'muted small' }, 'As datas das tarefas são calculadas a partir do início do projeto e podem ser ajustadas depois.'),
        el('div', { class: 'row end' },
          el('button', { class: 'btn', onclick: () => App.go('portfolio') }, 'Cancelar'),
          el('button', { class: 'btn btn-primary', onclick: criar }, 'Criar projeto'))));
    return wrap;
  }

  // ---------- Guia PMBOK 8 ----------

  function guia() {
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Guia PMBOK 8 na prática', 'Como os conceitos da 8ª edição do PMBOK® Guide aparecem neste sistema.'));
    wrap.append(el('section', { class: 'card' },
      el('h2', null, 'Os 6 princípios'),
      el('p', { class: 'muted' }, 'Orientam o comportamento e as decisões em qualquer abordagem.'),
      el('div', { class: 'grid-3' }, Ref.PRINCIPIOS.map((p, i) => el('article', { class: 'tile' },
        el('span', { class: 'tile-num mono' }, `P${i + 1}`), el('h3', null, p.nome), el('p', null, p.texto))))));
    wrap.append(el('section', { class: 'card' },
      el('h2', null, 'Os 7 domínios de desempenho'),
      el('p', { class: 'muted' }, 'A saúde de cada projeto é avaliada nestes domínios, com regras explicadas em cada tela.'),
      UI.table([
        { label: 'Domínio', get: (d) => el('strong', null, d.nome) },
        { label: 'O que cobre', get: (d) => d.texto },
        { label: 'Onde no sistema', get: (d) => d.onde },
      ], Ref.DOMINIOS)));
    wrap.append(el('section', { class: 'card' },
      el('h2', null, 'As 5 áreas de foco'),
      el('p', { class: 'muted' }, 'Agrupam os processos do ciclo de vida. Em projetos ágeis elas se repetem a cada ciclo; em preditivos, seguem as fases.'),
      el('ol', { class: 'steps-list' }, Ref.AREAS_FOCO.map((a) => el('li', null, el('strong', null, a.nome), el('span', null, a.texto))))));
    wrap.append(el('section', { class: 'card' },
      el('h2', null, 'Abordagens de entrega'),
      el('div', { class: 'grid-3' }, Object.values(Ref.ABORDAGENS).map((a) => el('article', { class: 'tile' }, el('h3', null, a.nome), el('p', null, a.texto))))));
    wrap.append(el('section', { class: 'card' },
      el('h2', null, 'Modelos por tipo de projeto'),
      UI.table([
        { label: 'Tipo', get: ([, t]) => el('strong', null, t.nome) },
        { label: 'Método', get: ([, t]) => t.metodo },
        { label: 'Abordagem típica', get: ([, t]) => Ref.ABORDAGENS[t.abordagem].nome },
        { label: 'Fases e gates', get: ([k]) => Ref.MODELOS[k].map((f) => f.fase).join(' → ') },
      ], Object.entries(Ref.TIPOS)),
      el('p', { class: 'muted small' }, 'PMBOK é marca registrada do Project Management Institute (PMI). Este sistema aplica os conceitos do guia e não é afiliado ao PMI; os termos em português são traduções livres.')));
    return wrap;
  }

  // ---------- Configurações ----------

  function config() {
    const s = Store.settings();
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Configurações e backup', 'Os dados ficam somente neste navegador. Faça backups com frequência.'));
    const f = UI.form([{ key: 'empresa', label: 'Nome da empresa', full: true }], s, 'cfg');
    wrap.append(el('section', { class: 'card' }, el('h2', null, 'Empresa'), f.node,
      el('div', { class: 'row end' }, el('button', { class: 'btn btn-primary', onclick: () => { Store.saveSettings(f.read()); UI.toast('Configurações salvas.'); render(); } }, 'Salvar'))));

    const file = el('input', { id: 'cfg-import', type: 'file', accept: '.json,application/json', class: 'sr-only' });
    const importar = (txt) => {
      try { Store.importAll(txt); UI.toast('Backup restaurado.'); App.go('portfolio'); } catch (e) { UI.toast(`Não foi possível importar: ${e.message}`, 'bad'); }
    };
    file.addEventListener('change', () => {
      const fl = file.files[0];
      if (!fl) return;
      const r = new FileReader();
      r.onload = () => importar(String(r.result));
      r.readAsText(fl);
    });
    const colar = el('textarea', { id: 'cfg-colar', rows: 4, placeholder: 'Ou cole aqui o conteúdo de um backup (.json)' });
    wrap.append(el('section', { class: 'card' }, el('h2', null, 'Backup'),
      el('p', { class: 'muted' }, `${Store.projetos().length} projeto(s) neste navegador.`),
      el('div', { class: 'row' },
        el('button', { class: 'btn btn-primary', onclick: () => UI.download(`backup-projetos-${UI.today()}.json`, Store.exportAll(), 'application/json') }, 'Exportar backup'),
        el('button', { class: 'btn', onclick: () => UI.copyText(Store.exportAll(), 'Backup copiado.') }, 'Copiar backup'),
        el('label', { class: 'btn', for: 'cfg-import' }, 'Importar arquivo…'), file),
      colar,
      el('div', { class: 'row end' }, el('button', { class: 'btn', onclick: () => { if (colar.value.trim()) importar(colar.value); } }, 'Importar texto colado'))));

    wrap.append(el('section', { class: 'card' }, el('h2', null, 'Dados'),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => {
          if (!Store.projetos().length) return carregarExemplos();
          UI.confirmAction('Carregar exemplos', 'Os projetos atuais serão substituídos pelos exemplos. Faça um backup antes, se precisar.', 'Substituir', carregarExemplos);
        } }, 'Carregar projetos de exemplo'),
        el('button', { class: 'btn btn-danger', onclick: () => UI.confirmAction('Apagar todos os projetos', 'Esta ação não pode ser desfeita. Faça um backup antes.', 'Apagar tudo', () => { Store.clear(); UI.toast('Projetos apagados.'); App.go('portfolio'); }) }, 'Apagar todos os projetos'))));
    return wrap;
  }

  // ---------- Início ----------

  App.start = function () {
    if (!Store.projetos().length && !localStorageUsed()) Store.replaceAll(Sample.projetos(UI.today()), { exemplo: true });
    state = fromHash();
    window.addEventListener('popstate', () => { state = fromHash(); render(); });
    document.getElementById('menu-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    render();
  };
  // No primeiro acesso o sistema abre com exemplos; depois respeita o que o usuário apagou
  function localStorageUsed() {
    try {
      const k = 'gestao-projetos-pmbok8:iniciado';
      const v = localStorage.getItem(k);
      localStorage.setItem(k, '1');
      return !!v;
    } catch (e) { return false; }
  }

  window.App = App;
})();
