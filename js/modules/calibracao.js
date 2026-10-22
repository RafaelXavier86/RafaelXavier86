/* Instrumentos de medição e calibração — IATF 16949 — 7.1.5.2 / 7.1.5.2.1 / 7.1.5.3. */
(function () {
  'use strict';
  const { badge, fmtDate } = UI;

  function nextDate(rec) {
    if (!rec.ultimaCalibracao || !Calc.num(rec.periodicidade)) return '';
    const [y, m, d] = rec.ultimaCalibracao.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + Calc.num(rec.periodicidade), d));
    return dt.toISOString().slice(0, 10);
  }

  function status(rec) {
    if (rec.situacao && rec.situacao !== 'Em uso') return rec.situacao;
    const next = nextDate(rec);
    if (!next) return 'Sem programação';
    const today = UI.today();
    if (next < today) return 'Vencido';
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return next <= in30 ? 'Vence em 30 dias' : 'Em dia';
  }

  App.register({
    id: 'instrumentos',
    collection: 'instrumentos',
    group: 'Lançamentos',
    icon: '⌖',
    title: 'Instrumentos e Calibração',
    short: 'Calibração',
    clause: 'IATF 16949 — 7.1.5.2.1 / 7.1.5.3',
    description: 'Cadastro de instrumentos, controle de vencimento de calibração e registros de verificação.',
    recordTitle: (r) => `${r.codigo || 'Instrumento'} — ${r.descricao || ''}`,
    newRecord: () => ({ periodicidade: '12', situacao: 'Em uso', registros: [] }),
    fields: [
      { key: 'codigo', label: 'Código / TAG', required: true },
      { key: 'descricao', label: 'Descrição', required: true, span: 2 },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Paquímetro', 'Micrômetro', 'Relógio comparador', 'Calibrador passa/não passa', 'Dispositivo de controle', 'Torquímetro', 'Máquina de medição (CMM)', 'Rugosímetro', 'Balança', 'Outro'] },
      { key: 'fabricante', label: 'Fabricante' },
      { key: 'numeroSerie', label: 'Nº de série' },
      { key: 'faixa', label: 'Faixa de medição' },
      { key: 'resolucao', label: 'Resolução' },
      { key: 'local', label: 'Local de uso' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'ultimaCalibracao', label: 'Última calibração', type: 'date' },
      { key: 'periodicidade', label: 'Periodicidade (meses)', type: 'number' },
      { key: 'laboratorio', label: 'Laboratório' },
      { key: 'acreditado', label: 'Laboratório acreditado ISO/IEC 17025', type: 'checkbox' },
      { key: 'situacao', label: 'Situação', type: 'select', options: ['Em uso', 'Bloqueado', 'Em calibração', 'Fora de uso'] },
    ],
    rows: {
      key: 'registros',
      title: 'Histórico de calibrações / verificações',
      columns: [
        { key: 'data', label: 'Data', type: 'date', width: '130px' },
        { key: 'certificado', label: 'Nº certificado', width: '120px' },
        { key: 'laboratorio', label: 'Laboratório', width: '140px' },
        { key: 'erro', label: 'Erro / Incerteza', width: '120px' },
        { key: 'resultado', label: 'Resultado', type: 'select', options: ['Aprovado', 'Reprovado'], width: '110px' },
        { key: 'obs', label: 'Observação (avaliação de impacto se reprovado)', width: '220px' },
      ],
      newRow: () => ({ data: UI.today() }),
    },
    beforeSave(rec) {
      const last = (rec.registros || []).map((r) => r.data).filter(Boolean).sort().pop();
      if (last && (!rec.ultimaCalibracao || last > rec.ultimaCalibracao)) rec.ultimaCalibracao = last;
      rec.proximaCalibracao = nextDate(rec);
    },
    analysisTitle: 'Situação da calibração',
    analysis(rec) {
      const st = status(rec);
      const reprov = (rec.registros || []).filter((r) => r.resultado === 'Reprovado');
      return UI.el('div', { class: 'stack' },
        UI.el('div', { class: 'kpis' },
          Common.kpi('Próxima calibração', fmtDate(nextDate(rec))),
          Common.kpi('Situação', st, UI.levelOf(st))),
        reprov.length ? UI.el('div', { class: 'alert alert-bad' }, 'Instrumento com calibração reprovada: avalie a validade das medições anteriores e o produto potencialmente afetado; notifique o cliente se produto suspeito foi expedido (IATF 7.1.5.2.1).') : null);
    },
    listColumns: [
      { key: 'codigo', label: 'Código' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'local', label: 'Local' },
      { key: 'ultimaCalibracao', label: 'Última', render: (r) => fmtDate(r.ultimaCalibracao) },
      { key: 'proxima', label: 'Próxima', render: (r) => fmtDate(nextDate(r)) },
      { key: 'status', label: 'Situação', render: (r) => { const s = status(r); return badge(s, UI.levelOf(s)); } },
    ],
    csv(records) {
      return {
        headers: ['Código', 'Descrição', 'Tipo', 'Fabricante', 'Nº série', 'Faixa', 'Resolução', 'Local', 'Responsável', 'Última calibração', 'Periodicidade (meses)', 'Próxima', 'Laboratório', 'Acreditado', 'Situação'],
        rows: records.map((r) => [r.codigo, r.descricao, r.tipo, r.fabricante, r.numeroSerie, r.faixa, r.resolucao, r.local, r.responsavel,
          fmtDate(r.ultimaCalibracao), r.periodicidade, fmtDate(nextDate(r)), r.laboratorio, r.acreditado ? 'Sim' : 'Não', status(r)]),
      };
    },
  });

  window.Instrumentos = { status, nextDate };
})();
