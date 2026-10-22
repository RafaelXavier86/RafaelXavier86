/* Lançamento de inspeções de qualidade (IATF 16949 — 8.6 Liberação de produtos e 9.1). */
(function () {
  'use strict';
  const { el, badge, fmtDate } = UI;

  const TIPOS = [
    'Recebimento',
    'Primeira peça / Setup',
    'Processo (patrulha)',
    'Inspeção final',
    'Auditoria de produto',
    'Inspeção de layout (anual)',
    'Reinspeção / Seleção',
  ];
  const DISPOSICOES = ['Aprovado', 'Reprovado', 'Retrabalho', 'Segregado', 'Liberado sob desvio'];

  function rowResult(row) {
    return Calc.evaluate(row.medido, row.lie, row.lse) || row.atributo || null;
  }

  function overall(rec) {
    const results = (rec.caracteristicas || []).map(rowResult).filter(Boolean);
    if (!results.length) return '';
    return results.includes('NOK') ? 'NOK' : 'OK';
  }

  function loadFromControlPlan(rec, render, onChange) {
    const plans = Store.all('planos');
    const matching = plans.filter((p) => !rec.codigoPeca || p.codigoPeca === rec.codigoPeca);
    const list = matching.length ? matching : plans;
    if (!list.length) { UI.toast('Nenhum Plano de Controle cadastrado.', 'warn'); return; }
    const select = el('select', null, list.map((p) => el('option', { value: p.id }, `${p.numero || ''} — ${p.codigoPeca || ''} ${p.descricaoPeca || ''} (rev. ${p.revisao || '-'})`)));
    const onlyProduct = el('input', { type: 'checkbox', checked: true });
    UI.modal('Carregar características do Plano de Controle', el('div', { class: 'stack' },
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Plano de Controle'), select),
      el('label', { class: 'check' }, onlyProduct, ' Somente características de produto')), [
      { label: 'Cancelar' },
      {
        label: 'Carregar', class: 'btn-primary', onClick: () => {
          const plan = Store.get('planos', select.value);
          const rows = (plan.itens || []).filter((i) => !onlyProduct.checked || i.tipo !== 'Processo');
          rows.forEach((i) => rec.caracteristicas.push({
            caracteristica: [i.operacao, i.caracteristica].filter(Boolean).join(' — '),
            classe: i.classe || '', nominal: i.nominal || '', lie: i.lie || '', lse: i.lse || '', instrumento: i.metodo || '',
          }));
          if (!rec.codigoPeca) { rec.codigoPeca = plan.codigoPeca; rec.descricaoPeca = plan.descricaoPeca; rec.cliente = plan.cliente; }
          rec.planoControle = plan.numero;
          render();
          onChange();
          UI.toast(`${rows.length} característica(s) carregada(s).`);
        },
      },
    ]);
  }

  App.register({
    id: 'inspecoes',
    collection: 'inspecoes',
    group: 'Lançamentos',
    icon: '✔',
    title: 'Inspeções de Qualidade',
    short: 'Inspeções',
    clause: 'IATF 16949 — 8.6 / 9.1.1',
    description: 'Registro de inspeções de recebimento, setup, processo, final e auditoria de produto.',
    recordTitle: (r) => `${r.numero || 'Inspeção'} — ${r.codigoPeca || ''}`,
    newRecord: () => ({
      numero: Common.nextNumber('inspecoes', 'INS'),
      data: UI.today(),
      hora: new Date().toTimeString().slice(0, 5),
      inspetor: Store.settings().inspetor || '',
      caracteristicas: [],
    }),
    fields: [
      { key: 'numero', label: 'Nº da inspeção', required: true },
      { key: 'data', label: 'Data', type: 'date', required: true },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'tipo', label: 'Tipo de inspeção', type: 'select', options: TIPOS, required: true },
      { key: 'codigoPeca', label: 'Código da peça', required: true },
      { key: 'descricaoPeca', label: 'Descrição da peça', span: 2 },
      { key: 'revisao', label: 'Revisão do desenho' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'fornecedor', label: 'Fornecedor (recebimento)' },
      { key: 'operacao', label: 'Operação / Posto' },
      { key: 'maquina', label: 'Máquina / Linha' },
      { key: 'lote', label: 'Lote / Rastreabilidade' },
      { key: 'turno', label: 'Turno', type: 'select', options: ['1º', '2º', '3º'] },
      { key: 'qtdLote', label: 'Qtd. do lote', type: 'number' },
      { key: 'qtdInspecionada', label: 'Qtd. inspecionada', type: 'number' },
      { key: 'qtdReprovada', label: 'Qtd. reprovada', type: 'number' },
      { key: 'inspetor', label: 'Inspetor', required: true },
      { key: 'planoControle', label: 'Plano de Controle (ref.)' },
      { key: 'disposicao', label: 'Disposição', type: 'select', options: DISPOSICOES },
      { key: 'observacoes', label: 'Observações', type: 'textarea', span: 4 },
    ],
    rows: {
      key: 'caracteristicas',
      title: 'Características inspecionadas',
      empty: 'Adicione as características ou carregue-as do Plano de Controle.',
      tools: (rec, render, onChange) => el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => loadFromControlPlan(rec, render, onChange) }, 'Carregar do Plano de Controle'),
      columns: [
        { key: 'caracteristica', label: 'Característica', width: '200px' },
        { key: 'classe', label: 'Classe', type: 'select', options: [['', '—'], 'CC', 'SC'], width: '70px' },
        { key: 'nominal', label: 'Nominal', type: 'number', width: '80px' },
        { key: 'lie', label: 'LIE', type: 'number', width: '80px' },
        { key: 'lse', label: 'LSE', type: 'number', width: '80px' },
        { key: 'instrumento', label: 'Instrumento', width: '120px' },
        { key: 'medido', label: 'Medido', type: 'number', width: '90px' },
        { key: 'atributo', label: 'Visual / Atributo', type: 'select', options: ['OK', 'NOK'], width: '90px' },
        { key: '_res', label: 'Resultado', computed: rowResult },
      ],
    },
    beforeSave(rec) {
      rec.resultado = overall(rec);
      if (!rec.disposicao && rec.resultado === 'OK') rec.disposicao = 'Aprovado';
    },
    validate(rec) {
      return (rec.caracteristicas || []).length ? [] : ['Inclua ao menos uma característica inspecionada.'];
    },
    analysisTitle: 'Resultado da inspeção',
    analysis(rec) {
      const rows = rec.caracteristicas || [];
      const res = rows.map(rowResult);
      const ok = res.filter((r) => r === 'OK').length;
      const nok = res.filter((r) => r === 'NOK').length;
      const pend = res.filter((r) => !r).length;
      const result = overall(rec);
      const specialNok = rows.filter((r, i) => res[i] === 'NOK' && r.classe);
      return el('div', { class: 'stack' },
        el('div', { class: 'kpis' },
          Common.kpi('Resultado geral', result || '—', result === 'NOK' ? 'bad' : result === 'OK' ? 'ok' : 'neutral'),
          Common.kpi('Conformes', ok, 'ok'),
          Common.kpi('Não conformes', nok, nok ? 'bad' : 'neutral'),
          Common.kpi('Sem avaliação', pend, pend ? 'warn' : 'neutral')),
        specialNok.length ? el('div', { class: 'alert alert-bad' },
          el('strong', null, 'Atenção: característica especial não conforme. '),
          specialNok.map((r) => `${r.caracteristica} (${r.classe})`).join(', '),
          '. Segregar o lote, notificar a liderança e avaliar notificação ao cliente (IATF 8.7.1).') : null,
        result === 'NOK' ? el('div', { class: 'alert alert-warn' },
          'Inspeção reprovada. Registre a disposição do produto e, se necessário, abra uma Não Conformidade / 8D. ',
          el('button', {
            class: 'btn btn-secondary btn-sm',
            onclick: () => {
              const nc = {
                origem: rec.tipo === 'Recebimento' ? 'Fornecedor' : 'Interna',
                codigoPeca: rec.codigoPeca, descricaoPeca: rec.descricaoPeca, cliente: rec.cliente, lote: rec.lote,
                qtdAfetada: rec.qtdReprovada || '', referencia: rec.numero,
                d2: 'Características não conformes: ' + rows.filter((r, i) => res[i] === 'NOK')
                  .map((r) => `${r.caracteristica} (medido ${r.medido || r.atributo}; especificado ${r.lie || '—'} a ${r.lse || '—'})`).join('; '),
              };
              App.go(`#/m/ncs/novo/${encodeURIComponent(JSON.stringify(nc))}`);
            },
          }, 'Abrir NC / 8D')) : null);
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'data', label: 'Data', render: (r) => fmtDate(r.data) },
      { key: 'tipo', label: 'Tipo' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'lote', label: 'Lote' },
      { key: 'inspetor', label: 'Inspetor' },
      { key: 'resultado', label: 'Resultado', render: (r) => (r.resultado ? badge(r.resultado, UI.levelOf(r.resultado)) : '—') },
      { key: 'disposicao', label: 'Disposição', render: (r) => (r.disposicao ? badge(r.disposicao, UI.levelOf(r.disposicao)) : '—') },
    ],
    // CSV detalhado: uma linha por característica inspecionada
    csv(records) {
      const headers = ['Nº', 'Data', 'Hora', 'Tipo', 'Código peça', 'Descrição', 'Cliente', 'Fornecedor', 'Operação', 'Máquina', 'Lote', 'Turno',
        'Qtd lote', 'Qtd inspecionada', 'Qtd reprovada', 'Inspetor', 'Disposição', 'Resultado geral',
        'Característica', 'Classe', 'Nominal', 'LIE', 'LSE', 'Instrumento', 'Medido', 'Atributo', 'Resultado característica'];
      const rows = [];
      records.forEach((r) => {
        const head = [r.numero, fmtDate(r.data), r.hora, r.tipo, r.codigoPeca, r.descricaoPeca, r.cliente, r.fornecedor, r.operacao, r.maquina, r.lote, r.turno,
          r.qtdLote, r.qtdInspecionada, r.qtdReprovada, r.inspetor, r.disposicao, r.resultado];
        const chars = r.caracteristicas && r.caracteristicas.length ? r.caracteristicas : [{}];
        chars.forEach((c) => rows.push(head.concat([c.caracteristica, c.classe, c.nominal, c.lie, c.lse, c.instrumento, c.medido, c.atributo, rowResult(c) || ''])));
      });
      return { headers, rows };
    },
  });

  window.Inspecoes = { TIPOS, DISPOSICOES, rowResult, overall };
})();
