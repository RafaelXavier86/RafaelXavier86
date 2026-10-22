/* Plano de Controle (AIAG APQP / IATF 16949 — 8.5.1.1 e Anexo A). */
(function () {
  'use strict';
  const { badge, fmtDate } = UI;

  App.register({
    id: 'planos',
    collection: 'planos',
    group: 'Core Tools',
    icon: '☰',
    title: 'Plano de Controle',
    short: 'Plano de Controle',
    clause: 'IATF 16949 — 8.5.1.1 / Anexo A',
    description: 'Características de produto e processo, métodos de controle e planos de reação. Base para as inspeções.',
    recordTitle: (r) => `${r.numero || 'PC'} — ${r.codigoPeca || ''} ${r.descricaoPeca || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('planos', 'PC'), fase: 'Produção', revisao: '00', dataRevisao: UI.today(), itens: [] }),
    fields: [
      { key: 'numero', label: 'Nº do Plano', required: true },
      { key: 'fase', label: 'Fase', type: 'select', options: ['Protótipo', 'Pré-lançamento', 'Produção', 'Safe Launch'], required: true },
      { key: 'revisao', label: 'Revisão' },
      { key: 'dataRevisao', label: 'Data da revisão', type: 'date' },
      { key: 'codigoPeca', label: 'Código da peça', required: true },
      { key: 'descricaoPeca', label: 'Descrição da peça', span: 2 },
      { key: 'nivelAlteracao', label: 'Nível de alteração (desenho)' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'fornecedor', label: 'Organização / Planta' },
      { key: 'contato', label: 'Contato principal' },
      { key: 'equipe', label: 'Equipe multifuncional', span: 1 },
      { key: 'aprovacaoEngCliente', label: 'Aprovação eng. cliente (data)', type: 'date' },
      { key: 'aprovacaoQualCliente', label: 'Aprovação qualidade cliente (data)', type: 'date' },
    ],
    rows: {
      key: 'itens',
      title: 'Itens do Plano de Controle',
      columns: [
        { key: 'operacao', label: 'Nº / Operação', width: '130px' },
        { key: 'maquina', label: 'Máquina / Dispositivo', width: '130px' },
        { key: 'numCaracteristica', label: 'Nº carac.', width: '60px' },
        { key: 'caracteristica', label: 'Característica', width: '160px' },
        { key: 'tipo', label: 'Produto / Processo', type: 'select', options: ['Produto', 'Processo'], width: '100px' },
        { key: 'classe', label: 'Classe', type: 'select', options: [['', '—'], 'CC', 'SC'], width: '70px' },
        { key: 'nominal', label: 'Nominal', type: 'number', width: '75px' },
        { key: 'lie', label: 'LIE', type: 'number', width: '75px' },
        { key: 'lse', label: 'LSE', type: 'number', width: '75px' },
        { key: 'metodo', label: 'Técnica de medição', width: '120px' },
        { key: 'amostra', label: 'Amostra (tam.)', width: '70px' },
        { key: 'frequencia', label: 'Frequência', width: '100px' },
        { key: 'controle', label: 'Método de controle', width: '130px' },
        { key: 'reacao', label: 'Plano de reação', width: '160px' },
      ],
      newRow: () => ({ tipo: 'Produto' }),
    },
    analysisTitle: 'Resumo',
    analysis(rec) {
      const itens = rec.itens || [];
      const cc = itens.filter((i) => i.classe === 'CC').length;
      const sc = itens.filter((i) => i.classe === 'SC').length;
      const semReacao = itens.filter((i) => !i.reacao).length;
      return UI.el('div', { class: 'stack' },
        UI.el('div', { class: 'kpis' },
          Common.kpi('Itens', itens.length),
          Common.kpi('Características CC', cc, cc ? 'bad' : 'neutral'),
          Common.kpi('Características SC', sc, sc ? 'warn' : 'neutral'),
          Common.kpi('Sem plano de reação', semReacao, semReacao ? 'warn' : 'ok')),
        semReacao ? UI.el('div', { class: 'alert alert-warn' }, 'Todo item do Plano de Controle deve ter um plano de reação definido (IATF 8.5.1.1).') : null);
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'descricaoPeca', label: 'Descrição' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'fase', label: 'Fase', render: (r) => badge(r.fase || '—', 'neutral') },
      { key: 'revisao', label: 'Rev.' },
      { key: 'dataRevisao', label: 'Data rev.', render: (r) => fmtDate(r.dataRevisao) },
      { key: 'itens', label: 'Itens', render: (r) => (r.itens || []).length },
    ],
    csv(records) {
      const headers = ['Nº plano', 'Fase', 'Revisão', 'Peça', 'Descrição', 'Cliente', 'Operação', 'Máquina', 'Nº carac.', 'Característica', 'Tipo', 'Classe',
        'Nominal', 'LIE', 'LSE', 'Técnica de medição', 'Amostra', 'Frequência', 'Método de controle', 'Plano de reação'];
      const rows = [];
      records.forEach((r) => (r.itens || []).forEach((i) => rows.push([r.numero, r.fase, r.revisao, r.codigoPeca, r.descricaoPeca, r.cliente,
        i.operacao, i.maquina, i.numCaracteristica, i.caracteristica, i.tipo, i.classe, i.nominal, i.lie, i.lse, i.metodo, i.amostra, i.frequencia, i.controle, i.reacao])));
      return { headers, rows };
    },
  });
})();
