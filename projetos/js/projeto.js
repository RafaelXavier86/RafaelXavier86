/*
 * Telas de um projeto, organizadas pelos domínios de desempenho do PMBOK 8.
 * Cada aba lê e grava o objeto do projeto e chama App.save + App.render.
 */
(function () {
  'use strict';
  const { el, fill } = UI;

  const TABS = [
    ['visao', 'Visão geral', 'Todos os domínios'],
    ['termo', 'Termo de abertura', 'Governança · Escopo · Finanças'],
    ['tarefas', 'Tarefas', 'Escopo · Cronograma'],
    ['cronograma', 'Cronograma', 'Cronograma'],
    ['sprints', 'Sprints', 'Cronograma · Escopo'],
    ['equipe', 'Equipe', 'Recursos'],
    ['partes', 'Partes interessadas', 'Partes interessadas'],
    ['riscos', 'Riscos', 'Riscos'],
    ['financas', 'Finanças', 'Finanças'],
    ['governanca', 'Governança', 'Governança'],
    ['encerramento', 'Encerramento', 'Área de foco: Encerramento'],
  ];
  const DOMINIO_TAB = { governanca: 'governanca', escopo: 'termo', cronograma: 'cronograma', financas: 'financas', partes: 'partes', recursos: 'equipe', riscos: 'riscos' };

  const PROB = ['Muito baixa (< 10%)', 'Baixa (10–30%)', 'Média (30–50%)', 'Alta (50–70%)', 'Muito alta (> 70%)'];
  const IMPACTO = ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'];
  const PODER = ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'];
  const ATITUDES = [['desconhece', 'Desconhece'], ['resistente', 'Resistente'], ['neutro', 'Neutro'], ['apoiador', 'Apoiador'], ['lider', 'Lidera / patrocina']];
  const QUADRANTES = { gerenciar: 'Gerenciar de perto', satisfeito: 'Manter satisfeito', informado: 'Manter informado', monitorar: 'Monitorar' };
  const STATUS_RISCO = [['aberto', 'Aberto'], ['tratamento', 'Em tratamento'], ['ocorrido', 'Ocorreu (virou questão)'], ['fechado', 'Fechado']];
  const STATUS_GATE = [['pendente', 'Pendente'], ['aprovado', 'Aprovado (go)'], ['condicional', 'Aprovado com condições'], ['reprovado', 'Reprovado (no-go / kill)']];
  const STATUS_MUDANCA = [['analise', 'Em análise'], ['aprovada', 'Aprovada'], ['rejeitada', 'Rejeitada']];

  let tarefasView = 'quadro';
  const tarefasFiltro = { responsavel: '', fase: '', sprint: '' };
  let sprintSel = null;

  const hoje = () => UI.today();
  const save = (p) => App.save(p);
  const membros = (p) => [['', '— sem responsável —'], ...(p.equipe || []).map((m) => [m.nome, m.nome])];
  const fases = (p) => [...new Set((p.tarefas || []).map((t) => t.fase).filter(Boolean))];
  const statusTarefa = (s) => Ref.label(Ref.STATUS_TAREFA, s);

  // ---------- Registro genérico (tabela + janela de edição) ----------

  function registro(p, key, spec) {
    if (!p[key]) p[key] = [];
    const list = p[key];
    function editar(rec) {
      const isNew = !rec;
      const data = rec ? Object.assign({}, rec) : (spec.defaults ? spec.defaults(p) : {});
      const f = UI.form(spec.fields(p, data), data, key);
      const actions = [];
      if (!isNew) actions.push({ label: 'Excluir', class: 'btn-danger push-left', onClick: () => UI.confirmAction(`Excluir ${spec.singular.toLowerCase()}`, `"${spec.title(rec)}" será excluído. Deseja continuar?`, 'Excluir', () => {
        p[key] = p[key].filter((r) => r !== rec);
        save(p); App.render(); UI.toast('Registro excluído.');
      }) });
      actions.push({ label: 'Cancelar' });
      actions.push({ label: 'Salvar', class: 'btn-primary', onClick: () => {
        if (!f.validate()) return false;
        const d = Object.assign(data, f.read());
        if (spec.validate) { const msg = spec.validate(d); if (msg) { UI.toast(msg, 'bad'); return false; } }
        if (spec.beforeSave) spec.beforeSave(d, p);
        if (isNew) { d.id = Ref.uid(); p[key].push(d); } else Object.assign(rec, d);
        save(p); App.render(); UI.toast('Salvo.');
        return true;
      } });
      UI.modal(isNew ? `Novo registro: ${spec.singular.toLowerCase()}` : spec.singular, f.node, actions, { wide: true });
    }
    const rows = spec.sort ? list.slice().sort(spec.sort) : list.slice();
    const node = el('section', { class: 'card' },
      el('div', { class: 'card-head' },
        el('div', null, el('h2', null, spec.heading), spec.sub ? el('p', { class: 'muted small' }, spec.sub) : null),
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => editar(null) }, `Adicionar ${spec.singular.toLowerCase()}`)),
      spec.before ? spec.before(rows) : null,
      UI.table(spec.cols, rows, editar, spec.empty));
    return { node, editar };
  }

  // ---------- Página do projeto ----------

  function render(p, tab) {
    const h = Calc.health(p, hoje());
    const wrap = el('div', { class: 'stack' });
    const tipo = Ref.TIPOS[p.tipo] || Ref.TIPOS.outro;
    const cliente = Store.clienteDe(p);
    const idxFase = Ref.AREAS_FOCO.findIndex((a) => a.key === p.fase);
    wrap.append(el('header', { class: 'proj-head' },
      el('div', { class: 'proj-title' },
        el('nav', { class: 'crumbs', 'aria-label': 'Caminho' },
          cliente ? [el('button', { class: 'crumb', onclick: () => App.go('cliente', cliente.id) }, cliente.nome), el('span', { 'aria-hidden': 'true' }, ' › ')]
            : el('span', { class: 'muted' }, 'Sem cliente · '),
          el('span', { class: 'eyebrow mono' }, `${p.codigo} · ${tipo.nome}`)),
        el('h1', null, p.nome),
        el('div', { class: 'chips' },
          UI.health(h.geral),
          UI.pill(Ref.label(Ref.STATUS_PROJETO, p.status)),
          UI.pill(`Abordagem ${(Ref.ABORDAGENS[p.abordagem] || {}).nome || '—'}`, 'accent'),
          p.gerente ? UI.pill(`Gerente: ${p.gerente}`) : null)),
      el('div', { class: 'page-actions' },
        el('button', { class: 'btn', onclick: () => UI.copyText(statusReport(p, h), 'Relatório de status copiado. Cole no e-mail ou no Teams.') }, 'Copiar relatório de status'),
        el('button', { class: 'btn btn-ghost-danger', onclick: () => UI.confirmAction('Excluir projeto', `"${p.nome}" e todos os seus registros serão excluídos. Esta ação não pode ser desfeita.`, 'Excluir projeto', () => { Store.remove(p.id); UI.toast('Projeto excluído.'); if (cliente) App.go('cliente', cliente.id); else App.go('painel'); }) }, 'Excluir'))));

    wrap.append(el('nav', { class: 'focus-steps', 'aria-label': 'Área de foco atual' },
      Ref.AREAS_FOCO.map((a, i) => el('button', {
        class: `step${i < idxFase ? ' done' : ''}${i === idxFase ? ' current' : ''}`,
        'aria-current': i === idxFase ? 'step' : null,
        title: `${a.texto} Clique para marcar como área de foco atual.`,
        onclick: () => { p.fase = a.key; save(p); App.render(); },
      }, el('span', { class: 'step-n mono' }, i + 1), el('span', null, a.nome)))));

    wrap.append(el('div', { class: 'tabs', role: 'tablist' }, TABS.map(([k, label, dom]) => el('button', {
      class: `tab${k === tab ? ' active' : ''}`, role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', title: dom,
      onclick: () => App.go('projeto', p.id, k),
    }, label))));

    const tabDef = TABS.find((t) => t[0] === tab) || TABS[0];
    const body = el('div', { class: 'stack', role: 'tabpanel' });
    if (tabDef[0] !== 'visao') body.append(el('p', { class: 'domain-tag' }, 'Domínio de desempenho: ', el('strong', null, tabDef[2])));
    const views = { visao, termo, tarefas, cronograma, sprints, equipe, partes, riscos, financas, governanca, encerramento };
    body.append(views[tabDef[0]](p, h));
    wrap.append(body);
    return wrap;
  }

  // ---------- Visão geral ----------

  function visao(p, h) {
    const e = h.evm;
    const out = el('div', { class: 'stack' });
    const proxMarco = (p.marcos || []).filter((m) => m.status === 'pendente').sort((a, b) => String(a.data).localeCompare(String(b.data)))[0];
    out.append(el('div', { class: 'kpis' },
      App.kpi('Avanço real', UI.pct(e.avancoReal), `Planejado para hoje: ${UI.pct(e.avancoPlanejado)}`, e.avancoReal + 0.05 < e.avancoPlanejado ? 'warn' : null),
      App.kpi('IDP (prazo)', e.SPI == null ? '—' : UI.idx(e.SPI), e.temCusto ? 'Valor agregado ÷ valor planejado' : 'Avanço físico ÷ planejado', tone(e.SPI)),
      App.kpi('IDC (custo)', e.CPI == null ? '—' : UI.idx(e.CPI), 'Valor agregado ÷ custo real', tone(e.CPI)),
      App.kpi('Estimativa no término', UI.moneyK(e.EAC), `Orçamento: ${UI.moneyK(e.orcamento)}`, e.EAC != null && e.orcamento && e.EAC > e.orcamento ? 'warn' : null),
      App.kpi('Próximo marco', proxMarco ? UI.dateShort(proxMarco.data) : '—', proxMarco ? proxMarco.nome : 'Nenhum marco pendente',
        proxMarco && proxMarco.data < hoje() ? 'bad' : null)));

    const dom = el('section', { class: 'card' },
      el('h2', null, 'Saúde por domínio de desempenho'),
      el('ul', { class: 'domain-list' }, Ref.DOMINIOS.map((d) => {
        const r = h.dominios[d.key];
        return el('li', null,
          el('button', { class: 'domain-row', onclick: () => App.go('projeto', p.id, DOMINIO_TAB[d.key]) },
            UI.health(r.nivel, true),
            el('span', { class: 'domain-name' }, d.nome),
            el('span', { class: 'domain-why muted' }, r.motivos.length ? r.motivos.join('; ') : 'Sem alertas')));
      })));

    const kpis = p.indicadores || [];
    const valor = el('section', { class: 'card' },
      el('h2', null, 'Valor entregue'),
      el('p', { class: 'muted small' }, 'Princípio "Focar no valor": indicadores do caso de negócio, da linha de base à meta.'),
      kpis.length ? el('ul', { class: 'kpi-list' }, kpis.map((k) => {
        const prog = Calc.kpiProgress(k);
        return el('li', null,
          el('div', { class: 'kpi-line' }, el('strong', null, k.nome), el('span', { class: 'mono small' },
            `${fmtNum(k.base)} → ${k.atual === '' || k.atual == null ? '?' : fmtNum(k.atual)} → meta ${fmtNum(k.meta)} ${k.unidade || ''}`)),
          UI.bar(prog, prog >= 1 ? 'ok' : '', `${UI.pct(prog)} do caminho até a meta`));
      })) : el('p', { class: 'empty' }, 'Nenhum indicador de valor. Cadastre no Termo de abertura.'));

    const abertas = (p.tarefas || []).filter((t) => !Calc.isDone(t));
    const atrasadas = abertas.filter((t) => Calc.isOverdue(t, hoje()));
    const proximas = abertas.filter((t) => !Calc.isOverdue(t, hoje()) && t.inicio && Calc.daysBetween(hoje(), t.inicio) <= 14)
      .sort((a, b) => String(a.fim).localeCompare(String(b.fim))).slice(0, 6);
    const tarefasCard = el('section', { class: 'card' },
      el('h2', null, 'Atrasadas e próximas 2 semanas'),
      atrasadas.length || proximas.length ? el('ul', { class: 'task-list' },
        [...atrasadas, ...proximas].map((t) => el('li', null,
          el('span', { class: `pill pill-${Calc.isOverdue(t, hoje()) ? 'bad' : 'neutral'}` }, Calc.isOverdue(t, hoje()) ? `Atrasada ${Calc.daysBetween(t.fim, hoje())} d` : `Até ${UI.dateShort(t.fim)}`),
          el('span', { class: 'task-title' }, t.titulo),
          el('span', { class: 'muted small' }, t.responsavel || 'sem responsável')))) : el('p', { class: 'empty' }, 'Nada atrasado nem previsto para as próximas 2 semanas.'));

    const top = (p.riscos || []).filter(Calc.riskOpen).sort((a, b) => Calc.riskScore(b) - Calc.riskScore(a)).slice(0, 5);
    const riscosCard = el('section', { class: 'card' },
      el('h2', null, 'Principais riscos'),
      top.length ? el('ul', { class: 'task-list' }, top.map((r) => el('li', null,
        scorePill(r), el('span', { class: 'task-title' }, r.descricao),
        el('span', { class: 'muted small' }, r.plano ? `${Ref.label(allRespostas(), r.resposta)}: ${r.dono || 'sem dono'}` : 'Sem plano de resposta')))) : el('p', { class: 'empty' }, 'Nenhum risco em aberto.'));

    out.append(el('div', { class: 'grid-2' }, dom, valor), el('div', { class: 'grid-2' }, tarefasCard, riscosCard));
    return out;
  }
  const tone = (v) => (v == null ? null : v < 0.8 ? 'bad' : v < 0.95 ? 'warn' : 'ok');
  const fmtNum = (v) => (v === '' || v == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(+v));
  const allRespostas = () => [...Ref.RESPOSTAS_RISCO.ameaca, ...Ref.RESPOSTAS_RISCO.oportunidade];
  function scorePill(r) {
    const s = Calc.riskScore(r);
    if (r.tipo === 'oportunidade') return el('span', { class: 'pill pill-accent mono', title: 'Oportunidade' }, `+${s}`);
    const lv = Calc.riskLevel(s);
    return el('span', { class: `pill pill-${lv === 'alto' ? 'bad' : lv === 'medio' ? 'warn' : 'ok'} mono`, title: `P × I = ${s}` }, s);
  }

  function statusReport(p, h) {
    const e = h.evm;
    const nv = { ok: 'No rumo', atencao: 'Atenção', critico: 'Crítico' };
    const L = [];
    L.push(`RELATÓRIO DE STATUS — ${p.codigo} ${p.nome}`);
    L.push(`Cliente: ${(Store.clienteDe(p) || {}).nome || '—'}`);
    L.push(`Data: ${UI.date(hoje())} | Gerente: ${p.gerente || '—'} | Patrocinador: ${p.patrocinador || '—'}`);
    L.push(`Abordagem: ${(Ref.ABORDAGENS[p.abordagem] || {}).nome || '—'} | Área de foco: ${(Ref.AREAS_FOCO.find((a) => a.key === p.fase) || {}).nome || '—'}`);
    L.push('');
    L.push(`SAÚDE GERAL: ${nv[h.geral].toUpperCase()}`);
    L.push(`Avanço real ${UI.pct(e.avancoReal)} x planejado ${UI.pct(e.avancoPlanejado)} | IDP ${UI.idx(e.SPI)} | IDC ${UI.idx(e.CPI)} | ENT ${UI.money(e.EAC)} (orçamento ${UI.money(e.orcamento)})`);
    L.push('');
    L.push('DOMÍNIOS DE DESEMPENHO');
    Ref.DOMINIOS.forEach((d) => { const r = h.dominios[d.key]; L.push(`- ${d.nome}: ${nv[r.nivel]}${r.motivos.length ? ` — ${r.motivos.join('; ')}` : ''}`); });
    const kp = p.indicadores || [];
    if (kp.length) { L.push(''); L.push('VALOR'); kp.forEach((k) => L.push(`- ${k.nome}: base ${fmtNum(k.base)}, atual ${fmtNum(k.atual)}, meta ${fmtNum(k.meta)} ${k.unidade || ''}`)); }
    const marcos = (p.marcos || []).filter((m) => m.status === 'pendente').sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(0, 3);
    if (marcos.length) { L.push(''); L.push('PRÓXIMOS MARCOS'); marcos.forEach((m) => L.push(`- ${UI.date(m.data)} — ${m.nome}`)); }
    const atr = (p.tarefas || []).filter((t) => Calc.isOverdue(t, hoje()));
    if (atr.length) { L.push(''); L.push('TAREFAS ATRASADAS'); atr.forEach((t) => L.push(`- ${t.titulo} (${t.responsavel || 'sem responsável'}, prazo ${UI.date(t.fim)}, ${Calc.taskProgress(t)}%)`)); }
    const rs = (p.riscos || []).filter((r) => Calc.riskOpen(r) && r.tipo !== 'oportunidade').sort((a, b) => Calc.riskScore(b) - Calc.riskScore(a)).slice(0, 3);
    if (rs.length) { L.push(''); L.push('PRINCIPAIS RISCOS'); rs.forEach((r) => L.push(`- [${Calc.riskScore(r)}] ${r.descricao} — ${r.plano || 'SEM PLANO DE RESPOSTA'}`)); }
    const cr = (p.mudancas || []).filter((m) => m.status === 'analise');
    if (cr.length) { L.push(''); L.push('MUDANÇAS AGUARDANDO DECISÃO'); cr.forEach((m) => L.push(`- ${m.codigo}: ${m.descricao} (prazo +${m.impactoPrazo || 0} d, custo ${UI.money(Calc.num(m.impactoCusto))})`)); }
    return L.join('\n');
  }

  // ---------- Termo de abertura ----------

  function termo(p) {
    const f = UI.form([
      { key: 'nome', label: 'Nome do projeto', required: true, full: true },
      { key: 'codigo', label: 'Código' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(Ref.TIPOS).map(([k, t]) => [k, t.nome]) },
      { key: 'abordagem', label: 'Abordagem', type: 'select', options: Object.entries(Ref.ABORDAGENS).map(([k, a]) => [k, a.nome]) },
      { key: 'status', label: 'Situação', type: 'select', options: Ref.STATUS_PROJETO },
      { key: 'area', label: 'Área / planta' },
      { key: 'clienteId', label: 'Cliente', type: 'select', options: () => [['', '— sem cliente —'], ...Store.clientes().map((c) => [c.id, c.nome])] },
      { key: 'gerente', label: 'Gerente do projeto', required: true },
      { key: 'patrocinador', label: 'Patrocinador' },
      { key: 'inicio', label: 'Início', type: 'date' },
      { key: 'fim', label: 'Término previsto', type: 'date' },
      { key: 'orcamento', label: 'Orçamento aprovado (R$)', type: 'money', help: 'Inclui reservas. A linha de base vem do custo planejado das tarefas.' },
      { key: 'aprovadoEm', label: 'Termo aprovado em', type: 'date', help: 'Data em que o patrocinador autorizou o projeto.' },
      { key: 'justificativa', label: 'Justificativa e caso de negócio', type: 'textarea', full: true, help: 'Problema ou oportunidade, retorno esperado e alinhamento com a estratégia.' },
      { key: 'objetivos', label: 'Objetivos (SMART)', type: 'textarea', full: true },
      { key: 'escopoIncluido', label: 'Escopo: o que está incluído', type: 'textarea', full: true },
      { key: 'escopoExcluido', label: 'Escopo: o que fica fora', type: 'textarea', full: true },
      { key: 'entregaveis', label: 'Principais entregas', type: 'textarea', full: true },
      { key: 'premissas', label: 'Premissas', type: 'textarea' },
      { key: 'restricoes', label: 'Restrições', type: 'textarea' },
      { key: 'criteriosSucesso', label: 'Critérios de sucesso e de aceite', type: 'textarea', full: true },
      { key: 'sustentabilidade', label: 'Sustentabilidade (ambiental, social e econômica)', type: 'textarea', full: true, help: 'Princípio do PMBOK 8: energia, resíduos, emissões, segurança, ergonomia, custo do ciclo de vida.' },
    ], p, 'termo');
    const out = el('div', { class: 'stack' });
    out.append(el('section', { class: 'card' },
      el('div', { class: 'card-head' }, el('h2', null, 'Termo de abertura do projeto'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          if (!f.validate()) return;
          Object.assign(p, f.read());
          save(p); App.render(); UI.toast('Termo de abertura salvo.');
        } }, 'Salvar termo')),
      f.node));
    out.append(registro(p, 'indicadores', {
      heading: 'Indicadores de valor', singular: 'Indicador', sub: 'Como o resultado será medido: da linha de base à meta (funciona também para metas de redução).',
      title: (r) => r.nome,
      fields: () => [
        { key: 'nome', label: 'Indicador', required: true, full: true, placeholder: 'Ex.: Refugo da linha 3' },
        { key: 'unidade', label: 'Unidade', placeholder: '%, R$ mil, h, peças/h' },
        { key: 'base', label: 'Linha de base', type: 'number', step: 'any' },
        { key: 'meta', label: 'Meta', type: 'number', step: 'any' },
        { key: 'atual', label: 'Valor atual', type: 'number', step: 'any' },
      ],
      cols: [
        { label: 'Indicador', get: (k) => el('strong', null, k.nome) },
        { label: 'Base', cls: 'num', get: (k) => fmtNum(k.base) },
        { label: 'Atual', cls: 'num', get: (k) => fmtNum(k.atual) },
        { label: 'Meta', cls: 'num', get: (k) => fmtNum(k.meta) },
        { label: 'Unidade', get: (k) => k.unidade || '' },
        { label: 'Caminho até a meta', get: (k) => UI.bar(Calc.kpiProgress(k)) },
      ],
      empty: 'Nenhum indicador. Exemplo: refugo 4,2% → 1,5%; OEE 58% → 70%.',
    }).node);
    return out;
  }

  // ---------- Tarefas ----------

  function aplicarStatus(t, status) {
    t.status = status;
    if (status === 'concluida') { t.progresso = 100; if (!t.concluidoEm) t.concluidoEm = hoje(); } else t.concluidoEm = '';
  }

  function tarefaSpec(p) {
    return {
      heading: 'Tarefas', singular: 'Tarefa', title: (t) => t.titulo,
      defaults: () => ({ status: p.abordagem === 'adaptativo' ? 'backlog' : 'afazer', prioridade: 'media', progresso: 0, inicio: hoje(), fim: Calc.addDays(hoje(), 6), fase: tarefasFiltro.fase || '', sprint: tarefasFiltro.sprint || '' }),
      fields: () => [
        { key: 'titulo', label: 'Tarefa / entrega / história', required: true, full: true },
        { key: 'fase', label: 'Fase / pacote de trabalho', datalist: fases(p) },
        { key: 'responsavel', label: 'Responsável', type: 'select', options: () => membros(p) },
        { key: 'status', label: 'Situação', type: 'select', options: Ref.STATUS_TAREFA },
        { key: 'prioridade', label: 'Prioridade', type: 'select', options: Ref.PRIORIDADES },
        { key: 'inicio', label: 'Início', type: 'date' },
        { key: 'fim', label: 'Término', type: 'date' },
        { key: 'progresso', label: 'Avanço (%)', type: 'number', min: 0, max: 100, step: 5 },
        { key: 'pontos', label: 'Pontos (estimativa ágil)', type: 'number', min: 0, step: 1 },
        { key: 'sprint', label: 'Sprint', type: 'select', options: () => [['', '— nenhum —'], ...(p.sprints || []).map((s) => [s.id, s.nome])] },
        { key: 'custoPlanejado', label: 'Custo planejado (R$)', type: 'money', min: 0 },
        { key: 'custoReal', label: 'Custo real até agora (R$)', type: 'money', min: 0 },
        { key: 'descricao', label: 'Descrição, critérios de aceite, observações', type: 'textarea', full: true },
      ],
      validate: (d) => (d.inicio && d.fim && d.fim < d.inicio ? 'O término não pode ser antes do início.' : null),
      beforeSave: (d) => {
        d.progresso = Calc.clamp(Calc.num(d.progresso), 0, 100);
        if (d.progresso === 100 && d.status !== 'concluida') d.status = 'concluida';
        aplicarStatus(d, d.status);
      },
    };
  }

  function tarefas(p) {
    const out = el('div', { class: 'stack' });
    const spec = tarefaSpec(p);
    const reg = registro(p, 'tarefas', Object.assign({}, spec, { cols: [] }));
    const editar = reg.editar;
    const lista = (p.tarefas || []).filter((t) => (!tarefasFiltro.responsavel || t.responsavel === tarefasFiltro.responsavel)
      && (!tarefasFiltro.fase || t.fase === tarefasFiltro.fase)
      && (!tarefasFiltro.sprint || t.sprint === tarefasFiltro.sprint));

    const sel = (key, label, opts) => {
      const s = el('select', { id: `tf-${key}`, onchange: (e) => { tarefasFiltro[key] = e.target.value; App.render(); } },
        el('option', { value: '' }, 'Todos'), opts.map(([v, l]) => el('option', { value: v }, l)));
      s.value = tarefasFiltro[key];
      if (s.value !== tarefasFiltro[key]) { tarefasFiltro[key] = ''; s.value = ''; }
      return el('label', { class: 'filter' }, el('span', null, label), s);
    };
    const toggle = el('div', { class: 'seg', role: 'group', 'aria-label': 'Visualização' },
      [['quadro', 'Quadro Kanban'], ['lista', 'Lista (EAP)']].map(([k, l]) => el('button', {
        class: `seg-btn${tarefasView === k ? ' active' : ''}`, 'aria-pressed': tarefasView === k ? 'true' : 'false',
        onclick: () => { tarefasView = k; App.render(); },
      }, l)));
    out.append(el('section', { class: 'card' },
      el('div', { class: 'card-head' },
        el('div', null, el('h2', null, p.abordagem === 'preditivo' ? 'Tarefas e EAP' : 'Backlog e tarefas'),
          el('p', { class: 'muted small' }, `${lista.length} de ${(p.tarefas || []).length} tarefas. ${tarefasView === 'quadro' ? 'Arraste os cartões entre as colunas ou clique para editar.' : 'Clique numa linha para editar.'}`)),
        el('div', { class: 'row' }, toggle,
          el('button', { class: 'btn', onclick: () => exportarTarefas(p) }, 'CSV'),
          el('button', { class: 'btn btn-primary btn-sm', onclick: () => editar(null) }, 'Adicionar tarefa'))),
      el('div', { class: 'filters' },
        sel('responsavel', 'Responsável', (p.equipe || []).map((m) => [m.nome, m.nome])),
        sel('fase', 'Fase', fases(p).map((f) => [f, f])),
        (p.sprints || []).length ? sel('sprint', 'Sprint', p.sprints.map((s) => [s.id, s.nome])) : null),
      tarefasView === 'quadro' ? kanban(p, lista, editar) : listaEAP(p, lista, editar)));
    return out;
  }

  function kanban(p, lista, editar) {
    const board = el('div', { class: 'kanban' });
    Ref.STATUS_TAREFA.forEach(([st, label]) => {
      const cards = lista.filter((t) => (t.status || 'afazer') === st);
      const col = el('div', { class: `kcol kcol-${st}`, 'data-status': st },
        el('div', { class: 'kcol-head' }, el('span', null, label), el('span', { class: 'count mono' }, cards.length)),
        el('div', { class: 'kcol-body' }, cards.map((t) => card(t))));
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drop');
        const t = (p.tarefas || []).find((x) => x.id === e.dataTransfer.getData('text/plain'));
        if (!t || t.status === st) return;
        aplicarStatus(t, st);
        save(p); App.render();
        UI.toast(`"${t.titulo}" → ${label}`);
      });
      board.append(col);
    });
    function card(t) {
      const atrasada = Calc.isOverdue(t, hoje());
      const sprint = (p.sprints || []).find((s) => s.id === t.sprint);
      // div em vez de button: botões arrastáveis não funcionam em todos os navegadores
      return el('div', {
        class: `kcard prio-${t.prioridade || 'media'}${atrasada ? ' late' : ''}`, draggable: 'true', role: 'button', tabindex: '0',
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; },
        onclick: () => editar(t),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editar(t); } },
      },
        el('span', { class: 'kcard-meta muted' }, t.fase || 'Sem fase', sprint ? ` · ${sprint.nome}` : ''),
        el('span', { class: 'kcard-title' }, t.titulo),
        t.status === 'andamento' || (t.progresso > 0 && t.status !== 'concluida') ? UI.bar(Calc.taskProgress(t) / 100) : null,
        el('span', { class: 'kcard-foot' },
          el('span', { class: 'avatar', title: t.responsavel || 'Sem responsável' }, t.responsavel ? UI.initials(t.responsavel) : '?'),
          t.pontos ? el('span', { class: 'mono small muted' }, `${t.pontos} pts`) : null,
          el('span', { class: `due mono${atrasada ? ' late' : ''}` }, atrasada ? `⚠ ${UI.dateShort(t.fim)}` : UI.dateShort(t.fim))));
    }
    return el('div', { class: 'kanban-wrap' }, board);
  }

  function listaEAP(p, lista, editar) {
    const grupos = [];
    lista.forEach((t) => {
      let g = grupos.find((x) => x.fase === (t.fase || 'Sem fase'));
      if (!g) grupos.push(g = { fase: t.fase || 'Sem fase', itens: [] });
      g.itens.push(t);
    });
    if (!grupos.length) return el('p', { class: 'empty' }, 'Nenhuma tarefa com esses filtros.');
    return el('div', { class: 'table-wrap' }, el('table', { class: 'table' },
      el('thead', null, el('tr', null, ['EAP', 'Tarefa', 'Responsável', 'Início', 'Término', 'Avanço', 'Situação', 'Custo plan.'].map((h, i) => el('th', { class: i >= 3 && i !== 6 ? 'num' : null }, h)))),
      el('tbody', null, grupos.map((g, gi) => {
        const prog = g.itens.reduce((s, t) => s + Calc.taskProgress(t) * Calc.duration(t), 0) / g.itens.reduce((s, t) => s + Calc.duration(t), 0);
        return [
          el('tr', { class: 'group-row' }, el('td', { class: 'mono' }, `${gi + 1}`), el('td', { colspan: '4' }, el('strong', null, g.fase)),
            el('td', { class: 'num mono' }, `${Math.round(prog)}%`), el('td'), el('td', { class: 'num mono' }, UI.moneyK(g.itens.reduce((s, t) => s + Calc.num(t.custoPlanejado), 0)))),
          g.itens.map((t, ti) => el('tr', { class: 'clickable', tabindex: '0', onclick: () => editar(t), onkeydown: (e) => { if (e.key === 'Enter') editar(t); } },
            el('td', { class: 'mono muted' }, `${gi + 1}.${ti + 1}`),
            el('td', null, t.titulo),
            el('td', null, t.responsavel || el('span', { class: 'muted' }, '—')),
            el('td', { class: 'num mono' }, UI.dateShort(t.inicio)),
            el('td', { class: `num mono${Calc.isOverdue(t, hoje()) ? ' text-bad' : ''}` }, UI.dateShort(t.fim)),
            el('td', { class: 'num mono' }, `${Calc.taskProgress(t)}%`),
            el('td', null, UI.pill(statusTarefa(t.status), t.status === 'concluida' ? 'ok' : t.status === 'bloqueada' ? 'bad' : Calc.isOverdue(t, hoje()) ? 'warn' : 'neutral')),
            el('td', { class: 'num mono' }, t.custoPlanejado ? UI.moneyK(Calc.num(t.custoPlanejado)) : '—'))),
        ];
      }))));
  }

  function exportarTarefas(p) {
    UI.csv(`tarefas-${p.codigo}-${hoje()}.csv`,
      ['Fase', 'Tarefa', 'Responsável', 'Situação', 'Prioridade', 'Início', 'Término', 'Avanço %', 'Pontos', 'Sprint', 'Custo planejado', 'Custo real', 'Concluída em'],
      (p.tarefas || []).map((t) => [t.fase, t.titulo, t.responsavel, statusTarefa(t.status), Ref.label(Ref.PRIORIDADES, t.prioridade), UI.date(t.inicio), UI.date(t.fim),
        Calc.taskProgress(t), t.pontos, ((p.sprints || []).find((s) => s.id === t.sprint) || {}).nome || '', t.custoPlanejado, t.custoReal, t.concluidoEm ? UI.date(t.concluidoEm) : '']));
  }

  // ---------- Cronograma (Gantt) ----------

  function cronograma(p) {
    const out = el('div', { class: 'stack' });
    const tasks = (p.tarefas || []).filter((t) => t.inicio && t.fim);
    const marcos = (p.marcos || []).filter((m) => m.data);
    const editarTarefa = registro(p, 'tarefas', Object.assign({}, tarefaSpec(p), { cols: [] })).editar;
    if (!tasks.length) {
      out.append(el('section', { class: 'card' }, el('h2', null, 'Cronograma'), el('p', { class: 'empty' }, 'Cadastre tarefas com início e término para ver o gráfico de Gantt.')));
      return out;
    }
    const P = Calc.parseDate;
    const datas = [...tasks.flatMap((t) => [P(t.inicio), P(t.fim)]), ...marcos.map((m) => P(m.data)), P(hoje())];
    const min = Math.min(...datas) - 2 * 86400000;
    const max = Math.max(...datas) + 3 * 86400000;
    const span = max - min;
    const x = (d) => ((P(d) - min) / span) * 100;
    const w = (t) => ((P(t.fim) - P(t.inicio) + 86400000) / span) * 100;

    const meses = [];
    const d0 = new Date(min);
    let m = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1);
    while (m < max) { meses.push(m); const d = new Date(m); m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
    const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const fmtMes = (t) => { const d = new Date(t); return `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`; };
    const hojePos = x(hoje());

    const grupos = [];
    tasks.forEach((t) => {
      let g = grupos.find((gg) => gg.fase === (t.fase || 'Sem fase'));
      if (!g) grupos.push(g = { fase: t.fase || 'Sem fase', itens: [] });
      g.itens.push(t);
    });

    const rows = [];
    rows.push(el('div', { class: 'g-row g-scale' }, el('div', { class: 'g-label' }),
      el('div', { class: 'g-track' }, meses.map((mm) => el('span', { class: 'g-month', style: { left: `${((mm - min) / span) * 100}%` } }, fmtMes(mm))))));
    grupos.forEach((g) => {
      const ini = g.itens.reduce((a, t) => (t.inicio < a ? t.inicio : a), g.itens[0].inicio);
      const fim = g.itens.reduce((a, t) => (t.fim > a ? t.fim : a), g.itens[0].fim);
      rows.push(el('div', { class: 'g-row g-group' }, el('div', { class: 'g-label' }, el('strong', null, g.fase)),
        el('div', { class: 'g-track' }, el('span', { class: 'g-summary', style: { left: `${x(ini)}%`, width: `${w({ inicio: ini, fim })}%` } }))));
      g.itens.forEach((t) => {
        const late = Calc.isOverdue(t, hoje());
        const cls = t.status === 'concluida' ? 'done' : t.status === 'bloqueada' ? 'blocked' : late ? 'late' : '';
        rows.push(el('div', { class: 'g-row' },
          el('button', { class: 'g-label g-task', onclick: () => editarTarefa(t), title: 'Editar tarefa' }, t.titulo, el('small', { class: 'muted' }, t.responsavel || '')),
          el('div', { class: 'g-track' },
            el('span', { class: `g-bar ${cls}`, style: { left: `${x(t.inicio)}%`, width: `${w(t)}%` }, title: `${t.titulo}: ${UI.date(t.inicio)} a ${UI.date(t.fim)} · ${Calc.taskProgress(t)}%` },
              el('span', { class: 'g-fill', style: { width: `${Calc.taskProgress(t)}%` } })))));
      });
    });
    if (marcos.length) {
      rows.push(el('div', { class: 'g-row g-group' }, el('div', { class: 'g-label' }, el('strong', null, 'Marcos e gates')),
        el('div', { class: 'g-track' }, marcos.map((mk) => el('span', {
          class: `g-milestone ms-${mk.status}`, style: { left: `${x(mk.data)}%` }, title: `${mk.nome} — ${UI.date(mk.data)} (${Ref.label(STATUS_GATE, mk.status)})`,
        })))));
    }

    out.append(el('section', { class: 'card' },
      el('div', { class: 'card-head' }, el('div', null, el('h2', null, 'Gráfico de Gantt'),
        el('p', { class: 'muted small' }, `${UI.date(p.inicio)} a ${UI.date(p.fim)} · a linha vertical marca hoje. Clique numa tarefa para editar datas e avanço.`)),
        el('div', { class: 'legend-row small' },
          el('span', null, el('i', { class: 'lg lg-bar' }), 'Planejado'), el('span', null, el('i', { class: 'lg lg-fill' }), 'Realizado'),
          el('span', null, el('i', { class: 'lg lg-late' }), 'Atrasada'), el('span', null, el('i', { class: 'lg lg-ms' }), 'Marco/gate'))),
      el('div', { class: 'gantt-wrap' }, el('div', { class: 'gantt' },
        el('div', { class: 'g-today', style: { left: `calc(var(--g-label) + (100% - var(--g-label)) * ${hojePos / 100})` }, title: `Hoje: ${UI.date(hoje())}` }),
        rows))));

    out.append(registro(p, 'marcos', marcoSpec(p)).node);
    return out;
  }

  // ---------- Sprints ----------

  function sprints(p) {
    const out = el('div', { class: 'stack' });
    if (p.abordagem === 'preditivo') {
      out.append(el('p', { class: 'banner banner-info' }, 'Projetos preditivos normalmente não usam sprints. Se partes do projeto têm incerteza (ex.: software, ajustes de processo), use sprints só nelas: isso torna a abordagem híbrida.'));
    }
    const lista = (p.sprints || []).slice().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    if (!sprintSel || !lista.find((s) => s.id === sprintSel)) {
      const atual = lista.find((s) => s.inicio <= hoje() && s.fim >= hoje());
      sprintSel = (atual || lista[lista.length - 1] || {}).id || null;
    }
    const tasks = p.tarefas || [];
    const reg = registro(p, 'sprints', {
      heading: 'Sprints', singular: 'Sprint', title: (s) => s.nome,
      sub: 'Ciclos curtos com meta definida. Associe as tarefas ao sprint na aba Tarefas.',
      defaults: () => {
        const ult = lista[lista.length - 1];
        const ini = ult ? Calc.addDays(ult.fim, 1) : hoje();
        return { nome: `Sprint ${lista.length + 1}`, inicio: ini, fim: Calc.addDays(ini, 13) };
      },
      fields: () => [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'inicio', label: 'Início', type: 'date', required: true },
        { key: 'fim', label: 'Fim', type: 'date', required: true },
        { key: 'meta', label: 'Meta do sprint', type: 'textarea', full: true },
        { key: 'retrospectiva', label: 'Retrospectiva: o que manter e o que mudar', type: 'textarea', full: true },
      ],
      validate: (d) => (d.fim < d.inicio ? 'O fim não pode ser antes do início.' : null),
      sort: (a, b) => String(a.inicio).localeCompare(String(b.inicio)),
      cols: [
        { label: 'Sprint', get: (s) => el('strong', null, s.nome) },
        { label: 'Período', cls: 'num', get: (s) => `${UI.dateShort(s.inicio)} – ${UI.dateShort(s.fim)}` },
        { label: 'Itens', cls: 'num', get: (s) => tasks.filter((t) => t.sprint === s.id).length },
        { label: 'Pontos (feitos / total)', cls: 'num', get: (s) => `${Calc.velocity(tasks, s)} / ${tasks.filter((t) => t.sprint === s.id).reduce((a, t) => a + Calc.num(t.pontos), 0)}` },
        { label: 'Situação', get: (s) => (s.fim < hoje() ? UI.pill('Encerrado', 'neutral') : s.inicio <= hoje() ? UI.pill('Em curso', 'accent') : UI.pill('Planejado', 'neutral')) },
        { label: 'Meta', get: (s) => el('span', { class: 'small' }, s.meta || '') },
      ],
      empty: 'Nenhum sprint. Crie o primeiro para planejar entregas em ciclos.',
    });
    const sel = lista.find((s) => s.id === sprintSel);
    if (sel) {
      const b = Calc.burndown(tasks, sel, hoje());
      const seletor = el('select', { id: 'sprint-sel', onchange: (e) => { sprintSel = e.target.value; App.render(); } },
        lista.map((s) => el('option', { value: s.id }, s.nome)));
      seletor.value = sel.id;
      const feitos = Calc.velocity(tasks, sel);
      out.append(el('div', { class: 'grid-2' },
        el('section', { class: 'card' },
          el('div', { class: 'card-head' }, el('h2', null, 'Burndown'), el('label', { class: 'filter' }, el('span', null, 'Sprint'), seletor)),
          el('p', { class: 'muted small' }, `${feitos} de ${b.total} pontos concluídos. Meta: ${sel.meta || '—'}`),
          b.total ? burndownChart(b) : el('p', { class: 'empty' }, 'As tarefas deste sprint não têm pontos. Estime em pontos para ver o burndown.')),
        el('section', { class: 'card' },
          el('h2', null, 'Velocidade por sprint'),
          el('p', { class: 'muted small' }, 'Pontos concluídos em cada sprint: base para planejar a capacidade do próximo.'),
          velocityChart(lista, tasks))));
    }
    out.append(reg.node);
    return out;
  }

  function burndownChart(b) {
    const W = 560, H = 220, L = 34, R = 24, T = 12, B = 28;
    const n = b.dias.length - 1 || 1;
    const X = (i) => L + (i / n) * (W - L - R);
    const Y = (v) => T + (1 - v / b.total) * (H - T - B);
    const g = [];
    [0, 0.5, 1].forEach((f) => {
      const v = Math.round(b.total * f);
      g.push(UI.svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }));
      g.push(UI.svg('text', { x: L - 6, y: Y(v) + 4, class: 'axis', 'text-anchor': 'end' }, v));
    });
    const step = Math.max(1, Math.ceil(n / 6));
    b.dias.forEach((d, i) => {
      if (i % step === 0 || i === n) g.push(UI.svg('text', { x: X(i), y: H - 8, class: 'axis', 'text-anchor': 'middle' }, UI.dateShort(d.data)));
    });
    g.push(UI.svg('polyline', { points: b.dias.map((d, i) => `${X(i)},${Y(d.ideal)}`).join(' '), class: 'line-ideal', fill: 'none' }));
    const real = b.dias.map((d, i) => [i, d.real]).filter(([, v]) => v != null);
    if (real.length) {
      g.push(UI.svg('polygon', { points: [`${X(real[0][0])},${Y(0)}`, ...real.map(([i, v]) => `${X(i)},${Y(v)}`), `${X(real[real.length - 1][0])},${Y(0)}`].join(' '), class: 'area-real' }));
      g.push(UI.svg('polyline', { points: real.map(([i, v]) => `${X(i)},${Y(v)}`).join(' '), class: 'line-real', fill: 'none' }));
      const [li, lv] = real[real.length - 1];
      g.push(UI.svg('circle', { cx: X(li), cy: Y(lv), r: 4, class: 'dot-real' }));
    }
    return el('div', { class: 'chart' },
      UI.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Burndown: ${b.total} pontos no início` }, g),
      el('div', { class: 'legend-row small' }, el('span', null, el('i', { class: 'lg lg-ideal' }), 'Ideal'), el('span', null, el('i', { class: 'lg lg-real' }), 'Restante real')));
  }

  function velocityChart(lista, tasks) {
    const dados = lista.map((s) => ({ nome: s.nome, v: Calc.velocity(tasks, s), total: tasks.filter((t) => t.sprint === s.id).reduce((a, t) => a + Calc.num(t.pontos), 0) }));
    const max = Math.max(1, ...dados.map((d) => d.total));
    return el('ul', { class: 'hbars' }, dados.map((d) => el('li', null,
      el('span', { class: 'hbar-label' }, d.nome),
      el('span', { class: 'hbar-track' },
        el('span', { class: 'hbar-plan', style: { width: `${(d.total / max) * 100}%` } }),
        el('span', { class: 'hbar-val', style: { width: `${(d.v / max) * 100}%` } })),
      el('span', { class: 'mono small' }, `${d.v}/${d.total}`))));
  }

  // ---------- Equipe ----------

  function equipe(p) {
    const out = el('div', { class: 'stack' });
    out.append(registro(p, 'equipe', {
      heading: 'Equipe do projeto', singular: 'Membro', title: (m) => m.nome,
      sub: 'Alocação é o percentual do tempo da pessoa dedicado a este projeto.',
      defaults: () => ({ alocacao: 50 }),
      fields: () => [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'papel', label: 'Papel no projeto', placeholder: 'Ex.: Engenheiro de processos' },
        { key: 'area', label: 'Área / departamento' },
        { key: 'alocacao', label: 'Alocação (%)', type: 'number', min: 0, max: 200, step: 5 },
        { key: 'custoHora', label: 'Custo por hora (R$)', type: 'money', min: 0 },
        { key: 'contato', label: 'Contato (ramal, e-mail)' },
      ],
      beforeSave: (d, proj) => {
        // Mantém as tarefas e a RACI ligadas quando o nome muda
        const antigo = (proj.equipe || []).find((m) => m.id === d.id);
        if (antigo && antigo.nome !== d.nome) {
          (proj.tarefas || []).forEach((t) => { if (t.responsavel === antigo.nome) t.responsavel = d.nome; });
          Object.values(proj.raci || {}).forEach((row) => { if (row[antigo.nome]) { row[d.nome] = row[antigo.nome]; delete row[antigo.nome]; } });
        }
      },
      cols: [
        { label: 'Nome', get: (m) => el('span', { class: 'who' }, el('span', { class: 'avatar' }, UI.initials(m.nome)), el('strong', null, m.nome)) },
        { label: 'Papel', get: (m) => m.papel || '' },
        { label: 'Área', get: (m) => m.area || '' },
        { label: 'Alocação', cls: 'num', get: (m) => el('span', { class: `mono${Calc.num(m.alocacao) > 100 ? ' text-bad' : ''}` }, `${Calc.num(m.alocacao)}%`) },
        { label: 'Custo/h', cls: 'num', get: (m) => (m.custoHora ? UI.money(Calc.num(m.custoHora)) : '—') },
        { label: 'Contato', get: (m) => m.contato || '' },
      ],
      empty: 'Nenhum membro cadastrado.',
    }).node);

    const carga = Calc.workload(p, hoje());
    out.append(el('section', { class: 'card' },
      el('h2', null, 'Carga de trabalho'),
      UI.table([
        { label: 'Pessoa', get: (w) => el('strong', null, w.nome) },
        { label: 'Alocação', get: (w) => el('div', { class: 'progress-cell' }, UI.bar(w.alocacao / 100, w.sobrecarga ? 'bad' : ''), el('small', { class: 'mono' }, `${w.alocacao}%`)) },
        { label: 'Abertas', cls: 'num', get: (w) => w.abertas },
        { label: 'Atrasadas', cls: 'num', get: (w) => el('span', { class: w.atrasadas ? 'text-bad mono' : 'mono' }, w.atrasadas) },
        { label: 'Concluídas', cls: 'num', get: (w) => w.concluidas },
      ], carga, null, 'Cadastre a equipe para ver a carga.')));

    // Matriz RACI por fase
    const fs = fases(p);
    const pessoas = (p.equipe || []).map((m) => m.nome);
    if (!p.raci) p.raci = {};
    const semA = fs.filter((f) => Object.values(p.raci[f] || {}).filter((v) => v === 'A').length !== 1);
    out.append(el('section', { class: 'card' },
      el('h2', null, 'Matriz RACI'),
      el('p', { class: 'muted small' }, 'R = executa · A = aprova e responde pelo resultado (apenas um por fase) · C = consultado · I = informado.'),
      fs.length && pessoas.length ? el('div', { class: 'table-wrap' }, el('table', { class: 'table raci' },
        el('thead', null, el('tr', null, el('th', null, 'Fase / entrega'), pessoas.map((n) => el('th', { class: 'center', title: n }, n.split(' ')[0])))),
        el('tbody', null, fs.map((f, fi) => el('tr', null, el('td', null, f), pessoas.map((n, ni) => {
          const s = el('select', { id: `raci-${fi}-${ni}`, class: 'raci-sel', 'aria-label': `${f} — ${n}`, onchange: (e) => {
            p.raci[f] = p.raci[f] || {};
            if (e.target.value) p.raci[f][n] = e.target.value; else delete p.raci[f][n];
            save(p); App.render();
          } }, ['', 'R', 'A', 'C', 'I'].map((v) => el('option', { value: v }, v || '·')));
          s.value = (p.raci[f] || {})[n] || '';
          return el('td', { class: 'center' }, s);
        })))))) : el('p', { class: 'empty' }, 'Cadastre a equipe e as tarefas (com fase) para montar a matriz.'),
      fs.length && pessoas.length && semA.length ? el('p', { class: 'small text-warn' }, `Fases sem exatamente um "A": ${semA.join(', ')}.`) : null));
    return out;
  }

  // ---------- Partes interessadas ----------

  function partes(p) {
    const out = el('div', { class: 'stack' });
    const lista = p.partes || [];
    const grid = el('div', { class: 'pi-grid', role: 'img', 'aria-label': 'Matriz poder × interesse' },
      ['satisfeito', 'gerenciar', 'monitorar', 'informado'].map((q) => el('div', { class: `pi-q pi-${q}` },
        el('span', { class: 'pi-title' }, QUADRANTES[q]),
        el('div', { class: 'pi-names' }, lista.filter((s) => Calc.quadrant(s.poder, s.interesse) === q).map((s) =>
          el('span', { class: `pi-chip att-${s.atitude || 'neutro'}`, title: `${s.nome}: poder ${s.poder}, interesse ${s.interesse}, ${Ref.label(ATITUDES, s.atitude)}` }, s.nome))))));
    out.append(el('section', { class: 'card' },
      el('h2', null, 'Poder × interesse'),
      el('div', { class: 'pi-wrap' },
        el('span', { class: 'pi-axis-y' }, 'Poder ↑'), grid, el('span', { class: 'pi-axis-x' }, 'Interesse →')),
      el('div', { class: 'legend-row small' }, ATITUDES.map(([k, l]) => el('span', null, el('i', { class: `lg att-${k}` }), l)))));
    out.append(registro(p, 'partes', {
      heading: 'Registro e plano de engajamento', singular: 'Parte interessada', title: (s) => s.nome,
      defaults: () => ({ poder: 3, interesse: 3, atitude: 'neutro', desejada: 'apoiador' }),
      fields: () => [
        { key: 'nome', label: 'Nome ou grupo', required: true },
        { key: 'cargo', label: 'Cargo / organização' },
        { key: 'poder', label: 'Poder / influência', type: 'scale', scale: PODER },
        { key: 'interesse', label: 'Interesse', type: 'scale', scale: PODER },
        { key: 'atitude', label: 'Engajamento atual', type: 'select', options: ATITUDES },
        { key: 'desejada', label: 'Engajamento desejado', type: 'select', options: ATITUDES },
        { key: 'estrategia', label: 'Estratégia de engajamento e comunicação', type: 'textarea', full: true },
        { key: 'frequencia', label: 'Frequência', datalist: ['Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Nos gates', 'A cada sprint'] },
      ],
      sort: (a, b) => Calc.num(b.poder) * Calc.num(b.interesse) - Calc.num(a.poder) * Calc.num(a.interesse),
      cols: [
        { label: 'Parte interessada', get: (s) => el('div', { class: 'cell-title' }, el('strong', null, s.nome), el('small', { class: 'muted' }, s.cargo || '')) },
        { label: 'P', cls: 'num', get: (s) => s.poder },
        { label: 'I', cls: 'num', get: (s) => s.interesse },
        { label: 'Quadrante', get: (s) => QUADRANTES[Calc.quadrant(s.poder, s.interesse)] },
        { label: 'Engajamento atual → desejado', get: (s) => el('span', null, UI.pill(Ref.label(ATITUDES, s.atitude), s.atitude === 'resistente' ? 'bad' : s.atitude === 'desconhece' ? 'warn' : 'neutral'), ' → ', Ref.label(ATITUDES, s.desejada)) },
        { label: 'Estratégia / comunicação', get: (s) => el('span', { class: 'small' }, s.estrategia || el('em', { class: 'muted' }, 'sem estratégia'), s.frequencia ? ` (${s.frequencia})` : '') },
      ],
      empty: 'Nenhuma parte interessada. Pense em cliente, produção, manutenção, qualidade, SESMT, compras, fornecedores e órgãos reguladores.',
    }).node);
    return out;
  }

  // ---------- Riscos ----------

  function riscos(p) {
    const out = el('div', { class: 'stack' });
    const lista = p.riscos || [];
    const ameacas = lista.filter((r) => Calc.riskOpen(r) && r.tipo !== 'oportunidade');
    const heat = el('div', { class: 'heat', role: 'img', 'aria-label': 'Mapa de calor de ameaças abertas por probabilidade e impacto' });
    for (let i = 5; i >= 1; i--) {
      heat.append(el('span', { class: 'heat-ylab' }, IMPACTO[i - 1]));
      for (let pr = 1; pr <= 5; pr++) {
        const nesses = ameacas.filter((r) => Calc.num(r.probabilidade) === pr && Calc.num(r.impacto) === i);
        const lv = Calc.riskLevel(pr * i);
        heat.append(el('span', { class: `heat-cell lv-${lv}${nesses.length ? ' has' : ''}`, title: nesses.map((r) => `${r.codigo}: ${r.descricao}`).join('\n') || `P${pr} × I${i} = ${pr * i}` },
          nesses.length ? nesses.map((r) => r.codigo).join(' ') : ''));
      }
    }
    heat.append(el('span'), ...[1, 2, 3, 4, 5].map((pr) => el('span', { class: 'heat-xlab' }, PROB[pr - 1].split(' (')[0])));
    const altos = ameacas.filter((r) => Calc.riskScore(r) >= 15);
    const ops = lista.filter((r) => Calc.riskOpen(r) && r.tipo === 'oportunidade');
    out.append(el('div', { class: 'grid-2' },
      el('section', { class: 'card' }, el('h2', null, 'Mapa de calor (ameaças abertas)'),
        el('div', { class: 'heat-wrap' }, el('span', { class: 'pi-axis-y' }, 'Impacto ↑'), heat), el('p', { class: 'muted small center' }, 'Probabilidade →')),
      el('section', { class: 'card' }, el('h2', null, 'Resumo'),
        el('div', { class: 'kpis kpis-2' },
          App.kpi('Ameaças abertas', ameacas.length, `${altos.length} alta(s), P × I ≥ 15`, altos.length ? 'warn' : 'ok'),
          App.kpi('Sem plano de resposta', ameacas.filter((r) => !r.plano).length, 'Ameaças abertas', ameacas.some((r) => !r.plano && Calc.riskScore(r) >= 15) ? 'bad' : null),
          App.kpi('Oportunidades', ops.length, 'Riscos positivos em aberto'),
          App.kpi('Ocorridos', lista.filter((r) => r.status === 'ocorrido').length, 'Tratar no registro de questões')),
        el('p', { class: 'muted small' }, 'Classificação: P × I ≥ 15 alto, 8 a 14 médio, até 7 baixo. Descreva o risco como causa → evento → efeito.'))));
    out.append(registro(p, 'riscos', {
      heading: 'Registro de riscos', singular: 'Risco', title: (r) => `${r.codigo} ${r.descricao}`,
      defaults: () => {
        const n = Math.max(0, ...lista.map((r) => parseInt(String(r.codigo || '').replace(/\D/g, ''), 10) || 0)) + 1;
        return { codigo: `R-${String(n).padStart(2, '0')}`, tipo: 'ameaca', probabilidade: 3, impacto: 3, resposta: 'mitigar', status: 'aberto', categoria: Ref.CATEGORIAS_RISCO[0] };
      },
      fields: () => [
        { key: 'codigo', label: 'Código' },
        { key: 'tipo', label: 'Tipo', type: 'select', options: [['ameaca', 'Ameaça'], ['oportunidade', 'Oportunidade']] },
        { key: 'descricao', label: 'Descrição (causa → evento → efeito)', type: 'textarea', required: true, full: true },
        { key: 'categoria', label: 'Categoria', type: 'select', options: Ref.CATEGORIAS_RISCO },
        { key: 'dono', label: 'Dono do risco', type: 'select', options: () => membros(p) },
        { key: 'probabilidade', label: 'Probabilidade', type: 'scale', scale: PROB },
        { key: 'impacto', label: 'Impacto (prazo, custo, qualidade, segurança)', type: 'scale', scale: IMPACTO },
        { key: 'resposta', label: 'Estratégia de resposta', type: 'select', options: allRespostas().filter((o, i, a) => a.findIndex((x) => x[0] === o[0]) === i) },
        { key: 'status', label: 'Situação', type: 'select', options: STATUS_RISCO },
        { key: 'plano', label: 'Plano de resposta (ações, prazo)', type: 'textarea', full: true },
        { key: 'gatilho', label: 'Gatilho / sinal de alerta', full: true },
      ],
      sort: (a, b) => (Calc.riskOpen(b) - Calc.riskOpen(a)) || Calc.riskScore(b) - Calc.riskScore(a),
      cols: [
        { label: 'Cód.', get: (r) => el('span', { class: 'mono' }, r.codigo) },
        { label: 'Risco', get: (r) => el('div', { class: 'cell-title' }, el('span', null, r.descricao), el('small', { class: 'muted' }, `${r.tipo === 'oportunidade' ? 'Oportunidade' : 'Ameaça'} · ${r.categoria || ''}`)) },
        { label: 'P × I', cls: 'num', get: (r) => scorePill(r) },
        { label: 'Resposta', get: (r) => el('div', { class: 'cell-title' }, el('strong', null, Ref.label(allRespostas(), r.resposta)), el('small', { class: r.plano ? 'muted' : 'text-bad' }, r.plano || 'Sem plano de resposta')) },
        { label: 'Dono', get: (r) => r.dono || '—' },
        { label: 'Situação', get: (r) => UI.pill(Ref.label(STATUS_RISCO, r.status), r.status === 'ocorrido' ? 'bad' : r.status === 'fechado' ? 'neutral' : 'accent') },
      ],
      empty: 'Nenhum risco registrado. Comece pelos riscos de fornecedor, técnicos, de segurança e de cronograma.',
    }).node);
    return out;
  }

  // ---------- Finanças ----------

  function financas(p, h) {
    const e = h.evm;
    const out = el('div', { class: 'stack' });
    if (!e.temCusto) {
      out.append(el('p', { class: 'banner banner-info' }, 'Informe o custo planejado das tarefas (aba Tarefas) para calcular o valor agregado em R$. Enquanto isso, o IDP usa o avanço físico ponderado pela duração.'));
    }
    out.append(el('div', { class: 'kpis' },
      App.kpi('Orçamento aprovado', UI.moneyK(e.orcamento), 'Termo de abertura'),
      App.kpi('Linha de base (ONT)', UI.moneyK(e.BAC), 'Soma do custo planejado das tarefas'),
      App.kpi('Reserva', UI.moneyK(e.reserva), 'Orçamento − linha de base', e.reserva < 0 ? 'bad' : null),
      App.kpi('Estimativa no término (ENT)', UI.moneyK(e.EAC), e.VAC == null ? '—' : `Variação no término (VNT): ${UI.moneyK(e.VAC)}`, e.VAC != null && e.VAC < 0 ? 'warn' : null)));

    const max = Math.max(e.BAC, e.EAC || 0, e.orcamento, 1);
    const linha = (label, v, cls, nota) => el('li', null,
      el('span', { class: 'hbar-label' }, label),
      el('span', { class: 'hbar-track' }, el('span', { class: `hbar-val ${cls}`, style: { width: `${(Math.max(0, v || 0) / max) * 100}%` } })),
      el('span', { class: 'mono small' }, UI.moneyK(v)), nota ? el('small', { class: 'muted hbar-note' }, nota) : null);
    out.append(el('div', { class: 'grid-2' },
      el('section', { class: 'card' },
        el('h2', null, 'Valor agregado hoje'),
        el('ul', { class: 'hbars' },
          linha('Valor planejado (VP)', e.PV, 'c-pv', 'Quanto deveria estar feito, em R$'),
          linha('Valor agregado (VA)', e.EV, 'c-ev', 'Quanto foi feito, pelo orçamento das tarefas'),
          linha('Custo real (CR)', e.AC, 'c-ac', 'Quanto foi gasto'),
          linha('Estimativa no término', e.EAC, 'c-eac', 'ONT ÷ IDC'),
          linha('Orçamento aprovado', e.orcamento, 'c-orc'))),
      el('section', { class: 'card' },
        el('h2', null, 'Índices'),
        el('dl', { class: 'metrics' },
          metric('IDP (SPI)', App.indice(e.SPI), 'VA ÷ VP. Abaixo de 1: entregando menos que o planejado.'),
          metric('IDC (CPI)', App.indice(e.CPI), 'VA ÷ CR. Abaixo de 1: gastando mais do que entrega.'),
          metric('VPR (SV)', UI.moneyK(e.SV), 'VA − VP'),
          metric('VC (CV)', UI.moneyK(e.CV), 'VA − CR'),
          metric('EPT (ETC)', UI.moneyK(e.ETC), 'Quanto ainda falta gastar'),
          metric('IDPT (TCPI)', App.indice(e.TCPI), 'Eficiência necessária no restante para cumprir a linha de base')))));

    const porFase = fases(p).map((f) => {
      const ts = (p.tarefas || []).filter((t) => t.fase === f);
      const ev = Calc.evm(ts, hoje());
      return { f, ...ev };
    });
    out.append(el('section', { class: 'card' },
      el('div', { class: 'card-head' }, el('h2', null, 'Custos por fase'), el('button', { class: 'btn btn-sm', onclick: () => App.go('projeto', p.id, 'tarefas') }, 'Lançar custos nas tarefas')),
      UI.table([
        { label: 'Fase', get: (r) => el('strong', null, r.f) },
        { label: 'Planejado (ONT)', cls: 'num', get: (r) => UI.money(r.BAC) },
        { label: 'VP hoje', cls: 'num', get: (r) => UI.money(r.PV) },
        { label: 'VA', cls: 'num', get: (r) => UI.money(r.EV) },
        { label: 'CR', cls: 'num', get: (r) => UI.money(r.AC) },
        { label: 'IDC', cls: 'num', get: (r) => App.indice(r.CPI) },
      ], porFase, null, 'Sem tarefas com fase.')));
    return out;
  }
  function metric(label, value, help) {
    return el('div', { class: 'metric' }, el('dt', null, label), el('dd', null, value), el('small', { class: 'muted' }, help));
  }

  // ---------- Governança ----------

  function marcoSpec(p) {
    return {
      heading: 'Marcos e gates de decisão', singular: 'Marco', title: (m) => m.nome,
      sub: 'Pontos em que o patrocinador decide seguir, ajustar ou encerrar (go / no-go).',
      defaults: () => ({ status: 'pendente', data: hoje() }),
      fields: () => [
        { key: 'nome', label: 'Marco / gate', required: true, full: true },
        { key: 'data', label: 'Data prevista', type: 'date' },
        { key: 'status', label: 'Decisão', type: 'select', options: STATUS_GATE },
        { key: 'criterios', label: 'Critérios de passagem', type: 'textarea', full: true },
        { key: 'decisor', label: 'Quem decide' },
        { key: 'decisao', label: 'Registro da decisão', type: 'textarea', full: true },
      ],
      sort: (a, b) => String(a.data).localeCompare(String(b.data)),
      cols: [
        { label: 'Data', cls: 'num', get: (m) => el('span', { class: `mono${m.status === 'pendente' && m.data < hoje() ? ' text-bad' : ''}` }, UI.date(m.data)) },
        { label: 'Marco / gate', get: (m) => el('div', { class: 'cell-title' }, el('strong', null, m.nome), el('small', { class: 'muted' }, m.criterios || '')) },
        { label: 'Decisão', get: (m) => UI.pill(Ref.label(STATUS_GATE, m.status), { aprovado: 'ok', condicional: 'warn', reprovado: 'bad' }[m.status] || (m.data < hoje() ? 'bad' : 'neutral')) },
        { label: 'Registro', get: (m) => el('span', { class: 'small' }, [m.decisor, m.decisao].filter(Boolean).join(': ')) },
      ],
      empty: 'Nenhum marco. Inclua pelo menos a aprovação do plano e o aceite final.',
    };
  }

  function governanca(p) {
    const out = el('div', { class: 'stack' });
    out.append(registro(p, 'marcos', marcoSpec(p)).node);
    out.append(registro(p, 'mudancas', {
      heading: 'Controle de mudanças', singular: 'Solicitação de mudança', title: (m) => `${m.codigo} ${m.descricao}`,
      sub: 'Toda alteração de escopo, prazo ou custo da linha de base passa por análise de impacto e decisão.',
      defaults: () => {
        const n = Math.max(0, ...(p.mudancas || []).map((m) => parseInt(String(m.codigo || '').replace(/\D/g, ''), 10) || 0)) + 1;
        return { codigo: `CR-${String(n).padStart(2, '0')}`, data: hoje(), status: 'analise' };
      },
      fields: () => [
        { key: 'codigo', label: 'Código' },
        { key: 'data', label: 'Data', type: 'date' },
        { key: 'descricao', label: 'Mudança solicitada', type: 'textarea', required: true, full: true },
        { key: 'solicitante', label: 'Solicitante' },
        { key: 'status', label: 'Situação', type: 'select', options: STATUS_MUDANCA },
        { key: 'impactoEscopo', label: 'Impacto no escopo e na qualidade', type: 'textarea', full: true },
        { key: 'impactoPrazo', label: 'Impacto no prazo (dias)', type: 'number', step: 1 },
        { key: 'impactoCusto', label: 'Impacto no custo (R$)', type: 'money' },
        { key: 'decisao', label: 'Decisão e justificativa', type: 'textarea', full: true },
      ],
      sort: (a, b) => String(b.data).localeCompare(String(a.data)),
      cols: [
        { label: 'Cód.', get: (m) => el('span', { class: 'mono' }, m.codigo) },
        { label: 'Data', cls: 'num', get: (m) => UI.dateShort(m.data) },
        { label: 'Mudança', get: (m) => el('div', { class: 'cell-title' }, el('span', null, m.descricao), el('small', { class: 'muted' }, m.solicitante || '')) },
        { label: 'Prazo', cls: 'num', get: (m) => (m.impactoPrazo ? `+${m.impactoPrazo} d` : '—') },
        { label: 'Custo', cls: 'num', get: (m) => (m.impactoCusto ? UI.moneyK(Calc.num(m.impactoCusto)) : '—') },
        { label: 'Situação', get: (m) => UI.pill(Ref.label(STATUS_MUDANCA, m.status), { aprovada: 'ok', rejeitada: 'neutral', analise: 'warn' }[m.status]) },
      ],
      empty: 'Nenhuma solicitação de mudança.',
    }).node);
    out.append(registro(p, 'questoes', {
      heading: 'Questões e decisões', singular: 'Questão ou decisão', title: (q) => q.descricao,
      sub: 'Problemas que já estão acontecendo (questões) e decisões tomadas, com responsável e prazo.',
      defaults: () => ({ data: hoje(), tipo: 'questao', status: 'aberta' }),
      fields: () => [
        { key: 'tipo', label: 'Tipo', type: 'select', options: [['questao', 'Questão (problema)'], ['decisao', 'Decisão']] },
        { key: 'data', label: 'Data', type: 'date' },
        { key: 'descricao', label: 'Descrição', type: 'textarea', required: true, full: true },
        { key: 'responsavel', label: 'Responsável', datalist: (p.equipe || []).map((m) => m.nome) },
        { key: 'prazo', label: 'Prazo', type: 'date' },
        { key: 'status', label: 'Situação', type: 'select', options: [['aberta', 'Aberta'], ['fechada', 'Fechada']] },
      ],
      sort: (a, b) => (a.status === b.status ? String(b.data).localeCompare(String(a.data)) : a.status === 'aberta' ? -1 : 1),
      cols: [
        { label: 'Tipo', get: (q) => UI.pill(q.tipo === 'decisao' ? 'Decisão' : 'Questão', q.tipo === 'decisao' ? 'accent' : 'neutral') },
        { label: 'Descrição', get: (q) => q.descricao },
        { label: 'Responsável', get: (q) => q.responsavel || '—' },
        { label: 'Prazo', cls: 'num', get: (q) => el('span', { class: `mono${q.status === 'aberta' && q.prazo && q.prazo < hoje() ? ' text-bad' : ''}` }, UI.dateShort(q.prazo)) },
        { label: 'Situação', get: (q) => UI.pill(q.status === 'aberta' ? 'Aberta' : 'Fechada', q.status === 'aberta' ? 'warn' : 'neutral') },
      ],
      empty: 'Nenhuma questão ou decisão registrada.',
    }).node);
    return out;
  }

  // ---------- Encerramento ----------

  function encerramento(p) {
    const out = el('div', { class: 'stack' });
    if (!p.encerramento) p.encerramento = {};
    const feitos = Ref.CHECKLIST_ENCERRAMENTO.filter(([k]) => p.encerramento[k]).length;
    const total = Ref.CHECKLIST_ENCERRAMENTO.length;
    const beneficio = el('textarea', { id: 'enc-beneficio', rows: 4, placeholder: 'Ex.: refugo caiu de 4,2% para 1,4% (R$ 31 mil/mês). Comparar com o caso de negócio.' });
    beneficio.value = p.beneficioRealizado || '';
    out.append(el('div', { class: 'grid-2' },
      el('section', { class: 'card' },
        el('div', { class: 'card-head' }, el('h2', null, 'Checklist de encerramento'), el('span', { class: 'mono small' }, `${feitos}/${total}`)),
        UI.bar(feitos / total, feitos === total ? 'ok' : ''),
        el('ul', { class: 'checklist' }, Ref.CHECKLIST_ENCERRAMENTO.map(([k, l]) => {
          const cb = el('input', { type: 'checkbox', id: `enc-${k}`, onchange: (e) => { p.encerramento[k] = e.target.checked; save(p); App.render(); } });
          cb.checked = !!p.encerramento[k];
          return el('li', null, el('label', { class: 'check', for: `enc-${k}` }, cb, el('span', null, l)));
        }))),
      el('section', { class: 'card' },
        el('h2', null, 'Benefícios realizados'),
        el('p', { class: 'muted small' }, 'O valor é medido no resultado, não só na entrega. Atualize também os indicadores no Termo de abertura.'),
        el('label', { for: 'enc-beneficio', class: 'sr-only' }, 'Benefícios realizados'), beneficio,
        el('div', { class: 'row end' },
          el('button', { class: 'btn', onclick: () => { p.beneficioRealizado = beneficio.value.trim(); save(p); UI.toast('Benefícios salvos.'); } }, 'Salvar'),
          p.status === 'concluido' ? UI.pill(`Encerrado em ${UI.date(p.encerradoEm)}`, 'ok') : el('button', { class: 'btn btn-primary', onclick: () => {
            const falta = total - feitos;
            UI.confirmAction('Encerrar projeto', falta ? `Ainda há ${falta} item(ns) do checklist pendente(s). Encerrar mesmo assim?` : 'O projeto será marcado como concluído.', 'Encerrar projeto', () => {
              p.beneficioRealizado = beneficio.value.trim();
              p.status = 'concluido'; p.fase = 'encerramento'; p.encerradoEm = hoje();
              save(p); App.render(); UI.toast('Projeto encerrado.');
            });
          } }, 'Encerrar projeto')))));
    out.append(registro(p, 'licoes', {
      heading: 'Lições aprendidas', singular: 'Lição aprendida', title: (l) => l.descricao,
      sub: 'Registre durante todo o projeto, não só no fim. Elas alimentam os próximos projetos.',
      defaults: () => ({ data: hoje(), categoria: 'melhorar' }),
      fields: () => [
        { key: 'data', label: 'Data', type: 'date' },
        { key: 'fase', label: 'Fase', datalist: fases(p) },
        { key: 'categoria', label: 'Categoria', type: 'select', options: [['funcionou', 'O que funcionou (repetir)'], ['melhorar', 'O que melhorar']] },
        { key: 'descricao', label: 'O que aconteceu', type: 'textarea', required: true, full: true },
        { key: 'recomendacao', label: 'Recomendação para próximos projetos', type: 'textarea', full: true },
      ],
      sort: (a, b) => String(b.data).localeCompare(String(a.data)),
      cols: [
        { label: 'Data', cls: 'num', get: (l) => UI.dateShort(l.data) },
        { label: 'Categoria', get: (l) => UI.pill(l.categoria === 'funcionou' ? 'Funcionou' : 'Melhorar', l.categoria === 'funcionou' ? 'ok' : 'warn') },
        { label: 'Fase', get: (l) => l.fase || '' },
        { label: 'Lição', get: (l) => el('div', { class: 'cell-title' }, el('span', null, l.descricao), l.recomendacao ? el('small', { class: 'muted' }, `→ ${l.recomendacao}`) : null) },
      ],
      empty: 'Nenhuma lição registrada.',
    }).node);
    return out;
  }

  window.Projeto = { render };
})();
