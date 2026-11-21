/* RXR 3D — módulo de precificação: composição de preço, comparativo por canal e catálogo de peças. */
(function () {
  'use strict';
  const { h } = UI;
  const n = Calc.n;
  const SIMNAO = [['nao', 'Não'], ['sim', 'Sim']];

  function opts(name, emptyLabel) {
    const rows = Store.all(name).sort(Cadastros.DEFS[name].sort);
    return [['', emptyLabel]].concat(rows.map((r) => [r.id, Cadastros.label(name, r)]));
  }

  function categorias() {
    const base = ['Decoração', 'Utilidades', 'Peças técnicas', 'Brinquedos', 'Chaveiros', 'Organização', 'Automotivo', 'Games', 'Brindes'];
    const usadas = Store.all('pecas').map((p) => p.categoria || (p.input && p.input.categoria)).filter(Boolean);
    return [...new Set(usadas.concat(base))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  const skuDe = (p) => p.sku || (p.input && p.input.sku) || '';
  const catDe = (p) => p.categoria || (p.input && p.input.categoria) || '';

  /** Gera SKU para a peça se ainda não tiver; devolve o SKU. */
  function filamentosDe(input) {
    const ids = [...new Set(Calc.partesDe(input || {}).map((p) => p.filamentoId).filter(Boolean))];
    return ids.map((id) => Store.get('filamentos', id)).filter(Boolean);
  }
  /** Material para o SKU: o material da peça, ou MULTI quando há materiais diferentes. */
  function materialDe(input) {
    const mats = [...new Set(filamentosDe(input).map((f) => Calc.normSku(f.material).split('-')[0]))];
    return mats.length > 1 ? 'MULTI' : (mats[0] || '');
  }
  /** "PLA Branco + PETG Azul" */
  function materiaisTexto(input) {
    return filamentosDe(input).map((f) => f.material + (f.cor ? ' ' + f.cor : '')).join(' + ');
  }
  const nPartes = (input) => Calc.partesDe(input || {}).length;
  function skusUsados(excetoId) {
    return new Set(Store.all('pecas').filter((p) => p.id !== excetoId).map(skuDe).filter(Boolean));
  }

  function canaisAtivos() {
    return Store.settings().canais.filter((c) => c.ativo);
  }

  function fields() {
    const s = Store.settings();
    const eqs = opts('equipamentos', '— selecione —');
    return [
      { key: 'nome', label: 'Nome da peça', required: true, span: 2 },
      { key: 'sku', label: 'SKU (código)', span: 1, placeholder: 'automático', help: 'Em branco = gerado ao salvar no catálogo.' },
      { key: 'categoria', label: 'Categoria', span: 1, suggest: categorias(), placeholder: 'ex.: Decoração' },
      { key: 'equipamentoId', label: 'Equipamento', type: 'select', options: eqs, required: true, span: 2, default: eqs[1] ? eqs[1][0] : '' },
      { key: 'quantidade', label: 'Quantidade', type: 'num', suffix: 'un.', default: 1, span: 1, help: 'Peças (ou conjuntos) a produzir.' },
      { key: 'acabamento', label: 'Acabamento (+' + UI.num(s.params.acabamentoPct, 0) + '% no custo)', type: 'select', options: SIMNAO, span: 2 },
      { key: 'projeto', label: 'Projeto customizado (+' + UI.num(s.params.projetoPct, 0) + '% no custo)', type: 'select', options: SIMNAO, span: 2 },
      { key: 'embalagemId', label: 'Embalagem', type: 'select', options: opts('embalagens', 'Sem embalagem'), span: 2 },
      { key: 'pecasPorEmbalagem', label: 'Peças por embalagem', type: 'num', default: 1, span: 1 },
      { key: 'margem', label: 'Margem desejada', type: 'pct', default: s.params.margemPadrao, span: 1, help: 'Sobre o preço de venda.' },
      { key: 'frete', label: 'Frete', type: 'money', span: 1 },
      { key: 'freteModo', label: 'Frete é…', type: 'select', options: [['repassado', 'Cliente paga'], ['absorvido', 'Eu pago (custo)']], span: 1 },
      { key: 'canalId', label: 'Canal de venda', type: 'select', options: canaisAtivos().map((c) => [c.id, c.nome]), span: 2 },
      { key: 'precoManual', label: 'Preço unitário manual (opcional)', type: 'money', span: 2, help: 'Preencha para simular um preço fixo (ex.: anúncio já publicado). Em branco = preço pela margem.' },
    ];
  }

  /** Converte o formulário para o "input" do cálculo (e vice-versa). */
  function toForm(input) {
    const i = Object.assign({}, input || {});
    const m = n(i.minutos);
    i.horas = m ? Math.floor(m / 60) : '';
    i.min = m ? Math.round(m % 60) : '';
    i.acabamento = i.acabamento ? 'sim' : 'nao';
    i.projeto = i.projeto ? 'sim' : 'nao';
    i.freteModo = i.freteRepassado === false ? 'absorvido' : 'repassado';
    if (!i.precoManual) i.precoManual = '';
    return i;
  }
  function fromForm(v) {
    return {
      nome: v.nome, sku: Calc.normSku(v.sku), categoria: (v.categoria || '').trim(), equipamentoId: v.equipamentoId, embalagemId: v.embalagemId,
      quantidade: Math.max(1, Math.round(n(v.quantidade) || 1)),
      acabamento: v.acabamento === 'sim', projeto: v.projeto === 'sim',
      pecasPorEmbalagem: Math.max(1, Math.round(n(v.pecasPorEmbalagem) || 1)),
      margem: n(v.margem), frete: n(v.frete), freteRepassado: v.freteModo !== 'absorvido',
      canalId: v.canalId || 'direto', precoManual: n(v.precoManual) || '',
    };
  }

  function ctx(input, canalId) {
    const s = Store.settings();
    const cid = canalId || input.canalId || 'direto';
    return {
      filamento: input.filamentoId ? Store.get('filamentos', input.filamentoId) : null,
      filamentos: Object.fromEntries(Store.all('filamentos').map((f) => [f.id, f])),
      equipamento: input.equipamentoId ? Store.get('equipamentos', input.equipamentoId) : null,
      embalagem: input.embalagemId ? Store.get('embalagens', input.embalagemId) : null,
      canal: s.canais.find((c) => c.id === cid) || null,
      params: s.params,
    };
  }

  function calcular(input, canalId) {
    return Calc.compor(input, ctx(input, canalId));
  }

  // ---------------------------------------------------------------- exibição do resultado
  function kpi(label, value, cls, sub) {
    return h('div', { class: 'kpi ' + (cls || '') }, h('span', { class: 'kpi-label' }, label), h('strong', null, value), sub ? h('small', null, sub) : null);
  }

  function resultado(input, res) {
    const canal = ctx(input).canal;
    const box = h('div', { class: 'result' });
    if (res.erro) box.append(h('div', { class: 'alert bad' }, res.erro));
    const q = res.quantidade;
    box.append(
      h('div', { class: 'price-hero' },
        h('span', null, 'Preço de venda' + (q > 1 ? ' (unitário)' : '')),
        h('strong', null, UI.brl(res.precoUnitario)),
        h('small', null, (q > 1 ? q + ' peças: ' + UI.brl(res.precoVendaPecas || res.precoUnitario * q) + ' · ' : '') +
          (res.lote.freteCobrado ? 'frete ' + UI.brl(res.lote.freteCobrado) + ' · ' : '') + 'total ' + UI.brl(res.precoTotal) +
          (canal ? ' · ' + canal.nome : ''))),
      h('div', { class: 'kpis' },
        kpi('Custo total', UI.brl(res.custoTotal)),
        kpi('Custo unitário', UI.brl(res.custoUnitario)),
        kpi('Lucro', UI.brl(res.lucro), res.lucro < 0 ? 'neg' : 'pos'),
        kpi('Margem', UI.pct(res.margemPct), res.margemPct < 0 ? 'neg' : ''),
        kpi('Markup', UI.markup(res.markup)),
        kpi('Lucro por hora', UI.brl(res.lucroHora), '', UI.horas(res.horasTotal) + ' de impressão')));

    const L = res.lote;
    const linhas = [
      ...(res.consumo.length > 1
        ? res.consumo.map((c) => { const f = Store.get('filamentos', c.filamentoId); return ['Material · ' + (f ? f.material + (f.cor ? ' ' + f.cor : '') : '?'), c.custo, UI.num(c.g, 0) + ' g']; })
        : [['Material', L.material, UI.num(res.pesoTotalG, 0) + ' g']]),
      ['Energia elétrica', L.energia],
      ['Depreciação do equipamento', L.depreciacao],
      ['Manutenção', L.manutencao],
      ['Custos fixos (rateio)', L.fixo],
      ['Perdas / falhas', L.falha],
      ['Embalagem', L.embalagem, L.qtdEmbalagens ? L.qtdEmbalagens + ' un.' : ''],
      ['Acabamento', L.acabamento],
      ['Projeto customizado', L.projeto],
      ['Frete absorvido', L.freteAbsorvido],
      ['Comissão da plataforma', L.comissao, res.comissaoPct ? UI.pct(res.comissaoPct) : ''],
      ['Taxa fixa da plataforma', L.taxaFixa],
      ['Impostos', L.imposto],
      ['Frete repassado ao cliente', L.freteCobrado],
    ].filter((l) => Math.abs(l[1]) > 0.0049);
    box.append(h('details', { class: 'breakdown', open: true },
      h('summary', null, 'Composição do custo'),
      h('table', { class: 'table compact' },
        h('tbody', null, linhas.map(([t, v, x]) => h('tr', null, h('td', null, t, x ? h('small', { class: 'muted' }, ' · ' + x) : null), h('td', { class: 'num' }, UI.brl(v)), h('td', { class: 'num muted' }, res.custoTotal ? UI.pct(v / res.custoTotal * 100) : '')))),
        h('tfoot', null, h('tr', null, h('td', null, 'Custo total'), h('td', { class: 'num' }, UI.brl(res.custoTotal)), h('td', null, ''))))));
    return box;
  }

  function comparativo(input) {
    const rows = canaisAtivos().map((c) => {
      const r = calcular(Object.assign({}, input), c.id);
      return h('tr', { class: c.id === (input.canalId || 'direto') ? 'hl' : null },
        h('td', null, c.nome),
        h('td', { class: 'num' }, r.erro ? '—' : UI.brl(r.precoUnitario)),
        h('td', { class: 'num' }, UI.brl(r.lote.taxasPlataforma / r.quantidade)),
        h('td', { class: 'num' }, UI.brl(r.custoUnitario)),
        h('td', { class: 'num ' + (r.lucro < 0 ? 'neg' : 'pos') }, UI.brl(r.lucroUnitario)),
        h('td', { class: 'num' }, UI.pct(r.margemPct)),
        h('td', { class: 'num' }, UI.markup(r.markup)));
    });
    return h('div', { class: 'card' },
      h('h3', null, 'Comparativo por canal de venda'),
      h('p', { class: 'sub' }, input.precoManual ? 'Com o mesmo preço manual em todos os canais.' : 'Preço necessário em cada canal para manter a margem desejada, já descontadas comissões e taxas. Valores por unidade.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['Canal', 'Preço unitário', 'Taxas/un.', 'Custo/un.', 'Lucro/un.', 'Margem', 'Markup'].map((t, i) => h('th', { class: i ? 'num' : null }, t)))),
        h('tbody', null, rows))),
      h('p', { class: 'help' }, 'Taxas de referência editáveis em ', h('a', { href: '#/marketplaces' }, 'Marketplaces'), '. Confira sempre a tabela vigente de cada plataforma.'));
  }

  function faltaCadastro() {
    const falta = [];
    if (!Store.all('filamentos').length) falta.push(h('a', { href: '#/filamentos' }, 'filamentos'));
    if (!Store.all('equipamentos').length) falta.push(h('a', { href: '#/equipamentos' }, 'equipamentos'));
    if (!falta.length) return null;
    return h('div', { class: 'alert warn' }, 'Cadastre primeiro ', falta.flatMap((a, i) => i ? [' e ', a] : [a]), ' para calcular os custos.');
  }

  /**
   * Quadro de partes: cada linha é uma parte/cor da peça com filamento, peso,
   * tempo de impressão e quantidade por peça (conjunto).
   */
  function partesEditor(partesIniciais) {
    const filOpts = opts('filamentos', '— filamento —');
    const tbody = h('tbody');
    const totalEl = h('div', { class: 'partes-total' });
    const numIn = (v, ph, cls) => h('input', { type: 'text', inputmode: 'decimal', class: cls || '', placeholder: ph || '', value: (v === '' || v === undefined || v === null || n(v) === 0) ? '' : UI.inNum(v) });

    const addLinha = (pt) => {
      pt = pt || {};
      const m = n(pt.minutos);
      const tr = h('tr', null,
        h('td', null, h('input', { type: 'text', class: 'pt-nome', placeholder: 'ex.: Letras', value: pt.nome || '' })),
        h('td', null, h('select', { class: 'pt-fil', 'aria-label': 'Filamento' }, filOpts.map(([v, l]) => h('option', { value: v, selected: v === (pt.filamentoId || '') }, l)))),
        h('td', null, h('div', { class: 'affix' }, numIn(pt.pesoG, '', 'pt-peso'), h('span', null, 'g'))),
        h('td', null, h('div', { class: 'tempo' },
          numIn(m ? Math.floor(m / 60) : '', 'h', 'pt-h'), h('span', { class: 'sep' }, ':'),
          numIn(m ? Math.round(m % 60) : '', 'min', 'pt-m'))),
        h('td', null, h('div', { class: 'affix' }, numIn(pt.qtd || 1, '1', 'pt-qtd'), h('span', null, '×'))),
        h('td', null, h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Remover parte', title: 'Remover parte', onclick: () => {
          if (tbody.children.length > 1) { tr.remove(); tbody.dispatchEvent(new Event('input', { bubbles: true })); }
        } }, '✕')));
      tbody.append(tr);
      return tr;
    };
    const ler = () => [...tbody.children].map((tr) => ({
      nome: tr.querySelector('.pt-nome').value.trim(),
      filamentoId: tr.querySelector('.pt-fil').value,
      pesoG: n(tr.querySelector('.pt-peso').value),
      minutos: n(tr.querySelector('.pt-h').value) * 60 + n(tr.querySelector('.pt-m').value),
      qtd: Math.max(1, Math.round(n(tr.querySelector('.pt-qtd').value) || 1)),
    }));
    const get = () => {
      const lidas = ler();
      const uteis = lidas.filter((p) => p.filamentoId || p.pesoG || p.minutos);
      return uteis.length ? uteis : lidas.slice(0, 1);
    };
    const atualizaTotal = () => {
      const ps = get();
      const g = ps.reduce((s, p) => s + p.pesoG * p.qtd, 0);
      const min = ps.reduce((s, p) => s + p.minutos * p.qtd, 0);
      const pecas = ps.reduce((s, p) => s + p.qtd, 0);
      totalEl.textContent = 'Por peça/conjunto: ' + UI.num(g, 0) + ' g · ' + UI.horas(min / 60) + ' de impressão · ' + pecas + ' parte(s) impressa(s)';
    };
    const valid = () => {
      let ok = true;
      [...tbody.children].forEach((tr, i) => {
        const fil = tr.querySelector('.pt-fil'), peso = tr.querySelector('.pt-peso');
        const vazia = !fil.value && !n(peso.value) && !n(tr.querySelector('.pt-h').value) && !n(tr.querySelector('.pt-m').value);
        const badFil = !fil.value && (!vazia || i === 0);
        const badPeso = !n(peso.value) && (!vazia || i === 0);
        fil.classList.toggle('invalid', badFil);
        peso.closest('.affix').classList.toggle('invalid', badPeso);
        if (badFil || badPeso) ok = false;
      });
      if (!ok) UI.toast('Informe filamento e peso de cada parte.', 'bad');
      return ok;
    };

    (partesIniciais && partesIniciais.length ? partesIniciais : [{}]).forEach(addLinha);
    tbody.addEventListener('input', atualizaTotal);
    tbody.addEventListener('change', atualizaTotal);
    atualizaTotal();

    const el = h('div', { class: 'partes span-4' },
      h('div', { class: 'partes-head' },
        h('label', null, 'Materiais e partes da peça', h('span', { class: 'req' }, ' *')),
        h('button', { type: 'button', class: 'btn small', onclick: () => { addLinha({}).querySelector('.pt-nome').focus(); atualizaTotal(); } }, '+ Adicionar parte / cor')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'partes-tab' },
        h('thead', null, h('tr', null, ['Parte (opcional)', 'Filamento', 'Peso', 'Tempo (h : min)', 'Qtd', ''].map((t) => h('th', null, t)))),
        tbody)),
      totalEl,
      h('small', { class: 'help' }, 'Peso e tempo de cada parte conforme o fatiador. "Qtd" = quantas vezes essa parte é impressa por peça/conjunto. ',
        'Impressão multicor de uma vez (AMS): lance o tempo só na linha principal e, nas outras cores, apenas o peso gasto (inclua a purga).'));
    return { el, get, valid };
  }

  /**
   * Monta o formulário de composição com resultado ao vivo.
   * Retorna { el, get(): {input,res}, valid() }.
   */
  function editor(input, { comparar = true } = {}) {
    const fs = fields();
    const form = UI.form(fs, toForm(input));
    const out = h('div');
    const cmp = h('div');
    let imagemId = (input && input.imagemId) || '';
    const imgField = Imagens.campo(imagemId, (id) => { imagemId = id; });
    const partesIni = (input && (input.partes || input.filamentoId || input.pesoG)) ? Calc.partesDe(input) : [];
    const partesEd = partesEditor(partesIni);
    form.elements.categoria.closest('.field').after(partesEd.el);
    const get = () => {
      const inp = fromForm(UI.readForm(form, fs));
      inp.imagemId = imagemId;
      inp.partes = partesEd.get();
      // resumo para listas e compatibilidade: 1º filamento, peso e tempo por peça
      inp.filamentoId = (inp.partes.find((p) => p.filamentoId) || {}).filamentoId || '';
      inp.pesoG = inp.partes.reduce((s, p) => s + p.pesoG * p.qtd, 0);
      inp.minutos = inp.partes.reduce((s, p) => s + p.minutos * p.qtd, 0);
      return { input: inp, res: calcular(inp) };
    };
    const update = () => {
      const { input: inp, res } = get();
      out.replaceChildren(resultado(inp, res));
      if (comparar) cmp.replaceChildren(comparativo(inp));
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
    const el = h('div', { class: 'pricing' },
      h('div', { class: 'pricing-form card' }, faltaCadastro(), form, imgField),
      h('div', { class: 'pricing-out' }, out));
    return { el, cmp, get, valid: () => UI.validate(form, fs) && partesEd.valid(), form };
  }

  /** Converte uma composição em item de orçamento (com fotografia dos valores). */
  function toItem(input, res, prev) {
    return Object.assign({}, prev || {}, {
      id: (prev && prev.id) || Store.uid(),
      tipo: 'peca',
      imagemId: input.imagemId || '',
      descricao: (prev && prev.descricao && prev.nomeOrig === input.nome) ? prev.descricao : input.nome,
      nomeOrig: input.nome,
      sku: input.sku || '',
      detalhe: [input.sku ? 'SKU ' + input.sku : '', materiaisTexto(input), nPartes(input) > 1 ? nPartes(input) + ' partes' : '', input.acabamento ? 'com acabamento' : '', input.projeto ? 'projeto customizado' : ''].filter(Boolean).join(' · '),
      quantidade: res.quantidade,
      valorUnit: res.precoTotal / res.quantidade,
      valorTotal: res.precoTotal,
      custoTotal: res.custoTotal,
      lucro: res.lucro,
      horas: res.horasTotal,
      pecas: res.quantidade,
      pesoG: res.pesoTotalG,
      consumo: res.consumo,
      input,
      resumo: { precoUnitario: res.precoUnitario, custoUnitario: res.custoUnitario, margemPct: res.margemPct, markup: res.markup, lucroHora: res.lucroHora, canalId: input.canalId },
    });
  }

  // ---------------------------------------------------------------- página da calculadora
  function page(pecaId) {
    const peca = pecaId ? Store.get('pecas', pecaId) : null;
    const ed = editor(peca ? peca.input : { quantidade: 1, pecasPorEmbalagem: 1, canalId: 'direto' });
    const salvar = () => {
      if (!ed.valid()) return;
      const { input } = ed.get();
      const todas = Store.all('pecas');
      // peça aberta do catálogo, ou mesma peça salva de novo (mesmo nome e SKU compatível)
      const existente = peca
        || todas.find((p) => p.nome.toLowerCase() === input.nome.toLowerCase() && (!input.sku || !skuDe(p) || skuDe(p) === input.sku));
      const usados = skusUsados(existente && existente.id);
      if (input.sku && usados.has(input.sku)) {
        UI.toast('O SKU ' + input.sku + ' já está em uso por outra peça.', 'bad');
        ed.form.elements.sku.classList.add('invalid');
        return;
      }
      if (!input.sku) input.sku = Store.nextSku(materialDe(input), usados);
      ed.form.elements.sku.value = input.sku;
      ed.form.elements.sku.classList.remove('invalid');
      const saved = Store.save('pecas', Object.assign({}, existente || {}, { nome: input.nome, sku: input.sku, categoria: input.categoria, input }));
      UI.toast('Peça salva no catálogo · SKU ' + input.sku + '.');
      if (!pecaId) location.hash = '#/precificacao/' + saved.id;
    };
    const addOrc = () => {
      if (!ed.valid()) return;
      const { input, res } = ed.get();
      if (res.erro) { UI.toast(res.erro, 'bad'); return; }
      Orcamentos.escolherEAdicionar(toItem(input, res));
    };
    return h('div', null,
      UI.pageHead(peca ? peca.nome : 'Precificação', peca ? 'Peça do catálogo' + (skuDe(peca) ? ' · SKU ' + skuDe(peca) : '') + ' — altere e salve para atualizar.' : 'Composição de preço de uma peça, com custos, margem e taxas de marketplace.',
        h('a', { class: 'btn', href: '#/precificacao' }, 'Nova'),
        h('button', { class: 'btn', onclick: salvar }, 'Salvar no catálogo'),
        h('button', { class: 'btn primary', onclick: addOrc }, 'Adicionar a orçamento')),
      ed.el, ed.cmp);
  }

  // ---------------------------------------------------------------- catálogo de peças
  function linhaCatalogo(p, canalId) {
    const r = calcular(Object.assign({}, p.input, { quantidade: 1, frete: 0, precoManual: canalId ? '' : p.input.precoManual }), canalId);
    return { p, r, mat: materiaisTexto(p.input), sku: skuDe(p), cat: catDe(p) };
  }

  function catalogo() {
    const tbody = h('tbody');
    const f = { q: '', cat: '', ordem: 'sku' };
    const avisoSku = h('div');
    const filtrar = () => Store.all('pecas').map((p) => linhaCatalogo(p)).filter((l) => {
      if (f.cat && (l.cat || '(sem categoria)') !== f.cat) return false;
      if (!f.q) return true;
      return [l.p.nome, l.sku, l.cat, l.mat].join(' ').toLowerCase().includes(f.q);
    }).sort((a, b) => {
      if (f.ordem === 'nome') return a.p.nome.localeCompare(b.p.nome, 'pt-BR');
      if (f.ordem === 'categoria') return (a.cat || '~').localeCompare(b.cat || '~', 'pt-BR') || a.p.nome.localeCompare(b.p.nome, 'pt-BR');
      if (f.ordem === 'preco') return b.r.precoUnitario - a.r.precoUnitario;
      return (a.sku || '~').localeCompare(b.sku || '~', 'pt-BR', { numeric: true });
    });

    const gerarFaltantes = () => {
      const sem = Store.all('pecas').filter((p) => !skuDe(p)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const usados = skusUsados();
      for (const p of sem) {
        const sku = Store.nextSku(materialDe(p.input), usados);
        usados.add(sku);
        p.sku = sku;
        p.input.sku = sku;
        Store.save('pecas', p);
      }
      UI.toast(sem.length + ' SKU(s) gerado(s).');
      render();
    };

    const render = () => {
      const rows = filtrar();
      const semSku = Store.all('pecas').filter((p) => !skuDe(p)).length;
      avisoSku.replaceChildren(semSku ? h('div', { class: 'alert warn' }, semSku + ' peça(s) ainda sem SKU. ',
        h('button', { class: 'btn small', onclick: gerarFaltantes }, 'Gerar SKUs automaticamente')) : '');
      tbody.replaceChildren();
      if (!rows.length) {
        tbody.append(h('tr', null, h('td', { colspan: 10, class: 'muted center' }, (f.q || f.cat) ? 'Nada encontrado.' : 'Nenhuma peça salva. Use a Precificação e clique em "Salvar no catálogo".')));
        return;
      }
      for (const { p, r, mat, sku, cat } of rows) {
        tbody.append(h('tr', null,
          h('td', null, sku ? h('code', { class: 'sku' }, sku) : h('span', { class: 'muted' }, '—')),
          h('td', null, h('div', { class: 'with-thumb' }, Imagens.mini(p.input.imagemId), h('a', { href: '#/precificacao/' + p.id }, h('strong', null, p.nome)))),
          h('td', null, cat || h('span', { class: 'muted' }, '—')),
          h('td', null, mat || h('span', { class: 'neg' }, 'filamento excluído'), nPartes(p.input) > 1 ? h('small', { class: 'muted block' }, nPartes(p.input) + ' partes') : null),
          h('td', { class: 'num' }, UI.num(r.pesoPecaG, 0) + ' g'),
          h('td', { class: 'num' }, UI.horas(r.horasPeca)),
          h('td', { class: 'num' }, UI.brl(r.custoUnitario)),
          h('td', { class: 'num strong' }, UI.brl(r.precoUnitario)),
          h('td', { class: 'num' }, UI.pct(r.margemPct)),
          h('td', { class: 'row-actions' },
            h('a', { class: 'btn small', href: '#/precificacao/' + p.id }, 'Abrir'),
            h('button', { class: 'btn small', onclick: () => Orcamentos.escolherEAdicionar(toItem(p.input, calcular(p.input))) }, 'Orçar'),
            h('button', { class: 'btn small ghost-danger', onclick: () => UI.confirm('Excluir "' + p.nome + '" do catálogo?', () => { Store.remove('pecas', p.id); render(); }) }, 'Excluir'))));
      }
    };

    const cats = [...new Set(Store.all('pecas').map((p) => catDe(p) || '(sem categoria)'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const exportar = () => {
      const linhas = [['SKU', 'Peça', 'Categoria', 'Materiais', 'Partes', 'Peso (g)', 'Tempo (h)', 'Custo unitário', 'Preço unitário', 'Margem %']];
      for (const { p, r, mat, sku, cat } of filtrar()) {
        linhas.push([sku, p.nome, cat, mat, nPartes(p.input), Calc.r2(r.pesoPecaG), Calc.r2(r.horasPeca), Calc.r2(r.custoUnitario), Calc.r2(r.precoUnitario), Calc.r2(r.margemPct)]);
      }
      UI.download('catalogo_rxr3d_' + UI.today() + '.csv', UI.csv(linhas), 'text/csv');
    };

    render();
    return h('div', null,
      UI.pageHead('Catálogo de peças', 'Peças já precificadas, recalculadas com os custos atuais (1 unidade, sem frete).',
        h('button', { class: 'btn', onclick: exportar }, 'Exportar CSV'),
        h('button', { class: 'btn', onclick: () => opcoesCatalogoPdf(filtrar().map((l) => l.p), f.cat) }, 'Catálogo em PDF'),
        h('a', { class: 'btn primary', href: '#/precificacao' }, '+ Nova peça')),
      avisoSku,
      h('div', { class: 'card' },
        h('div', { class: 'toolbar' },
          h('input', { type: 'search', class: 'search', placeholder: 'Buscar por SKU, nome, categoria ou material…', oninput: (e) => { f.q = e.target.value.toLowerCase(); render(); } }),
          h('select', { 'aria-label': 'Categoria', onchange: (e) => { f.cat = e.target.value; render(); } }, h('option', { value: '' }, 'Todas as categorias'), cats.map((c) => h('option', { value: c }, c))),
          h('label', { class: 'inline' }, 'Ordenar por ',
            h('select', { onchange: (e) => { f.ordem = e.target.value; render(); } },
              [['sku', 'SKU'], ['nome', 'Nome'], ['categoria', 'Categoria'], ['preco', 'Maior preço']].map(([v, l]) => h('option', { value: v }, l))))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['SKU', 'Peça', 'Categoria', 'Material', 'Peso', 'Tempo', 'Custo/un.', 'Preço/un.', 'Margem', ''].map((t, i) => h('th', { class: i >= 4 && i <= 8 ? 'num' : null }, t)))),
          tbody))));
  }

  // ---------------------------------------------------------------- catálogo em PDF
  function opcoesCatalogoPdf(pecas, categoria) {
    if (!pecas.length) { UI.toast('Nenhuma peça para o catálogo.', 'warn'); return; }
    const canais = canaisAtivos();
    const fs = [
      { key: 'titulo', label: 'Título', span: 4, default: '' },
      { key: 'precos', label: 'Preços', type: 'select', options: [['sim', 'Mostrar preço unitário'], ['nao', 'Sem preços (só vitrine)']], span: 2 },
      { key: 'canalId', label: 'Preço do canal', type: 'select', options: canais.map((c) => [c.id, c.nome]), span: 2 },
      { key: 'detalhes', label: 'Mostrar material e cor', type: 'check', span: 2 },
    ];
    const form = UI.form(fs, { titulo: categoria && categoria !== '(sem categoria)' ? 'Catálogo — ' + categoria : 'Catálogo de produtos', precos: 'sim', canalId: 'direto', detalhes: true });
    form.append(h('p', { class: 'help span-4' }, pecas.length + ' peça(s), na ordem e com os filtros da tela. Agrupadas por categoria.'));
    UI.modal('Catálogo em PDF', form, {
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Gerar PDF', kind: 'primary', onClick: (c) => { const v = UI.readForm(form, fs); c(); imprimirCatalogo(pecas, v); } },
      ],
    });
  }

  async function imprimirCatalogo(pecas, op) {
    const s = Store.settings();
    const esc = UI.esc;
    const imgs = await Imagens.getMany(pecas.map((p) => p.input.imagemId));
    const grupos = new Map();
    for (const p of pecas) {
      const cat = catDe(p) || 'Outros';
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(p);
    }
    const card = (p) => {
      const l = linhaCatalogo(p, op.canalId);
      const img = imgs[p.input.imagemId];
      return `<figure class="cat-card">
        <div class="ph">${img ? `<img src="${img}" alt="">` : '<img class="sem" src="assets/logo.png" alt="">'}</div>
        <figcaption>
          ${l.sku ? `<span class="cat-sku">${esc(l.sku)}</span>` : ''}
          <strong>${esc(p.nome)}</strong>
          ${op.detalhes && l.mat ? `<small>${esc(l.mat)}</small>` : ''}
          ${op.precos === 'sim' ? `<span class="cat-preco">${UI.brl(l.r.precoUnitario)}</span>` : ''}
        </figcaption></figure>`;
    };
    const canal = s.canais.find((c) => c.id === op.canalId);
    const html = `
    <div class="pdf">
      ${Orcamentos.cabecalhoPdf(s.empresa)}
      <div class="cat-titulo"><h1>${esc(op.titulo || 'Catálogo de produtos')}</h1>
        <span>${pecas.length} produto(s) · ${UI.date(UI.today())}${op.precos === 'sim' && canal && canal.id !== 'direto' ? ' · preços ' + esc(canal.nome) : ''}</span></div>
      ${[...grupos.entries()].sort((a, b) => (a[0] === 'Outros') - (b[0] === 'Outros') || a[0].localeCompare(b[0], 'pt-BR')).map(([cat, ps]) => `
        <section class="cat-grupo">
          <div class="pdf-bar">${esc(cat.toUpperCase())}</div>
          <div class="cat-grid">${ps.map(card).join('')}</div>
        </section>`).join('')}
      ${op.precos === 'sim' ? '<p class="cat-nota">Preços unitários sujeitos a alteração sem aviso prévio. Consulte condições para quantidade e personalização.</p>' : ''}
    </div>`;
    Orcamentos.imprimirHtml(html, Orcamentos.nomeArquivo(op.titulo || 'Catalogo') + '_' + UI.today());
  }

  window.Precificacao = { materiaisTexto, filamentosDe, page, catalogo, editor, calcular, toItem, toForm, fromForm, imprimirCatalogo };
})();
