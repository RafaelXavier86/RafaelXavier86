/*
 * Cálculos da gestão de projetos:
 *  - Gerenciamento do Valor Agregado (EVM): VP, VA, CR, IDP, IDC, ENT, VNT, IDPT
 *  - Saúde do projeto pelos 7 domínios de desempenho do PMBOK 8
 *  - Adaptação (tailoring) da abordagem: preditiva, híbrida ou adaptativa
 *  - Riscos (P × I), quadrante poder × interesse, burndown e carga da equipe
 * Funciona no navegador (window.Calc) e no Node (require) para testes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;

  // Datas no formato AAAA-MM-DD, tratadas em UTC para não sofrer com fuso/horário de verão
  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function toISO(t) { return new Date(t).toISOString().slice(0, 10); }
  function addDays(s, n) { return toISO(parseDate(s) + n * DAY); }
  function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / DAY); }
  function num(v) {
    if (v === '' || v == null) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dec = (v) => v.toFixed(2).replace('.', ',');
  const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

  // ---------- Tarefas e cronograma ----------

  const isDone = (t) => t.status === 'concluida';
  function taskProgress(t) { return isDone(t) ? 100 : clamp(num(t.progresso), 0, 100); }
  function isOverdue(t, today) {
    const fim = parseDate(t.fim);
    return !isDone(t) && fim != null && fim < parseDate(today);
  }
  // Fração do trabalho que deveria estar pronta na data (linha de base linear entre início e fim)
  function plannedFraction(t, today) {
    const ini = parseDate(t.inicio), fim = parseDate(t.fim), d = parseDate(today);
    if (ini == null || fim == null) return 0;
    if (d < ini) return 0;
    if (d >= fim) return 1;
    return (d - ini + DAY) / (fim - ini + DAY);
  }
  function duration(t) {
    const ini = parseDate(t.inicio), fim = parseDate(t.fim);
    return ini == null || fim == null ? 1 : Math.max(1, (fim - ini) / DAY + 1);
  }

  // Avanço físico ponderado pela duração (usado quando as tarefas não têm custo)
  function physicalProgress(tasks, today) {
    let w = 0, real = 0, plan = 0;
    tasks.forEach((t) => {
      const d = duration(t);
      w += d;
      real += d * taskProgress(t) / 100;
      plan += d * plannedFraction(t, today);
    });
    return w ? { real: real / w, planejado: plan / w } : { real: 0, planejado: 0 };
  }

  /*
   * Valor agregado. BAC = soma dos custos planejados das tarefas;
   * orçamento aprovado (com reservas) é informado à parte no termo de abertura.
   */
  function evm(tasks, today, orcamento) {
    let BAC = 0, PV = 0, EV = 0, AC = 0;
    tasks.forEach((t) => {
      const c = num(t.custoPlanejado);
      BAC += c;
      PV += c * plannedFraction(t, today);
      EV += c * taskProgress(t) / 100;
      AC += num(t.custoReal);
    });
    const fis = physicalProgress(tasks, today);
    const temCusto = BAC > 0;
    const SPI = temCusto ? (PV > 0 ? EV / PV : null) : (fis.planejado > 0 ? fis.real / fis.planejado : null);
    const CPI = AC > 0 ? EV / AC : null;
    const EAC = CPI ? BAC / CPI : (temCusto ? BAC : null);
    const orc = num(orcamento) || BAC;
    return {
      BAC, PV, EV, AC,
      SV: EV - PV, CV: EV - AC,
      SPI: round(SPI), CPI: round(CPI),
      EAC: EAC == null ? null : round(EAC),
      ETC: EAC == null ? null : round(Math.max(0, EAC - AC)),
      VAC: EAC == null ? null : round(BAC - EAC),
      TCPI: BAC - AC > 0 ? round((BAC - EV) / (BAC - AC)) : null,
      orcamento: orc,
      reserva: orc - BAC,
      avancoReal: temCusto ? EV / BAC : fis.real,
      avancoPlanejado: temCusto ? PV / BAC : fis.planejado,
      temCusto,
    };
  }

  // ---------- Riscos e partes interessadas ----------

  function riskScore(r) { return clamp(num(r.probabilidade), 0, 5) * clamp(num(r.impacto), 0, 5); }
  function riskLevel(score) { return score >= 15 ? 'alto' : score >= 8 ? 'medio' : 'baixo'; }
  const riskOpen = (r) => r.status !== 'fechado';

  function quadrant(poder, interesse) {
    const p = num(poder) >= 3, i = num(interesse) >= 3;
    if (p && i) return 'gerenciar';
    if (p) return 'satisfeito';
    if (i) return 'informado';
    return 'monitorar';
  }

  // ---------- Equipe ----------

  function workload(project, today) {
    const tasks = project.tarefas || [];
    return (project.equipe || []).map((m) => {
      const minhas = tasks.filter((t) => t.responsavel === m.nome);
      const abertas = minhas.filter((t) => !isDone(t));
      return {
        nome: m.nome,
        alocacao: num(m.alocacao),
        abertas: abertas.length,
        atrasadas: abertas.filter((t) => isOverdue(t, today)).length,
        concluidas: minhas.length - abertas.length,
        sobrecarga: num(m.alocacao) > 100,
      };
    });
  }

  // ---------- Sprints (abordagem adaptativa) ----------

  // Pontos restantes por dia do sprint; o real só vai até hoje
  function burndown(tasks, sprint, today) {
    const ini = parseDate(sprint.inicio), fim = parseDate(sprint.fim), hoje = parseDate(today);
    if (ini == null || fim == null || fim < ini) return { total: 0, dias: [] };
    const doSprint = tasks.filter((t) => t.sprint === sprint.id);
    const total = doSprint.reduce((s, t) => s + num(t.pontos), 0);
    const n = Math.round((fim - ini) / DAY);
    const dias = [];
    for (let i = 0; i <= n; i++) {
      const d = ini + i * DAY;
      const feitos = doSprint
        .filter((t) => isDone(t) && parseDate(t.concluidoEm) != null && parseDate(t.concluidoEm) <= d)
        .reduce((s, t) => s + num(t.pontos), 0);
      dias.push({ data: toISO(d), ideal: n ? total * (1 - i / n) : 0, real: d <= hoje ? total - feitos : null });
    }
    return { total, dias };
  }
  function velocity(tasks, sprint) {
    return tasks.filter((t) => t.sprint === sprint.id && isDone(t)).reduce((s, t) => s + num(t.pontos), 0);
  }

  // ---------- Indicadores de valor ----------

  // Quanto do caminho entre a linha de base e a meta já foi percorrido (serve para metas de redução)
  function kpiProgress(k) {
    const base = num(k.base), meta = num(k.meta), atual = k.atual === '' || k.atual == null ? base : num(k.atual);
    if (meta === base) return atual === meta ? 1 : 0;
    return clamp((atual - base) / (meta - base), 0, 1);
  }

  // ---------- Adaptação (tailoring) ----------

  /*
   * Cada resposta vai de 1 (favorece a abordagem preditiva) a 5 (favorece a adaptativa).
   * A média define a abordagem sugerida; os extremos viram justificativas.
   */
  function tailoring(answers, questions) {
    const vals = questions.map((q) => num(answers[q.key])).filter((v) => v >= 1 && v <= 5);
    if (!vals.length) return { abordagem: null, media: null, respondidas: 0 };
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const abordagem = media <= 2.4 ? 'preditivo' : media >= 3.6 ? 'adaptativo' : 'hibrido';
    const pred = [], adapt = [];
    questions.forEach((q) => {
      const v = num(answers[q.key]);
      if (v && v <= 2) pred.push(q.curto);
      if (v >= 4) adapt.push(q.curto);
    });
    return { abordagem, media: round(media), respondidas: vals.length, pred, adapt };
  }

  // ---------- Saúde pelos domínios de desempenho ----------

  const ORDER = { ok: 0, atencao: 1, critico: 2 };
  function worst(a, b) { return ORDER[b] > ORDER[a] ? b : a; }

  function health(p, today) {
    const tasks = p.tarefas || [];
    const e = evm(tasks, today, p.orcamento);
    const out = {};
    const put = (key, nivel, motivo) => {
      const d = out[key] || (out[key] = { nivel: 'ok', motivos: [] });
      d.nivel = worst(d.nivel, nivel);
      if (motivo) d.motivos.push(motivo);
    };
    ['governanca', 'escopo', 'cronograma', 'financas', 'partes', 'recursos', 'riscos'].forEach((k) => put(k, 'ok'));

    // Governança: termo aprovado, patrocinador, marcos de decisão em dia
    if (!p.patrocinador) put('governanca', 'atencao', 'Projeto sem patrocinador definido');
    if (!p.aprovadoEm && p.status !== 'proposta') put('governanca', 'atencao', 'Termo de abertura não aprovado');
    const gatesAtrasados = (p.marcos || []).filter((g) => g.status === 'pendente' && parseDate(g.data) != null && parseDate(g.data) < parseDate(today));
    if (gatesAtrasados.length) {
      const maxAtraso = Math.max(...gatesAtrasados.map((g) => daysBetween(g.data, today)));
      put('governanca', gatesAtrasados.length > 1 || maxAtraso > 14 ? 'critico' : 'atencao',
        `${gatesAtrasados.length} marco(s)/gate(s) com decisão atrasada`);
    }

    // Escopo
    if (!p.escopoIncluido) put('escopo', 'atencao', 'Escopo não descrito no termo de abertura');
    if (!tasks.length) put('escopo', 'atencao', 'Nenhuma tarefa/entrega planejada');
    const mudancasAbertas = (p.mudancas || []).filter((m) => m.status === 'analise').length;
    if (mudancasAbertas >= 3) put('escopo', 'critico', `${mudancasAbertas} solicitações de mudança aguardando decisão`);
    else if (mudancasAbertas) put('escopo', 'atencao', `${mudancasAbertas} solicitação(ões) de mudança aguardando decisão`);

    // Cronograma
    const atrasadas = tasks.filter((t) => isOverdue(t, today)).length;
    if (e.SPI != null && e.SPI < 0.8) put('cronograma', 'critico', `IDP ${dec(e.SPI)}: entregas bem abaixo do planejado`);
    else if (e.SPI != null && e.SPI < 0.95) put('cronograma', 'atencao', `IDP ${dec(e.SPI)}: entregas abaixo do planejado`);
    if (atrasadas >= 3) put('cronograma', 'critico', `${atrasadas} tarefas atrasadas`);
    else if (atrasadas) put('cronograma', 'atencao', `${atrasadas} tarefa(s) atrasada(s)`);
    if (p.fim && parseDate(p.fim) < parseDate(today) && !['concluido', 'cancelado'].includes(p.status)) {
      put('cronograma', 'critico', 'Data de término do projeto já passou');
    }

    // Finanças
    if (!num(p.orcamento) && !e.temCusto) put('financas', 'atencao', 'Sem orçamento nem custos planejados');
    if (e.CPI != null && e.CPI < 0.8) put('financas', 'critico', `IDC ${dec(e.CPI)}: custo muito acima do valor entregue`);
    else if (e.CPI != null && e.CPI < 0.95) put('financas', 'atencao', `IDC ${dec(e.CPI)}: custo acima do valor entregue`);
    if (e.EAC != null && e.orcamento > 0) {
      if (e.EAC > e.orcamento * 1.1) put('financas', 'critico', 'Estimativa no término supera o orçamento em mais de 10%');
      else if (e.EAC > e.orcamento) put('financas', 'atencao', 'Estimativa no término acima do orçamento');
    }

    // Partes interessadas
    const partes = p.partes || [];
    if (!partes.length) put('partes', 'atencao', 'Nenhuma parte interessada identificada');
    const resistentes = partes.filter((s) => num(s.poder) >= 4 && s.atitude === 'resistente');
    if (resistentes.some((s) => !s.estrategia)) put('partes', 'critico', 'Parte interessada influente e resistente sem estratégia de engajamento');
    else if (resistentes.length) put('partes', 'atencao', `${resistentes.length} parte(s) interessada(s) influente(s) resistente(s)`);

    // Recursos
    if (!(p.equipe || []).length) put('recursos', 'atencao', 'Equipe não cadastrada');
    const sobrecarga = workload(p, today).filter((w) => w.sobrecarga);
    if (sobrecarga.length) put('recursos', 'atencao', `Alocação acima de 100%: ${sobrecarga.map((w) => w.nome).join(', ')}`);
    const semDono = tasks.filter((t) => !isDone(t) && !t.responsavel).length;
    if (semDono) put('recursos', 'atencao', `${semDono} tarefa(s) aberta(s) sem responsável`);

    // Riscos
    const riscos = p.riscos || [];
    const altos = riscos.filter((r) => riskOpen(r) && r.tipo !== 'oportunidade' && riskLevel(riskScore(r)) === 'alto');
    if (!riscos.length) put('riscos', 'atencao', 'Nenhum risco identificado');
    if (altos.some((r) => !r.plano)) put('riscos', 'critico', 'Risco alto sem plano de resposta');
    else if (altos.length) put('riscos', 'atencao', `${altos.length} risco(s) alto(s) em aberto`);
    if (riscos.some((r) => r.status === 'ocorrido')) put('riscos', 'atencao', 'Risco materializado: tratar como questão');

    let geral = 'ok';
    Object.values(out).forEach((d) => { geral = worst(geral, d.nivel); });
    // Maioria dos domínios em atenção também torna o projeto crítico
    const nAtencao = Object.values(out).filter((d) => d.nivel !== 'ok').length;
    if (geral === 'atencao' && nAtencao >= 5) geral = 'critico';
    return { dominios: out, geral, evm: e, atrasadas };
  }

  return {
    parseDate, toISO, addDays, daysBetween, num, clamp, round,
    isDone, taskProgress, isOverdue, plannedFraction, duration, physicalProgress, evm,
    riskScore, riskLevel, riskOpen, quadrant, workload, burndown, velocity, kpiProgress,
    tailoring, health,
  };
});
