/* FMEA de Processo / Projeto — Manual AIAG-VDA (2019) com Prioridade de Ação (AP). IATF 8.3.5 / 9.1.2.1. */
(function () {
  'use strict';
  const { el, badge, fmtDate } = UI;
  const AP_LABEL = { H: 'Alta', M: 'Média', L: 'Baixa' };
  const RATING = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  const ap = (r) => Calc.actionPriority(r.s, r.o, r.d);
  const apCell = (r) => { const v = ap(r); return v ? { text: `${v} — ${AP_LABEL[v]}`, level: UI.levelOf(v) } : null; };
  const rpn = (r) => { const s = Calc.num(r.s), o = Calc.num(r.o), d = Calc.num(r.d); return s && o && d ? s * o * d : null; };

  App.register({
    id: 'fmea',
    collection: 'fmea',
    group: 'Core Tools',
    icon: '⚠',
    title: 'FMEA — Análise de Modo e Efeito de Falha',
    short: 'FMEA',
    clause: 'Manual AIAG-VDA 2019 · IATF 16949 — 8.3.5.2 / 9.1.2.1',
    description: 'PFMEA e DFMEA com severidade, ocorrência, detecção e Prioridade de Ação (AP).',
    recordTitle: (r) => `${r.numero || 'FMEA'} — ${r.tipo || ''} ${r.item || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('fmea', 'FMEA'), tipo: 'PFMEA', dataInicio: UI.today(), revisao: '00', itens: [] }),
    fields: [
      { key: 'numero', label: 'Nº da FMEA', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['PFMEA', 'DFMEA'], required: true },
      { key: 'item', label: 'Item / Processo', required: true, span: 2 },
      { key: 'codigoPeca', label: 'Código da peça' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'modelo', label: 'Modelo / Programa' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'dataInicio', label: 'Data de início', type: 'date' },
      { key: 'revisao', label: 'Revisão' },
      { key: 'dataRevisao', label: 'Data da revisão', type: 'date' },
      { key: 'confidencialidade', label: 'Confidencialidade', type: 'select', options: ['Uso interno', 'Proprietário', 'Confidencial'] },
      { key: 'equipe', label: 'Equipe multifuncional', type: 'textarea', span: 4, rows: 2 },
    ],
    rows: {
      key: 'itens',
      title: 'Análise de falhas',
      columns: [
        { key: 'etapa', label: 'Etapa / Elemento', width: '130px' },
        { key: 'funcao', label: 'Função / Requisito', width: '140px' },
        { key: 'modo', label: 'Modo de falha', width: '140px' },
        { key: 'efeito', label: 'Efeito da falha', width: '140px' },
        { key: 's', label: 'S', type: 'select', options: RATING, width: '58px' },
        { key: 'classe', label: 'Classe', type: 'select', options: [['', '—'], 'CC', 'SC'], width: '64px' },
        { key: 'causa', label: 'Causa da falha', width: '140px' },
        { key: 'prevencao', label: 'Controle de prevenção', width: '140px' },
        { key: 'o', label: 'O', type: 'select', options: RATING, width: '58px' },
        { key: 'deteccao', label: 'Controle de detecção', width: '140px' },
        { key: 'd', label: 'D', type: 'select', options: RATING, width: '58px' },
        { key: '_ap', label: 'AP', computed: apCell },
        { key: '_rpn', label: 'NPR*', computed: (r) => { const v = rpn(r); return v ? { text: String(v), level: 'neutral' } : null; } },
        { key: 'acao', label: 'Ação recomendada', width: '150px' },
        { key: 'responsavel', label: 'Responsável', width: '100px' },
        { key: 'prazo', label: 'Prazo', type: 'date', width: '130px' },
        { key: 'status', label: 'Status', type: 'select', options: Common.STATUS_ACAO, width: '110px' },
      ],
    },
    analysisTitle: 'Prioridade de Ação',
    analysis(rec) {
      const itens = rec.itens || [];
      const counts = { H: 0, M: 0, L: 0 };
      itens.forEach((i) => { const v = ap(i); if (v) counts[v]++; });
      const highOpen = itens.filter((i) => ap(i) === 'H' && (!i.acao || (i.status !== 'Concluído' && i.status !== 'N/A')));
      const late = itens.filter((i) => Common.isLate(i.prazo, i.status));
      return el('div', { class: 'stack' },
        el('div', { class: 'kpis' },
          Common.kpi('Modos de falha', itens.length),
          Common.kpi('AP Alta', counts.H, counts.H ? 'bad' : 'ok'),
          Common.kpi('AP Média', counts.M, counts.M ? 'warn' : 'neutral'),
          Common.kpi('AP Baixa', counts.L, 'ok'),
          Common.kpi('AP Alta sem ação concluída', highOpen.length, highOpen.length ? 'bad' : 'ok'),
          Common.kpi('Ações atrasadas', late.length, late.length ? 'bad' : 'ok')),
        highOpen.length ? el('div', { class: 'alert alert-bad' }, 'Itens com AP Alta exigem ação para melhorar a prevenção e/ou detecção, ou justificativa documentada: ',
          highOpen.map((i) => i.modo || i.etapa).filter(Boolean).join('; '), '.') : null,
        el('p', { class: 'muted' }, '* O NPR (S×O×D) é exibido apenas como referência; o Manual AIAG-VDA utiliza a Prioridade de Ação (AP) para priorizar as ações.'));
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'item', label: 'Item / Processo' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'revisao', label: 'Rev.' },
      { key: 'h', label: 'AP Alta', render: (r) => { const n = (r.itens || []).filter((i) => ap(i) === 'H').length; return badge(String(n), n ? 'bad' : 'ok'); } },
      { key: 'itens', label: 'Itens', render: (r) => (r.itens || []).length },
      { key: 'atualizadoEm', label: 'Atualizado', render: (r) => fmtDate(r.atualizadoEm) },
    ],
    csv(records) {
      const headers = ['Nº FMEA', 'Tipo', 'Item', 'Peça', 'Etapa', 'Função', 'Modo de falha', 'Efeito', 'S', 'Classe', 'Causa', 'Prevenção', 'O', 'Detecção', 'D', 'AP', 'NPR', 'Ação', 'Responsável', 'Prazo', 'Status'];
      const rows = [];
      records.forEach((r) => (r.itens || []).forEach((i) => rows.push([r.numero, r.tipo, r.item, r.codigoPeca, i.etapa, i.funcao, i.modo, i.efeito, i.s, i.classe,
        i.causa, i.prevencao, i.o, i.deteccao, i.d, ap(i) || '', rpn(i) || '', i.acao, i.responsavel, fmtDate(i.prazo), i.status])));
      return { headers, rows };
    },
  });

  window.FMEA = { ap };
})();
