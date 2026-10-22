/* PPAP — Processo de Aprovação de Peça de Produção (Manual AIAG PPAP 4ª ed.; IATF 8.3.4.4). */
(function () {
  'use strict';
  const { el, badge, fmtDate } = UI;

  // Requisitos por nível de submissão: S = submeter ao cliente, R = reter na organização, * = conforme cliente
  const ELEMENTOS = [
    ['1', 'Registros de projeto', 'RSS*R'],
    ['2', 'Documentos de alteração de engenharia', 'RSS*R'],
    ['3', 'Aprovação de engenharia do cliente', 'RRS*R'],
    ['4', 'DFMEA', 'RRS*R'],
    ['5', 'Fluxograma do processo', 'RRS*R'],
    ['6', 'PFMEA', 'RRS*R'],
    ['7', 'Plano de Controle', 'RRS*R'],
    ['8', 'Estudos de Análise do Sistema de Medição (MSA)', 'RRS*R'],
    ['9', 'Resultados dimensionais', 'RSS*R'],
    ['10', 'Registros de ensaios de material / desempenho', 'RSS*R'],
    ['11', 'Estudos iniciais do processo (capabilidade)', 'RRS*R'],
    ['12', 'Documentação de laboratório qualificado', 'RSS*R'],
    ['13', 'Relatório de Aprovação de Aparência (AAR)', 'SSS*R'],
    ['14', 'Amostras de peças de produção', 'RSS*R'],
    ['15', 'Amostra padrão', 'RRR*R'],
    ['16', 'Dispositivos de controle', 'RRR*R'],
    ['17', 'Requisitos específicos do cliente', 'RRS*R'],
    ['18', 'Certificado de Submissão de Peça (PSW)', 'SSSSR'],
  ];
  const REQ_LABEL = { S: 'Submeter', R: 'Reter', '*': 'Conforme cliente' };

  function prepare(rec) {
    const old = rec.elementos || [];
    rec.elementos = ELEMENTOS.map(([n, nome]) => Object.assign({ status: 'Pendente' }, old.find((e) => e.n === n) || {}, { n, elemento: `${n}. ${nome}` }));
  }

  const req = (row, rec) => {
    const lvl = Number(rec.nivel) || 3;
    const e = ELEMENTOS.find((x) => x[0] === row.n);
    return e ? e[2][lvl - 1] : null;
  };

  function progress(rec) {
    const els = rec.elementos || [];
    const applicable = els.filter((e) => e.status !== 'N/A');
    const done = applicable.filter((e) => e.status === 'Concluído').length;
    return { done, total: applicable.length, pct: applicable.length ? (100 * done) / applicable.length : 0 };
  }

  App.register({
    id: 'ppap',
    collection: 'ppap',
    group: 'Core Tools',
    icon: '✉',
    title: 'PPAP — Aprovação de Peça de Produção',
    short: 'PPAP',
    clause: 'Manual PPAP AIAG 4ª ed. · IATF 16949 — 8.3.4.4',
    description: 'Controle dos 18 elementos do PPAP por nível de submissão e status do PSW.',
    recordTitle: (r) => `${r.numero || 'PPAP'} — ${r.codigoPeca || ''} ${r.descricaoPeca || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('ppap', 'PPAP'), nivel: '3', statusPSW: 'Pendente' }),
    prepare,
    fields: [
      { key: 'numero', label: 'Nº PPAP', required: true },
      { key: 'codigoPeca', label: 'Código da peça', required: true },
      { key: 'descricaoPeca', label: 'Descrição da peça', span: 2 },
      { key: 'revisaoDesenho', label: 'Nível de alteração do desenho' },
      { key: 'cliente', label: 'Cliente', required: true },
      { key: 'nivel', label: 'Nível de submissão', type: 'select', options: [['1', 'Nível 1 — somente PSW'], ['2', 'Nível 2 — PSW + amostras e dados limitados'], ['3', 'Nível 3 — PSW + amostras e dados completos'], ['4', 'Nível 4 — conforme cliente'], ['5', 'Nível 5 — revisão na planta']], rerender: true, required: true },
      {
        key: 'motivo', label: 'Motivo da submissão', type: 'select', span: 2, options: ['Submissão inicial', 'Alteração de engenharia', 'Ferramental: transferência, reposição, reparo', 'Correção de discrepância',
          'Ferramental inativo > 1 ano', 'Alteração de material / construção opcional', 'Alteração de subfornecedor ou fonte de material', 'Alteração no processamento', 'Peças produzidas em outro local', 'Outro'],
      },
      { key: 'dataSubmissao', label: 'Data de submissão', type: 'date' },
      { key: 'dataAprovacao', label: 'Data de aprovação', type: 'date' },
      { key: 'statusPSW', label: 'Status do PSW', type: 'select', options: ['Pendente', 'Em análise', 'Aprovado', 'Aprovação interina', 'Rejeitado'] },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'pesoPeca', label: 'Peso da peça (kg)', type: 'number' },
      { key: 'imds', label: 'Nº IMDS / Material' },
      { key: 'observacoes', label: 'Observações', type: 'textarea', span: 4 },
    ],
    rows: {
      key: 'elementos',
      title: 'Elementos do PPAP',
      fixed: true,
      columns: [
        { key: 'elemento', label: 'Elemento', readonly: true },
        { key: '_req', label: 'Requisito', computed: (r, rec) => { const v = req(r, rec); return v ? { text: REQ_LABEL[v], level: v === 'S' ? 'warn' : 'neutral' } : null; } },
        { key: 'status', label: 'Status', type: 'select', options: Common.STATUS_ACAO, width: '120px' },
        { key: 'responsavel', label: 'Responsável', width: '120px' },
        { key: 'prazo', label: 'Prazo', type: 'date', width: '130px' },
        { key: 'documento', label: 'Documento / Referência', width: '160px' },
        { key: '_sit', label: 'Situação', computed: (r) => (Common.isLate(r.prazo, r.status) ? 'Atrasado' : null) },
      ],
    },
    analysisTitle: 'Andamento do PPAP',
    analysis(rec) {
      const p = progress(rec);
      const late = (rec.elementos || []).filter((e) => Common.isLate(e.prazo, e.status));
      const submitPending = (rec.elementos || []).filter((e) => req(e, rec) === 'S' && e.status !== 'Concluído' && e.status !== 'N/A');
      return el('div', { class: 'stack' },
        Common.progress(p.pct, `Elementos concluídos: ${p.done} de ${p.total}`),
        el('div', { class: 'kpis' },
          Common.kpi('Status do PSW', rec.statusPSW || '—', UI.levelOf(rec.statusPSW)),
          Common.kpi('Pendentes para submissão', submitPending.length, submitPending.length ? 'warn' : 'ok'),
          Common.kpi('Atrasados', late.length, late.length ? 'bad' : 'ok')),
        el('p', { class: 'muted' }, 'Lembre-se de vincular os estudos de MSA (elemento 8) e de capabilidade (elemento 11, Ppk ≥ 1,67) cadastrados nos módulos correspondentes.'));
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'nivel', label: 'Nível' },
      { key: 'motivo', label: 'Motivo' },
      { key: 'progresso', label: 'Progresso', render: (r) => `${Math.round(progress(r).pct)}%` },
      { key: 'statusPSW', label: 'PSW', render: (r) => badge(r.statusPSW || '—', UI.levelOf(r.statusPSW)) },
      { key: 'dataSubmissao', label: 'Submissão', render: (r) => fmtDate(r.dataSubmissao) },
    ],
    csv(records) {
      const headers = ['Nº PPAP', 'Peça', 'Cliente', 'Nível', 'Motivo', 'Status PSW', 'Elemento', 'Requisito', 'Status', 'Responsável', 'Prazo', 'Documento'];
      const rows = [];
      records.forEach((r) => (r.elementos || []).forEach((e) => rows.push([r.numero, r.codigoPeca, r.cliente, r.nivel, r.motivo, r.statusPSW,
        e.elemento, REQ_LABEL[req(e, r)] || '', e.status, e.responsavel, fmtDate(e.prazo), e.documento])));
      return { headers, rows };
    },
  });

  window.PPAP = { progress };
})();
