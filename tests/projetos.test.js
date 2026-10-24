// Testes dos cálculos da Gestão de Projetos (PMBOK 8): `npm test`
const test = require('node:test');
const assert = require('node:assert');
const Calc = require('../projetos/js/calc.js');
const Ref = require('../projetos/js/pmbok.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('datas: soma de dias e diferença', () => {
  assert.strictEqual(Calc.addDays('2026-02-27', 2), '2026-03-01');
  assert.strictEqual(Calc.daysBetween('2026-01-01', '2026-01-31'), 30);
});

test('fração planejada: linear entre início e fim, inclusive', () => {
  const t = { inicio: '2026-03-01', fim: '2026-03-10' };
  assert.strictEqual(Calc.plannedFraction(t, '2026-02-28'), 0);
  close(Calc.plannedFraction(t, '2026-03-05'), 0.5);
  assert.strictEqual(Calc.plannedFraction(t, '2026-03-10'), 1);
});

test('EVM: VP, VA, CR, IDP, IDC e ENT', () => {
  const tarefas = [
    { inicio: '2026-03-01', fim: '2026-03-10', custoPlanejado: 1000, progresso: 100, status: 'concluida', custoReal: 1250 },
    { inicio: '2026-03-01', fim: '2026-03-10', custoPlanejado: 1000, progresso: 0, status: 'afazer', custoReal: 0 },
    { inicio: '2026-03-11', fim: '2026-03-20', custoPlanejado: 2000, progresso: 0, custoReal: 0 },
  ];
  const e = Calc.evm(tarefas, '2026-03-10', 5000);
  assert.strictEqual(e.BAC, 4000);
  assert.strictEqual(e.PV, 2000);
  assert.strictEqual(e.EV, 1000);
  assert.strictEqual(e.AC, 1250);
  assert.strictEqual(e.SPI, 0.5);
  assert.strictEqual(e.CPI, 0.8);
  assert.strictEqual(e.EAC, 5000);
  assert.strictEqual(e.VAC, -1000);
  assert.strictEqual(e.reserva, 1000);
  close(e.TCPI, 3000 / 2750);
});

test('EVM sem custos usa avanço físico ponderado pela duração', () => {
  const tarefas = [
    { inicio: '2026-03-01', fim: '2026-03-04', status: 'concluida' },
    { inicio: '2026-03-05', fim: '2026-03-08', progresso: 0 },
  ];
  const e = Calc.evm(tarefas, '2026-03-08', 0);
  assert.strictEqual(e.temCusto, false);
  assert.strictEqual(e.SPI, 0.5);
  assert.strictEqual(e.CPI, null);
});

test('riscos: P × I e nível', () => {
  assert.strictEqual(Calc.riskScore({ probabilidade: 4, impacto: 4 }), 16);
  assert.strictEqual(Calc.riskLevel(16), 'alto');
  assert.strictEqual(Calc.riskLevel(9), 'medio');
  assert.strictEqual(Calc.riskLevel(4), 'baixo');
});

test('poder × interesse', () => {
  assert.strictEqual(Calc.quadrant(5, 5), 'gerenciar');
  assert.strictEqual(Calc.quadrant(5, 1), 'satisfeito');
  assert.strictEqual(Calc.quadrant(1, 5), 'informado');
  assert.strictEqual(Calc.quadrant(1, 1), 'monitorar');
});

test('indicador de valor: funciona para metas de redução', () => {
  close(Calc.kpiProgress({ base: 4.2, meta: 1.5, atual: 2.85 }), 0.5);
  assert.strictEqual(Calc.kpiProgress({ base: 60, meta: 80, atual: 90 }), 1);
  assert.strictEqual(Calc.kpiProgress({ base: 60, meta: 80, atual: '' }), 0);
});

test('tailoring: sugere a abordagem pela média das respostas', () => {
  const q = Ref.TAILORING;
  const all = (v) => Object.fromEntries(q.map((x) => [x.key, v]));
  assert.strictEqual(Calc.tailoring(all(1), q).abordagem, 'preditivo');
  assert.strictEqual(Calc.tailoring(all(3), q).abordagem, 'hibrido');
  assert.strictEqual(Calc.tailoring(all(5), q).abordagem, 'adaptativo');
  assert.strictEqual(Calc.tailoring({}, q).abordagem, null);
});

test('burndown: ideal linear e real até hoje', () => {
  const sprint = { id: 's1', inicio: '2026-03-01', fim: '2026-03-05' };
  const tarefas = [
    { sprint: 's1', pontos: 5, status: 'concluida', concluidoEm: '2026-03-02' },
    { sprint: 's1', pontos: 3, status: 'andamento' },
    { sprint: 's2', pontos: 8, status: 'concluida', concluidoEm: '2026-03-01' },
  ];
  const b = Calc.burndown(tarefas, sprint, '2026-03-03');
  assert.strictEqual(b.total, 8);
  assert.strictEqual(b.dias.length, 5);
  assert.strictEqual(b.dias[0].ideal, 8);
  assert.strictEqual(b.dias[4].ideal, 0);
  assert.deepStrictEqual(b.dias.map((d) => d.real), [8, 3, 3, null, null]);
  assert.strictEqual(Calc.velocity(tarefas, sprint), 5);
});

test('modelo: fases em sequência com um gate ao fim de cada fase', () => {
  const m = Ref.buildFromTemplate('manutencao', '2026-03-01');
  assert.strictEqual(m.marcos.length, Ref.MODELOS.manutencao.length);
  assert.strictEqual(m.tarefas[0].inicio, '2026-03-01');
  assert.strictEqual(m.tarefas[1].inicio, Calc.addDays(m.tarefas[0].fim, 1));
  assert.strictEqual(m.marcos[0].data, m.tarefas[2].fim);
  assert.strictEqual(m.fim, m.tarefas[m.tarefas.length - 1].fim);
});

test('modelo ágil: tarefas do sprint correm em paralelo', () => {
  const m = Ref.buildFromTemplate('digital', '2026-03-01');
  assert.strictEqual(m.sprints.length, 3);
  const s1 = m.tarefas.filter((t) => t.sprint === m.sprints[0].id);
  assert.strictEqual(s1.length, 3);
  assert.ok(s1.every((t) => t.inicio === m.sprints[0].inicio && t.fim === m.sprints[0].fim));
});

test('saúde: aponta risco alto sem plano e tarefas atrasadas', () => {
  const p = {
    status: 'andamento', patrocinador: 'Diretor', aprovadoEm: '2026-01-01', escopoIncluido: 'x', orcamento: 1000,
    tarefas: [
      { inicio: '2026-01-01', fim: '2026-01-10', status: 'andamento', progresso: 50, responsavel: 'Ana' },
    ],
    equipe: [{ nome: 'Ana', alocacao: 120 }],
    partes: [{ nome: 'Cliente', poder: 5, interesse: 5, atitude: 'apoiador' }],
    riscos: [{ probabilidade: 5, impacto: 4, status: 'aberto', tipo: 'ameaca', plano: '' }],
  };
  const h = Calc.health(p, '2026-02-01');
  assert.strictEqual(h.dominios.riscos.nivel, 'critico');
  assert.strictEqual(h.dominios.recursos.nivel, 'atencao');
  assert.strictEqual(h.dominios.cronograma.nivel, 'critico'); // IDP 0,5
  assert.strictEqual(h.dominios.partes.nivel, 'ok');
  assert.strictEqual(h.geral, 'critico');
});
