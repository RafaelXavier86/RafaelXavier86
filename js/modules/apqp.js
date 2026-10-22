/* APQP — Planejamento Avançado da Qualidade do Produto (Manual AIAG APQP 2ª ed.; IATF 8.3). */
(function () {
  'use strict';
  const { el, badge, fmtDate } = UI;

  const FASES = [
    ['1', 'Planejar e definir o programa', [
      'Voz do cliente', 'Plano de negócios / estratégia de marketing', 'Benchmark de produto e processo', 'Premissas de produto e processo',
      'Estudos de confiabilidade do produto', 'Metas de projeto', 'Metas de confiabilidade e qualidade', 'Lista preliminar de materiais',
      'Fluxograma preliminar do processo', 'Lista preliminar de características especiais', 'Plano de garantia do produto', 'Apoio da gerência (fase 1)',
    ]],
    ['2', 'Projeto e desenvolvimento do produto', [
      'DFMEA', 'Projeto para manufatura e montagem (DFM/DFA)', 'Verificação do projeto', 'Análises críticas de projeto', 'Plano de Controle de protótipo',
      'Desenhos de engenharia', 'Especificações de engenharia e de materiais', 'Alterações de desenhos e especificações', 'Requisitos de equipamentos e ferramental',
      'Características especiais de produto e processo', 'Requisitos de dispositivos de controle', 'Comprometimento de viabilidade da equipe',
    ]],
    ['3', 'Projeto e desenvolvimento do processo', [
      'Padrões e especificações de embalagem', 'Análise crítica do sistema da qualidade', 'Fluxograma do processo', 'Layout das instalações',
      'Matriz de características', 'PFMEA', 'Plano de Controle de pré-lançamento', 'Instruções de processo', 'Plano de análise dos sistemas de medição',
      'Plano de estudo preliminar de capabilidade', 'Apoio da gerência (fase 3)',
    ]],
    ['4', 'Validação do produto e do processo', [
      'Corrida piloto de produção significativa', 'Avaliação dos sistemas de medição (MSA)', 'Estudo preliminar de capabilidade do processo',
      'Aprovação de peça de produção (PPAP)', 'Testes de validação da produção', 'Avaliação de embalagem', 'Plano de Controle de produção',
      'Aprovação do planejamento da qualidade e apoio da gerência',
    ]],
    ['5', 'Retroalimentação, avaliação e ação corretiva', [
      'Redução de variação', 'Melhoria da satisfação do cliente', 'Melhoria de entrega e assistência técnica', 'Uso efetivo de lições aprendidas / melhores práticas',
    ]],
  ];

  function prepare(rec) {
    const old = rec.entregaveis || [];
    const rows = [];
    FASES.forEach(([f, nomeFase, itens]) => itens.forEach((nome, i) => {
      const id = `${f}.${i + 1}`;
      rows.push(Object.assign({ status: 'Pendente' }, old.find((o) => o.id === id) || {}, { id, fase: `Fase ${f}`, entregavel: `${id} ${nome}` }));
    }));
    rec.entregaveis = rows;
  }

  function phaseProgress(rec) {
    return FASES.map(([f, nome]) => {
      const items = (rec.entregaveis || []).filter((e) => e.fase === `Fase ${f}` && e.status !== 'N/A');
      const done = items.filter((e) => e.status === 'Concluído').length;
      return { fase: f, nome, done, total: items.length, pct: items.length ? (100 * done) / items.length : 0 };
    });
  }

  function overall(rec) {
    const items = (rec.entregaveis || []).filter((e) => e.status !== 'N/A');
    return items.length ? (100 * items.filter((e) => e.status === 'Concluído').length) / items.length : 0;
  }

  App.register({
    id: 'apqp',
    collection: 'apqp',
    group: 'Core Tools',
    icon: '◴',
    title: 'APQP — Planejamento Avançado da Qualidade',
    short: 'APQP',
    clause: 'Manual APQP AIAG 2ª ed. · IATF 16949 — 8.3',
    description: 'Acompanhamento das 5 fases do APQP com entregáveis, responsáveis e prazos.',
    recordTitle: (r) => `${r.projeto || 'Projeto APQP'} — ${r.codigoPeca || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('apqp', 'APQP'), dataInicio: UI.today() }),
    prepare,
    fields: [
      { key: 'numero', label: 'Nº do projeto', required: true },
      { key: 'projeto', label: 'Nome do projeto', required: true, span: 2 },
      { key: 'cliente', label: 'Cliente' },
      { key: 'codigoPeca', label: 'Código da peça' },
      { key: 'descricaoPeca', label: 'Descrição da peça' },
      { key: 'lider', label: 'Líder do projeto' },
      { key: 'equipe', label: 'Equipe multifuncional' },
      { key: 'dataInicio', label: 'Início', type: 'date' },
      { key: 'gate', label: 'Data de PPAP (meta)', type: 'date' },
      { key: 'sop', label: 'SOP (início de produção)', type: 'date' },
      { key: 'status', label: 'Status do projeto', type: 'select', options: ['Em andamento', 'Em risco', 'Concluído', 'Cancelado'] },
    ],
    rows: {
      key: 'entregaveis',
      title: 'Entregáveis por fase',
      fixed: true,
      columns: [
        { key: 'fase', label: 'Fase', readonly: true },
        { key: 'entregavel', label: 'Entregável', readonly: true },
        { key: 'status', label: 'Status', type: 'select', options: Common.STATUS_ACAO, width: '120px' },
        { key: 'responsavel', label: 'Responsável', width: '120px' },
        { key: 'prazo', label: 'Prazo', type: 'date', width: '130px' },
        { key: 'evidencia', label: 'Evidência / Observação', width: '180px' },
        { key: '_sit', label: 'Situação', computed: (r) => (Common.isLate(r.prazo, r.status) ? 'Atrasado' : null) },
      ],
    },
    analysisTitle: 'Andamento por fase',
    analysis(rec) {
      const late = (rec.entregaveis || []).filter((e) => Common.isLate(e.prazo, e.status));
      return el('div', { class: 'stack' },
        Common.progress(overall(rec), 'Projeto (geral)'),
        phaseProgress(rec).map((p) => Common.progress(p.pct, `Fase ${p.fase} — ${p.nome} (${p.done}/${p.total})`)),
        late.length ? el('div', { class: 'alert alert-bad' }, `${late.length} entregável(is) atrasado(s): `, late.map((e) => e.entregavel).join('; '), '.') : null);
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'projeto', label: 'Projeto' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'sop', label: 'SOP', render: (r) => fmtDate(r.sop) },
      { key: 'progresso', label: 'Progresso', render: (r) => `${Math.round(overall(r))}%` },
      { key: 'atrasados', label: 'Atrasados', render: (r) => { const n = (r.entregaveis || []).filter((e) => Common.isLate(e.prazo, e.status)).length; return badge(String(n), n ? 'bad' : 'ok'); } },
      { key: 'status', label: 'Status', render: (r) => badge(r.status || '—', r.status === 'Em risco' ? 'bad' : UI.levelOf(r.status)) },
    ],
    csv(records) {
      const headers = ['Nº', 'Projeto', 'Cliente', 'Peça', 'SOP', 'Fase', 'Entregável', 'Status', 'Responsável', 'Prazo', 'Evidência', 'Atrasado'];
      const rows = [];
      records.forEach((r) => (r.entregaveis || []).forEach((e) => rows.push([r.numero, r.projeto, r.cliente, r.codigoPeca, fmtDate(r.sop), e.fase, e.entregavel,
        e.status, e.responsavel, fmtDate(e.prazo), e.evidencia, Common.isLate(e.prazo, e.status) ? 'Sim' : 'Não'])));
      return { headers, rows };
    },
  });

  window.APQP = { overall };
})();
