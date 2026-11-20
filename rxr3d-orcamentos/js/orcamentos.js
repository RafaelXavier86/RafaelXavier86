/* RXR 3D — orçamentos: histórico, edição, PDF e envio por WhatsApp. */
(function () {
  'use strict';
  const { h } = UI;
  const n = Calc.n;

  const STATUS = [
    ['aberto', 'Em aberto'],
    ['enviado', 'Enviado'],
    ['aprovado', 'Aprovado'],
    ['concluido', 'Concluído'],
    ['recusado', 'Recusado'],
  ];
  const VENDIDO = ['aprovado', 'concluido'];
  const statusLabel = (s) => (STATUS.find((x) => x[0] === s) || ['', s])[1];
  const badge = (s) => h('span', { class: 'badge st-' + s }, statusLabel(s));
  const numero = (o) => String(o.numero || 0).padStart(4, '0');

  function novo(itens) {
    const s = Store.settings();
    const hoje = UI.today();
    return Store.save('orcamentos', {
      numero: Store.nextNumero(),
      data: hoje,
      validade: UI.addDays(hoje, s.orcamento.validadeDias),
      status: 'aberto',
      clienteId: '',
      cliente: null,
      itens: itens || [],
      desconto: 0,
      acrescimo: 0,
      condicoes: s.orcamento.condicoes,
      obs: '',
    });
  }

  /** Vendas (orçamentos aprovados/concluídos) para o painel. */
  function vendas() {
    return Store.all('orcamentos').filter((o) => VENDIDO.includes(o.status));
  }

  function escolherEAdicionar(item) {
    const abertos = Store.all('orcamentos').filter((o) => ['aberto', 'enviado'].includes(o.status)).sort((a, b) => b.numero - a.numero);
    const adicionar = (orc, close) => {
      orc.itens.push(item);
      Store.save('orcamentos', orc);
      close();
      UI.toast('Item adicionado ao orçamento nº ' + numero(orc) + '.');
      location.hash = '#/orcamentos/' + orc.id;
    };
    const body = h('div', { class: 'pick-list' },
      h('button', { class: 'pick primary-pick', onclick: () => { m.close(); const o = novo([item]); UI.toast('Orçamento nº ' + numero(o) + ' criado.'); location.hash = '#/orcamentos/' + o.id; } },
        h('strong', null, '+ Novo orçamento'), h('small', null, 'Cria um orçamento com este item')),
      abertos.length ? h('p', { class: 'sub' }, 'Ou adicione a um orçamento em aberto:') : null,
      abertos.map((o) => h('button', { class: 'pick', onclick: () => adicionar(o, m.close) },
        h('strong', null, 'Nº ' + numero(o) + ' — ' + (o.cliente ? o.cliente.nome : 'sem cliente')),
        h('small', null, UI.date(o.data) + ' · ' + o.itens.length + ' itens · ' + UI.brl(Calc.totaisOrcamento(o).total)))));
    const m = UI.modal('Adicionar "' + item.descricao + '" a…', body);
  }

  // ---------------------------------------------------------------- lista / histórico
  function lista() {
    const f = { q: '', status: '', de: '', ate: '' };
    const tbody = h('tbody');
    const resumo = h('div', { class: 'list-summary' });
    const filtrar = () => Store.all('orcamentos').filter((o) => {
      if (f.status && o.status !== f.status) return false;
      if (f.de && o.data < f.de) return false;
      if (f.ate && o.data > f.ate) return false;
      if (f.q) {
        const txt = [numero(o), o.cliente && o.cliente.nome, o.cliente && o.cliente.documento, o.itens.map((i) => i.descricao + ' ' + (i.sku || '')).join(' ')].join(' ').toLowerCase();
        if (!txt.includes(f.q)) return false;
      }
      return true;
    }).sort((a, b) => b.numero - a.numero);

    const render = () => {
      const rows = filtrar();
      tbody.replaceChildren();
      let tot = 0, luc = 0;
      if (!rows.length) tbody.append(h('tr', null, h('td', { colspan: 9, class: 'muted center' }, 'Nenhum orçamento encontrado.')));
      for (const o of rows) {
        const t = Calc.totaisOrcamento(o);
        tot += t.total; luc += t.lucro;
        const sel = h('select', { class: 'status-select st-' + o.status, 'aria-label': 'Status', onchange: (e) => { mudarStatus(o.id, e.target.value); render(); } },
          STATUS.map(([v, l]) => h('option', { value: v, selected: v === o.status }, l)));
        tbody.append(h('tr', null,
          h('td', null, h('a', { href: '#/orcamentos/' + o.id }, h('strong', null, numero(o)))),
          h('td', null, UI.date(o.data)),
          h('td', null, o.cliente ? o.cliente.nome : h('span', { class: 'muted' }, 'sem cliente')),
          h('td', { class: 'ellipsis' }, o.itens.map((i) => i.descricao).join(', ') || '—'),
          h('td', { class: 'num strong' }, UI.brl(t.total)),
          h('td', { class: 'num ' + (t.lucro < 0 ? 'neg' : '') }, UI.brl(t.lucro)),
          h('td', { class: 'num' }, UI.pct(t.margemPct)),
          h('td', null, sel),
          h('td', { class: 'row-actions' },
            h('a', { class: 'btn small', href: '#/orcamentos/' + o.id }, 'Abrir'),
            h('button', { class: 'btn small', onclick: () => imprimir(Store.get('orcamentos', o.id)) }, 'PDF'))));
      }
      resumo.textContent = rows.length + ' orçamento(s) · total ' + UI.brl(tot) + ' · lucro previsto ' + UI.brl(luc);
    };

    const exportar = () => {
      const linhas = [['Nº', 'Emissão', 'Validade', 'Status', 'Cliente', 'CPF/CNPJ', 'Item', 'Qtd', 'Valor unit.', 'Valor total', 'Custo', 'Lucro', 'Horas']];
      for (const o of filtrar()) {
        for (const it of o.itens) {
          linhas.push([numero(o), UI.date(o.data), UI.date(o.validade), statusLabel(o.status), o.cliente ? o.cliente.nome : '', o.cliente ? o.cliente.documento : '',
            it.descricao, it.quantidade, Calc.r2(it.valorUnit), Calc.r2(it.valorTotal), Calc.r2(it.custoTotal), Calc.r2(it.lucro), Calc.r2(it.horas)]);
        }
        if (n(o.desconto) || n(o.acrescimo)) linhas.push([numero(o), UI.date(o.data), '', statusLabel(o.status), o.cliente ? o.cliente.nome : '', '', 'Desconto/Acréscimo', '', '', Calc.r2(n(o.acrescimo) - n(o.desconto)), 0, Calc.r2(n(o.acrescimo) - n(o.desconto)), 0]);
      }
      UI.download('orcamentos_rxr3d_' + UI.today() + '.csv', UI.csv(linhas), 'text/csv');
    };

    const bar = h('div', { class: 'toolbar' },
      h('input', { type: 'search', class: 'search', placeholder: 'Buscar por nº, cliente ou peça…', oninput: (e) => { f.q = e.target.value.toLowerCase(); render(); } }),
      h('select', { 'aria-label': 'Status', onchange: (e) => { f.status = e.target.value; render(); } }, h('option', { value: '' }, 'Todos os status'), STATUS.map(([v, l]) => h('option', { value: v }, l))),
      h('label', { class: 'inline' }, 'De ', h('input', { type: 'date', onchange: (e) => { f.de = e.target.value; render(); } })),
      h('label', { class: 'inline' }, 'até ', h('input', { type: 'date', onchange: (e) => { f.ate = e.target.value; render(); } })));
    render();
    return h('div', null,
      UI.pageHead('Orçamentos', 'Histórico completo. Aprovados e concluídos entram no Dashboard como vendas.',
        h('button', { class: 'btn', onclick: exportar }, 'Exportar CSV'),
        h('button', { class: 'btn primary', onclick: () => { const o = novo(); location.hash = '#/orcamentos/' + o.id; } }, '+ Novo orçamento')),
      h('div', { class: 'card' }, bar, h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['Nº', 'Emissão', 'Cliente', 'Itens', 'Total', 'Lucro', 'Margem', 'Status', ''].map((t, i) => h('th', { class: i >= 4 && i <= 6 ? 'num' : null }, t)))),
        tbody)), resumo));
  }

  function mudarStatus(id, st) {
    const o = Store.get('orcamentos', id);
    o.status = st;
    if (VENDIDO.includes(st) && !o.dataVenda) o.dataVenda = UI.today();
    if (!VENDIDO.includes(st)) o.dataVenda = '';
    Store.save('orcamentos', o);
  }

  // ---------------------------------------------------------------- composição em modal
  function editarComposicao(input, onOk, titulo) {
    const ed = Precificacao.editor(input, { comparar: false });
    UI.modal(titulo || 'Composição da peça', ed.el, {
      wide: true,
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Aplicar ao orçamento', kind: 'primary', onClick: (c) => {
          if (!ed.valid()) return;
          const { input: inp, res } = ed.get();
          if (res.erro) { UI.toast(res.erro, 'bad'); return; }
          c(); onOk(inp, res);
        } },
      ],
    });
  }

  function itemAvulso(item, onOk) {
    const fs = [
      { key: 'descricao', label: 'Descrição', required: true, span: 4, placeholder: 'ex.: Modelagem 3D, pintura, serviço de reparo…' },
      { key: 'quantidade', label: 'Quantidade', type: 'num', default: 1, span: 1 },
      { key: 'valorUnit', label: 'Valor unitário', type: 'money', required: true, span: 1 },
      { key: 'custoUnit', label: 'Custo unitário', type: 'money', span: 1, help: 'Opcional, para o lucro.' },
      { key: 'horasUnit', label: 'Horas de impressão/un.', type: 'num', span: 1 },
    ];
    const form = UI.form(fs, item ? { descricao: item.descricao, quantidade: item.quantidade, valorUnit: item.valorUnit, custoUnit: item.custoTotal / (item.quantidade || 1), horasUnit: item.horas / (item.quantidade || 1) } : {});
    let imagemId = (item && item.imagemId) || '';
    const imgField = Imagens.campo(imagemId, (id) => { imagemId = id; });
    imgField.classList.add('span-4');
    form.append(imgField);
    UI.modal(item ? 'Editar item avulso' : 'Item avulso', form, {
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Aplicar', kind: 'primary', onClick: (c) => {
          if (!UI.validate(form, fs)) return;
          const v = UI.readForm(form, fs);
          const q = Math.max(1, n(v.quantidade) || 1);
          c();
          onOk(Object.assign({}, item || {}, {
            id: (item && item.id) || Store.uid(), tipo: 'avulso', descricao: v.descricao, detalhe: '', imagemId,
            quantidade: q, valorUnit: n(v.valorUnit), valorTotal: n(v.valorUnit) * q,
            custoTotal: n(v.custoUnit) * q, lucro: (n(v.valorUnit) - n(v.custoUnit)) * q,
            horas: n(v.horasUnit) * q, pecas: n(v.horasUnit) ? q : 0,
          }));
        } },
      ],
    });
  }

  function escolherPeca(onOk) {
    const pecas = Store.all('pecas').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!pecas.length) { UI.toast('O catálogo está vazio. Use "Nova composição".', 'warn'); return; }
    let q = '';
    const listEl = h('div', { class: 'pick-list' });
    const render = () => {
      listEl.replaceChildren(...pecas.filter((p) => !q || p.nome.toLowerCase().includes(q)).map((p) => {
        const r = Precificacao.calcular(Object.assign({}, p.input, { quantidade: 1, frete: 0 }));
        return h('button', { class: 'pick', onclick: () => { m.close(); editarComposicao(p.input, onOk, p.nome); } },
          h('strong', null, p.nome), h('small', null, UI.brl(r.precoUnitario) + ' / un. · ' + UI.num(p.input.pesoG, 0) + ' g · ' + UI.horas(n(p.input.minutos) / 60)));
      }));
    };
    render();
    const m = UI.modal('Peça do catálogo', h('div', null, h('input', { type: 'search', class: 'search full', placeholder: 'Buscar…', oninput: (e) => { q = e.target.value.toLowerCase(); render(); } }), listEl));
  }

  // ---------------------------------------------------------------- edição
  function editor(id) {
    let o = Store.get('orcamentos', id);
    if (!o) return h('div', null, UI.pageHead('Orçamento não encontrado', null, h('a', { class: 'btn', href: '#/orcamentos' }, 'Voltar')));

    const saveState = h('span', { class: 'save-state' }, 'Salvo');
    let tm;
    const save = (immediate) => {
      saveState.textContent = 'Salvando…';
      clearTimeout(tm);
      const go = () => { o = Store.save('orcamentos', o); saveState.textContent = 'Salvo ✓'; };
      if (immediate) go(); else tm = setTimeout(go, 400);
    };

    // ---- dados gerais
    const clienteSel = h('select', { id: 'orc-cliente' });
    const fillClientes = () => {
      clienteSel.replaceChildren(h('option', { value: '' }, '— selecione o cliente —'),
        ...Store.all('clientes').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => h('option', { value: c.id, selected: c.id === o.clienteId }, c.nome)));
      if (o.clienteId && !Store.get('clientes', o.clienteId) && o.cliente) {
        clienteSel.append(h('option', { value: o.clienteId, selected: true }, o.cliente.nome + ' (excluído do cadastro)'));
      }
    };
    fillClientes();
    const setCliente = (cid) => {
      o.clienteId = cid;
      const c = cid ? Store.get('clientes', cid) : null;
      if (c) o.cliente = c; else if (!cid) o.cliente = null;
      clienteInfo.replaceChildren(infoCliente());
      save();
    };
    clienteSel.addEventListener('change', () => setCliente(clienteSel.value));
    const infoCliente = () => {
      const c = o.cliente;
      if (!c) return h('span', { class: 'muted' }, 'Nenhum cliente selecionado.');
      return h('span', null, [c.telefone, c.documento, [c.endereco, c.numero].filter(Boolean).join(', '), [c.cidade, c.uf].filter(Boolean).join(' - ')].filter(Boolean).join(' · '));
    };
    const clienteInfo = h('div', { class: 'cliente-info' }, infoCliente());

    const field = (label, el) => h('div', { class: 'field' }, h('label', null, label), el);
    const dateInput = (key) => h('input', { type: 'date', value: o[key] || '', onchange: (e) => { o[key] = e.target.value; if (key === 'data') { o.validade = UI.addDays(o.data, Store.settings().orcamento.validadeDias); validadeEl.value = o.validade; } save(); } });
    const validadeEl = dateInput('validade');
    const statusSel = h('select', { onchange: (e) => {
      o.status = e.target.value;
      if (VENDIDO.includes(o.status) && !o.dataVenda) o.dataVenda = UI.today();
      if (!VENDIDO.includes(o.status)) o.dataVenda = '';
      vendaEl.value = o.dataVenda || '';
      vendaWrap.hidden = !VENDIDO.includes(o.status);
      save();
    } }, STATUS.map(([v, l]) => h('option', { value: v, selected: v === o.status }, l)));
    const vendaEl = dateInput('dataVenda');
    const vendaWrap = field('Data da venda', vendaEl);
    vendaWrap.hidden = !VENDIDO.includes(o.status);

    const dados = h('div', { class: 'card' },
      h('div', { class: 'grid-form' },
        h('div', { class: 'field span-2' }, h('label', { for: 'orc-cliente' }, 'Cliente'),
          h('div', { class: 'inline-group' }, clienteSel,
            h('button', { class: 'btn', type: 'button', onclick: () => Cadastros.editar('clientes', null, (c) => { fillClientes(); clienteSel.value = c.id; setCliente(c.id); }) }, '+ Novo'))),
        field('Emissão', dateInput('data')),
        field('Válido até', validadeEl),
        field('Status', statusSel),
        vendaWrap,
        field('Imagens no PDF', h('select', { onchange: (e) => { o.imagensPdf = e.target.value; save(); } },
          [['miniatura', 'Miniatura na tabela'], ['galeria', 'Galeria ampliada'], ['ambas', 'Miniatura + galeria'], ['nenhuma', 'Não mostrar']]
            .map(([v, l]) => h('option', { value: v, selected: v === (o.imagensPdf || 'miniatura') }, l))))),
      clienteInfo);

    // ---- itens
    const tbody = h('tbody');
    const totaisEl = h('div', { class: 'totais' });
    const renderItens = () => {
      tbody.replaceChildren();
      if (!o.itens.length) {
        tbody.append(h('tr', null, h('td', { colspan: 9, class: 'muted center' }, 'Nenhum item. Adicione uma peça do catálogo, uma nova composição ou um item avulso.')));
      }
      o.itens.forEach((it, idx) => {
        const desc = h('input', { type: 'text', class: 'cell-input', value: it.descricao, 'aria-label': 'Descrição', oninput: (e) => { it.descricao = e.target.value; save(); } });
        const editar = () => {
          if (it.tipo === 'avulso') itemAvulso(it, (novoIt) => { o.itens[idx] = novoIt; save(true); renderItens(); });
          else editarComposicao(it.input, (inp, res) => { o.itens[idx] = Precificacao.toItem(inp, res, it); save(true); renderItens(); }, it.descricao);
        };
        const mover = (d) => { const j = idx + d; if (j < 0 || j >= o.itens.length) return; [o.itens[idx], o.itens[j]] = [o.itens[j], o.itens[idx]]; save(true); renderItens(); };
        tbody.append(h('tr', null,
          h('td', { class: 'center muted' }, String(idx + 1)),
          h('td', null, h('div', { class: 'with-thumb' }, Imagens.mini(it.imagemId, () => trocarImagem(it)),
            h('div', null, desc, it.detalhe ? h('small', { class: 'muted block' }, it.detalhe) : null))),
          h('td', { class: 'num' }, UI.int(it.quantidade)),
          h('td', { class: 'num' }, UI.brl(it.valorUnit)),
          h('td', { class: 'num strong' }, UI.brl(it.valorTotal)),
          h('td', { class: 'num muted' }, UI.brl(it.custoTotal)),
          h('td', { class: 'num ' + (it.lucro < 0 ? 'neg' : 'pos') }, UI.brl(it.lucro)),
          h('td', { class: 'num muted' }, it.horas ? UI.horas(it.horas) : '—'),
          h('td', { class: 'row-actions' },
            h('button', { class: 'btn-icon', title: 'Subir', 'aria-label': 'Subir', onclick: () => mover(-1) }, '↑'),
            h('button', { class: 'btn-icon', title: 'Descer', 'aria-label': 'Descer', onclick: () => mover(1) }, '↓'),
            h('button', { class: 'btn small', onclick: editar }, 'Editar'),
            h('button', { class: 'btn small ghost-danger', onclick: () => { o.itens.splice(idx, 1); save(true); renderItens(); } }, 'Remover'))));
      });
      renderTotais();
    };
    const trocarImagem = (it) => {
      let novo = it.imagemId || '';
      UI.modal('Imagem — ' + it.descricao, h('div', { class: 'card' }, Imagens.campo(novo, (id) => { novo = id; })), {
        actions: [
          { label: 'Cancelar', onClick: (c) => c() },
          { label: 'Aplicar', kind: 'primary', onClick: (c) => {
            it.imagemId = novo;
            if (it.input) it.input.imagemId = novo;
            save(true); renderItens(); c();
          } },
        ],
      });
    };
    const addItem = (it) => { o.itens.push(it); save(true); renderItens(); };

    const moneyInput = (key) => h('input', { type: 'text', inputmode: 'decimal', class: 'money-in', value: UI.inNum(o[key] || 0, 2),
      oninput: (e) => { o[key] = n(e.target.value); save(); renderTotais(); } });
    const descontoEl = moneyInput('desconto');
    const acrescimoEl = moneyInput('acrescimo');
    const renderTotais = () => {
      const t = Calc.totaisOrcamento(o);
      totaisEl.replaceChildren(
        h('div', { class: 'tot-client' },
          h('div', { class: 'tot-row' }, h('span', null, 'Subtotal'), h('strong', null, UI.brl(t.subtotal))),
          h('div', { class: 'tot-row' }, h('label', null, 'Desconto (R$)'), descontoEl),
          h('div', { class: 'tot-row' }, h('label', null, 'Acréscimo (R$)'), acrescimoEl),
          h('div', { class: 'tot-row total' }, h('span', null, 'TOTAL'), h('strong', null, UI.brl(t.total)))),
        h('div', { class: 'tot-internal' },
          h('h4', null, 'Uso interno (não sai no PDF)'),
          h('div', { class: 'mini-kpis' },
            mini('Custo', UI.brl(t.custo)), mini('Lucro', UI.brl(t.lucro), t.lucro < 0 ? 'neg' : 'pos'),
            mini('Margem', UI.pct(t.margemPct)), mini('Markup', UI.markup(t.custo ? t.total / t.custo : 0)),
            mini('Horas', UI.horas(t.horas)), mini('Lucro/hora', UI.brl(t.horas ? t.lucro / t.horas : 0)))));
    };
    const mini = (l, v, cls) => h('div', { class: 'mini ' + (cls || '') }, h('span', null, l), h('strong', null, v));

    const itensCard = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', null, 'Itens'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => escolherPeca((inp, res) => addItem(Precificacao.toItem(inp, res))) }, '+ Peça do catálogo'),
          h('button', { class: 'btn', onclick: () => editarComposicao({ quantidade: 1, pecasPorEmbalagem: 1, canalId: 'direto' }, (inp, res) => addItem(Precificacao.toItem(inp, res)), 'Nova composição') }, '+ Nova composição'),
          h('button', { class: 'btn', onclick: () => itemAvulso(null, addItem) }, '+ Item avulso'))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['Item', 'Descrição', 'Qtd', 'Valor unit.', 'Valor total', 'Custo', 'Lucro', 'Tempo', ''].map((t, i) => h('th', { class: i >= 2 && i <= 7 ? 'num' : (i === 0 ? 'center' : null) }, t)))),
        tbody)),
      totaisEl);

    const textos = h('div', { class: 'card grid-2' },
      h('div', { class: 'field' }, h('label', null, 'Condições (saem no PDF)'),
        h('textarea', { rows: 5, oninput: (e) => { o.condicoes = e.target.value; save(); } }, o.condicoes || '')),
      h('div', { class: 'field' }, h('label', null, 'Observações internas'),
        h('textarea', { rows: 5, oninput: (e) => { o.obs = e.target.value; save(); } }, o.obs || '')));

    renderItens();

    const duplicar = () => {
      const copia = novo(JSON.parse(JSON.stringify(o.itens)).map((i) => Object.assign(i, { id: Store.uid() })));
      Object.assign(copia, { clienteId: o.clienteId, cliente: o.cliente, desconto: o.desconto, acrescimo: o.acrescimo, condicoes: o.condicoes });
      Store.save('orcamentos', copia);
      UI.toast('Cópia criada: nº ' + numero(copia) + '.');
      location.hash = '#/orcamentos/' + copia.id;
    };
    const excluir = () => UI.confirm('Excluir o orçamento nº ' + numero(o) + '? Ele sai do histórico e do Dashboard.', () => { Store.remove('orcamentos', o.id); location.hash = '#/orcamentos'; });

    return h('div', null,
      UI.pageHead('Orçamento nº ' + numero(o), null,
        saveState,
        h('button', { class: 'btn', onclick: duplicar }, 'Duplicar'),
        h('button', { class: 'btn ghost-danger', onclick: excluir }, 'Excluir'),
        h('button', { class: 'btn', onclick: () => { clearTimeout(tm); save(true); whatsapp(o); } }, 'WhatsApp'),
        h('button', { class: 'btn primary', onclick: () => { clearTimeout(tm); save(true); imprimir(o); } }, 'Gerar PDF')),
      dados, itensCard, textos);
  }

  // ---------------------------------------------------------------- WhatsApp
  function whatsapp(o) {
    const s = Store.settings();
    const t = Calc.totaisOrcamento(o);
    const linhas = [
      'Olá' + (o.cliente ? ', ' + o.cliente.nome.split(' ')[0] : '') + '! Segue o orçamento nº ' + numero(o) + ' da ' + s.empresa.nome + ':',
      '',
      ...o.itens.map((i) => '• ' + UI.int(i.quantidade) + 'x ' + i.descricao + ' — ' + UI.brl(i.valorTotal)),
      '',
    ];
    if (t.desconto) linhas.push('Desconto: ' + UI.brl(t.desconto));
    if (t.acrescimo) linhas.push('Acréscimo: ' + UI.brl(t.acrescimo));
    linhas.push('*Total: ' + UI.brl(t.total) + '*', 'Válido até ' + UI.date(o.validade) + '.', '', 'O PDF do orçamento segue em anexo.');
    const fone = o.cliente && o.cliente.telefone ? '55' + o.cliente.telefone.replace(/\D/g, '') : '';
    window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(linhas.join('\n')), '_blank', 'noopener');
  }

  // ---------------------------------------------------------------- PDF (impressão)
  function cabecalhoPdf(e) {
    const esc = UI.esc;
    return `
      <header class="pdf-head">
        <img src="assets/logo.png" alt="">
        <div class="pdf-emp">
          <div class="pdf-marca">${esc(e.nome).replace(/3D/, '<span>3D</span>')}</div>
          ${e.documento ? `<div>CNPJ ${esc(e.documento)}</div>` : ''}
          ${e.endereco ? `<div>${esc(e.endereco)}</div>` : ''}
          ${e.cidade ? `<div>${esc(e.cidade)}</div>` : ''}
          ${e.telefone ? `<div>Tel: ${esc(e.telefone)}</div>` : ''}
          ${e.email ? `<div>e-mail: ${esc(e.email)}</div>` : ''}
          ${e.site ? `<div>${esc(e.site)}</div>` : ''}
        </div>
      </header>
`;
  }

  /** Coloca o HTML na área de impressão, espera as imagens e abre "Imprimir / Salvar como PDF". */
  async function imprimirHtml(html, nomeArquivo) {
    const area = document.getElementById('print-area');
    area.innerHTML = html;
    await Promise.all([...area.querySelectorAll('img')].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
    const tituloAnterior = document.title;
    document.title = nomeArquivo;
    setTimeout(() => { window.print(); document.title = tituloAnterior; }, 50);
  }
  const nomeArquivo = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');

  async function imprimir(o) {
    const s = Store.settings();
    const e = s.empresa;
    const c = o.cliente || {};
    const t = Calc.totaisOrcamento(o);
    const esc = UI.esc;
    const modo = o.imagensPdf || 'miniatura';
    const imgs = modo === 'nenhuma' ? {} : await Imagens.getMany(o.itens.map((i) => i.imagemId));
    const temImg = o.itens.some((i) => imgs[i.imagemId]);
    const mini = temImg && (modo === 'miniatura' || modo === 'ambas');
    const galeria = temImg && (modo === 'galeria' || modo === 'ambas');
    const MIN_LINHAS = mini ? 6 : 12;
    const colImg = (it) => mini ? `<td class="c img">${imgs[it.imagemId] ? `<img src="${imgs[it.imagemId]}" alt="">` : ''}</td>` : '';
    const linhas = o.itens.map((it, i) => `
      <tr><td class="c">${i + 1}</td>${colImg(it)}<td>${esc(it.descricao)}${it.detalhe ? `<small>${esc(it.detalhe)}</small>` : ''}</td>
      <td class="c">${UI.int(it.quantidade)}</td><td class="r">${UI.brl(it.valorUnit)}</td><td class="r v">${UI.brl(it.valorTotal)}</td></tr>`).join('') +
      Array.from({ length: Math.max(0, MIN_LINHAS - o.itens.length) }, (_, i) => `<tr class="vazia"><td class="c">${o.itens.length + i + 1}</td>${mini ? '<td></td>' : ''}<td></td><td></td><td></td><td></td></tr>`).join('');
    const galeriaHtml = galeria ? `
      <section class="pdf-galeria">
        <div class="pdf-bar">IMAGENS DOS PRODUTOS</div>
        <div class="pdf-gal-grid">${o.itens.map((it, i) => imgs[it.imagemId] ? `
          <figure><div class="ph"><img src="${imgs[it.imagemId]}" alt=""></div>
          <figcaption><b>Item ${i + 1}</b> — ${esc(it.descricao)}</figcaption></figure>` : '').join('')}</div>
      </section>` : '';
    const end = [c.endereco, c.numero].filter(Boolean).join(', ') + (c.complemento ? ' — ' + c.complemento : '');
    const html = `
    <div class="pdf">
      ${cabecalhoPdf(e)}
      <table class="pdf-info"><tr>
        <th>Orçamento nº</th><td class="num-orc">${numero(o)}</td>
        <th>Emitido em</th><td>${UI.date(o.data)}</td>
        <th>Válido até</th><td>${UI.date(o.validade)}</td>
      </tr></table>
      <div class="pdf-bar">CLIENTE</div>
      <table class="pdf-grid">
        <tr><th>NOME</th><td colspan="5">${esc(c.nome)}</td></tr>
        <tr><th>TELEFONE</th><td>${esc(c.telefone)}</td><th>E-MAIL</th><td colspan="3">${esc(c.email)}</td></tr>
        <tr><th>CPF/CNPJ</th><td colspan="5">${esc(c.documento)}</td></tr>
        <tr><th>ENDEREÇO</th><td colspan="3">${esc(end)}</td><th>CEP</th><td>${esc(c.cep)}</td></tr>
        <tr><th>BAIRRO</th><td>${esc(c.bairro)}</td><th>CIDADE</th><td>${esc(c.cidade)}</td><th>ESTADO</th><td>${esc(c.uf)}</td></tr>
      </table>
      <div class="pdf-bar">ORÇAMENTO</div>
      <table class="pdf-itens">
        <thead><tr><th class="c" style="width:7%">ITEM</th>${mini ? '<th class="c" style="width:16%">IMAGEM</th>' : ''}<th>DESCRIÇÃO</th><th class="c" style="width:10%">QUANT.</th><th class="r" style="width:16%">VALOR UNIT.</th><th class="r" style="width:17%">VALOR</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <table class="pdf-tot">
        <tr><th>SUBTOTAL</th><td>${UI.brl(t.subtotal)}</td><th>DESCONTO</th><td>${t.desconto ? '− ' + UI.brl(t.desconto) : UI.brl(0)}</td></tr>
        <tr><th>ACRÉSCIMO</th><td>${UI.brl(t.acrescimo)}</td><th class="total">TOTAL</th><td class="total">${UI.brl(t.total)}</td></tr>
      </table>
      ${o.condicoes ? `<div class="pdf-cond"><strong>Condições</strong><p>${esc(o.condicoes).replace(/\n/g, '<br>')}</p></div>` : ''}
      <div class="pdf-sign">
        <div><span></span>${esc(e.nome)}</div>
        <div><span></span>${esc(c.nome || 'Cliente')}</div>
      </div>
      ${galeriaHtml}
    </div>`;
    const area = document.getElementById('print-area');
    area.innerHTML = html;
    const tituloAnterior = document.title;
    const nomeArq = 'Orcamento_' + numero(o) + (c.nome ? '_' + c.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_') : '');
    document.title = nomeArq;
    await Promise.all([...area.querySelectorAll('img')].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
    setTimeout(() => {
      window.print();
      document.title = tituloAnterior;
    }, 50);
  }

  window.Orcamentos = { cabecalhoPdf, imprimirHtml, nomeArquivo, STATUS, VENDIDO, statusLabel, badge, numero, lista, editor, novo, vendas, escolherEAdicionar, imprimir };
})();
