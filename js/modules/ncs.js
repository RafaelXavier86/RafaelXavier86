/* Não Conformidades e 8D — IATF 16949 — 8.7 (produto não conforme) e 10.2 (ação corretiva). */
(function () {
  'use strict';
  const { el, badge, fmtDate } = UI;

  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const daysOpen = (r) => (r.dataAbertura ? daysBetween(r.dataAbertura, r.dataFechamento || UI.today()) : null);

  App.register({
    id: 'ncs',
    collection: 'ncs',
    group: 'Lançamentos',
    icon: '✖',
    title: 'Não Conformidades / 8D',
    short: 'NC / 8D',
    clause: 'IATF 16949 — 8.7 / 10.2.3 / 10.2.4',
    description: 'Registro de não conformidades internas, de cliente e de fornecedor com tratamento pela metodologia 8D.',
    recordTitle: (r) => `${r.numero || 'NC'} — ${r.titulo || r.codigoPeca || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('ncs', 'NC'), dataAbertura: UI.today(), status: 'Aberta' }),
    fields: [
      { key: 'numero', label: 'Nº NC / 8D', required: true },
      { key: 'dataAbertura', label: 'Data de abertura', type: 'date', required: true },
      { key: 'origem', label: 'Origem', type: 'select', options: ['Interna', 'Cliente', 'Fornecedor', 'Auditoria', 'Campo / Garantia'], required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Aberta', 'Em análise', 'Aguardando verificação', 'Fechada'], required: true },
      { key: 'titulo', label: 'Título / Problema', span: 2, required: true },
      { key: 'codigoPeca', label: 'Código da peça' },
      { key: 'descricaoPeca', label: 'Descrição da peça' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'lote', label: 'Lote(s) afetado(s)' },
      { key: 'qtdAfetada', label: 'Qtd. afetada', type: 'number' },
      { key: 'referencia', label: 'Referência (inspeção, reclamação)' },
      { key: 'gravidade', label: 'Gravidade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Crítica (segurança)'] },
      { key: 'prazo', label: 'Prazo de fechamento', type: 'date' },
      { key: 'dataFechamento', label: 'Data de fechamento', type: 'date' },
      { type: 'section', label: 'Metodologia 8D' },
      { key: 'd1', label: 'D1 — Equipe', type: 'textarea', span: 4, rows: 2 },
      { key: 'd2', label: 'D2 — Descrição do problema (5W2H)', type: 'textarea', span: 4 },
      { key: 'd3', label: 'D3 — Ações de contenção (estoque, trânsito, cliente)', type: 'textarea', span: 4 },
      { key: 'd4', label: 'D4 — Causa raiz (ocorrência e não detecção — 5 porquês / Ishikawa)', type: 'textarea', span: 4, rows: 4 },
      { key: 'd5', label: 'D5 — Ações corretivas permanentes escolhidas', type: 'textarea', span: 4 },
      { key: 'd6', label: 'D6 — Implementação e validação da eficácia', type: 'textarea', span: 4 },
      { key: 'd7', label: 'D7 — Prevenção da recorrência (atualizar FMEA, Plano de Controle, lições aprendidas, poka-yoke)', type: 'textarea', span: 4 },
      { key: 'd8', label: 'D8 — Reconhecimento da equipe e encerramento', type: 'textarea', span: 4, rows: 2 },
      { key: 'fmeaAtualizada', label: 'FMEA atualizada', type: 'checkbox' },
      { key: 'pcAtualizado', label: 'Plano de Controle atualizado', type: 'checkbox' },
      { key: 'eficaciaVerificada', label: 'Eficácia verificada', type: 'checkbox' },
      { key: 'licaoAprendida', label: 'Lição aprendida registrada', type: 'checkbox' },
    ],
    beforeSave(rec) {
      if (rec.status === 'Fechada' && !rec.dataFechamento) rec.dataFechamento = UI.today();
    },
    validate(rec) {
      if (rec.status !== 'Fechada') return [];
      const missing = ['d3', 'd4', 'd5', 'd6'].filter((k) => !rec[k]);
      return missing.length ? [`Para fechar a NC preencha ${missing.map((k) => k.toUpperCase()).join(', ')}.`] : [];
    },
    analysisTitle: 'Situação',
    analysis(rec) {
      const done = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'].filter((k) => rec[k]).length;
      const late = rec.status !== 'Fechada' && rec.prazo && rec.prazo < UI.today();
      const pending = rec.status === 'Fechada' ? [] : [
        !rec.fmeaAtualizada && 'atualização da FMEA', !rec.pcAtualizado && 'atualização do Plano de Controle',
        !rec.eficaciaVerificada && 'verificação de eficácia', !rec.licaoAprendida && 'registro de lição aprendida'].filter(Boolean);
      return el('div', { class: 'stack' },
        Common.progress((100 * done) / 8, `Disciplinas preenchidas: ${done} de 8`),
        el('div', { class: 'kpis' },
          Common.kpi('Status', rec.status || '—', UI.levelOf(rec.status)),
          Common.kpi('Dias em aberto', daysOpen(rec) ?? '—', late ? 'bad' : 'neutral', late ? 'Prazo vencido' : null)),
        rec.origem === 'Cliente' ? el('p', { class: 'muted' }, 'Reclamação de cliente: verifique o prazo de resposta e o formato de 8D exigido nos requisitos específicos do cliente (IATF 10.2.5).') : null,
        pending.length ? el('div', { class: 'alert alert-warn' }, 'Pendências antes do fechamento: ', pending.join(', '), '.') : null);
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'dataAbertura', label: 'Abertura', render: (r) => fmtDate(r.dataAbertura) },
      { key: 'origem', label: 'Origem' },
      { key: 'titulo', label: 'Problema' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'dias', label: 'Dias', render: (r) => daysOpen(r) ?? '—' },
      { key: 'status', label: 'Status', render: (r) => badge(r.status || '—', r.status !== 'Fechada' && r.prazo && r.prazo < UI.today() ? 'bad' : UI.levelOf(r.status)) },
    ],
    csv(records) {
      const headers = ['Nº', 'Abertura', 'Origem', 'Status', 'Título', 'Peça', 'Cliente', 'Fornecedor', 'Lote', 'Qtd afetada', 'Gravidade', 'Prazo', 'Fechamento', 'Dias',
        'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
      return {
        headers,
        rows: records.map((r) => [r.numero, fmtDate(r.dataAbertura), r.origem, r.status, r.titulo, r.codigoPeca, r.cliente, r.fornecedor, r.lote, r.qtdAfetada, r.gravidade,
          fmtDate(r.prazo), fmtDate(r.dataFechamento), daysOpen(r), r.d1, r.d2, r.d3, r.d4, r.d5, r.d6, r.d7, r.d8]),
      };
    },
  });

  window.NCs = { daysOpen };
})();
