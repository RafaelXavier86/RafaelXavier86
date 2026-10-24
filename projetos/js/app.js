/*
 * Núcleo da aplicação: rotas, menu, Painel geral, Clientes, Novo projeto
 * (com adaptação da abordagem), Guia PMBOK 8 e Configurações/backup.
 * As telas de cada projeto ficam em projeto.js.
 */
(function () {
  'use strict';
  const { el, fill } = UI;

  const VIEWS = ['painel', 'clientes', 'novo', 'guia', 'config'];
  let state = { view: 'painel', id: null, tab: 'visao' };
  const filtros = { busca: '', cliente: '', tipo: '', abordagem: '', status: 'ativos' };

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
    if (s.view === 'cliente') return `#cliente.${s.id}`;
    if (s.view === 'novo' && s.id) return `#novo.${s.id}`;
    return `#${s.view}`;
  }
  function fromHash() {
    const h = (location.hash || '').replace(/^#/, '');
    const [view, id, tab] = h.split('.');
    if (view === 'projeto' && Store.get(id)) return { view, id, tab: tab || 'visao' };
    if (view === 'cliente' && Store.cliente(id)) return { view, id, tab: 'visao' };
    if (VIEWS.includes(view)) return { view, id: view === 'novo' && Store.cliente(id) ? id : null, tab: 'visao' };
    return { view: 'painel', id: null, tab: 'visao' };
  }

  // Agrupa projetos por cliente; projetos sem cliente ficam por último
  function porCliente(projetos) {
    const grupos = new Map();
    projetos.forEach((p) => {
      const c = Store.clienteDe(p);
      const k = c ? c.id : '';
      if (!grupos.has(k)) grupos.set(k, { c, ps: [] });
      grupos.get(k).ps.push(p);
    });
    return [...grupos.values()].sort((a, b) => (a.c ? 0 : 1) - (b.c ? 0 : 1) || (a.c && b.c ? a.c.nome.localeCompare(b.c.nome, 'pt-BR') : 0));
  }
  const nomeCliente = (p) => (Store.clienteDe(p) || {}).nome || 'Sem cliente';

  // ---------- Layout ----------

  function renderNav() {
    const ativos = Store.projetos().filter(Calc.isActive);
    const link = (label, view, icon, active) => el('button', {
      class: `nav-link${active ? ' active' : ''}`, onclick: () => App.go(view),
      'aria-current': active ? 'page' : null,
    }, el('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon), label);
    const hoje = UI.today();
    fill(document.getElementById('nav'),
      link('Painel geral', 'painel', '▦', state.view === 'painel'),
      link('Clientes', 'clientes', '◫', state.view === 'clientes'),
      link('Novo projeto', 'novo', '+', state.view === 'novo'),
      el('div', { class: 'nav-group' }, `Projetos ativos (${ativos.length})`),
      porCliente(ativos).map(({ c, ps }) => [
        c ? el('button', { class: `nav-client${state.view === 'cliente' && state.id === c.id ? ' active' : ''}`, onclick: () => App.go('cliente', c.id), title: c.nome }, c.nome)
          : el('span', { class: 'nav-client' }, 'Sem cliente'),
        ps.map((p) => {
          const active = state.view === 'projeto' && state.id === p.id;
          return el('button', {
            class: `nav-link nav-proj${active ? ' active' : ''}`, title: p.nome,
            onclick: () => App.go('projeto', p.id, active ? state.tab : 'visao'),
          }, UI.health(Calc.health(p, hoje).geral, true), el('span', { class: 'nav-proj-name' }, p.nome));
        }),
      ]),
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
        el('span', null, el('strong', null, 'Dados de exemplo. '), 'Os clientes e projetos são fictícios e servem para conhecer o sistema.'),
        el('button', { class: 'btn btn-sm', onclick: limparExemplos }, 'Apagar exemplos e começar')));
    }
    if (state.view === 'projeto') {
      const p = Store.get(state.id);
      if (!p) { state = { view: 'painel' }; return render(); }
      main.append(Projeto.render(p, state.tab));
    } else if (state.view === 'cliente') {
      const c = Store.cliente(state.id);
      if (!c) { state = { view: 'clientes' }; return render(); }
      main.append(clienteView(c));
    } else if (state.view === 'clientes') main.append(clientesView());
    else if (state.view === 'novo') main.append(novoProjeto(state.id));
    else if (state.view === 'guia') main.append(guia());
    else if (state.view === 'config') main.append(config());
    else main.append(painel());
  }

  function pageHead(title, subtitle, actions, eyebrow) {
    return el('div', { class: 'page-head' },
      el('div', null, eyebrow || null, el('h1', null, title), subtitle ? el('p', { class: 'muted' }, subtitle) : null),
      el('div', { class: 'page-actions' }, actions || []));
  }
  App.pageHead = pageHead;

  function limparExemplos() {
    UI.confirmAction('Apagar dados de exemplo', 'Todos os clientes e projetos serão apagados deste navegador. Deseja continuar?', 'Apagar tudo', () => {
      Store.clear();
      UI.toast('Exemplos apagados. Cadastre seu primeiro cliente.');
      App.go('clientes');
    });
  }
  function carregarExemplos() {
    Store.replaceAll(Sample.dados(UI.today()), { exemplo: true });
    UI.toast('Dados de exemplo carregados.');
    App.go('painel');
  }

  // ---------- Peças reutilizadas ----------

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

  // Contagem de projetos ativos por saúde, como selos
  function saudeMix(r) {
    if (!r.ativos) return el('span', { class: 'muted small' }, 'Nenhum ativo');
    return el('span', { class: 'mix' },
      r.criticos ? UI.pill(`${r.criticos} crítico${r.criticos > 1 ? 's' : ''}`, 'bad') : null,
      r.atencao ? UI.pill(`${r.atencao} atenção`, 'warn') : null,
      r.ok ? UI.pill(`${r.ok} no rumo`, 'ok') : null);
  }

  // Indicadores-resumo de um conjunto de projetos (painel geral e página do cliente)
  function resumoKpis(r, extra) {
    return el('div', { class: 'kpis' },
      kpi('Projetos ativos', UI.n0(r.ativos), extra || `${r.encerrados} encerrado(s) ou cancelado(s)`),
      kpi('Precisam de atenção', `${r.criticos} crítico${r.criticos === 1 ? '' : 's'}`, `${r.atencao} em atenção · ${r.ok} no rumo`, r.criticos ? 'bad' : r.atencao ? 'warn' : 'ok'),
      kpi('Orçamento em execução', UI.moneyK(r.orcamento), `Gasto até agora: ${UI.moneyK(r.custoReal)}`),
      kpi('Avanço médio', UI.pct(r.avanco), 'Ponderado pelo orçamento'),
      kpi('Riscos altos abertos', UI.n0(r.riscosAltos), 'Ameaças com P × I ≥ 15', r.riscosAltos ? 'warn' : 'ok'),
      kpi('Tarefas atrasadas', UI.n0(r.atrasadas), 'Nos projetos ativos', r.atrasadas ? 'warn' : 'ok'));
  }

  function proximoMarco(projetos) {
    return projetos.filter(Calc.isActive)
      .flatMap((p) => (p.marcos || []).filter((m) => m.status === 'pendente' && m.data).map((m) => ({ m, p })))
      .sort((a, b) => a.m.data.localeCompare(b.m.data))[0] || null;
  }

  // Tabela de projetos: rows = [{ p, h }]
  function tabelaProjetos(rows, opts) {
    const o = opts || {};
    return UI.table([
      { label: 'Saúde', get: ({ h }) => UI.health(h.geral) },
      { label: 'Projeto', get: ({ p }) => el('div', { class: 'cell-title' }, el('strong', null, p.nome),
        el('small', { class: 'muted' }, el('span', { class: 'mono' }, p.codigo),
          o.cliente ? ` · ${nomeCliente(p)}` : '',
          ` · ${(Ref.TIPOS[p.tipo] || Ref.TIPOS.outro).curto} · ${(Ref.ABORDAGENS[p.abordagem] || {}).nome || '—'}`)) },
      o.situacao ? { label: 'Situação', get: ({ p }) => UI.pill(Ref.label(Ref.STATUS_PROJETO, p.status), p.status === 'concluido' ? 'ok' : p.status === 'cancelado' ? 'neutral' : 'accent') } : null,
      { label: 'Área de foco', get: ({ p }) => (Ref.AREAS_FOCO.find((a) => a.key === p.fase) || {}).nome || '—' },
      { label: 'Gerente', get: ({ p }) => p.gerente || '—' },
      { label: 'Avanço real / plan.', get: ({ h }) => el('div', { class: 'progress-cell' }, UI.bar(h.evm.avancoReal), el('small', { class: 'mono' }, `${UI.pct(h.evm.avancoReal)} / ${UI.pct(h.evm.avancoPlanejado)}`)) },
      { label: 'IDP', cls: 'num', get: ({ h }) => indice(h.evm.SPI) },
      { label: 'IDC', cls: 'num', get: ({ h }) => indice(h.evm.CPI) },
      { label: 'Domínios', get: ({ h }) => strip(h) },
      { label: 'Término', cls: 'num', get: ({ p }) => UI.date(p.fim) },
    ].filter(Boolean), rows, ({ p }) => App.go('projeto', p.id), o.empty || 'Nenhum projeto com esses filtros.');
  }
  const ORDEM = { critico: 0, atencao: 1, ok: 2 };
  const ordenar = (a, b) => (Calc.isActive(b.p) - Calc.isActive(a.p)) || ORDEM[a.h.geral] - ORDEM[b.h.geral] || String(a.p.fim).localeCompare(String(b.p.fim));
  const legenda = () => el('p', { class: 'legend muted' }, 'Domínios, na ordem: ', Ref.DOMINIOS.map((d) => d.nome).join(' · '), '. IDP = índice de desempenho de prazo; IDC = índice de desempenho de custo (1,00 = conforme o planejado).');

  // ---------- Painel geral ----------

  function painel() {
    const hoje = UI.today();
    const projetos = Store.projetos();
    const todos = projetos.map((p) => ({ p, h: Calc.health(p, hoje) }));
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Painel geral', 'Resumo de tudo o que está em andamento, em todos os clientes.', [
      todos.length ? el('button', { class: 'btn', onclick: () => exportarProjetos(todos) }, 'Exportar CSV') : null,
      el('button', { class: 'btn', onclick: () => editarCliente(null) }, 'Novo cliente'),
      el('button', { class: 'btn btn-primary', onclick: () => App.go('novo') }, 'Novo projeto'),
    ]));

    if (!todos.length) {
      wrap.append(el('section', { class: 'card empty-state' },
        el('h2', null, 'Nenhum projeto cadastrado'),
        el('p', null, 'Comece cadastrando um cliente: externo (montadora, OEM) ou interno (uma área da fábrica). Depois crie os projetos dele. O sistema sugere a abordagem (preditiva, híbrida ou ágil) e monta fases, gates e tarefas a partir de um modelo.'),
        el('div', { class: 'row' },
          el('button', { class: 'btn btn-primary', onclick: () => editarCliente(null) }, 'Cadastrar cliente'),
          el('button', { class: 'btn', onclick: () => App.go('novo') }, 'Criar projeto'),
          el('button', { class: 'btn', onclick: carregarExemplos }, 'Carregar exemplos'))));
      return wrap;
    }

    const r = Calc.resumo(projetos, hoje);
    const ativos = projetos.filter(Calc.isActive);
    const grupos = porCliente(ativos);
    wrap.append(resumoKpis(r, `${grupos.length} cliente(s) · ${r.encerrados} encerrado(s)`));

    // Resumo por cliente
    wrap.append(el('section', { class: 'card' },
      el('div', { class: 'card-head' },
        el('div', null, el('h2', null, 'Por cliente'), el('p', { class: 'muted small' }, 'Projetos ativos de cada cliente. Clique para abrir o cliente.')),
        el('button', { class: 'btn btn-sm', onclick: () => App.go('clientes') }, 'Todos os clientes')),
      UI.table([
        { label: 'Cliente', get: ({ c }) => el('div', { class: 'cell-title' }, el('strong', null, c ? c.nome : 'Sem cliente'), el('small', { class: 'muted' }, c ? [...new Set([tipoTxt(c), c.segmento].filter(Boolean))].join(' · ') : 'Associe no termo de abertura')) },
        { label: 'Ativos', cls: 'num', get: ({ r: rr }) => rr.ativos },
        { label: 'Saúde', get: ({ r: rr }) => saudeMix(rr) },
        { label: 'Orçamento', cls: 'num', get: ({ r: rr }) => UI.moneyK(rr.orcamento) },
        { label: 'Avanço médio', get: ({ r: rr }) => el('div', { class: 'progress-cell' }, UI.bar(rr.avanco), el('small', { class: 'mono' }, UI.pct(rr.avanco))) },
        { label: 'Atrasadas', cls: 'num', get: ({ r: rr }) => el('span', { class: rr.atrasadas ? 'text-bad mono' : 'mono' }, rr.atrasadas) },
        { label: 'Riscos altos', cls: 'num', get: ({ r: rr }) => el('span', { class: rr.riscosAltos ? 'text-warn mono' : 'mono' }, rr.riscosAltos) },
        { label: 'Próximo marco', get: ({ ps }) => {
          const x = proximoMarco(ps);
          return x ? el('div', { class: 'cell-title' }, el('span', { class: `mono${x.m.data < hoje ? ' text-bad' : ''}` }, UI.date(x.m.data)), el('small', { class: 'muted' }, x.m.nome)) : el('span', { class: 'muted' }, '—');
        } },
      ], grupos.map((g) => ({ c: g.c, ps: g.ps, r: Calc.resumo(g.ps, hoje) })), ({ c }) => (c ? App.go('cliente', c.id) : null), 'Nenhum projeto ativo.')));

    // Marcos dos próximos 30 dias (e os atrasados) e pontos de atenção
    const limite = Calc.addDays(hoje, 30);
    const marcos = ativos.flatMap((p) => (p.marcos || []).filter((m) => m.status === 'pendente' && m.data && m.data <= limite).map((m) => ({ m, p })))
      .sort((a, b) => a.m.data.localeCompare(b.m.data));
    const atencao = todos.filter(({ p, h }) => Calc.isActive(p) && h.geral !== 'ok').sort(ordenar);
    wrap.append(el('div', { class: 'grid-2' },
      el('section', { class: 'card' },
        el('h2', null, 'Marcos e gates — próximos 30 dias'),
        marcos.length ? el('ul', { class: 'task-list' }, marcos.map(({ m, p }) => el('li', { class: 'clickable-li', tabindex: '0', onclick: () => App.go('projeto', p.id, 'governanca'), onkeydown: (e) => { if (e.key === 'Enter') App.go('projeto', p.id, 'governanca'); } },
          UI.pill(m.data < hoje ? `Atrasado ${Calc.daysBetween(m.data, hoje)} d` : UI.dateShort(m.data), m.data < hoje ? 'bad' : 'neutral'),
          el('span', { class: 'task-title' }, m.nome),
          el('span', { class: 'muted small' }, `${p.nome} · ${nomeCliente(p)}`)))) : el('p', { class: 'empty' }, 'Nenhum marco pendente nos próximos 30 dias.')),
      el('section', { class: 'card' },
        el('h2', null, 'Pontos de atenção'),
        atencao.length ? el('ul', { class: 'task-list' }, atencao.map(({ p, h }) => {
          const motivos = Ref.DOMINIOS.map((d) => h.dominios[d.key]).filter((d) => d.nivel !== 'ok')
            .sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]).flatMap((d) => d.motivos).slice(0, 2);
          return el('li', { class: 'clickable-li', tabindex: '0', onclick: () => App.go('projeto', p.id), onkeydown: (e) => { if (e.key === 'Enter') App.go('projeto', p.id); } },
            UI.health(h.geral), el('span', { class: 'task-title' }, el('strong', null, p.nome), el('span', { class: 'muted' }, ` · ${nomeCliente(p)}`)),
            el('span', { class: 'muted small' }, motivos.join('; ')));
        })) : el('p', { class: 'empty' }, 'Todos os projetos ativos estão no rumo.'))));

    // Todos os projetos, com filtros
    const lista = el('div');
    const temSemCliente = projetos.some((p) => !Store.clienteDe(p));
    const bar = el('div', { class: 'filters' },
      filtroInput(),
      filtroSelect('cliente', 'Cliente', [...Store.clientes().map((c) => [c.id, c.nome]), ...(temSemCliente ? [['-', 'Sem cliente']] : [])]),
      filtroSelect('tipo', 'Tipo', Object.entries(Ref.TIPOS).map(([k, t]) => [k, t.curto])),
      filtroSelect('abordagem', 'Abordagem', Object.entries(Ref.ABORDAGENS).map(([k, a]) => [k, a.nome])),
      filtroSelect('status', 'Situação', [['ativos', 'Ativos'], ...Ref.STATUS_PROJETO], 'Todas'));
    function desenhar() {
      const q = filtros.busca.toLowerCase();
      const rows = todos.filter(({ p }) => (!q || `${p.codigo} ${p.nome} ${p.gerente} ${p.area} ${nomeCliente(p)}`.toLowerCase().includes(q))
        && (!filtros.cliente || (filtros.cliente === '-' ? !Store.clienteDe(p) : p.clienteId === filtros.cliente))
        && (!filtros.tipo || p.tipo === filtros.tipo)
        && (!filtros.abordagem || p.abordagem === filtros.abordagem)
        && (!filtros.status || (filtros.status === 'ativos' ? Calc.isActive(p) : p.status === filtros.status)));
      rows.sort(ordenar);
      fill(lista, tabelaProjetos(rows, { cliente: true }));
    }
    function filtroInput() {
      return el('label', { class: 'filter' }, el('span', null, 'Buscar'),
        el('input', { id: 'filtro-busca', type: 'search', placeholder: 'Projeto, código, gerente, cliente', value: filtros.busca, oninput: (e) => { filtros.busca = e.target.value; desenhar(); } }));
    }
    function filtroSelect(key, label, opts, todosTxt) {
      const s = el('select', { id: `filtro-${key}`, onchange: (e) => { filtros[key] = e.target.value; desenhar(); } },
        el('option', { value: '' }, todosTxt || 'Todos'), opts.map(([v, l]) => el('option', { value: v }, l)));
      s.value = filtros[key];
      if (s.value !== filtros[key]) { filtros[key] = ''; s.value = ''; }
      return el('label', { class: 'filter' }, el('span', null, label), s);
    }
    desenhar();
    wrap.append(el('section', { class: 'card' }, el('h2', null, 'Todos os projetos'), bar, lista, legenda()));
    return wrap;
  }

  function exportarProjetos(todos) {
    UI.csv(`projetos-${UI.today()}.csv`,
      ['Código', 'Projeto', 'Cliente', 'Tipo', 'Abordagem', 'Situação', 'Gerente', 'Patrocinador', 'Início', 'Término', 'Orçamento', 'Avanço real', 'Avanço planejado', 'IDP', 'IDC', 'Saúde', ...Ref.DOMINIOS.map((d) => d.nome)],
      todos.map(({ p, h }) => [p.codigo, p.nome, nomeCliente(p), (Ref.TIPOS[p.tipo] || {}).curto, (Ref.ABORDAGENS[p.abordagem] || {}).nome, Ref.label(Ref.STATUS_PROJETO, p.status),
        p.gerente, p.patrocinador, UI.date(p.inicio), UI.date(p.fim), p.orcamento, UI.pct(h.evm.avancoReal), UI.pct(h.evm.avancoPlanejado),
        h.evm.SPI == null ? '' : UI.idx(h.evm.SPI), h.evm.CPI == null ? '' : UI.idx(h.evm.CPI), nivelTxt(h.geral),
        ...Ref.DOMINIOS.map((d) => nivelTxt(h.dominios[d.key].nivel))]));
  }

  // ---------- Clientes ----------

  const tipoTxt = (c) => (c.tipo === 'interno' ? 'Interno' : 'Externo');
  const SEGMENTOS = ['Automotivo', 'Implementos rodoviários', 'Máquinas agrícolas', 'Construção civil', 'Linha branca', 'Energia', 'Óleo e gás', 'Mineração', 'Ferroviário', 'Interno'];

  // Abre o cadastro do cliente; onSaved recebe o cliente salvo (usado no Novo projeto)
  function editarCliente(c, onSaved) {
    const isNew = !c;
    const data = c ? Object.assign({}, c) : { tipo: 'externo' };
    const f = UI.form([
      { key: 'nome', label: 'Nome do cliente', required: true, full: true, placeholder: 'Ex.: Montadora Alfa S.A. ou Operações — Estamparia' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: [['externo', 'Externo (empresa cliente)'], ['interno', 'Interno (área da fábrica)']] },
      { key: 'segmento', label: 'Segmento', datalist: SEGMENTOS },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'cidade', label: 'Cidade / UF' },
      { key: 'contatoNome', label: 'Contato principal' },
      { key: 'contatoCargo', label: 'Cargo / área do contato' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'telefone', label: 'Telefone', type: 'tel' },
      { key: 'observacoes', label: 'Observações (requisitos específicos, portal do fornecedor, exigências de PPAP…)', type: 'textarea', full: true },
    ], data, 'cliente');
    UI.modal(isNew ? 'Novo cliente' : 'Editar cliente', f.node, [
      { label: 'Cancelar' },
      { label: 'Salvar', class: 'btn-primary', onClick: () => {
        if (!f.validate()) return false;
        const d = Object.assign(data, f.read());
        const dup = Store.clientes().find((x) => x.id !== d.id && x.nome.toLowerCase() === d.nome.toLowerCase());
        if (dup) { UI.toast('Já existe um cliente com esse nome.', 'bad'); return false; }
        Store.saveCliente(d);
        UI.toast(isNew ? 'Cliente cadastrado.' : 'Cliente salvo.');
        if (onSaved) onSaved(d); else if (isNew) App.go('cliente', d.id); else render();
        return true;
      } },
    ], { wide: true });
  }
  App.editarCliente = editarCliente;

  function clientesView() {
    const hoje = UI.today();
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Clientes', 'Clientes externos (montadoras, OEMs) e internos (áreas da fábrica). Os projetos ficam dentro de cada cliente.', [
      el('button', { class: 'btn btn-primary', onclick: () => editarCliente(null) }, 'Novo cliente'),
    ]));
    const cs = Store.clientes();
    if (!cs.length) {
      wrap.append(el('section', { class: 'card empty-state' },
        el('h2', null, 'Nenhum cliente cadastrado'),
        el('p', null, 'Cadastre clientes externos, como uma montadora, e internos, como "Operações — Estamparia" para projetos de manutenção e melhoria.'),
        el('div', { class: 'row' }, el('button', { class: 'btn btn-primary', onclick: () => editarCliente(null) }, 'Cadastrar primeiro cliente'))));
      return wrap;
    }
    const linhas = cs.map((c) => ({ c, r: Calc.resumo(Store.projetosDoCliente(c.id), hoje) }));
    const sem = Store.projetosDoCliente(null);
    wrap.append(el('section', { class: 'card' },
      UI.table([
        { label: 'Cliente', get: ({ c }) => el('div', { class: 'cell-title' }, el('strong', null, c.nome), el('small', { class: 'muted' }, [c.segmento, c.cidade].filter(Boolean).join(' · ') || '—')) },
        { label: 'Tipo', get: ({ c }) => UI.pill(tipoTxt(c), c.tipo === 'interno' ? 'neutral' : 'accent') },
        { label: 'Contato', get: ({ c }) => el('div', { class: 'cell-title' }, el('span', null, c.contatoNome || '—'), el('small', { class: 'muted' }, c.contatoCargo || '')) },
        { label: 'Ativos', cls: 'num', get: ({ r }) => r.ativos },
        { label: 'Encerrados', cls: 'num', get: ({ r }) => r.encerrados },
        { label: 'Saúde dos ativos', get: ({ r }) => saudeMix(r) },
        { label: 'Orçamento ativo', cls: 'num', get: ({ r }) => UI.moneyK(r.orcamento) },
      ], linhas, ({ c }) => App.go('cliente', c.id)),
      sem.length ? el('p', { class: 'small text-warn' }, `${sem.length} projeto(s) sem cliente. Associe no Termo de abertura de cada projeto.`) : null));
    return wrap;
  }

  function clienteView(c) {
    const hoje = UI.today();
    const ps = Store.projetosDoCliente(c.id);
    const r = Calc.resumo(ps, hoje);
    const wrap = el('div', { class: 'stack' });
    const crumb = el('nav', { class: 'crumbs', 'aria-label': 'Caminho' },
      el('button', { class: 'crumb', onclick: () => App.go('clientes') }, 'Clientes'), el('span', { 'aria-hidden': 'true' }, ' › '));
    wrap.append(pageHead(c.nome, null, [
      el('button', { class: 'btn', onclick: () => editarCliente(c) }, 'Editar cliente'),
      el('button', { class: 'btn btn-primary', onclick: () => App.go('novo', c.id) }, 'Novo projeto para este cliente'),
      el('button', { class: 'btn btn-ghost-danger', onclick: () => {
        if (ps.length) { UI.toast(`Este cliente tem ${ps.length} projeto(s). Mova ou exclua os projetos antes.`, 'bad'); return; }
        UI.confirmAction('Excluir cliente', `"${c.nome}" será excluído.`, 'Excluir cliente', () => { Store.removeCliente(c.id); UI.toast('Cliente excluído.'); App.go('clientes'); });
      } }, 'Excluir'),
    ], crumb));
    wrap.firstChild.querySelector('h1').after(el('div', { class: 'chips' },
      UI.pill(tipoTxt(c), c.tipo === 'interno' ? 'neutral' : 'accent'),
      c.segmento ? UI.pill(c.segmento) : null, c.cidade ? UI.pill(c.cidade) : null));

    const info = [['Contato', [c.contatoNome, c.contatoCargo].filter(Boolean).join(' — ')], ['E-mail', c.email], ['Telefone', c.telefone], ['CNPJ', c.cnpj], ['Observações', c.observacoes]]
      .filter(([, v]) => v);
    if (info.length) {
      wrap.append(el('section', { class: 'card' }, el('dl', { class: 'info-grid' },
        info.map(([k, v]) => el('div', { class: k === 'Observações' ? 'full' : null }, el('dt', null, k), el('dd', null, v))))));
    }
    wrap.append(resumoKpis(r));
    const rows = ps.map((p) => ({ p, h: Calc.health(p, hoje) })).sort(ordenar);
    wrap.append(el('section', { class: 'card' },
      el('div', { class: 'card-head' }, el('h2', null, `Projetos (${ps.length})`),
        ps.length ? el('button', { class: 'btn btn-sm', onclick: () => exportarProjetos(rows) }, 'Exportar CSV') : null),
      ps.length ? tabelaProjetos(rows, { situacao: true }) : el('div', { class: 'empty' }, 'Nenhum projeto para este cliente ainda. ',
        el('button', { class: 'btn btn-sm btn-primary', onclick: () => App.go('novo', c.id) }, 'Criar o primeiro')),
      ps.length ? legenda() : null));
    return wrap;
  }

  // ---------- Novo projeto ----------

  function novoProjeto(clienteId) {
    const wrap = el('div', { class: 'stack' });
    wrap.append(pageHead('Novo projeto', 'Iniciação: dados básicos, adaptação da abordagem e estrutura inicial.'));
    const basico = UI.form([
      { key: 'nome', label: 'Nome do projeto', required: true, full: true, placeholder: 'Ex.: Novo suporte estampado do eixo traseiro' },
      { key: 'clienteId', label: 'Cliente', type: 'select', required: true, options: () => [['', '— selecione —'], ...Store.clientes().map((c) => [c.id, `${c.nome} (${tipoTxt(c).toLowerCase()})`])] },
      { key: 'tipo', label: 'Tipo de projeto', type: 'select', options: Object.entries(Ref.TIPOS).map(([k, t]) => [k, t.nome]), required: true },
      { key: 'area', label: 'Área / planta', placeholder: 'Ex.: Estamparia' },
      { key: 'gerente', label: 'Gerente do projeto', required: true },
      { key: 'patrocinador', label: 'Patrocinador', help: 'Quem autoriza o projeto e decide nos gates.' },
      { key: 'inicio', label: 'Data de início', type: 'date', required: true },
      { key: 'orcamento', label: 'Orçamento aprovado (R$)', type: 'money', min: 0 },
    ], { tipo: 'npd', inicio: UI.today(), clienteId: clienteId || '' }, 'novo');

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
      el('section', { class: 'card' }, el('h2', null, '1. Dados básicos'), basico.node,
        el('p', { class: 'small muted' }, 'O cliente não está na lista? ',
          el('button', { class: 'btn btn-sm', onclick: () => editarCliente(null, (c) => {
            const sel = basico.inputs.clienteId.input;
            sel.append(el('option', { value: c.id }, `${c.nome} (${tipoTxt(c).toLowerCase()})`));
            sel.value = c.id;
            renderNav();
          }) }, 'Cadastrar cliente'))),
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
          el('button', { class: 'btn', onclick: () => App.go('painel') }, 'Cancelar'),
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
      try { Store.importAll(txt); UI.toast('Backup restaurado.'); App.go('painel'); } catch (e) { UI.toast(`Não foi possível importar: ${e.message}`, 'bad'); }
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
      el('p', { class: 'muted' }, `${Store.clientes().length} cliente(s) e ${Store.projetos().length} projeto(s) neste navegador.`),
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
          UI.confirmAction('Carregar exemplos', 'Os clientes e projetos atuais serão substituídos pelos exemplos. Faça um backup antes, se precisar.', 'Substituir', carregarExemplos);
        } }, 'Carregar dados de exemplo'),
        el('button', { class: 'btn btn-danger', onclick: () => UI.confirmAction('Apagar todos os dados', 'Todos os clientes e projetos serão apagados. Esta ação não pode ser desfeita. Faça um backup antes.', 'Apagar tudo', () => { Store.clear(); UI.toast('Dados apagados.'); App.go('painel'); }) }, 'Apagar todos os dados'))));
    return wrap;
  }

  // ---------- Início ----------

  App.start = function () {
    if (!Store.projetos().length && !localStorageUsed()) Store.replaceAll(Sample.dados(UI.today()), { exemplo: true });
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
