/* Listas e utilitários compartilhados pelos módulos. */
(function () {
  'use strict';

  const Common = {
    CLASSES: [['', '—'], ['CC', 'CC — Crítica (segurança/legal)'], ['SC', 'SC — Significativa (ajuste/função)']],
    STATUS_ACAO: ['Pendente', 'Em andamento', 'Concluído', 'N/A'],

    /** Gera o próximo número sequencial no formato PREFIXO-AAAA-NNN. */
    nextNumber(collection, prefix, key = 'numero') {
      const year = new Date().getFullYear();
      const base = `${prefix}-${year}-`;
      const max = Store.all(collection)
        .map((r) => String(r[key] || ''))
        .filter((n) => n.startsWith(base))
        .map((n) => parseInt(n.slice(base.length), 10) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
      return base + String(max + 1).padStart(3, '0');
    },

    /** Indicador de KPI. */
    kpi(label, value, level, hint) {
      return UI.el('div', { class: `kpi kpi-${level || 'neutral'}` },
        UI.el('div', { class: 'kpi-value' }, value),
        UI.el('div', { class: 'kpi-label' }, label),
        hint ? UI.el('div', { class: 'kpi-hint' }, hint) : null);
    },

    /** Tabela compacta de chave/valor para resultados de análises. */
    stats(pairs) {
      return UI.el('dl', { class: 'stats' }, pairs.filter(Boolean).map(([k, v]) => [UI.el('dt', null, k), UI.el('dd', null, v instanceof Node ? v : UI.fmt(v, 4))]));
    },

    /** Barra de progresso. */
    progress(pct, label) {
      const level = pct >= 100 ? 'ok' : pct >= 50 ? 'warn' : 'bad';
      return UI.el('div', { class: 'progress-row' },
        UI.el('div', { class: 'progress-label' }, label),
        UI.el('div', { class: 'progress' }, UI.el('div', { class: `progress-bar bar-${level}`, style: { width: `${Math.min(100, pct)}%` } })),
        UI.el('div', { class: 'progress-pct' }, `${Math.round(pct)}%`));
    },

    isLate(prazo, status) {
      return !!prazo && status !== 'Concluído' && status !== 'N/A' && prazo < UI.today();
    },
  };

  window.Common = Common;
})();
