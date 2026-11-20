/* RXR 3D — utilitários de interface: formatação pt-BR, DOM, formulários, modal e avisos. */
(function () {
  'use strict';

  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const n = (v) => Calc.n(v);

  const UI = {
    brl: (v) => fmtBRL.format(n(v)),
    num: (v, d = 2) => n(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }),
    int: (v) => Math.round(n(v)).toLocaleString('pt-BR'),
    pct: (v, d = 1) => UI.num(v, d) + '%',
    markup: (v) => UI.num(v, 2) + '×',
    horas(h) {
      const tot = Math.round(n(h) * 60);
      const hh = Math.floor(tot / 60), mm = tot % 60;
      return hh + 'h' + (mm ? ' ' + String(mm).padStart(2, '0') + 'min' : '');
    },
    date(iso) {
      if (!iso) return '';
      const [y, m, d] = String(iso).slice(0, 10).split('-');
      return d && m && y ? `${d}/${m}/${y}` : '';
    },
    today() {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    },
    addDays(iso, days) {
      const d = new Date(iso + 'T12:00:00');
      d.setDate(d.getDate() + n(days));
      return d.toISOString().slice(0, 10);
    },
    /** Valor numérico para mostrar em campo de texto (vírgula decimal). */
    inNum(v, d) {
      if (v === '' || v === null || v === undefined) return '';
      const x = n(v);
      return d === undefined ? String(x).replace('.', ',') : x.toFixed(d).replace('.', ',');
    },
    esc(s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    maskDoc(v) {
      const d = String(v || '').replace(/\D/g, '').slice(0, 14);
      if (d.length <= 11) {
        return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      }
      return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    },
    maskFone(v) {
      const d = String(v || '').replace(/\D/g, '').slice(0, 11);
      if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
      return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    },
    maskCep(v) {
      return String(v || '').replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
    },

    /** Cria elemento: h('div', {class:'x', onclick: fn}, 'texto', outroEl) */
    h(tag, attrs, ...children) {
      const el = document.createElement(tag);
      if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
          if (v === null || v === undefined || v === false) continue;
          if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
          else if (k === 'html') el.innerHTML = v;
          else if (k === 'value') el.value = v;
          else if (v === true) el.setAttribute(k, '');
          else el.setAttribute(k, v);
        }
      }
      for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        el.append(c instanceof Node ? c : document.createTextNode(String(c)));
      }
      return el;
    },

    toast(msg, kind = 'ok') {
      const box = document.getElementById('toasts');
      const t = UI.h('div', { class: 'toast ' + kind }, msg);
      box.append(t);
      setTimeout(() => t.classList.add('out'), 3200);
      setTimeout(() => t.remove(), 3700);
    },

    /** Modal. Retorna { el, body, close }. */
    modal(title, body, { wide = false, actions = [] } = {}) {
      const back = UI.h('div', { class: 'modal-back' });
      const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      const foot = UI.h('div', { class: 'modal-foot' },
        actions.map((a) => UI.h('button', { class: 'btn ' + (a.kind || ''), type: 'button', onclick: () => a.onClick(close) }, a.label)));
      const box = UI.h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        UI.h('div', { class: 'modal-head' }, UI.h('h3', null, title),
          UI.h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Fechar', onclick: close }, '✕')),
        UI.h('div', { class: 'modal-body' }, body),
        actions.length ? foot : null);
      back.append(box);
      back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
      document.addEventListener('keydown', onKey);
      document.body.append(back);
      const first = box.querySelector('input, select, textarea');
      if (first) setTimeout(() => first.focus(), 30);
      return { el: box, body, close };
    },

    confirm(msg, onYes, label = 'Excluir') {
      UI.modal('Confirmar', UI.h('p', null, msg), {
        actions: [
          { label: 'Cancelar', onClick: (c) => c() },
          { label, kind: 'danger', onClick: (c) => { c(); onYes(); } },
        ],
      });
    },

    /**
     * Formulário a partir de uma lista de campos.
     * campo: { key, label, type: text|num|money|pct|select|textarea|date|check|doc|fone|cep,
     *          options: [[valor, rótulo]], required, help, span (1|2|3|4), placeholder }
     */
    form(fields, values = {}) {
      const form = UI.h('form', { class: 'grid-form', novalidate: true, onsubmit: (e) => e.preventDefault() });
      for (const f of fields) {
        if (f.type === 'section') { form.append(UI.h('h4', { class: 'form-section' }, f.label)); continue; }
        const id = 'f-' + f.key + '-' + Math.random().toString(36).slice(2, 6);
        const v = values[f.key];
        let input;
        if (f.type === 'select') {
          input = UI.h('select', { id, name: f.key },
            (f.options || []).map(([val, lab]) => UI.h('option', { value: val, selected: String(val) === String(v ?? f.default ?? '') }, lab)));
        } else if (f.type === 'textarea') {
          input = UI.h('textarea', { id, name: f.key, rows: f.rows || 3, placeholder: f.placeholder || '' }, v || '');
        } else if (f.type === 'check') {
          input = UI.h('input', { id, name: f.key, type: 'checkbox', checked: !!v });
        } else if (f.type === 'date') {
          input = UI.h('input', { id, name: f.key, type: 'date', value: v || f.default || '' });
        } else if (['num', 'money', 'pct'].includes(f.type)) {
          const shown = (v === undefined || v === null || v === '') ? (f.default !== undefined ? UI.inNum(f.default) : '') : UI.inNum(v);
          input = UI.h('input', { id, name: f.key, type: 'text', inputmode: 'decimal', value: shown, placeholder: f.placeholder || '', autocomplete: 'off' });
        } else {
          input = UI.h('input', { id, name: f.key, type: 'text', value: v || '', placeholder: f.placeholder || '', autocomplete: 'off' });
          if (f.suggest) {
            const lid = id + '-l';
            input.setAttribute('list', lid);
            form.append(UI.h('datalist', { id: lid }, f.suggest.map((s) => UI.h('option', { value: s }))));
          }
          const mask = { doc: UI.maskDoc, fone: UI.maskFone, cep: UI.maskCep }[f.type];
          if (mask) {
            input.value = mask(input.value);
            input.addEventListener('input', () => { input.value = mask(input.value); });
          }
        }
        if (f.required) input.required = true;
        const pre = f.type === 'money' ? 'R$' : null;
        const suf = f.type === 'pct' ? '%' : (f.suffix || null);
        const wrapped = (pre || suf) ? UI.h('div', { class: 'affix' }, pre ? UI.h('span', null, pre) : null, input, suf ? UI.h('span', null, suf) : null) : input;
        const field = UI.h('div', { class: 'field span-' + (f.span || 1) + (f.type === 'check' ? ' check' : '') },
          f.type === 'check'
            ? UI.h('label', { for: id, class: 'check-label' }, input, ' ', f.label)
            : [UI.h('label', { for: id }, f.label, f.required ? UI.h('span', { class: 'req' }, ' *') : null), wrapped],
          f.help ? UI.h('small', { class: 'help' }, f.help) : null);
        form.append(field);
      }
      return form;
    },

    readForm(form, fields) {
      const out = {};
      for (const f of fields) {
        if (f.type === 'section') continue;
        const el = form.elements[f.key];
        if (!el) continue;
        if (f.type === 'check') out[f.key] = el.checked;
        else if (['num', 'money', 'pct'].includes(f.type)) out[f.key] = el.value.trim() === '' ? '' : n(el.value);
        else out[f.key] = el.value.trim();
      }
      return out;
    },

    /** Verifica campos obrigatórios; marca os vazios. */
    validate(form, fields) {
      let ok = true;
      for (const f of fields) {
        const el = form.elements[f.key];
        if (!el || !f.required) continue;
        const empty = f.type === 'select' ? !el.value : el.value.trim() === '';
        el.classList.toggle('invalid', empty);
        if (empty) ok = false;
      }
      if (!ok) UI.toast('Preencha os campos obrigatórios.', 'bad');
      return ok;
    },

    download(filename, text, mime = 'application/json') {
      const blob = new Blob([text], { type: mime + ';charset=utf-8' });
      const a = UI.h('a', { href: URL.createObjectURL(blob), download: filename });
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },

    csv(rows) {
      const cell = (v) => {
        const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
        return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    },

    empty(msg, action) {
      return UI.h('div', { class: 'empty' }, UI.h('p', null, msg), action || null);
    },

    pageHead(title, sub, ...actions) {
      return UI.h('div', { class: 'page-head' },
        UI.h('div', null, UI.h('h1', null, title), sub ? UI.h('p', { class: 'sub' }, sub) : null),
        UI.h('div', { class: 'actions' }, actions));
    },
  };

  window.UI = UI;
})();
