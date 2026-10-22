/* MSA — Estudo de Repetibilidade e Reprodutibilidade (Manual MSA AIAG 4ª ed.; IATF 7.1.5.1.1). */
(function () {
  'use strict';
  const { el, badge, fmt, fmtDate } = UI;
  const OPS = ['A', 'B', 'C'];

  const dims = (rec) => ({ ops: Number(rec.nOps) || 3, trials: Number(rec.nEnsaios) || 3, parts: Number(rec.nPecas) || 10 });

  /** Garante a grade operador × ensaio, preservando valores já digitados. */
  function prepare(rec) {
    const { ops, trials } = dims(rec);
    const old = rec.leituras || [];
    const grid = [];
    for (let o = 0; o < ops; o++) {
      for (let t = 1; t <= trials; t++) {
        const prev = old.find((r) => r.op === OPS[o] && Number(r.ensaio) === t) || {};
        grid.push(Object.assign({}, prev, { op: OPS[o], ensaio: t }));
      }
    }
    rec.leituras = grid;
  }

  function columns(rec) {
    const { parts } = dims(rec);
    const cols = [
      { key: 'operador', label: 'Operador', computed: (r, rc) => ({ text: rc[`operador${r.op}`] || `Operador ${r.op}`, level: 'neutral' }) },
      { key: 'ensaio', label: 'Ensaio', readonly: true },
    ];
    for (let p = 1; p <= parts; p++) cols.push({ key: `p${p}`, label: `Peça ${p}`, type: 'number', width: '72px' });
    return cols;
  }

  function tolerance(rec) {
    const lo = Calc.num(rec.lie), hi = Calc.num(rec.lse);
    return lo !== null && hi !== null ? hi - lo : null;
  }

  function analyze(rec) {
    const { ops, trials, parts } = dims(rec);
    const data = [];
    for (let o = 0; o < ops; o++) {
      const op = [];
      for (let t = 1; t <= trials; t++) {
        const row = (rec.leituras || []).find((r) => r.op === OPS[o] && Number(r.ensaio) === t) || {};
        const tr = [];
        for (let p = 1; p <= parts; p++) tr.push(row[`p${p}`]);
        op.push(tr);
      }
      data.push(op);
    }
    return Calc.grr(data, tolerance(rec));
  }

  App.register({
    id: 'msa',
    collection: 'msa',
    group: 'Core Tools',
    icon: '⊿',
    title: 'MSA — Análise do Sistema de Medição (R&R)',
    short: 'MSA (R&R)',
    clause: 'Manual MSA AIAG 4ª ed. · IATF 16949 — 7.1.5.1.1',
    description: 'Estudo de Repetibilidade e Reprodutibilidade pelo método da Média e Amplitude.',
    recordTitle: (r) => `${r.numero || 'MSA'} — ${r.instrumento || ''} / ${r.caracteristica || ''}`,
    newRecord: () => ({ numero: Common.nextNumber('msa', 'MSA'), data: UI.today(), nOps: '3', nEnsaios: '3', nPecas: '10' }),
    prepare,
    onFieldChange: prepare,
    fields: [
      { key: 'numero', label: 'Nº do estudo', required: true },
      { key: 'data', label: 'Data', type: 'date', required: true },
      { key: 'codigoPeca', label: 'Código da peça' },
      { key: 'caracteristica', label: 'Característica', required: true },
      { key: 'instrumento', label: 'Instrumento / Dispositivo', required: true },
      { key: 'codInstrumento', label: 'Código do instrumento' },
      { key: 'resolucao', label: 'Resolução', type: 'number' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'lie', label: 'LIE', type: 'number' },
      { key: 'lse', label: 'LSE', type: 'number' },
      { key: 'nOps', label: 'Nº de operadores', type: 'select', options: ['2', '3'], rerender: true },
      { key: 'nEnsaios', label: 'Nº de ensaios', type: 'select', options: ['2', '3'], rerender: true },
      { key: 'nPecas', label: 'Nº de peças', type: 'select', options: ['2', '3', '4', '5', '6', '7', '8', '9', '10'], rerender: true },
      { key: 'operadorA', label: 'Operador A' },
      { key: 'operadorB', label: 'Operador B' },
      { key: 'operadorC', label: 'Operador C' },
    ],
    rows: { key: 'leituras', title: 'Leituras (operador × ensaio × peça)', columns, fixed: true },
    analysisTitle: 'Resultado do estudo R&R',
    analysis(rec) {
      const r = analyze(rec);
      if (r.error) return el('p', { class: 'muted' }, r.error);
      const v = Calc.grrVerdict(r.pctGRR, r.ndc);
      const vt = Calc.grrVerdict(r.tolGRR, null);
      const res = Calc.num(rec.resolucao), tol = tolerance(rec);
      return el('div', { class: 'stack' },
        el('div', { class: 'kpis' },
          Common.kpi('%R&R (variação total)', `${fmt(r.pctGRR, 1)}%`, v.level, v.label),
          r.tolGRR !== null ? Common.kpi('%R&R (tolerância)', `${fmt(r.tolGRR, 1)}%`, vt.level, vt.label) : null,
          Common.kpi('ndc', r.ndc, r.ndc >= 5 ? 'ok' : 'bad', r.ndc >= 5 ? 'Adequado (≥ 5)' : 'Insuficiente (< 5)')),
        el('div', { class: 'table-scroll' }, el('table', { class: 'list' },
          el('thead', null, el('tr', null, ['Fonte', 'Desvio (σ)', '% Variação total', '% Tolerância'].map((h) => el('th', null, h)))),
          el('tbody', null, [
            ['Repetibilidade — EV', r.ev, r.pctEV, r.tolEV],
            ['Reprodutibilidade — AV', r.av, r.pctAV, r.tolAV],
            ['R&R', r.grr, r.pctGRR, r.tolGRR],
            ['Variação da peça — PV', r.pv, r.pctPV, null],
            ['Variação total — TV', r.tv, 100, null],
          ].map(([k, sd, p, t]) => el('tr', null, el('td', null, k), el('td', null, fmt(sd, 5)), el('td', null, p === null ? '—' : `${fmt(p, 1)}%`), el('td', null, t === null ? '—' : `${fmt(t, 1)}%`)))))),
        Common.stats([['R̿ (amplitude média)', r.rbarbar], ['X̄ dif. (operadores)', r.xdiff], ['LSC amplitudes', r.uclR], ['Rp (amplitude das peças)', r.rp]]),
        r.rangeOut ? el('div', { class: 'alert alert-warn' }, 'Há amplitudes acima do LSC: verifique leituras atípicas, método de medição ou treinamento antes de concluir o estudo.') : null,
        res && tol && res > tol / 10 ? el('div', { class: 'alert alert-warn' }, 'A resolução do instrumento é maior que 1/10 da tolerância (regra dos 10%).') : null,
        el('p', { class: 'muted' }, 'Critérios AIAG: < 10% aceitável; 10% – 30% pode ser aceitável conforme a aplicação, custo e aprovação do cliente; > 30% inaceitável. ndc ≥ 5.'));
    },
    listColumns: [
      { key: 'numero', label: 'Nº' },
      { key: 'data', label: 'Data', render: (r) => fmtDate(r.data) },
      { key: 'instrumento', label: 'Instrumento' },
      { key: 'caracteristica', label: 'Característica' },
      { key: 'grr', label: '%R&R', render: (r) => { const a = analyze(r); if (a.error) return '—'; return badge(`${fmt(a.pctGRR, 1)}%`, Calc.grrVerdict(a.pctGRR, a.ndc).level); } },
      { key: 'ndc', label: 'ndc', render: (r) => { const a = analyze(r); return a.error ? '—' : a.ndc; } },
    ],
    csv(records) {
      return {
        headers: ['Nº', 'Data', 'Peça', 'Característica', 'Instrumento', 'Código', 'EV', 'AV', 'R&R', 'PV', 'TV', '%R&R', '%R&R tolerância', 'ndc', 'Resultado'],
        rows: records.map((rec) => {
          const a = analyze(rec);
          if (a.error) return [rec.numero, fmtDate(rec.data), rec.codigoPeca, rec.caracteristica, rec.instrumento, rec.codInstrumento];
          return [rec.numero, fmtDate(rec.data), rec.codigoPeca, rec.caracteristica, rec.instrumento, rec.codInstrumento,
            a.ev, a.av, a.grr, a.pv, a.tv, a.pctGRR, a.tolGRR, a.ndc, Calc.grrVerdict(a.pctGRR, a.ndc).label];
        }),
      };
    },
  });

  window.MSA = { analyze };
})();
