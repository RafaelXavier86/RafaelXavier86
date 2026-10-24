/*
 * Componentes de interface: criação de elementos, formulários, janelas,
 * avisos, formatação (pt-BR), cópia/baixa de arquivos e tabelas.
 */
(function () {
  'use strict';

  function append(node, kids) {
    kids.flat(Infinity).forEach((k) => {
      if (k == null || k === false) return;
      node.append(k instanceof Node ? k : String(k));
    });
  }
  function setAttrs(n, attrs) {
    if (!attrs) return;
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.setAttribute('class', v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? '' : v);
    });
  }
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    setAttrs(n, attrs);
    append(n, kids);
    return n;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...kids) {
    const n = document.createElementNS(SVGNS, tag);
    setAttrs(n, attrs);
    append(n, kids);
    return n;
  }
  function fill(node, ...kids) { node.replaceChildren(); append(node, kids); return node; }

  // ---------- Formatação ----------

  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const money = (v) => (v == null || !Number.isFinite(+v) ? '—' : brl.format(+v));
  const moneyK = (v) => {
    if (v == null || !Number.isFinite(+v)) return '—';
    const a = Math.abs(v);
    return a >= 1e6 ? `R$ ${nf2.format(v / 1e6)} mi` : a >= 1e4 ? `R$ ${nf0.format(v / 1e3)} mil` : brl.format(v);
  };
  const idx = (v) => (v == null ? '—' : nf2.format(v));
  const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${nf0.format(v * 100)}%`);
  const n0 = (v) => nf0.format(v || 0);
  function date(s) {
    if (!s) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  }
  function dateShort(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? `${m[3]}/${m[2]}` : '—';
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function initials(nome) {
    return String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  // ---------- Selos de estado ----------

  const NIVEL = { ok: ['No rumo', 'ok'], atencao: ['Atenção', 'warn'], critico: ['Crítico', 'bad'] };
  function health(nivel, short) {
    const [txt, cls] = NIVEL[nivel] || ['—', 'neutral'];
    return el('span', { class: `pill pill-${cls}` }, el('span', { class: 'dot', 'aria-hidden': 'true' }), short ? null : txt);
  }
  function pill(text, cls) { return el('span', { class: `pill pill-${cls || 'neutral'}` }, text); }
  function bar(frac, cls, label) {
    const v = Math.max(0, Math.min(1, frac || 0));
    return el('span', { class: `bar ${cls || ''}`, role: 'img', 'aria-label': label || pct(v) },
      el('span', { class: 'bar-fill', style: { width: `${v * 100}%` } }));
  }

  // ---------- Formulários ----------

  /*
   * fields: [{ key, label, type: text|textarea|date|number|money|select|scale, options, full, help, required, placeholder }]
   * options: [[valor, rótulo], ...] ou lista de textos.
   */
  function form(fields, data, prefix) {
    const inputs = {};
    const node = el('div', { class: 'form-grid' });
    fields.forEach((f) => {
      const id = `${prefix || 'f'}-${f.key}`;
      const v = data[f.key] == null ? '' : data[f.key];
      let input;
      if (f.type === 'textarea') {
        input = el('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder });
        input.value = v;
      } else if (f.type === 'select' || f.type === 'scale') {
        const opts = f.type === 'scale'
          ? [['', '—'], ...[1, 2, 3, 4, 5].map((n) => [String(n), `${n} — ${f.scale[n - 1]}`])]
          : (typeof f.options === 'function' ? f.options() : f.options).map((o) => (Array.isArray(o) ? o : [o, o]));
        input = el('select', { id }, opts.map(([val, lab]) => el('option', { value: val }, lab)));
        input.value = String(v);
        if (input.value !== String(v) && v !== '') input.append(el('option', { value: v, selected: true }, v));
      } else {
        const type = f.type === 'money' ? 'number' : f.type || 'text';
        input = el('input', { id, type, placeholder: f.placeholder, min: f.min, max: f.max, step: f.step || (f.type === 'money' ? '0.01' : null), inputmode: type === 'number' ? 'decimal' : null });
        input.value = v;
      }
      let datalist = null;
      if (f.datalist) {
        datalist = el('datalist', { id: `${id}-dl` }, f.datalist.map((o) => el('option', { value: o })));
        input.setAttribute('list', `${id}-dl`);
      }
      if (f.required) input.required = true;
      inputs[f.key] = { input, f };
      node.append(el('div', { class: `field${f.full ? ' full' : ''}` },
        el('label', { for: id }, f.label, f.required ? el('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
        input, datalist,
        f.help ? el('small', { class: 'muted' }, f.help) : null));
    });
    return {
      node,
      inputs,
      read() {
        const out = {};
        Object.entries(inputs).forEach(([k, { input, f }]) => {
          const raw = input.value;
          out[k] = ['number', 'money', 'scale'].includes(f.type) && raw !== '' ? Number(raw) : raw.trim ? raw.trim() : raw;
        });
        return out;
      },
      validate() {
        const miss = Object.values(inputs).find(({ input, f }) => f.required && !String(input.value).trim());
        if (miss) { miss.input.focus(); toast(`Preencha o campo "${miss.f.label}".`, 'bad'); return false; }
        return true;
      },
    };
  }

  // ---------- Janelas e avisos ----------

  let openModal = null;
  function modal(title, body, actions, opts) {
    closeModal();
    const close = () => closeModal();
    const box = el('div', { class: `modal${opts && opts.wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div', { class: 'modal-head' },
        el('h2', null, title),
        el('button', { class: 'btn-icon', 'aria-label': 'Fechar', onclick: close }, '✕')),
      el('div', { class: 'modal-body' }, body),
      el('div', { class: 'modal-foot' }, (actions || [{ label: 'Fechar' }]).map((a) => el('button', {
        class: `btn ${a.class || ''}`,
        onclick: () => {
          if (a.onClick && a.onClick() === false) return;
          // A ação pode ter aberto outra janela; fecha só esta
          if (openModal && openModal.overlay === overlay) close();
        },
      }, a.label))));
    const overlay = el('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, box);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    openModal = { overlay, onKey, prev: document.activeElement };
    const first = box.querySelector('input, select, textarea') || box.querySelector('.modal-foot .btn');
    if (first) first.focus();
  }
  function closeModal() {
    if (!openModal) return;
    openModal.overlay.remove();
    document.removeEventListener('keydown', openModal.onKey);
    if (openModal.prev && openModal.prev.focus) openModal.prev.focus();
    openModal = null;
  }
  // Confirmação dentro da página (confirm() nativo não funciona em todos os ambientes)
  function confirmAction(title, text, label, onOk) {
    modal(title, el('p', null, text), [{ label: 'Cancelar' }, { label, class: 'btn-danger', onClick: onOk }]);
  }

  function toast(msg, kind) {
    const box = document.getElementById('toasts');
    const t = el('div', { class: `toast ${kind || ''}`, role: 'status' }, msg);
    box.append(t);
    setTimeout(() => t.remove(), 3800);
  }

  // ---------- Cópia e arquivos ----------

  function copyText(text, okMsg) {
    const fallback = () => {
      const ta = el('textarea', { class: 'copy-box', readonly: true, rows: 12 });
      ta.value = text;
      modal('Copie o texto abaixo', [el('p', { class: 'muted' }, 'Selecione tudo (Ctrl+A) e copie (Ctrl+C).'), ta]);
      ta.focus(); ta.select();
    };
    try {
      navigator.clipboard.writeText(text).then(() => toast(okMsg || 'Copiado para a área de transferência.'), fallback);
    } catch (e) { fallback(); }
  }
  // Dentro de um iframe (prévia publicada) o download pode ser bloqueado: oferece a cópia
  function download(filename, content, mime) {
    if (window.top !== window.self) { copyText(content, 'Backup copiado. Cole num arquivo .json para guardar.'); return; }
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(filename, headers, rows) {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
    download(filename, '﻿' + body, 'text/csv;charset=utf-8');
  }

  // ---------- Tabela ----------

  /*
   * cols: [{ label, get(row) -> nó ou texto, cls }]
   * onRow: clique na linha (abre edição). Linhas acessíveis por teclado.
   */
  function table(cols, rows, onRow, empty) {
    if (!rows.length) return el('p', { class: 'empty' }, empty || 'Nenhum registro.');
    return el('div', { class: 'table-wrap' }, el('table', { class: 'table' },
      el('thead', null, el('tr', null, cols.map((c) => el('th', { class: c.cls }, c.label)))),
      el('tbody', null, rows.map((r) => {
        const tr = el('tr', onRow ? { class: 'clickable', tabindex: '0', onclick: () => onRow(r), onkeydown: (e) => { if (e.key === 'Enter') onRow(r); } } : null,
          cols.map((c) => el('td', { class: c.cls }, c.get(r))));
        return tr;
      }))));
  }

  window.UI = {
    el, svg, fill, money, moneyK, idx, pct, n0, date, dateShort, today, initials,
    health, pill, bar, form, modal, closeModal, confirmAction, toast, copyText, download, csv, table,
  };
})();
