/* CEP / SPC — cartas de controle e capacidade do processo (AIAG SPC 2ª ed.; IATF 9.1.1.1). */
(function () {
  'use strict';
  const { el, badge, fmt, fmtDate } = UI;

  const subgroups = (rec) => (rec.subgrupos || []).map((s) => {
    const n = Number(rec.n) || 1;
    const out = [];
    for (let i = 1; i <= n; i++) out.push(s[`x${i}`]);
    return out;
  });

  const analyze = (rec) => Calc.spc(subgroups(rec), rec.lie, rec.lse);

  function columns(rec) {
    const n = Number(rec.n) || 1;
    const cols = [
      { key: 'data', label: 'Data', type: 'date', width: '130px' },
      { key: 'hora', label: 'Hora', type: 'time', width: '90px' },
    ];
    for (let i = 1; i <= n; i++) cols.push({ key: `x${i}`, label: `X${i}`, type: 'number', width: '75px' });
    if (n > 1) {
      cols.push({
        key: '_media', label: 'Média', computed: (r) => {
          const v = []; for (let i = 1; i <= n; i++) { const x = Calc.num(r[`x${i}`]); if (x !== null) v.push(x); }
          return v.length === n ? { text: fmt(Calc.mean(v), 4), level: 'neutral' } : null;
        },
      });
      cols.push({
        key: '_amp', label: 'Amplitude', computed: (r) => {
          const v = []; for (let i = 1; i <= n; i++) { const x = Calc.num(r[`x${i}`]); if (x !== null) v.push(x); }
          return v.length === n ? { text: fmt(Math.max(...v) - Math.min(...v), 4), level: 'neutral' } : null;
        },
      });
    }
    cols.push({ key: 'obs', label: 'Observação / Evento', width: '160px' });
    return cols;
  }

  App.register({
    id: 'spc',
    collection: 'spc',
    group: 'Core Tools',
    icon: '∿',
    title: 'CEP / SPC — Controle Estatístico do Processo',
    short: 'CEP / SPC',
    clause: 'Manual SPC AIAG · IATF 16949 — 9.1.1.1',
    description: 'Cartas X̄-R e I-MR, índices Cp, Cpk, Pp, Ppk e detecção de sinais de instabilidade.',
    recordTitle: (r) => `${r.numero || 'CEP'} — ${r.caracteristica || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('spc', 'CEP'), n: '5', subgrupos: [] }),
    fields: [
      { key: 'numero', label: 'Nº do estudo', required: true },
      { key: 'codigoPeca', label: 'Código da peça', required: true },
      { key: 'descricaoPeca', label: 'Descrição da peça' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'caracteristica', label: 'Característica', required: true },
      { key: 'classe', label: 'Classe', type: 'select', options: [['', '—'], 'CC', 'SC'] },
      { key: 'operacao', label: 'Operação' },
      { key: 'maquina', label: 'Máquina' },
      { key: 'unidade', label: 'Unidade', placeholder: 'mm' },
      { key: 'nominal', label: 'Nominal', type: 'number' },
      { key: 'lie', label: 'LIE', type: 'number' },
      { key: 'lse', label: 'LSE', type: 'number' },
      { key: 'n', label: 'Tamanho do subgrupo (n)', type: 'select', options: [['1', '1 (I-MR)'], '2', '3', '4', '5', '6', '7', '8', '9', '10'], rerender: true, required: true },
      { key: 'instrumento', label: 'Instrumento' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'tipoEstudo', label: 'Tipo de estudo', type: 'select', options: ['Estudo preliminar (PPAP)', 'Monitoramento contínuo'] },
    ],
    rows: {
      key: 'subgrupos',
      title: 'Subgrupos / medições',
      columns,
      newRow: () => ({ data: UI.today(), hora: new Date().toTimeString().slice(0, 5) }),
      empty: 'Adicione os subgrupos coletados. Recomenda-se ao menos 25 subgrupos (100 leituras).',
    },
    analysisTitle: 'Cartas de controle e capacidade',
    analysis(rec) {
      const r = analyze(rec);
      if (!r) return el('p', { class: 'muted' }, 'Informe as medições para calcular as cartas e os índices.');
      const vCpk = Calc.capabilityVerdict(r.cpk);
      const vPpk = Calc.capabilityVerdict(r.ppk);
      const isIMR = r.chart === 'I-MR';
      const flaggedX = r.signals.filter((s) => s.chart === 'media').map((s) => s.index);
      const flaggedR = r.signals.filter((s) => s.chart === 'amplitude').map((s) => s.index);
      const all = subgroups(rec).flat().map(Calc.num).filter((x) => x !== null);
      return el('div', { class: 'stack' },
        el('div', { class: 'kpis' },
          Common.kpi('Cpk', fmt(r.cpk, 2), vCpk.level, vCpk.label),
          Common.kpi('Ppk', fmt(r.ppk, 2), vPpk.level, vPpk.label),
          Common.kpi('Cp', fmt(r.cp, 2)),
          Common.kpi('Pp', fmt(r.pp, 2)),
          Common.kpi('Sinais de instabilidade', r.signals.length, r.signals.length ? 'bad' : 'ok', r.signals.length ? 'Processo fora de controle' : 'Processo sob controle'),
          Common.kpi('Leituras fora de especificação', r.nokCount, r.nokCount ? 'bad' : 'ok')),
        r.subgroups < 25 ? el('div', { class: 'alert alert-warn' }, `Apenas ${r.subgroups} subgrupo(s). O manual SPC recomenda no mínimo 25 subgrupos para estimar a capacidade.`) : null,
        r.discarded ? el('div', { class: 'alert alert-warn' }, `${r.discarded} subgrupo(s) incompleto(s) desconsiderado(s) no cálculo.`) : null,
        Common.stats([
          ['Carta', r.chart], ['Tamanho do subgrupo', r.n], ['Subgrupos', r.subgroups], ['Leituras', r.total],
          ['Média geral (X̿)', r.mean], ['Mínimo', r.min], ['Máximo', r.max],
          [isIMR ? 'MR médio' : 'R médio (R̄)', r.rbar],
          ['LSC média', r.ucl], ['LIC média', r.lcl], [isIMR ? 'LSC MR' : 'LSC amplitude', r.uclR],
          ['σ dentro (R̄/d2)', r.sigmaWithin], ['σ total (s)', r.sigmaOverall],
        ]),
        UI.controlChart({ title: isIMR ? 'Carta de valores individuais (I)' : 'Carta de médias (X̄)', points: r.points, center: r.center, ucl: r.ucl, lcl: r.lcl, flagged: flaggedX, unit: rec.unidade }),
        UI.controlChart({ title: isIMR ? 'Carta de amplitude móvel (MR)' : 'Carta de amplitudes (R)', points: r.ranges, center: r.rbar, ucl: r.uclR, lcl: r.lclR, flagged: flaggedR, unit: rec.unidade }),
        all.length >= 5 ? UI.histogram({ title: 'Histograma', values: all, lsl: Calc.num(rec.lie), usl: Calc.num(rec.lse) }) : null,
        r.signals.length ? el('div', null, el('h3', null, 'Sinais detectados'), el('ul', null,
          r.signals.map((s) => el('li', null, `Subgrupo ${s.index + 1}: ${s.rule}`)))) : null);
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'codigoPeca', label: 'Peça' },
      { key: 'caracteristica', label: 'Característica' },
      { key: 'maquina', label: 'Máquina' },
      { key: 'n', label: 'Subgrupos', render: (r) => (r.subgrupos || []).length },
      { key: 'cpk', label: 'Cpk', render: (r) => { const a = analyze(r); const v = Calc.capabilityVerdict(a && a.cpk); return a && a.cpk !== null ? badge(fmt(a.cpk, 2), v.level) : '—'; } },
      { key: 'ppk', label: 'Ppk', render: (r) => { const a = analyze(r); const v = Calc.capabilityVerdict(a && a.ppk); return a && a.ppk !== null ? badge(fmt(a.ppk, 2), v.level) : '—'; } },
      { key: 'atualizadoEm', label: 'Atualizado', render: (r) => fmtDate(r.atualizadoEm) },
    ],
    csv(records) {
      const headers = ['Nº', 'Peça', 'Característica', 'Máquina', 'LIE', 'LSE', 'n', 'Subgrupos', 'Média', 'σ dentro', 'σ total', 'Cp', 'Cpk', 'Pp', 'Ppk', 'Sinais'];
      return {
        headers,
        rows: records.map((rec) => {
          const r = analyze(rec) || {};
          return [rec.numero, rec.codigoPeca, rec.caracteristica, rec.maquina, rec.lie, rec.lse, rec.n, r.subgroups, r.mean, r.sigmaWithin, r.sigmaOverall, r.cp, r.cpk, r.pp, r.ppk, (r.signals || []).length];
        }),
      };
    },
  });

  window.SPC = { analyze };
})();
