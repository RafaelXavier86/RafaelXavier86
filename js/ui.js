/*
 * Componentes de interface: criação de elementos, formulários, tabelas
 * editáveis, modais, avisos, exportação CSV, impressão e gráficos SVG.
 */
(function () {
  'use strict';

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    append(node, children);
    return node;
  }

  /** Acrescenta filhos (aceita arrays aninhados; ignora null/false). */
  function add(node, ...children) {
    return append(node, children);
  }

  /** Substitui o conteúdo do nó pelos filhos informados. */
  function fill(node, ...children) {
    node.replaceChildren();
    return append(node, children);
  }

  function append(node, children) {
    children.flat(Infinity).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  function fmt(v, digits = 3) {
    if (v === null || v === undefined || v === '' || Number.isNaN(v)) return '—';
    if (typeof v !== 'number') return String(v);
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function fmtDate(v) {
    if (!v) return '—';
    const [y, m, d] = String(v).slice(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : String(v);
  }

  function today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function badge(text, level) {
    return el('span', { class: `badge badge-${level || 'neutral'}` }, text);
  }

  /** Mapeia valores comuns para o nível do selo (ok/warn/bad/neutral). */
  function levelOf(v) {
    const map = {
      OK: 'ok', Aprovado: 'ok', 'Concluído': 'ok', Fechada: 'ok', 'Em dia': 'ok', L: 'ok', Aceitável: 'ok',
      NOK: 'bad', Reprovado: 'bad', Vencido: 'bad', H: 'bad', Aberta: 'bad', Atrasado: 'bad', Rejeitado: 'bad',
      M: 'warn', Pendente: 'warn', 'Em andamento': 'warn', 'Em análise': 'warn', Retrabalho: 'warn',
      Segregado: 'warn', 'Liberado sob desvio': 'warn', 'Vence em 30 dias': 'warn', 'Aprovação interina': 'warn',
    };
    return map[v] || 'neutral';
  }

  // ---------- Campos de formulário ----------

  function input(field, rec, onChange) {
    const v = rec[field.key] ?? '';
    const common = {
      id: `f-${field.key}`,
      name: field.key,
      required: field.required,
      readonly: field.readonly,
      placeholder: field.placeholder || '',
    };
    let node;
    const set = (val) => { rec[field.key] = val; onChange && onChange(field.key, val); };

    if (field.type === 'select') {
      node = el('select', common,
        el('option', { value: '' }, '— selecione —'),
        (typeof field.options === 'function' ? field.options(rec) : field.options).map((o) => {
          const [val, label] = Array.isArray(o) ? o : [o, o];
          return el('option', { value: val, selected: String(val) === String(v) }, label);
        }));
      node.addEventListener('change', () => set(node.value));
    } else if (field.type === 'textarea') {
      node = el('textarea', Object.assign(common, { rows: field.rows || 3 }));
      node.value = v;
      node.addEventListener('input', () => set(node.value));
    } else if (field.type === 'checkbox') {
      node = el('input', Object.assign(common, { type: 'checkbox', checked: !!v }));
      node.addEventListener('change', () => set(node.checked));
    } else {
      const type = field.type === 'number' ? 'text' : field.type || 'text';
      node = el('input', Object.assign(common, {
        type,
        inputmode: field.type === 'number' ? 'decimal' : null,
        value: v,
        min: field.min, max: field.max,
      }));
      node.addEventListener('input', () => set(node.value));
    }
    return node;
  }

  function formGrid(fields, rec, onChange) {
    return el('div', { class: 'form-grid' }, fields.map((f) => {
      if (f.type === 'section') return el('h3', { class: 'form-section' }, f.label);
      return el('label', { class: `field span-${f.span || 1}`, for: `f-${f.key}` },
        el('span', { class: 'field-label' }, f.label, f.required ? el('b', { class: 'req' }, ' *') : null),
        input(f, rec, onChange),
        f.help ? el('small', { class: 'field-help' }, f.help) : null);
    }));
  }

  // ---------- Tabela editável de linhas ----------

  function rowsEditor(cfg, rec, onChange) {
    const key = cfg.key;
    if (!Array.isArray(rec[key])) rec[key] = [];
    const columns = typeof cfg.columns === 'function' ? cfg.columns(rec) : cfg.columns;
    const wrap = el('div', { class: 'rows-editor' });
    const tbody = el('tbody');

    function computedCell(col, row) {
      const out = col.computed(row, rec);
      const text = out && typeof out === 'object' ? out.text : out;
      const level = out && typeof out === 'object' ? out.level : levelOf(text);
      return text === null || text === undefined || text === '' ? '—' : badge(text, level);
    }

    function renderRow(row, idx) {
      const tr = el('tr');
      const computedTds = [];
      const refresh = () => computedTds.forEach(([td, col]) => { td.replaceChildren(computedCell(col, row)); });
      columns.forEach((col) => {
        if (col.computed) {
          const td = el('td', { class: 'computed' }, computedCell(col, row));
          computedTds.push([td, col]);
          tr.appendChild(td);
        } else if (col.readonly) {
          tr.appendChild(el('td', { class: 'readonly' }, row[col.key] ?? ''));
        } else {
          tr.appendChild(el('td', null, input(Object.assign({}, col, { placeholder: col.placeholder || '' }), row, () => {
            refresh();
            onChange && onChange();
          })));
        }
      });
      tr.appendChild(el('td', { class: 'row-actions' }, cfg.fixed ? null : el('button', {
        type: 'button', class: 'btn-icon', title: 'Remover linha',
        onclick: () => { rec[key].splice(idx, 1); render(); onChange && onChange(); },
      }, '✕')));
      return tr;
    }

    function render() {
      tbody.replaceChildren(...rec[key].map(renderRow));
      if (!rec[key].length) {
        tbody.appendChild(el('tr', null, el('td', { colspan: columns.length + 1, class: 'empty' }, cfg.empty || 'Nenhuma linha. Clique em “Adicionar linha”.')));
      }
    }

    const table = el('div', { class: 'table-scroll' }, el('table', { class: 'grid' },
      el('thead', null, el('tr', null, columns.map((c) => el('th', { style: c.width ? { minWidth: c.width } : null }, c.label)), el('th'))),
      tbody));

    wrap.appendChild(el('div', { class: 'rows-head' },
      el('h3', null, cfg.title),
      el('div', { class: 'rows-tools' },
        (cfg.tools ? cfg.tools(rec, render, onChange) : []),
        cfg.fixed ? null : el('button', {
          type: 'button', class: 'btn btn-secondary',
          onclick: () => { rec[key].push(cfg.newRow ? cfg.newRow(rec) : {}); render(); onChange && onChange(); },
        }, '+ Adicionar linha'))));
    wrap.appendChild(table);
    render();
    return wrap;
  }

  // ---------- Tabela simples (somente leitura) ----------

  function table(columns, rows, opts = {}) {
    if (!rows.length) return el('p', { class: 'empty' }, opts.empty || 'Nenhum registro encontrado.');
    return el('div', { class: 'table-scroll' }, el('table', { class: 'list' },
      el('thead', null, el('tr', null, columns.map((c) => el('th', null, c.label)))),
      el('tbody', null, rows.map((r) => el('tr', {
        class: opts.onRow ? 'clickable' : null,
        onclick: opts.onRow ? () => opts.onRow(r) : null,
      }, columns.map((c) => {
        const v = c.render ? c.render(r) : r[c.key];
        return el('td', { class: c.class }, v instanceof Node ? v : fmt(v));
      }))))));
  }

  // ---------- Modal, confirmação e avisos ----------

  function modal(title, content, actions, extraClass) {
    const overlay = el('div', { class: 'modal-overlay' });
    const close = () => overlay.remove();
    const box = el('div', { class: `modal ${extraClass || ''}`, role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'modal-head' }, el('h2', null, title), el('button', { class: 'btn-icon', onclick: close, title: 'Fechar' }, '✕')),
      el('div', { class: 'modal-body' }, content),
      el('div', { class: 'modal-foot' }, (actions || []).map((a) => el('button', {
        class: `btn ${a.class || 'btn-secondary'}`,
        onclick: () => { if (a.onClick && a.onClick() === false) return; close(); },
      }, a.label))));
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    return { close };
  }

  function confirm(message, onYes) {
    modal('Confirmar', el('p', null, message), [
      { label: 'Cancelar' },
      { label: 'Confirmar', class: 'btn-danger', onClick: onYes },
    ]);
  }

  function toast(message, level = 'ok') {
    let host = document.getElementById('toasts');
    if (!host) host = document.body.appendChild(el('div', { id: 'toasts' }));
    const t = el('div', { class: `toast toast-${level}` }, message);
    host.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------- Exportação ----------

  // Dentro de um iframe (ex.: prévia publicada) downloads e impressão costumam ser bloqueados;
  // nesse caso o conteúdo é exibido para copiar ou visualizar.
  const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  function copyBox(title, text, hint) {
    const area = el('textarea', { class: 'copy-box', rows: 12, readonly: true });
    area.value = text;
    modal(title, el('div', { class: 'stack' }, el('p', { class: 'muted' }, hint), area), [
      { label: 'Fechar' },
      {
        label: 'Copiar', class: 'btn-primary', onClick: () => {
          const fallback = () => { area.focus(); area.select(); toast('Texto selecionado: use Ctrl+C para copiar.', 'warn'); };
          try {
            navigator.clipboard.writeText(text).then(() => toast('Copiado para a área de transferência.'), fallback);
          } catch (e) { fallback(); }
          return false;
        },
      },
    ], 'modal-wide');
  }

  function download(filename, content, mime) {
    if (embedded) {
      copyBox(filename, content, 'Nesta versão de teste o navegador não permite baixar arquivos. Copie o conteúdo abaixo e salve-o em um arquivo de texto.');
      return;
    }
    const blob = new Blob([content], { type: mime });
    const a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /** CSV com ";" e BOM para abrir corretamente no Excel em português. */
  function downloadCSV(filename, headers, rows) {
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    if (embedded) {
      const tsv = [headers, ...rows].map((r) => r.map((v) => (v === null || v === undefined ? '' : String(typeof v === 'number' ? String(v).replace('.', ',') : v).replace(/[\t\r\n]+/g, ' '))).join('\t')).join('\n');
      copyBox('Exportar para Excel', tsv, `${rows.length} linha(s). Nesta versão de teste o download está bloqueado: clique em Copiar e cole na célula A1 de uma planilha do Excel; as colunas são separadas automaticamente.`);
      return;
    }
    const csv = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
    download(filename, '﻿' + csv, 'text/csv;charset=utf-8');
  }

  /** Monta um relatório para impressão / salvar em PDF pelo navegador. */
  function printReport(title, content) {
    const s = Store.settings();
    const area = document.getElementById('print-area');
    const doc = el('div', { class: 'print-doc' },
      el('header', { class: 'print-header' },
        el('div', null, el('strong', null, s.empresa || ''), el('div', { class: 'muted' }, 'Sistema de Gestão da Qualidade — IATF 16949')),
        el('div', { class: 'print-meta' }, el('div', null, title), el('div', { class: 'muted' }, 'Emitido em ' + new Date().toLocaleString('pt-BR')))),
      content,
      el('footer', { class: 'print-footer' },
        el('div', null, 'Elaborado por: ____________________'),
        el('div', null, 'Aprovado por: ____________________')));
    if (embedded) {
      modal('Prévia do relatório', el('div', { class: 'stack' },
        el('div', { class: 'alert alert-warn' }, 'Nesta versão de teste o navegador não permite imprimir. No app instalado (index.html), este botão abre a impressão, onde você pode salvar em PDF.'),
        el('div', { class: 'print-preview' }, doc)), [{ label: 'Fechar' }], 'modal-wide');
      return;
    }
    area.replaceChildren(doc);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 500); }, 50);
  }

  // ---------- Gráficos SVG ----------

  const SVG = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...children) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) node.setAttribute(k, v);
    children.flat(Infinity).forEach((c) => c && node.appendChild(c instanceof Node ? c : document.createTextNode(String(c))));
    return node;
  }

  /** Carta de controle com linha central, LSC/LIC e destaque de pontos com sinal. */
  function controlChart({ title, points, center, ucl, lcl, flagged = [], unit = '' }) {
    const W = 720, H = 240, pl = 64, pr = 92, pt = 28, pb = 28;
    const vals = points.filter((v) => v !== null);
    const lo = Math.min(...vals, lcl), hi = Math.max(...vals, ucl);
    const pad = (hi - lo) * 0.12 || 1;
    const y0 = lo - pad, y1 = hi + pad;
    const x = (i) => pl + (points.length <= 1 ? 0 : (i * (W - pl - pr)) / (points.length - 1));
    const y = (v) => pt + ((y1 - v) * (H - pt - pb)) / (y1 - y0);

    const line = (v, cls, label) => [
      s('line', { x1: pl, x2: W - pr, y1: y(v), y2: y(v), class: cls }),
      s('text', { x: W - pr + 6, y: y(v) + 4, class: 'chart-label' }, `${label} ${fmt(v, 4)}`),
    ];
    let path = '';
    points.forEach((v, i) => { if (v !== null) path += `${path ? 'L' : 'M'}${x(i)},${y(v)}`; });
    const flaggedSet = new Set(flagged);

    return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title },
      s('text', { x: pl, y: 16, class: 'chart-title' }, title + (unit ? ` (${unit})` : '')),
      s('line', { x1: pl, x2: pl, y1: pt, y2: H - pb, class: 'axis' }),
      s('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, class: 'axis' }),
      [y0, (y0 + y1) / 2, y1].map((v) => s('text', { x: pl - 6, y: y(v) + 4, class: 'chart-tick', 'text-anchor': 'end' }, fmt(v, 3))),
      line(ucl, 'limit', 'LSC'), line(center, 'center', 'LC'), line(lcl, 'limit', 'LIC'),
      s('path', { d: path, class: 'series' }),
      points.map((v, i) => (v === null ? null : s('circle', {
        cx: x(i), cy: y(v), r: flaggedSet.has(i) ? 5 : 3.5,
        class: flaggedSet.has(i) ? 'point flagged' : 'point',
      }, s('title', null, `#${i + 1}: ${fmt(v, 4)}`)))),
      points.map((_, i) => (points.length <= 30 || i % 5 === 0
        ? s('text', { x: x(i), y: H - pb + 16, class: 'chart-tick', 'text-anchor': 'middle' }, i + 1) : null)));
  }

  /** Histograma com limites de especificação. */
  function histogram({ title, values, lsl, usl }) {
    const W = 720, H = 236, pl = 40, pr = 20, pt = 44, pb = 30;
    const lo0 = Math.min(...values, lsl ?? Infinity), hi0 = Math.max(...values, usl ?? -Infinity);
    const span = hi0 - lo0 || 1;
    const lo = lo0 - span * 0.05, hi = hi0 + span * 0.05;
    const bins = Math.max(5, Math.min(20, Math.round(Math.sqrt(values.length))));
    const vlo = Math.min(...values), vhi = Math.max(...values);
    const bw = (vhi - vlo) / bins || 1;
    const counts = new Array(bins).fill(0);
    values.forEach((v) => { counts[Math.min(bins - 1, Math.floor((v - vlo) / bw))]++; });
    const maxC = Math.max(...counts);
    const x = (v) => pl + ((v - lo) * (W - pl - pr)) / (hi - lo);
    const y = (c) => H - pb - (c * (H - pt - pb)) / maxC;
    const spec = (v, label) => (v === null || v === undefined ? null : [
      s('line', { x1: x(v), x2: x(v), y1: pt, y2: H - pb, class: 'spec' }),
      s('text', { x: x(v), y: pt - 4, class: 'chart-label', 'text-anchor': 'middle' }, `${label} ${fmt(v, 4)}`),
    ]);
    return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title },
      s('text', { x: pl, y: 14, class: 'chart-title' }, title),
      counts.map((c, i) => s('rect', {
        x: x(vlo + i * bw) + 1, y: y(c), width: Math.max(1, x(vlo + (i + 1) * bw) - x(vlo + i * bw) - 2), height: H - pb - y(c), class: 'bar',
      }, s('title', null, `${fmt(vlo + i * bw, 4)} – ${fmt(vlo + (i + 1) * bw, 4)}: ${c}`))),
      s('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, class: 'axis' }),
      spec(lsl, 'LIE'), spec(usl, 'LSE'),
      [vlo, (vlo + vhi) / 2, vhi].map((v) => s('text', { x: x(v), y: H - pb + 16, class: 'chart-tick', 'text-anchor': 'middle' }, fmt(v, 3))));
  }

  /** Pareto horizontal (barras ordenadas com rótulo e valor). */
  function pareto({ title, items }) {
    const top = items.slice(0, 10);
    const W = 720, rowH = 26, pl = 230, pr = 60, pt = 28;
    const H = pt + top.length * rowH + 10;
    const max = Math.max(...top.map((i) => i.value), 1);
    const total = items.reduce((a, b) => a + b.value, 0);
    let acc = 0;
    return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title },
      s('text', { x: 0, y: 16, class: 'chart-title' }, title),
      top.map((it, i) => {
        acc += it.value;
        const yy = pt + i * rowH;
        const w = ((W - pl - pr) * it.value) / max;
        const label = it.label.length > 34 ? it.label.slice(0, 33) + '…' : it.label;
        return [
          s('text', { x: pl - 8, y: yy + 16, class: 'chart-tick', 'text-anchor': 'end' }, label, s('title', null, it.label)),
          s('rect', { x: pl, y: yy + 4, width: Math.max(2, w), height: rowH - 8, rx: 3, class: 'bar bar-bad' }),
          s('text', { x: pl + w + 6, y: yy + 16, class: 'chart-label' }, `${it.value} (${fmt((100 * acc) / total, 0)}%)`),
        ];
      }));
  }

  window.UI = {
    embedded, el, append, add, fill, fmt, fmtDate, today, badge, levelOf, input, formGrid, rowsEditor, table,
    modal, confirm, toast, download, downloadCSV, printReport, controlChart, histogram, pareto,
  };
})();
