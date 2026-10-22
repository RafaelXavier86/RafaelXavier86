// Testes dos cálculos estatísticos: `npm test`
const test = require('node:test');
const assert = require('node:assert');
const Calc = require('../js/calc.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('evaluate: OK/NOK conforme limites', () => {
  assert.strictEqual(Calc.evaluate(10, 9, 11), 'OK');
  assert.strictEqual(Calc.evaluate('11,5', 9, 11), 'NOK');
  assert.strictEqual(Calc.evaluate(8, 9, ''), 'NOK');
  assert.strictEqual(Calc.evaluate(8, '', ''), null);
  assert.strictEqual(Calc.evaluate('', 9, 11), null);
});

test('spc X̄-R: limites e capacidade', () => {
  const sg = [[10, 12], [11, 13], [10, 10], [12, 12]];
  const r = Calc.spc(sg, 5, 17);
  assert.strictEqual(r.chart, 'X̄-R');
  assert.strictEqual(r.n, 2);
  close(r.center, 11.25);
  close(r.rbar, 1);
  close(r.ucl, 11.25 + 1.88);
  close(r.uclR, 3.267);
  close(r.sigmaWithin, 1 / 1.128);
  close(r.cp, 12 / (6 / 1.128));
  close(r.cpk, (17 - 11.25) / (3 / 1.128));
});

test('spc I-MR com especificação unilateral', () => {
  const r = Calc.spc([[1], [2], [3], [2]], null, 10);
  assert.strictEqual(r.chart, 'I-MR');
  close(r.rbar, 1);
  assert.strictEqual(r.cp, null);
  close(r.cpk, (10 - 2) / (3 / 1.128));
});

test('spc detecta 7 pontos do mesmo lado', () => {
  const sg = [];
  for (let i = 0; i < 8; i++) sg.push([10.1, 10.2]);
  for (let i = 0; i < 8; i++) sg.push([9.8, 9.9]);
  const r = Calc.spc(sg, 9, 11);
  assert.ok(r.signals.some((s) => s.rule.includes('7 pontos')));
});

test('actionPriority segue tabela AIAG-VDA', () => {
  assert.strictEqual(Calc.actionPriority(10, 10, 10), 'H');
  assert.strictEqual(Calc.actionPriority(9, 4, 1), 'M');
  assert.strictEqual(Calc.actionPriority(9, 2, 3), 'L');
  assert.strictEqual(Calc.actionPriority(8, 6, 1), 'M');
  assert.strictEqual(Calc.actionPriority(5, 8, 3), 'M');
  assert.strictEqual(Calc.actionPriority(2, 9, 8), 'M');
  assert.strictEqual(Calc.actionPriority(1, 10, 10), 'L');
  assert.strictEqual(Calc.actionPriority(11, 1, 1), null);
});

test('grr: método média e amplitude', () => {
  // 2 operadores × 2 ensaios × 3 peças
  const data = [
    [[1.0, 2.0, 3.0], [1.1, 2.1, 3.1]],
    [[1.2, 2.2, 3.2], [1.1, 2.1, 3.1]],
  ];
  const r = Calc.grr(data, 4);
  close(r.rbarbar, 0.1);
  close(r.xdiff, 0.1);
  close(r.ev, 0.08862);
  const av = Math.sqrt((0.1 * 0.7071) ** 2 - 0.08862 ** 2 / 6);
  close(r.av, av);
  close(r.pv, 2 * 0.5231);
  close(r.grr, Math.sqrt(0.08862 ** 2 + av ** 2));
  assert.strictEqual(r.ndc, Math.floor((1.41 * r.pv) / r.grr));
  close(r.tolGRR, (100 * 6 * r.grr) / 4);
});

test('grr: valida dimensões e dados incompletos', () => {
  assert.ok(Calc.grr([[[1, 2]]]).error);
  assert.ok(Calc.grr([[[1, ''], [1, 2]], [[1, 2], [1, 2]]]).error);
});
