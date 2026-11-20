/* RXR 3D — cadastros: clientes, filamentos, equipamentos e embalagens. */
(function () {
  'use strict';
  const { h } = UI;
  const n = Calc.n;

  const UFS = ['', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  const DEFS = {
    clientes: {
      titulo: 'Clientes', singular: 'cliente', sub: 'Cadastro de clientes para os orçamentos.',
      fields: [
        { key: 'nome', label: 'Nome / Razão social', required: true, span: 3 },
        { key: 'documento', label: 'CPF / CNPJ', type: 'doc', span: 1 },
        { key: 'telefone', label: 'Telefone / WhatsApp', type: 'fone', span: 2 },
        { key: 'email', label: 'E-mail', span: 2 },
        { type: 'section', label: 'Endereço' },
        { key: 'cep', label: 'CEP', type: 'cep', span: 1, help: 'Saia do campo para preencher o endereço pelo CEP (precisa de internet).' },
        { key: 'endereco', label: 'Endereço (rua, avenida)', span: 2 },
        { key: 'numero', label: 'Número', span: 1 },
        { key: 'complemento', label: 'Complemento', span: 1 },
        { key: 'bairro', label: 'Bairro', span: 1 },
        { key: 'cidade', label: 'Cidade', span: 1 },
        { key: 'uf', label: 'Estado', type: 'select', options: UFS.map((u) => [u, u || '—']), span: 1 },
        { key: 'obs', label: 'Observações', type: 'textarea', span: 4 },
      ],
      cols: [
        ['Nome', (r) => h('strong', null, r.nome)],
        ['Telefone / WhatsApp', (r) => r.telefone ? h('a', { href: 'https://wa.me/55' + r.telefone.replace(/\D/g, ''), target: '_blank', rel: 'noopener' }, r.telefone) : '—'],
        ['CPF / CNPJ', (r) => r.documento || '—'],
        ['Cidade', (r) => [r.cidade, r.uf].filter(Boolean).join(' - ') || '—'],
        ['Orçamentos', (r) => String(Store.all('orcamentos').filter((o) => o.clienteId === r.id).length), 'num'],
      ],
      search: (r) => [r.nome, r.telefone, r.documento, r.cidade, r.email].join(' '),
      sort: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
      check(v) {
        if (v.documento && !Calc.validaDocumento(v.documento)) return 'CPF/CNPJ inválido. Confira os dígitos.';
        return null;
      },
      onForm(form) {
        const cep = form.elements.cep;
        cep.addEventListener('blur', async () => {
          const d = cep.value.replace(/\D/g, '');
          if (d.length !== 8 || form.elements.endereco.value) return;
          try {
            const r = await fetch('https://viacep.com.br/ws/' + d + '/json/');
            const j = await r.json();
            if (j.erro) { UI.toast('CEP não encontrado.', 'warn'); return; }
            form.elements.endereco.value = j.logradouro || '';
            form.elements.bairro.value = j.bairro || '';
            form.elements.cidade.value = j.localidade || '';
            form.elements.uf.value = j.uf || '';
            form.elements.numero.focus();
          } catch (e) { /* sem internet: preenchimento manual */ }
        });
      },
    },

    filamentos: {
      titulo: 'Filamentos', singular: 'filamento', sub: 'Preço do rolo com frete incluso — o custo por grama é calculado automaticamente.',
      fields: [
        { key: 'material', label: 'Material', required: true, suggest: ['PLA', 'PLA+', 'PLA Silk', 'PLA Matte', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon (PA)', 'PC', 'PLA-CF', 'PETG-CF'], span: 1 },
        { key: 'fabricante', label: 'Fabricante', span: 1 },
        { key: 'cor', label: 'Cor', span: 2 },
        { key: 'preco', label: 'Preço do rolo (com frete)', type: 'money', required: true, span: 1, help: 'Valor pago pelo rolo + frete rateado.' },
        { key: 'peso', label: 'Peso', type: 'num', required: true, default: 1, span: 1 },
        { key: 'unidade', label: 'Unidade', type: 'select', options: [['kg', 'kg'], ['g', 'g']], default: 'kg', span: 1 },
      ],
      cols: [
        ['Material', (r) => h('strong', null, r.material)],
        ['Fabricante', (r) => r.fabricante || '—'],
        ['Cor', (r) => r.cor || '—'],
        ['Preço do rolo', (r) => UI.brl(r.preco), 'num'],
        ['Peso', (r) => UI.inNum(r.peso) + ' ' + r.unidade, 'num'],
        ['Custo por grama', (r) => 'R$ ' + UI.num(Calc.custoPorGrama(r), 4) + '/g', 'num'],
      ],
      search: (r) => [r.material, r.fabricante, r.cor].join(' '),
      sort: (a, b) => (a.material + a.fabricante).localeCompare(b.material + b.fabricante, 'pt-BR'),
      label: (r) => [r.material, r.fabricante, r.cor].filter(Boolean).join(' · '),
    },

    equipamentos: {
      titulo: 'Equipamentos', singular: 'equipamento', sub: 'Impressoras: energia e depreciação entram no custo por hora de impressão.',
      fields: [
        { key: 'marca', label: 'Marca', required: true, span: 1 },
        { key: 'modelo', label: 'Modelo', required: true, span: 1 },
        { key: 'potencia', label: 'Potência', type: 'num', suffix: 'W', required: true, span: 1, help: 'Use o consumo médio durante a impressão (ex.: 150 W), não o pico da fonte.' },
        { key: 'valor', label: 'Valor de compra', type: 'money', required: true, span: 1 },
        { key: 'vidaUtil', label: 'Vida útil', type: 'num', suffix: 'h', span: 1, help: 'Em branco = padrão dos Parâmetros de custo.' },
        { key: 'obs', label: 'Observações', span: 3 },
      ],
      cols: [
        ['Equipamento', (r) => h('strong', null, r.marca + ' ' + r.modelo)],
        ['Potência', (r) => UI.int(r.potencia) + ' W', 'num'],
        ['Valor de compra', (r) => UI.brl(r.valor), 'num'],
        ['Energia/h', (r) => UI.brl(n(r.potencia) / 1000 * n(Store.settings().params.tarifaKwh)), 'num'],
        ['Depreciação/h', (r) => { const v = n(r.vidaUtil) || n(Store.settings().params.vidaUtilH); return UI.brl(v ? n(r.valor) / v : 0); }, 'num'],
      ],
      search: (r) => [r.marca, r.modelo].join(' '),
      sort: (a, b) => (a.marca + a.modelo).localeCompare(b.marca + b.modelo, 'pt-BR'),
      label: (r) => r.marca + ' ' + r.modelo,
    },

    embalagens: {
      titulo: 'Embalagens', singular: 'embalagem', sub: 'Caixas, sacos e envelopes usados para entregar as peças.',
      fields: [
        { key: 'tipo', label: 'Tipo de embalagem', required: true, suggest: ['Caixa de papelão', 'Envelope de segurança', 'Saco plástico', 'Plástico bolha', 'Caixa presente'], span: 2 },
        { key: 'dimensao', label: 'Dimensão', placeholder: 'ex.: 20 × 15 × 10 cm', span: 2 },
        { key: 'unidade', label: 'Unidade de compra', type: 'select', options: [['un', 'Unidade'], ['pct', 'Pacote'], ['cx', 'Caixa'], ['rolo', 'Rolo']], default: 'un', span: 1 },
        { key: 'qtdPorUnidade', label: 'Embalagens por unidade', type: 'num', default: 1, span: 1, help: 'Ex.: pacote com 50 → 50.' },
        { key: 'valor', label: 'Valor da unidade', type: 'money', required: true, span: 1 },
      ],
      cols: [
        ['Tipo', (r) => h('strong', null, r.tipo)],
        ['Dimensão', (r) => r.dimensao || '—'],
        ['Unidade', (r) => r.unidade + (n(r.qtdPorUnidade) > 1 ? ' c/ ' + UI.int(r.qtdPorUnidade) : '')],
        ['Valor', (r) => UI.brl(r.valor), 'num'],
        ['Custo por embalagem', (r) => UI.brl(Calc.custoEmbalagem(r)), 'num'],
      ],
      search: (r) => [r.tipo, r.dimensao].join(' '),
      sort: (a, b) => a.tipo.localeCompare(b.tipo, 'pt-BR'),
      label: (r) => r.tipo + (r.dimensao ? ' (' + r.dimensao + ')' : ''),
    },
  };

  function editar(name, record, onSaved) {
    const def = DEFS[name];
    const form = UI.form(def.fields, record || {});
    if (def.onForm) def.onForm(form);
    UI.modal((record && record.id ? 'Editar ' : 'Novo ') + def.singular, form, {
      wide: name === 'clientes',
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Salvar', kind: 'primary', onClick: (c) => {
          if (!UI.validate(form, def.fields)) return;
          const v = Object.assign({}, record || {}, UI.readForm(form, def.fields));
          const err = def.check && def.check(v);
          if (err) { UI.toast(err, 'bad'); return; }
          const saved = Store.save(name, v);
          c();
          UI.toast('Registro salvo.');
          if (onSaved) onSaved(saved);
        } },
      ],
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        form.closest('.modal').querySelector('.modal-foot .primary').click();
      }
    });
  }

  function page(name) {
    const def = DEFS[name];
    const wrap = h('div');
    let q = '';
    const tbody = h('tbody');
    const render = () => {
      const rows = Store.all(name).filter((r) => !q || def.search(r).toLowerCase().includes(q)).sort(def.sort);
      tbody.replaceChildren();
      if (!rows.length) {
        tbody.append(h('tr', null, h('td', { colspan: def.cols.length + 1, class: 'muted center' },
          q ? 'Nada encontrado.' : 'Nenhum ' + def.singular + ' cadastrado ainda.')));
        return;
      }
      for (const r of rows) {
        tbody.append(h('tr', null,
          def.cols.map(([, fn, cls]) => h('td', { class: cls || null }, fn(r))),
          h('td', { class: 'row-actions' },
            h('button', { class: 'btn small', onclick: () => editar(name, r, render) }, 'Editar'),
            h('button', { class: 'btn small ghost-danger', onclick: () => UI.confirm('Excluir este ' + def.singular + '? Orçamentos já emitidos não são alterados.', () => { Store.remove(name, r.id); render(); }) }, 'Excluir'))));
      }
    };
    wrap.append(
      UI.pageHead(def.titulo, def.sub, h('button', { class: 'btn primary', onclick: () => editar(name, null, render) }, '+ Novo ' + def.singular)),
      h('div', { class: 'card' },
        h('div', { class: 'toolbar' }, h('input', { type: 'search', placeholder: 'Buscar…', class: 'search', oninput: (e) => { q = e.target.value.toLowerCase(); render(); } })),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, def.cols.map(([t, , cls]) => h('th', { class: cls || null }, t)), h('th', null, ''))),
          tbody))));
    render();
    return wrap;
  }

  window.Cadastros = { DEFS, page, editar, label: (name, r) => (r ? DEFS[name].label(r) : '') };
})();
