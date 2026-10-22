/*
 * Núcleo da aplicação: registro de módulos, rotas (hash), navegação
 * e telas genéricas de lista / edição / impressão de registros.
 */
(function () {
  'use strict';
  const { el, fmt, fmtDate, badge, levelOf } = UI;

  const modules = [];
  const pages = {};
  let dirty = false;
  let currentHash = location.hash;
  let ignoreNextHash = false;

  const App = {
    modules,
    register(mod) { modules.push(mod); },
    page(id, def) { pages[id] = def; },
    module(id) { return modules.find((m) => m.id === id); },
    go(hash) { location.hash = hash; },
    setDirty(v) { dirty = v; },
    recordTitle(mod, rec) { return mod.recordTitle ? mod.recordTitle(rec) : rec[mod.fields[0].key] || '(sem título)'; },
  };

  // ---------- Layout e navegação ----------

  function renderNav() {
    const nav = document.getElementById('nav');
    const groups = {};
    modules.forEach((m) => { (groups[m.group] = groups[m.group] || []).push(m); });
    const link = (hash, icon, label) => el('a', { href: hash, 'data-hash': hash }, el('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon), label);
    UI.fill(nav,
      link('#/', '◧', 'Painel'),
      Object.entries(groups).map(([g, mods]) => [
        el('div', { class: 'nav-group' }, g),
        mods.map((m) => link(`#/m/${m.id}`, m.icon, m.short || m.title)),
      ]),
      el('div', { class: 'nav-group' }, 'Saídas'),
      link('#/relatorios', '▤', 'Relatórios'),
      link('#/config', '⚙', 'Configurações e backup'));
  }

  function highlightNav() {
    const h = location.hash || '#/';
    document.querySelectorAll('#nav a').forEach((a) => {
      const target = a.getAttribute('data-hash');
      a.classList.toggle('active', target === '#/' ? h === '#/' || h === '' : h.startsWith(target));
    });
  }

  function main() { return document.getElementById('main'); }

  function pageHeader(title, subtitle, actions) {
    return el('div', { class: 'page-head' },
      el('div', null, el('h1', null, title), subtitle ? el('p', { class: 'muted' }, subtitle) : null),
      el('div', { class: 'page-actions' }, actions || []));
  }
  App.pageHeader = pageHeader;

  function route() {
    if (ignoreNextHash) { ignoreNextHash = false; return; }
    if (dirty && location.hash !== currentHash) {
      if (!window.confirm('Existem alterações não salvas. Deseja sair mesmo assim?')) {
        ignoreNextHash = true;
        location.hash = currentHash;
        return;
      }
    }
    dirty = false;
    currentHash = location.hash;
    document.body.classList.remove('nav-open');
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    const root = main();
    root.replaceChildren();
    window.scrollTo(0, 0);

    if (!parts.length) pages.dashboard.render(root);
    else if (parts[0] === 'm' && App.module(parts[1])) {
      const mod = App.module(parts[1]);
      if (!parts[2]) renderList(root, mod);
      else renderEditor(root, mod, parts[2] === 'novo' ? null : parts[2], parts[3] ? decodeURIComponent(parts[3]) : null);
    } else if (pages[parts[0]]) pages[parts[0]].render(root, parts.slice(1));
    else root.appendChild(el('p', null, 'Página não encontrada.'));
    highlightNav();
  }

  // ---------- Lista de registros ----------

  function renderList(root, mod) {
    const all = Store.all(mod.collection).sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    const search = el('input', { type: 'search', placeholder: 'Pesquisar…', class: 'search' });
    const holder = el('div');

    const filtered = () => {
      const q = search.value.trim().toLowerCase();
      return q ? all.filter((r) => JSON.stringify(r).toLowerCase().includes(q)) : all;
    };
    const draw = () => holder.replaceChildren(UI.table(mod.listColumns, filtered(), {
      onRow: (r) => App.go(`#/m/${mod.id}/${r.id}`),
      empty: 'Nenhum registro ainda. Clique em “Novo” para fazer o primeiro lançamento.',
    }));
    search.addEventListener('input', draw);

    UI.add(root,
      pageHeader(mod.title, mod.description, [
        el('button', { class: 'btn btn-secondary', onclick: () => exportCSV(mod, filtered()) }, 'Exportar CSV'),
        el('a', { class: 'btn btn-primary', href: `#/m/${mod.id}/novo` }, '+ Novo'),
      ]),
      el('div', { class: 'card' }, el('div', { class: 'toolbar' }, search, el('span', { class: 'muted' }, `${all.length} registro(s)`)), holder));
    draw();
  }

  function exportCSV(mod, records) {
    if (mod.csv) {
      const { headers, rows } = mod.csv(records);
      return UI.downloadCSV(`${mod.id}-${UI.today()}.csv`, headers, rows);
    }
    const fields = mod.fields.filter((f) => f.type !== 'section');
    UI.downloadCSV(`${mod.id}-${UI.today()}.csv`, fields.map((f) => f.label),
      records.map((r) => fields.map((f) => (f.type === 'date' ? fmtDate(r[f.key]) : r[f.key] ?? ''))));
  }
  App.exportCSV = exportCSV;

  // ---------- Edição de registro ----------

  function renderEditor(root, mod, id, prefill) {
    let rec;
    if (id) {
      const found = Store.get(mod.collection, id);
      if (!found) { root.appendChild(el('p', null, 'Registro não encontrado.')); return; }
      rec = JSON.parse(JSON.stringify(found));
    } else {
      rec = mod.newRecord ? mod.newRecord() : {};
      if (prefill) { try { Object.assign(rec, JSON.parse(prefill)); } catch (e) { /* ignora */ } }
    }

    const body = el('div');
    const analysis = el('div', { class: 'analysis' });
    let timer = null;

    const refreshAnalysis = () => {
      if (!mod.analysis) return;
      clearTimeout(timer);
      timer = setTimeout(() => analysis.replaceChildren(mod.analysis(rec) || ''), 200);
    };

    const onChange = (key) => {
      dirty = true;
      const field = key && mod.fields.find((f) => f.key === key);
      if (field && field.rerender) {
        if (mod.onFieldChange) mod.onFieldChange(rec, key);
        draw();
      } else refreshAnalysis();
    };

    function draw() {
      const rowsCfgs = mod.rows ? [].concat(mod.rows) : [];
      if (mod.prepare) mod.prepare(rec);
      UI.fill(body,
        el('div', { class: 'card' }, UI.formGrid(mod.fields, rec, onChange)),
        rowsCfgs.map((cfg) => el('div', { class: 'card' }, UI.rowsEditor(cfg, rec, () => onChange()))));
      if (mod.analysis) analysis.replaceChildren(mod.analysis(rec) || '');
    }

    function save() {
      if (mod.beforeSave) mod.beforeSave(rec);
      const missing = mod.fields.filter((f) => f.required && (rec[f.key] === undefined || rec[f.key] === ''));
      if (missing.length) {
        UI.toast('Preencha: ' + missing.map((f) => f.label).join(', '), 'bad');
        const first = document.getElementById(`f-${missing[0].key}`);
        if (first) first.focus();
        return false;
      }
      const errors = mod.validate ? mod.validate(rec) : [];
      if (errors.length) { UI.toast(errors.join(' '), 'bad'); return false; }
      const isNew = !rec.id;
      Store.save(mod.collection, rec);
      dirty = false;
      UI.toast('Registro salvo com sucesso.');
      if (isNew) { currentHash = `#/m/${mod.id}/${rec.id}`; ignoreNextHash = true; location.hash = currentHash; renderEditorTitle(); }
      return true;
    }

    const titleEl = el('h1');
    const renderEditorTitle = () => titleEl.replaceChildren(rec.id ? App.recordTitle(mod, rec) : `Novo — ${mod.title}`);
    renderEditorTitle();

    const actions = [
      el('a', { class: 'btn btn-ghost', href: `#/m/${mod.id}` }, '← Voltar'),
      (mod.actions ? mod.actions(rec, { save }) : []),
      el('button', { class: 'btn btn-secondary', onclick: () => { if (mod.beforeSave) mod.beforeSave(rec); printRecord(mod, rec); } }, 'Imprimir / PDF'),
      el('button', {
        class: 'btn btn-danger-ghost',
        onclick: () => {
          if (!rec.id) { dirty = false; App.go(`#/m/${mod.id}`); return; }
          UI.confirm('Excluir este registro definitivamente?', () => {
            Store.remove(mod.collection, rec.id);
            dirty = false;
            UI.toast('Registro excluído.');
            App.go(`#/m/${mod.id}`);
          });
        },
      }, rec.id ? 'Excluir' : 'Descartar'),
      el('button', { class: 'btn btn-primary', onclick: save }, 'Salvar'),
    ];

    UI.add(root,
      el('div', { class: 'page-head' },
        el('div', null, titleEl, el('p', { class: 'muted' }, mod.title, mod.clause ? ` · ${mod.clause}` : '')),
        el('div', { class: 'page-actions' }, actions)),
      body,
      mod.analysis ? el('div', { class: 'card' }, el('h2', null, mod.analysisTitle || 'Análise'), analysis) : null);
    draw();
  }

  // ---------- Impressão de registro ----------

  function printRecord(mod, rec) {
    const fields = mod.fields.filter((f) => f.type !== 'section' && rec[f.key] !== undefined && rec[f.key] !== '');
    const display = (f, v) => {
      if (f.type === 'date') return fmtDate(v);
      if (f.type === 'checkbox') return v ? 'Sim' : 'Não';
      if (f.type === 'select' && f.options) {
        const opts = typeof f.options === 'function' ? f.options(rec) : f.options;
        const o = opts.find((x) => (Array.isArray(x) ? String(x[0]) === String(v) : false));
        if (o) return o[1];
      }
      return v;
    };
    const content = el('div', null,
      el('h1', null, App.recordTitle(mod, rec)),
      el('p', { class: 'muted' }, mod.title, mod.clause ? ` · ${mod.clause}` : ''),
      el('dl', { class: 'print-fields' }, fields.map((f) => [el('dt', null, f.label), el('dd', null, display(f, rec[f.key]))])),
      [].concat(mod.rows || []).map((cfg) => {
        const cols = typeof cfg.columns === 'function' ? cfg.columns(rec) : cfg.columns;
        const rows = rec[cfg.key] || [];
        return el('section', null, el('h2', null, cfg.title), UI.table(cols.map((c) => ({
          label: c.label,
          render: (r) => {
            if (c.computed) { const o = c.computed(r, rec); const t = o && typeof o === 'object' ? o.text : o; return t ? badge(t, o && o.level ? o.level : levelOf(t)) : '—'; }
            return c.type === 'date' ? fmtDate(r[c.key]) : (r[c.key] ?? '');
          },
        })), rows));
      }),
      mod.analysis ? el('section', null, el('h2', null, mod.analysisTitle || 'Análise'), mod.analysis(rec)) : null);
    UI.printReport(mod.title, content);
  }
  App.printRecord = printRecord;

  // ---------- Inicialização ----------

  App.start = function () {
    renderNav();
    document.getElementById('menu-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    const s = Store.settings();
    document.getElementById('brand-company').textContent = s.empresa || '';
    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    route();
  };

  App.helpers = { fmt, fmtDate, badge, levelOf };
  window.App = App;
})();
