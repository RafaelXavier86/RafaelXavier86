/*
 * Cálculos estatísticos do Core Tools (AIAG):
 *  - SPC: cartas X̄-R / I-MR, Cp, Cpk, Pp, Ppk e sinais de instabilidade
 *  - MSA: estudo R&R pelo método da Média e Amplitude (Manual MSA 4ª ed.)
 *  - FMEA: Prioridade de Ação (AP) conforme Manual AIAG-VDA (2019)
 * Funciona no navegador (window.Calc) e no Node (require) para testes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Constantes para cartas de controle por tamanho de subgrupo
  const SPC_CONST = {
    2: { A2: 1.880, D3: 0, D4: 3.267, d2: 1.128 },
    3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 },
    4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
    5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 },
    6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 },
    7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
    8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
    9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.970 },
    10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
  };

  // Constantes do método Média e Amplitude (MSA 4ª ed.)
  const K1 = { 2: 0.8862, 3: 0.5908 };
  const K2 = { 2: 0.7071, 3: 0.5231 };
  const K3 = { 2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742, 7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146 };

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function mean(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }

  function stdev(arr) {
    if (arr.length < 2) return null;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
  }

  /** Avalia uma medição contra os limites de especificação. */
  function evaluate(value, lsl, usl) {
    const v = num(value), lo = num(lsl), hi = num(usl);
    if (v === null) return null;
    if (lo === null && hi === null) return null;
    if (lo !== null && v < lo) return 'NOK';
    if (hi !== null && v > hi) return 'NOK';
    return 'OK';
  }

  /** Cp/Cpk (ou Pp/Ppk) para um sigma informado; suporta especificação unilateral. */
  function capability(m, sigma, lsl, usl) {
    const lo = num(lsl), hi = num(usl);
    if (m === null || !sigma) return { cp: null, cpk: null, cpu: null, cpl: null };
    const cpu = hi !== null ? (hi - m) / (3 * sigma) : null;
    const cpl = lo !== null ? (m - lo) / (3 * sigma) : null;
    const cp = hi !== null && lo !== null ? (hi - lo) / (6 * sigma) : null;
    const parts = [cpu, cpl].filter((x) => x !== null);
    return { cp, cpk: parts.length ? Math.min(...parts) : null, cpu, cpl };
  }

  /**
   * Estudo de SPC. subgroups: array de arrays de medições.
   * n = 1 → carta I-MR; n = 2..10 → carta X̄-R.
   */
  function spc(subgroups, lsl, usl) {
    const groups = (subgroups || [])
      .map((g) => (g || []).map(num).filter((x) => x !== null))
      .filter((g) => g.length > 0);
    if (!groups.length) return null;

    // Usa o tamanho de subgrupo mais frequente e descarta subgrupos incompletos
    const counts = {};
    groups.forEach((g) => { counts[g.length] = (counts[g.length] || 0) + 1; });
    const n = Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a] || b - a)[0]);
    const valid = groups.filter((g) => g.length === n);
    if (n > 10) return null;

    const all = valid.flat();
    let points, ranges, center, rbar, ucl, lcl, uclR, lclR, sigmaWithin, chart;

    if (n === 1) {
      chart = 'I-MR';
      points = all.slice();
      ranges = points.map((x, i) => (i === 0 ? null : Math.abs(x - points[i - 1])));
      const mrs = ranges.filter((r) => r !== null);
      if (!mrs.length) return null;
      center = mean(points);
      rbar = mean(mrs);
      ucl = center + 2.66 * rbar;
      lcl = center - 2.66 * rbar;
      uclR = 3.267 * rbar;
      lclR = 0;
      sigmaWithin = rbar / 1.128;
    } else {
      chart = 'X̄-R';
      const k = SPC_CONST[n];
      points = valid.map(mean);
      ranges = valid.map((g) => Math.max(...g) - Math.min(...g));
      center = mean(points);
      rbar = mean(ranges);
      ucl = center + k.A2 * rbar;
      lcl = center - k.A2 * rbar;
      uclR = k.D4 * rbar;
      lclR = k.D3 * rbar;
      sigmaWithin = rbar / k.d2;
    }

    const sigmaOverall = stdev(all);
    const capW = capability(center, sigmaWithin, lsl, usl);
    const capO = capability(mean(all), sigmaOverall, lsl, usl);

    // Sinais: Regra 1 (fora dos limites) e Regra 2 (7 pontos seguidos do mesmo lado da média)
    const signals = [];
    points.forEach((p, i) => {
      if (p > ucl || p < lcl) signals.push({ index: i, rule: 'Ponto fora dos limites de controle', chart: 'media' });
    });
    ranges.forEach((r, i) => {
      if (r !== null && (r > uclR || r < lclR)) signals.push({ index: i, rule: 'Amplitude fora dos limites', chart: 'amplitude' });
    });
    let run = 0, side = 0;
    points.forEach((p, i) => {
      const s = p > center ? 1 : p < center ? -1 : 0;
      if (s !== 0 && s === side) run++; else { side = s; run = s === 0 ? 0 : 1; }
      if (run === 7) signals.push({ index: i, rule: 'Sequência de 7 pontos do mesmo lado da média', chart: 'media' });
    });

    const nokCount = all.filter((v) => evaluate(v, lsl, usl) === 'NOK').length;

    return {
      chart, n, subgroups: valid.length, total: all.length, discarded: groups.length - valid.length,
      points, ranges, center, rbar, ucl, lcl, uclR, lclR,
      mean: mean(all), min: Math.min(...all), max: Math.max(...all),
      sigmaWithin, sigmaOverall,
      cp: capW.cp, cpk: capW.cpk, pp: capO.cp, ppk: capO.cpk,
      signals, nokCount,
    };
  }

  function capabilityVerdict(index) {
    if (index === null || index === undefined) return { label: 'Sem especificação', level: 'neutral' };
    if (index >= 1.67) return { label: 'Capaz (≥ 1,67)', level: 'ok' };
    if (index >= 1.33) return { label: 'Aceitável (1,33 – 1,67)', level: 'warn' };
    return { label: 'Não capaz (< 1,33)', level: 'bad' };
  }

  /**
   * Estudo R&R — método da Média e Amplitude.
   * data[operador][ensaio][peca] = medição
   */
  function grr(data, tolerance) {
    const ops = data.length;
    const trials = ops ? data[0].length : 0;
    const parts = trials ? data[0][0].length : 0;
    if (!K2[ops] || !K1[trials] || !K3[parts]) return { error: 'Use 2–3 operadores, 2–3 ensaios e 2–10 peças.' };

    const vals = data.map((op) => op.map((tr) => tr.map(num)));
    if (vals.flat(2).some((v) => v === null)) return { error: 'Preencha todas as medições do estudo.' };

    const opStats = vals.map((op) => {
      const ranges = [];
      for (let p = 0; p < parts; p++) {
        const col = op.map((tr) => tr[p]);
        ranges.push(Math.max(...col) - Math.min(...col));
      }
      return { xbar: mean(op.flat()), rbar: mean(ranges), ranges };
    });

    const rbarbar = mean(opStats.map((o) => o.rbar));
    const xbars = opStats.map((o) => o.xbar);
    const xdiff = Math.max(...xbars) - Math.min(...xbars);
    const uclR = (trials === 2 ? 3.267 : 2.574) * rbarbar;

    const partMeans = [];
    for (let p = 0; p < parts; p++) partMeans.push(mean(vals.flatMap((op) => op.map((tr) => tr[p]))));
    const rp = Math.max(...partMeans) - Math.min(...partMeans);

    const ev = rbarbar * K1[trials];
    const av = Math.sqrt(Math.max(0, (xdiff * K2[ops]) ** 2 - (ev ** 2) / (parts * trials)));
    const grrV = Math.sqrt(ev ** 2 + av ** 2);
    const pv = rp * K3[parts];
    const tv = Math.sqrt(grrV ** 2 + pv ** 2);
    const pct = (x) => (tv ? (100 * x) / tv : null);
    const tol = num(tolerance);
    const pctTol = (x) => (tol ? (100 * 6 * x) / tol : null);
    const ndc = grrV ? Math.floor((1.41 * pv) / grrV) : null;

    const rangeOut = opStats.some((o) => o.ranges.some((r) => r > uclR));

    return {
      ops, trials, parts, rbarbar, xdiff, uclR, rp, partMeans, opStats,
      ev, av, grr: grrV, pv, tv,
      pctEV: pct(ev), pctAV: pct(av), pctGRR: pct(grrV), pctPV: pct(pv),
      tolEV: pctTol(ev), tolAV: pctTol(av), tolGRR: pctTol(grrV),
      ndc, rangeOut,
    };
  }

  function grrVerdict(pctGRR, ndc) {
    if (pctGRR === null || pctGRR === undefined) return { label: '—', level: 'neutral' };
    if (pctGRR < 10 && (ndc === null || ndc >= 5)) return { label: 'Aceitável (< 10%)', level: 'ok' };
    if (pctGRR <= 30) return { label: 'Condicional (10% – 30%)', level: 'warn' };
    return { label: 'Inaceitável (> 30%)', level: 'bad' };
  }

  /** Prioridade de Ação (AIAG-VDA FMEA, 2019). Retorna 'H', 'M', 'L' ou null. */
  function actionPriority(s, o, d) {
    s = num(s); o = num(o); d = num(d);
    if ([s, o, d].some((x) => x === null || x < 1 || x > 10)) return null;
    const di = d >= 7 ? 0 : d >= 5 ? 1 : d >= 2 ? 2 : 3; // 7-10, 5-6, 2-4, 1
    const oi = o >= 8 ? 0 : o >= 6 ? 1 : o >= 4 ? 2 : o >= 2 ? 3 : 4; // 8-10, 6-7, 4-5, 2-3, 1
    const table = {
      s9: ['HHHH', 'HHHH', 'HHHM', 'HMLL', 'LLLL'],
      s7: ['HHHH', 'HHHM', 'HMMM', 'MMLL', 'LLLL'],
      s4: ['HHMM', 'MMML', 'MLLL', 'LLLL', 'LLLL'],
      s2: ['MMLL', 'LLLL', 'LLLL', 'LLLL', 'LLLL'],
    };
    if (s === 1) return 'L';
    const key = s >= 9 ? 's9' : s >= 7 ? 's7' : s >= 4 ? 's4' : 's2';
    return table[key][oi][di];
  }

  return { SPC_CONST, num, mean, stdev, evaluate, capability, spc, capabilityVerdict, grr, grrVerdict, actionPriority };
});
