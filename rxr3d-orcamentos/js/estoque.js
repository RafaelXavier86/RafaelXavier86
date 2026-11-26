/*
 * RXR 3D — controle de estoque de filamentos e de produtos acabados.
 *
 * O saldo é a soma das movimentações. Elas surgem de:
 *  - lançamentos manuais (entrada/compra, perda, ajuste de inventário, saída);
 *  - produção para estoque (soma produto acabado e consome filamento);
 *  - orçamentos aprovados/concluídos (consomem filamento ou saem do estoque do produto).
 * As movimentações de um orçamento são refeitas a cada gravação, então mudar status,
 * itens ou quantidades mantém o estoque sempre coerente.
 */
(function () {
  'use strict';
  const { h } = UI;
  const n = Calc.n;
  const MF = 'movFilamento';
  const MP = 'movProduto';
  const MC = 'movComponente';
  const VENDIDO = ['aprovado', 'concluido'];

  const TIPOS_F = {
    entrada: 'Entrada (compra)', 'consumo-venda': 'Consumo · venda', 'consumo-producao': 'Consumo · produção',
    perda: 'Perda / descarte', ajuste: 'Ajuste de inventário',
  };
  const TIPOS_C = {
    entrada: 'Entrada (compra)', 'consumo-venda': 'Consumo · venda', 'consumo-producao': 'Consumo · produção',
    perda: 'Perda / descarte', ajuste: 'Ajuste de inventário',
  };
  const TIPOS_P = { producao: 'Produção', venda: 'Venda', saida: 'Saída (brinde, amostra, perda)', ajuste: 'Ajuste de inventário' };

  const pesoRolo = (f) => (f ? n(f.peso) * (String(f.unidade).toLowerCase() === 'kg' ? 1000 : 1) : 0);
  const fmtG = (g) => (Math.abs(g) >= 1000 ? UI.num(g / 1000, 2) + ' kg' : UI.num(g, 0) + ' g');
  const filNome = (f) => (f ? [f.material, f.fabricante, f.cor].filter(Boolean).join(' · ') : 'filamento excluído');
  const skuDe = (p) => p.sku || (p.input && p.input.sku) || '';
  const minFil = (f) => (f.estoqueMinRolos === undefined ? 1 : n(f.estoqueMinRolos)) * pesoRolo(f);

  // ---------------------------------------------------------------- saldos
  function saldosFilamento() {
    const m = {};
    const desde = UI.addDays(UI.today(), -30);
    for (const x of Store.all(MF)) {
      const s = m[x.filamentoId] || (m[x.filamentoId] = { saldo: 0, movs: 0, consumo30: 0 });
      s.saldo += n(x.g);
      s.movs++;
      if (String(x.tipo).startsWith('consumo') && x.data >= desde) s.consumo30 -= n(x.g);
    }
    return m;
  }
  function saldosProduto() {
    const m = {};
    const desde = UI.addDays(UI.today(), -30);
    for (const x of Store.all(MP)) {
      const s = m[x.pecaId] || (m[x.pecaId] = { saldo: 0, movs: 0, vendas30: 0 });
      s.saldo += n(x.qtd);
      s.movs++;
      if (x.tipo === 'venda' && x.data >= desde) s.vendas30 -= n(x.qtd);
    }
    return m;
  }
  function saldosComponente() {
    const m = {};
    const desde = UI.addDays(UI.today(), -30);
    for (const x of Store.all(MC)) {
      const s = m[x.componenteId] || (m[x.componenteId] = { saldo: 0, movs: 0, consumo30: 0 });
      s.saldo += n(x.qtd);
      s.movs++;
      if (String(x.tipo).startsWith('consumo') && x.data >= desde) s.consumo30 -= n(x.qtd);
    }
    return m;
  }
  const vazio = { saldo: 0, movs: 0, consumo30: 0, vendas30: 0 };
  const fmtUn = (v) => UI.num(v, Math.abs(v % 1) > 0.001 ? 2 : 0) + ' un.';

  /** Componentes usados por um item de orçamento (quantidade total do lote). */
  function consumoCompItem(it) {
    if (Array.isArray(it.consumoComp)) return it.consumoComp;
    const lista = it.input && Array.isArray(it.input.componentes) ? it.input.componentes : [];
    const q = n(it.quantidade) || 1;
    return lista.filter((c) => c.componenteId && n(c.qtd)).map((c) => ({ componenteId: c.componenteId, qtd: n(c.qtd) * q }));
  }

  function situacao(saldo, minimo, controlado) {
    if (!controlado && !minimo) return h('span', { class: 'badge st-aberto' }, 'Sem controle');
    if (saldo <= 0) return h('span', { class: 'badge st-recusado' }, saldo < 0 ? 'Negativo' : 'Zerado');
    if (minimo && saldo < minimo) return h('span', { class: 'badge st-aprovado' }, 'Repor');
    return h('span', { class: 'badge st-concluido' }, 'OK');
  }

  // ---------------------------------------------------------------- orçamentos → estoque
  function pecaDoItem(it) {
    if (!it || it.tipo === 'avulso') return null;
    if (it.pecaId) { const p = Store.get('pecas', it.pecaId); if (p) return p; }
    if (it.sku) return Store.all('pecas').find((p) => skuDe(p) === it.sku) || null;
    return null;
  }

  function sincronizarOrcamento(o, acao) {
    const origem = 'orc:' + o.id;
    const inicio = (Store.settings().estoque || {}).inicio || '';
    const data = o.dataVenda || o.data || UI.today();
    const ativo = acao !== 'remove' && VENDIDO.includes(o.status) && (!inicio || data >= inicio);
    const ref = 'Orçamento nº ' + String(o.numero || 0).padStart(4, '0') + (o.cliente ? ' · ' + o.cliente.nome : '');
    const mf = [], mp = [], mc = [];
    if (ativo) {
      for (const it of o.itens || []) {
        const peca = pecaDoItem(it);
        if (it.atendimento === 'estoque' && peca) {
          mp.push({ data, pecaId: peca.id, tipo: 'venda', qtd: -n(it.quantidade), origem, ref: ref + ' · ' + it.descricao });
        } else {
          for (const c of Dashboard.consumoItem(it)) {
            if (c.filamentoId && n(c.g)) mf.push({ data, filamentoId: c.filamentoId, tipo: 'consumo-venda', g: -n(c.g), origem, ref: ref + ' · ' + it.descricao });
          }
          for (const c of consumoCompItem(it)) {
            if (c.componenteId && n(c.qtd)) mc.push({ data, componenteId: c.componenteId, tipo: 'consumo-venda', qtd: -n(c.qtd), origem, ref: ref + ' · ' + it.descricao });
          }
        }
      }
    }
    const tinha = [MF, MP, MC].some((col) => Store.all(col).some((r) => r.origem === origem));
    if (!tinha && !mf.length && !mp.length && !mc.length) return;
    Store.replaceWhere(MF, (r) => r.origem === origem, mf);
    Store.replaceWhere(MP, (r) => r.origem === origem, mp);
    Store.replaceWhere(MC, (r) => r.origem === origem, mc);
  }
  Store.on('orcamentos', sincronizarOrcamento);

  function ressincronizarTodos() {
    Store.all('orcamentos').forEach((o) => sincronizarOrcamento(o, 'save'));
  }

  // ---------------------------------------------------------------- produção para estoque
  function consumoProducao(peca, qtd) {
    const r = Precificacao.calcular(Object.assign({}, peca.input, { quantidade: qtd, frete: 0 }));
    return r.consumo.filter((c) => c.filamentoId && c.g);
  }
  function consumoCompProducao(peca, qtd) {
    const r = Precificacao.calcular(Object.assign({}, peca.input, { quantidade: qtd, frete: 0 }));
    return (r.consumoComp || []).filter((c) => c.componenteId && c.qtd);
  }

  function registrarProducao({ pecaId, qtd, data, descontar, obs }) {
    const peca = Store.get('pecas', pecaId);
    const origem = 'prod:' + Store.uid();
    const ref = 'Produção · ' + peca.nome + ' (' + qtd + ' un.)';
    Store.replaceWhere(MP, () => false, [{ data, pecaId, tipo: 'producao', qtd, origem, ref, obs }]);
    if (descontar) {
      Store.replaceWhere(MF, () => false, consumoProducao(peca, qtd).map((c) => ({ data, filamentoId: c.filamentoId, tipo: 'consumo-producao', g: -c.g, origem, ref, obs })));
      Store.replaceWhere(MC, () => false, consumoCompProducao(peca, qtd).map((c) => ({ data, componenteId: c.componenteId, tipo: 'consumo-producao', qtd: -c.qtd, origem, ref, obs })));
    }
  }

  // ---------------------------------------------------------------- modais de lançamento
  const NOVO = '__novo';
  const CAMPOS_NOVO = ['material', 'fabricante', 'cor', 'pesoRolo', 'unRolo', 'minRolos'];

  function modalFilamento(tipo, filamentoId, onDone) {
    const fils = Store.all('filamentos').sort((a, b) => filNome(a).localeCompare(filNome(b), 'pt-BR'));
    if (!fils.length && tipo !== 'entrada') { UI.toast('Cadastre os filamentos primeiro.', 'warn'); return; }
    const titulos = { entrada: 'Entrada de filamento (compra)', perda: 'Perda / descarte de filamento', ajuste: 'Ajuste de inventário' };
    const opcoes = fils.map((f) => [f.id, filNome(f)]);
    if (tipo === 'entrada') opcoes.push([NOVO, '+ Novo filamento (cadastrar agora)']);
    const fs = [
      { key: 'filamentoId', label: 'Filamento', type: 'select', options: opcoes, default: filamentoId || (fils.length ? fils[0].id : NOVO), required: true, span: 3 },
      { key: 'data', label: 'Data', type: 'date', default: UI.today(), span: 1 },
    ];
    if (tipo === 'entrada') {
      fs.push(
        { key: 'material', label: 'Material', suggest: Cadastros.DEFS.filamentos.fields[0].suggest, span: 1, placeholder: 'ex.: PLA' },
        { key: 'fabricante', label: 'Fabricante', span: 1 },
        { key: 'cor', label: 'Cor', span: 2 },
        { key: 'pesoRolo', label: 'Peso de cada rolo', type: 'num', default: 1, span: 1 },
        { key: 'unRolo', label: 'Unidade', type: 'select', options: [['kg', 'kg'], ['g', 'g']], default: 'kg', span: 1 },
        { key: 'minRolos', label: 'Estoque mínimo', type: 'num', suffix: 'rolos', default: 1, span: 2 });
    }
    fs.push(
      { key: 'qtd', label: tipo === 'ajuste' ? 'Saldo contado' : 'Quantidade', type: 'num', required: true, span: 2,
        help: tipo === 'ajuste' ? 'Quanto há de fato na prateleira (rolos fechados + sobras).' : null },
      { key: 'unidade', label: 'Unidade', type: 'select', options: [['rolos', 'Rolos'], ['g', 'Gramas'], ['kg', 'kg']], default: tipo === 'entrada' ? 'rolos' : 'g', span: 2 });
    if (tipo === 'entrada') {
      fs.push({ key: 'valor', label: 'Valor total pago (com frete)', type: 'money', span: 2, help: 'Define o preço do rolo usado na precificação.' });
      fs.push({ key: 'atualizar', label: 'Atualizar o preço do rolo no cadastro', type: 'check', span: 2 });
    }
    fs.push({ key: 'obs', label: 'Observação', span: 4, placeholder: tipo === 'entrada' ? 'ex.: loja, nota fiscal' : 'ex.: impressão falhou, umidade' });
    const form = UI.form(fs, { atualizar: true });
    const titulo = h('h4', { class: 'form-section' }, 'Dados do novo filamento');
    if (tipo === 'entrada') form.elements.material.closest('.field').before(titulo);
    const info = h('p', { class: 'help span-4' });
    form.append(info);
    const saldos = saldosFilamento();
    const ehNovo = () => form.elements.filamentoId.value === NOVO;
    const mostra = () => {
      if (tipo === 'entrada') {
        const novo = ehNovo();
        titulo.hidden = !novo;
        CAMPOS_NOVO.forEach((k) => { form.elements[k].closest('.field').hidden = !novo; });
        form.elements.atualizar.closest('.field').hidden = novo;
      }
      const f = fils.find((x) => x.id === form.elements.filamentoId.value);
      info.textContent = f ? 'Saldo atual: ' + fmtG((saldos[f.id] || vazio).saldo) + ' · rolo de ' + fmtG(pesoRolo(f)) + ' · preço cadastrado ' + UI.brl(f.preco) + '/rolo'
        : 'O filamento será cadastrado com o preço por rolo calculado a partir desta compra.';
    };
    form.addEventListener('change', mostra);
    mostra();
    UI.modal(titulos[tipo], form, {
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Lançar', kind: 'primary', onClick: (c) => {
          if (!UI.validate(form, fs)) return;
          const v = UI.readForm(form, fs);
          let f;
          if (tipo === 'entrada' && v.filamentoId === NOVO) {
            const faltando = [];
            if (!v.material) faltando.push('material');
            if (!(n(v.pesoRolo) > 0)) faltando.push('peso do rolo');
            if (!(n(v.valor) > 0)) faltando.push('valor pago');
            ['material', 'pesoRolo', 'valor'].forEach((k) => form.elements[k].classList.toggle('invalid', faltando.includes({ material: 'material', pesoRolo: 'peso do rolo', valor: 'valor pago' }[k])));
            if (faltando.length) { UI.toast('Para o novo filamento, informe: ' + faltando.join(', ') + '.', 'bad'); return; }
            const chave = (x) => [x.material, x.fabricante, x.cor].map((s) => String(s || '').trim().toLowerCase()).join('|');
            const existente = fils.find((x) => chave(x) === chave(v));
            if (existente) {
              f = existente;
              UI.toast('Esse filamento já estava cadastrado; a entrada foi lançada nele.', 'warn');
            } else {
              f = Store.save('filamentos', { material: v.material, fabricante: v.fabricante, cor: v.cor, peso: n(v.pesoRolo), unidade: v.unRolo, preco: 0, estoqueMinRolos: v.minRolos === '' ? 1 : n(v.minRolos) });
            }
            v.atualizar = true;
          } else {
            f = fils.find((x) => x.id === v.filamentoId);
          }
          const g = n(v.qtd) * (v.unidade === 'rolos' ? pesoRolo(f) : v.unidade === 'kg' ? 1000 : 1);
          let mov = g;
          if (tipo === 'perda') mov = -g;
          if (tipo === 'ajuste') mov = g - (saldos[f.id] || vazio).saldo;
          if (!mov && tipo !== 'ajuste') { UI.toast('Informe a quantidade.', 'bad'); return; }
          if (!mov) { UI.toast('O saldo já confere — nada a ajustar.'); c(); return; }
          Store.replaceWhere(MF, () => false, [{
            data: v.data || UI.today(), filamentoId: f.id, tipo, g: mov, valor: n(v.valor) || '', origem: 'manual:' + Store.uid(),
            ref: TIPOS_F[tipo] + (tipo === 'entrada' && v.unidade === 'rolos' ? ' · ' + UI.num(v.qtd, 0) + ' rolo(s)' : ''), obs: v.obs,
          }]);
          const rolos = pesoRolo(f) ? g / pesoRolo(f) : 0;
          if (tipo === 'entrada' && v.atualizar && n(v.valor) > 0 && rolos > 0) {
            const preco = Calc.r2(n(v.valor) / rolos);
            Store.save('filamentos', Object.assign({}, Store.get('filamentos', f.id), { preco }));
            UI.toast('Entrada lançada · preço do rolo: ' + UI.brl(preco) + '.');
          } else UI.toast('Lançamento registrado.');
          c();
          onDone && onDone();
        } },
      ],
    });
  }

  function modalProduto(tipo, pecaId, onDone) {
    const pecas = Store.all('pecas').sort((a, b) => (skuDe(a) || a.nome).localeCompare(skuDe(b) || b.nome, 'pt-BR', { numeric: true }));
    if (!pecas.length) { UI.toast('O catálogo de peças está vazio.', 'warn'); return; }
    const titulos = { producao: 'Registrar produção para estoque', saida: 'Saída de produto (brinde, amostra, perda)', ajuste: 'Ajuste de inventário do produto' };
    const fs = [
      { key: 'pecaId', label: 'Produto', type: 'select', options: pecas.map((p) => [p.id, (skuDe(p) ? skuDe(p) + ' — ' : '') + p.nome]), default: pecaId, required: true, span: 3 },
      { key: 'data', label: 'Data', type: 'date', default: UI.today(), span: 1 },
      { key: 'qtd', label: tipo === 'ajuste' ? 'Quantidade contada' : 'Quantidade', type: 'num', suffix: 'un.', required: true, span: 2, default: tipo === 'ajuste' ? '' : 1 },
    ];
    if (tipo === 'producao') fs.push({ key: 'descontar', label: 'Descontar o filamento usado do estoque', type: 'check', span: 2 });
    fs.push({ key: 'obs', label: 'Observação', span: 4 });
    const form = UI.form(fs, { descontar: true });
    const info = h('div', { class: 'span-4' });
    form.append(info);
    const sp = saldosProduto();
    const sf = saldosFilamento();
    const mostra = () => {
      const p = pecas.find((x) => x.id === form.elements.pecaId.value);
      if (!p) return;
      const saldo = (sp[p.id] || vazio).saldo;
      const linhas = [h('p', { class: 'help' }, 'Em estoque: ' + UI.int(saldo) + ' un.')];
      if (tipo === 'producao') {
        const q = Math.max(1, Math.round(n(form.elements.qtd.value) || 1));
        const cons = consumoProducao(p, q);
        linhas.push(h('table', { class: 'table compact' },
          h('thead', null, h('tr', null, h('th', null, 'Filamento necessário'), h('th', { class: 'num' }, 'Precisa'), h('th', { class: 'num' }, 'Em estoque'))),
          h('tbody', null, cons.map((c) => {
            const s = sf[c.filamentoId] || vazio;
            const falta = s.movs && s.saldo < c.g;
            return h('tr', null, h('td', null, filNome(Store.get('filamentos', c.filamentoId))), h('td', { class: 'num' }, fmtG(c.g)),
              h('td', { class: 'num ' + (falta ? 'neg' : '') }, s.movs ? fmtG(s.saldo) : 'sem controle'));
          }))));
        const comps = consumoCompProducao(p, q);
        if (comps.length) {
          const sc = saldosComponente();
          linhas.push(h('table', { class: 'table compact' },
            h('thead', null, h('tr', null, h('th', null, 'Componente necessário'), h('th', { class: 'num' }, 'Precisa'), h('th', { class: 'num' }, 'Em estoque'))),
            h('tbody', null, comps.map((c) => {
              const s = sc[c.componenteId] || vazio;
              const cp = Store.get('componentes', c.componenteId);
              return h('tr', null, h('td', null, cp ? cp.nome : 'componente excluído'), h('td', { class: 'num' }, fmtUn(c.qtd)),
                h('td', { class: 'num ' + (s.movs && s.saldo < c.qtd ? 'neg' : '') }, s.movs ? fmtUn(s.saldo) : 'sem controle'));
            }))));
        }
      }
      info.replaceChildren(...linhas);
    };
    form.addEventListener('input', mostra);
    form.addEventListener('change', mostra);
    mostra();
    UI.modal(titulos[tipo], form, {
      wide: false,
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Lançar', kind: 'primary', onClick: (c) => {
          if (!UI.validate(form, fs)) return;
          const v = UI.readForm(form, fs);
          const q = Math.round(n(v.qtd));
          const data = v.data || UI.today();
          if (tipo === 'producao') {
            if (q <= 0) { UI.toast('Informe a quantidade produzida.', 'bad'); return; }
            registrarProducao({ pecaId: v.pecaId, qtd: q, data, descontar: v.descontar, obs: v.obs });
          } else {
            const mov = tipo === 'saida' ? -Math.abs(q) : q - (sp[v.pecaId] || vazio).saldo;
            if (!mov) { UI.toast(tipo === 'ajuste' ? 'O saldo já confere — nada a ajustar.' : 'Informe a quantidade.'); c(); return; }
            Store.replaceWhere(MP, () => false, [{ data, pecaId: v.pecaId, tipo, qtd: mov, origem: 'manual:' + Store.uid(), ref: TIPOS_P[tipo], obs: v.obs }]);
          }
          UI.toast('Lançamento registrado.');
          c();
          onDone && onDone();
        } },
      ],
    });
  }

  // ---------------------------------------------------------------- histórico
  function historico(col, campo, id, titulo, onDone) {
    const qtdKey = col === MF ? 'g' : 'qtd';
    const fmt = col === MF ? fmtG : fmtUn;
    const tipos = col === MF ? TIPOS_F : col === MC ? TIPOS_C : TIPOS_P;
    const body = h('div');
    const render = () => {
      const movs = Store.all(col).filter((m) => m[campo] === id).sort((a, b) => (a.data + (a.criadoEm || '')).localeCompare(b.data + (b.criadoEm || '')));
      let acc = 0;
      const linhas = movs.map((m) => { acc += n(m[qtdKey]); return { m, saldo: acc }; }).reverse();
      body.replaceChildren(linhas.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' },
        h('thead', null, h('tr', null, ['Data', 'Movimento', 'Quantidade', 'Saldo', 'Referência', ''].map((t, i) => h('th', { class: i === 2 || i === 3 ? 'num' : null }, t)))),
        h('tbody', null, linhas.map(({ m, saldo }) => h('tr', null,
          h('td', null, UI.date(m.data)),
          h('td', null, tipos[m.tipo] || m.tipo),
          h('td', { class: 'num ' + (n(m[qtdKey]) < 0 ? 'neg' : 'pos') }, (n(m[qtdKey]) > 0 ? '+' : '') + fmt(m[qtdKey])),
          h('td', { class: 'num' }, fmt(saldo)),
          h('td', null, m.ref || '', m.obs ? h('small', { class: 'muted block' }, m.obs) : null),
          h('td', null, String(m.origem).startsWith('orc:')
            ? h('a', { href: '#/orcamentos/' + m.origem.slice(4), class: 'btn small', onclick: () => document.querySelector('.modal-back') && document.querySelector('.modal-back').remove() }, 'Ver')
            : h('button', { class: 'btn small ghost-danger', onclick: () => {
              const prod = String(m.origem).startsWith('prod:');
              UI.confirm(prod ? 'Excluir esta produção? O produto e o filamento consumido voltam ao saldo anterior.' : 'Excluir este lançamento?', () => {
                if (prod) [MF, MP, MC].forEach((c2) => Store.replaceWhere(c2, (r) => r.origem === m.origem, []));
                else Store.replaceWhere(col, (r) => r.id === m.id, []);
                render(); onDone && onDone();
              });
            } }, 'Excluir')))))))
        : UI.empty('Nenhuma movimentação ainda.'));
    };
    render();
    UI.modal('Histórico — ' + titulo, body, { wide: true });
  }

  // ---------------------------------------------------------------- página: filamentos
  function inicioCard(onChange) {
    const s = Store.settings();
    const inp = h('input', { type: 'date', value: (s.estoque || {}).inicio || '' });
    return h('div', { class: 'card estoque-inicio' },
      h('div', { class: 'inline-group' },
        h('span', null, 'Orçamentos aprovados ou concluídos com data da venda a partir de'), inp,
        h('button', { class: 'btn small', onclick: () => {
          Store.setSettings({ estoque: Object.assign({}, Store.settings().estoque, { inicio: inp.value }) });
          ressincronizarTodos();
          UI.toast('Data de início aplicada; estoque recalculado.');
          onChange && onChange();
        } }, 'Aplicar')),
      h('small', { class: 'help' }, 'consomem o estoque automaticamente. Vendas anteriores a essa data não mexem no estoque (evita descontar o histórico antigo).'));
  }

  function excluirFilamento(f, onDone) {
    const usadoEm = Store.all('pecas').filter((p) => Calc.partesDe(p.input || {}).some((pt) => pt.filamentoId === f.id));
    if (usadoEm.length) {
      UI.toast('Não dá para excluir: usado em ' + usadoEm.length + ' peça(s) do catálogo (' + usadoEm.slice(0, 3).map((p) => p.nome).join(', ') + (usadoEm.length > 3 ? '…' : '') + ').', 'bad');
      return;
    }
    const movs = Store.all(MF).filter((m) => m.filamentoId === f.id && !String(m.origem).startsWith('orc:')).length;
    UI.confirm('Excluir o filamento "' + filNome(f) + '"' + (movs ? ' e o histórico de estoque dele (' + movs + ' lançamento(s))' : '') + '? Orçamentos já emitidos não mudam.', () => {
      Store.remove('filamentos', f.id);
      Store.replaceWhere(MF, (m) => m.filamentoId === f.id && !String(m.origem).startsWith('orc:'), []);
      onDone && onDone();
    });
  }

  function filamentosPage() {
    const wrap = h('div');
    let q = '';
    const render = () => {
      const sf = saldosFilamento();
      const todos = Store.all('filamentos').sort((a, b) => filNome(a).localeCompare(filNome(b), 'pt-BR'));
      const fils = todos.filter((f) => !q || filNome(f).toLowerCase().includes(q));
      let valorTotal = 0;
      const rows = fils.map((f) => {
        const s = sf[f.id] || vazio;
        const minimo = minFil(f);
        const valor = Math.max(0, s.saldo) * Calc.custoPorGrama(f);
        valorTotal += valor;
        const porDia = s.consumo30 / 30;
        return h('tr', null,
          h('td', null, h('strong', null, filNome(f)), h('small', { class: 'muted block' }, 'rolo de ' + fmtG(pesoRolo(f)))),
          h('td', { class: 'num' }, UI.brl(f.preco), h('small', { class: 'muted block' }, 'R$ ' + UI.num(Calc.custoPorGrama(f), 4) + '/g')),
          h('td', { class: 'num' }, h('strong', { class: s.saldo < 0 ? 'neg' : '' }, s.movs ? fmtG(s.saldo) : '—'),
            s.movs && pesoRolo(f) ? h('small', { class: 'muted block' }, UI.num(s.saldo / pesoRolo(f), 2) + ' rolo(s)') : null,
            h('div', null, situacao(s.saldo, minimo, s.movs > 0))),
          h('td', { class: 'num' },
            h('div', { class: 'affix min-rolos', title: 'Estoque mínimo em rolos. Abaixo disso o sistema avisa para repor (0 = sem aviso).' },
              h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Estoque mínimo em rolos', value: UI.inNum(f.estoqueMinRolos === undefined ? 1 : f.estoqueMinRolos),
                onchange: (e) => { Store.save('filamentos', Object.assign(Store.get('filamentos', f.id), { estoqueMinRolos: Math.max(0, n(e.target.value)) })); render(); } }),
              h('span', null, 'rolos')),
            minimo ? h('small', { class: 'muted block' }, '= ' + fmtG(minimo)) : null),
          h('td', { class: 'num' }, s.consumo30 ? fmtG(s.consumo30) : '—', porDia > 0 && s.saldo > 0 ? h('small', { class: 'muted block' }, 'dura ~' + UI.int(s.saldo / porDia) + ' dias') : null),
          h('td', { class: 'num' }, s.movs ? UI.brl(valor) : '—'),
          h('td', { class: 'acts' }, h('div', { class: 'acts-grid three' },
            h('button', { class: 'btn small primary', onclick: () => modalFilamento('entrada', f.id, render) }, 'Entrada'),
            h('button', { class: 'btn small', onclick: () => modalFilamento('ajuste', f.id, render) }, 'Ajuste'),
            h('button', { class: 'btn small', onclick: () => modalFilamento('perda', f.id, render) }, 'Perda'),
            h('button', { class: 'btn small', onclick: () => historico(MF, 'filamentoId', f.id, filNome(f), render) }, 'Histórico'),
            h('button', { class: 'btn small', onclick: () => Cadastros.editar('filamentos', f, render) }, 'Editar'),
            h('button', { class: 'btn small ghost-danger', onclick: () => excluirFilamento(f, render) }, 'Excluir'))));
      });
      const repor = todos.filter((f) => { const s = sf[f.id] || vazio; return s.movs && s.saldo < Math.max(minFil(f), 0.0001); });
      const exportar = () => {
        const linhas = [['Material', 'Fabricante', 'Cor', 'Preço do rolo', 'Peso do rolo (g)', 'Custo por grama', 'Saldo (g)', 'Rolos', 'Mínimo (g)', 'Consumo 30 dias (g)', 'Valor em estoque']];
        todos.forEach((f) => { const s = sf[f.id] || vazio; linhas.push([f.material, f.fabricante || '', f.cor || '', Calc.r2(n(f.preco)), pesoRolo(f), Calc.custoPorGrama(f), Calc.r2(s.saldo), pesoRolo(f) ? Calc.r2(s.saldo / pesoRolo(f)) : '', minFil(f), Calc.r2(s.consumo30), Calc.r2(Math.max(0, s.saldo) * Calc.custoPorGrama(f))]); });
        UI.download('filamentos_' + UI.today() + '.csv', UI.csv(linhas), 'text/csv');
      };
      const busca = h('input', { type: 'search', class: 'search', placeholder: 'Buscar material, fabricante ou cor…', value: q, oninput: (e) => { q = e.target.value.toLowerCase(); render(); const el = wrap.querySelector('.search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
      wrap.replaceChildren(
        UI.pageHead('Filamentos', 'Cadastro, preço e estoque num só lugar. O preço do rolo (com frete) é o usado na precificação.',
          h('button', { class: 'btn', onclick: exportar }, 'Exportar CSV'),
          h('button', { class: 'btn', onclick: () => Cadastros.editar('filamentos', null, render) }, '+ Cadastrar sem estoque'),
          h('button', { class: 'btn primary', onclick: () => modalFilamento('entrada', null, render) }, '+ Entrada (compra)')),
        repor.length ? h('div', { class: 'alert warn' }, h('strong', null, 'Repor: '), repor.map((f) => filNome(f) + ' (' + fmtG((sf[f.id] || vazio).saldo) + ')').join(' · ')) : '',
        h('div', { class: 'card' },
          todos.length ? h('div', { class: 'toolbar' }, busca) : '',
          todos.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, ['Filamento', 'Preço do rolo', 'Saldo', 'Estoque mínimo', 'Consumo 30 dias', 'Valor em estoque', ''].map((t, i) => h('th', { class: i >= 1 && i <= 5 ? 'num' : null }, t)))),
            h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 7, class: 'muted center' }, 'Nada encontrado.'))),
            h('tfoot', null, h('tr', null, h('td', { colspan: 5 }, 'Valor total em estoque (custo)'), h('td', { class: 'num' }, UI.brl(valorTotal)), h('td', null, '')))))
            : UI.empty('Nenhum filamento ainda. Lance sua primeira compra: o filamento é cadastrado junto.', h('button', { class: 'btn primary', onclick: () => modalFilamento('entrada', null, render) }, '+ Entrada (compra)')),
          h('p', { class: 'help' }, 'Ao lançar uma compra, o preço do rolo é atualizado e passa a valer nas próximas precificações (orçamentos já emitidos não mudam). Defina o estoque mínimo (em rolos) direto na tabela: abaixo dele, a situação vira "Repor" e o Dashboard avisa.')),
        inicioCard(render));
    };
    render();
    return wrap;
  }

  // ---------------------------------------------------------------- página: produtos acabados
  function produtosPage() {
    const wrap = h('div');
    const f = { q: '', so: false };
    const tbody = h('tbody');
    const totais = h('tfoot');
    const renderTabela = () => {
      const sp = saldosProduto();
      let vCusto = 0, vVenda = 0, unidades = 0;
      const pecas = Store.all('pecas')
        .filter((p) => !f.q || [p.nome, skuDe(p), p.categoria].join(' ').toLowerCase().includes(f.q))
        .filter((p) => !f.so || (sp[p.id] || vazio).saldo !== 0)
        .sort((a, b) => (skuDe(a) || '~').localeCompare(skuDe(b) || '~', 'pt-BR', { numeric: true }));
      tbody.replaceChildren(...(pecas.length ? pecas.map((p) => {
        const s = sp[p.id] || vazio;
        const r = Precificacao.calcular(Object.assign({}, p.input, { quantidade: 1, frete: 0 }));
        const minimo = n(p.estoqueMin);
        if (s.saldo > 0) { vCusto += s.saldo * r.custoUnitario; vVenda += s.saldo * r.precoUnitario; unidades += s.saldo; }
        const minIn = h('input', { type: 'text', inputmode: 'numeric', class: 'min-in', value: minimo ? String(minimo) : '', placeholder: '—', 'aria-label': 'Estoque mínimo',
          onchange: (e) => { Store.save('pecas', Object.assign(Store.get('pecas', p.id), { estoqueMin: Math.max(0, Math.round(n(e.target.value))) })); renderTabela(); } });
        return h('tr', null,
          h('td', null, skuDe(p) ? h('code', { class: 'sku' }, skuDe(p)) : '—'),
          h('td', null, h('div', { class: 'with-thumb' }, Imagens.mini(p.input.imagemId), h('a', { href: '#/precificacao/' + p.id }, h('strong', null, p.nome)))),
          h('td', { class: 'num' }, h('strong', { class: s.saldo < 0 ? 'neg' : '' }, s.movs ? UI.int(s.saldo) + ' un.' : '—'), h('div', null, situacao(s.saldo, minimo, s.movs > 0))),
          h('td', { class: 'num' }, minIn),
          h('td', { class: 'num' }, s.vendas30 ? UI.int(s.vendas30) : '—'),
          h('td', { class: 'num' }, s.saldo > 0 ? UI.brl(s.saldo * r.custoUnitario) : '—'),
          h('td', { class: 'num' }, s.saldo > 0 ? UI.brl(s.saldo * r.precoUnitario) : '—'),
          h('td', { class: 'acts' }, h('div', { class: 'acts-grid' },
            h('button', { class: 'btn small primary', onclick: () => modalProduto('producao', p.id, render) }, 'Produzir'),
            h('button', { class: 'btn small', onclick: () => modalProduto('ajuste', p.id, render) }, 'Ajuste'),
            h('button', { class: 'btn small', onclick: () => modalProduto('saida', p.id, render) }, 'Saída'),
            h('button', { class: 'btn small', onclick: () => historico(MP, 'pecaId', p.id, (skuDe(p) ? skuDe(p) + ' — ' : '') + p.nome, render) }, 'Histórico'))));
      }) : [h('tr', null, h('td', { colspan: 8, class: 'muted center' }, Store.all('pecas').length ? 'Nada encontrado.' : 'Nenhuma peça no catálogo. Salve peças na Precificação.'))]));
      totais.replaceChildren(h('tr', null, h('td', { colspan: 2 }, 'Total em estoque'), h('td', { class: 'num' }, UI.int(unidades) + ' un.'), h('td', { colspan: 2 }, ''),
        h('td', { class: 'num' }, UI.brl(vCusto)), h('td', { class: 'num' }, UI.brl(vVenda)), h('td', null, '')));
    };
    const render = () => { renderTabela(); };
    const sp0 = saldosProduto();
    const repor = Store.all('pecas').filter((p) => n(p.estoqueMin) && (sp0[p.id] || vazio).saldo < n(p.estoqueMin));
    wrap.append(
      UI.pageHead('Produtos acabados', 'Peças prontas por SKU. Produção soma; vendas atendidas "do estoque" e saídas subtraem.',
        h('button', { class: 'btn primary', onclick: () => modalProduto('producao', null, render) }, '+ Registrar produção')),
      repor.length ? h('div', { class: 'alert warn' }, h('strong', null, 'Abaixo do mínimo: '), repor.map((p) => (skuDe(p) || p.nome) + ' (' + UI.int((sp0[p.id] || vazio).saldo) + ' un.)').join(' · ')) : '',
      h('div', { class: 'card' },
        h('div', { class: 'toolbar' },
          h('input', { type: 'search', class: 'search', placeholder: 'Buscar por SKU, nome ou categoria…', oninput: (e) => { f.q = e.target.value.toLowerCase(); renderTabela(); } }),
          h('label', { class: 'check-label' }, h('input', { type: 'checkbox', onchange: (e) => { f.so = e.target.checked; renderTabela(); } }), ' Só com estoque')),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['SKU', 'Produto', 'Em estoque', 'Mínimo', 'Vendas 30 dias', 'Valor (custo)', 'Valor (venda)', ''].map((t, i) => h('th', { class: i >= 2 && i <= 6 ? 'num' : null }, t)))),
          tbody, totais)),
        h('p', { class: 'help' }, 'Para vender do estoque: no orçamento, escolha "Do estoque" no item. Ao aprovar, a quantidade sai daqui (sem consumir filamento de novo).')),
      inicioCard(render));
    renderTabela();
    return wrap;
  }

  // ---------------------------------------------------------------- avisos para outras telas
  /** Filamentos controlados com saldo menor que o necessário para o consumo informado. */
  function faltasFilamento(consumo) {
    const sf = saldosFilamento();
    return (consumo || []).filter((c) => c.filamentoId && (sf[c.filamentoId] || vazio).movs && (sf[c.filamentoId] || vazio).saldo < c.g)
      .map((c) => ({ filamento: Store.get('filamentos', c.filamentoId), precisa: c.g, saldo: sf[c.filamentoId].saldo }));
  }

  function faltasComponente(consumoComp) {
    const sc = saldosComponente();
    return (consumoComp || []).filter((c) => c.componenteId && (sc[c.componenteId] || vazio).movs && (sc[c.componenteId] || vazio).saldo < c.qtd)
      .map((c) => ({ componente: Store.get('componentes', c.componenteId), precisa: c.qtd, saldo: sc[c.componenteId].saldo }));
  }

  const compRepor = (c, s) => s.movs && s.saldo < Math.max(n(c.estoqueMin), 0.0001);

  function alertasReposicao() {
    const sf = saldosFilamento();
    const sp = saldosProduto();
    const sc = saldosComponente();
    const fil = Store.all('filamentos').filter((f) => { const s = sf[f.id] || vazio; return s.movs && s.saldo < Math.max(minFil(f), 0.0001); });
    const prod = Store.all('pecas').filter((p) => n(p.estoqueMin) && (sp[p.id] || vazio).saldo < n(p.estoqueMin));
    const comp = Store.all('componentes').filter((c) => compRepor(c, sc[c.id] || vazio));
    return { fil, prod, comp };
  }

  // ---------------------------------------------------------------- componentes: lançamentos e página
  const CAMPOS_NOVO_C = ['nome', 'categoria', 'unidadeC', 'qtdPorUnidade'];

  function modalComponente(tipo, componenteId, onDone) {
    const comps = Store.all('componentes').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!comps.length && tipo !== 'entrada') { UI.toast('Cadastre os componentes primeiro.', 'warn'); return; }
    const titulos = { entrada: 'Entrada de componente (compra)', perda: 'Perda / descarte de componente', ajuste: 'Ajuste de inventário' };
    const opcoes = comps.map((c) => [c.id, Cadastros.label('componentes', c)]);
    if (tipo === 'entrada') opcoes.push([NOVO, '+ Novo componente (cadastrar agora)']);
    const defs = Cadastros.DEFS.componentes.fields;
    const fs = [
      { key: 'componenteId', label: 'Componente', type: 'select', options: opcoes, default: componenteId || (comps.length ? comps[0].id : NOVO), required: true, span: 3 },
      { key: 'data', label: 'Data', type: 'date', default: UI.today(), span: 1 },
    ];
    if (tipo === 'entrada') {
      fs.push(
        { key: 'nome', label: 'Componente', span: 2, placeholder: 'ex.: Tag NFC NTAG215' },
        { key: 'categoria', label: 'Categoria', span: 2, suggest: defs[1].suggest },
        { key: 'unidadeC', label: 'Compro por', type: 'select', options: defs[3].options, default: 'pct', span: 2 },
        { key: 'qtdPorUnidade', label: 'Quantidade que vem', type: 'num', suffix: 'un.', default: 1, span: 2, help: 'Ex.: pacote com 100 → 100.' });
    }
    fs.push(
      { key: 'qtd', label: tipo === 'ajuste' ? 'Quantidade contada' : 'Quantidade', type: 'num', required: true, span: 2,
        help: tipo === 'ajuste' ? 'Quantas unidades há de fato.' : null },
      { key: 'unidade', label: 'Em', type: 'select', options: [['compra', 'Embalagens de compra (pacote, caixa…)'], ['un', 'Unidades']], default: tipo === 'entrada' ? 'compra' : 'un', span: 2 });
    if (tipo === 'entrada') {
      fs.push({ key: 'valor', label: 'Valor total pago (com frete)', type: 'money', span: 2, help: 'Define o custo usado na precificação.' });
      fs.push({ key: 'atualizar', label: 'Atualizar o preço no cadastro', type: 'check', span: 2 });
    }
    fs.push({ key: 'obs', label: 'Observação', span: 4 });
    const form = UI.form(fs, { atualizar: true });
    const titulo = h('h4', { class: 'form-section' }, 'Dados do novo componente');
    if (tipo === 'entrada') form.elements.nome.closest('.field').before(titulo);
    const info = h('p', { class: 'help span-4' });
    form.append(info);
    const saldos = saldosComponente();
    const ehNovo = () => form.elements.componenteId.value === NOVO;
    const mostra = () => {
      if (tipo === 'entrada') {
        const novo = ehNovo();
        titulo.hidden = !novo;
        CAMPOS_NOVO_C.forEach((k) => { form.elements[k].closest('.field').hidden = !novo; });
        form.elements.atualizar.closest('.field').hidden = novo;
      }
      const c = comps.find((x) => x.id === form.elements.componenteId.value);
      info.textContent = c ? 'Saldo atual: ' + fmtUn((saldos[c.id] || vazio).saldo) + ' · embalagem de compra com ' + fmtUn(n(c.qtdPorUnidade) || 1) + ' · custo atual ' + UI.brl(Calc.custoComponente(c)) + '/un.'
        : 'O componente será cadastrado com o custo por unidade calculado a partir desta compra.';
    };
    form.addEventListener('change', mostra);
    mostra();
    UI.modal(titulos[tipo], form, {
      actions: [
        { label: 'Cancelar', onClick: (cl) => cl() },
        { label: 'Lançar', kind: 'primary', onClick: (cl) => {
          if (!UI.validate(form, fs)) return;
          const v = UI.readForm(form, fs);
          let c;
          if (tipo === 'entrada' && v.componenteId === NOVO) {
            if (!v.nome) { form.elements.nome.classList.add('invalid'); UI.toast('Informe o nome do componente.', 'bad'); return; }
            if (!(n(v.valor) > 0)) { form.elements.valor.closest('.affix').classList.add('invalid'); UI.toast('Informe o valor pago para calcular o custo.', 'bad'); return; }
            const existente = comps.find((x) => x.nome.trim().toLowerCase() === v.nome.trim().toLowerCase());
            if (existente) { c = existente; UI.toast('Esse componente já estava cadastrado; a entrada foi lançada nele.', 'warn'); }
            else c = Store.save('componentes', { nome: v.nome, categoria: v.categoria, unidade: v.unidadeC, qtdPorUnidade: n(v.qtdPorUnidade) || 1, preco: 0, estoqueMin: 0 });
            v.atualizar = true;
          } else {
            c = comps.find((x) => x.id === v.componenteId);
          }
          const pc = n(c.qtdPorUnidade) || 1;
          const un = n(v.qtd) * (v.unidade === 'compra' ? pc : 1);
          let mov = un;
          if (tipo === 'perda') mov = -un;
          if (tipo === 'ajuste') mov = un - (saldos[c.id] || vazio).saldo;
          if (!mov && tipo !== 'ajuste') { UI.toast('Informe a quantidade.', 'bad'); return; }
          if (!mov) { UI.toast('O saldo já confere — nada a ajustar.'); cl(); return; }
          Store.replaceWhere(MC, () => false, [{ data: v.data || UI.today(), componenteId: c.id, tipo, qtd: mov, valor: n(v.valor) || '', origem: 'manual:' + Store.uid(),
            ref: TIPOS_C[tipo] + (tipo === 'entrada' ? ' · ' + fmtUn(un) : ''), obs: v.obs }]);
          if (tipo === 'entrada' && v.atualizar && n(v.valor) > 0 && un > 0) {
            const preco = Calc.r2(n(v.valor) / un * pc);
            Store.save('componentes', Object.assign({}, Store.get('componentes', c.id), { preco }));
            UI.toast('Entrada lançada · custo: ' + UI.brl(preco / pc) + '/un.');
          } else UI.toast('Lançamento registrado.');
          cl();
          onDone && onDone();
        } },
      ],
    });
  }

  function excluirComponente(c, onDone) {
    const usadoEm = Store.all('pecas').filter((p) => (p.input && p.input.componentes || []).some((x) => x.componenteId === c.id));
    if (usadoEm.length) {
      UI.toast('Não dá para excluir: usado em ' + usadoEm.length + ' peça(s) do catálogo (' + usadoEm.slice(0, 3).map((p) => p.nome).join(', ') + (usadoEm.length > 3 ? '…' : '') + ').', 'bad');
      return;
    }
    UI.confirm('Excluir o componente "' + c.nome + '" e o histórico de estoque dele? Orçamentos já emitidos não mudam.', () => {
      Store.remove('componentes', c.id);
      Store.replaceWhere(MC, (m) => m.componenteId === c.id && !String(m.origem).startsWith('orc:'), []);
      onDone && onDone();
    });
  }

  function componentesPage() {
    const wrap = h('div');
    let q = '';
    const render = () => {
      const sc = saldosComponente();
      const todos = Store.all('componentes').sort((a, b) => (a.categoria || '~').localeCompare(b.categoria || '~', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
      const lista = todos.filter((c) => !q || [c.nome, c.categoria, c.codigo].join(' ').toLowerCase().includes(q));
      let valorTotal = 0;
      const usos = {};
      Store.all('pecas').forEach((p) => (p.input && p.input.componentes || []).forEach((x) => { usos[x.componenteId] = (usos[x.componenteId] || 0) + 1; }));
      const rows = lista.map((c) => {
        const s = sc[c.id] || vazio;
        const cu = Calc.custoComponente(c);
        const valor = Math.max(0, s.saldo) * cu;
        valorTotal += valor;
        const porDia = s.consumo30 / 30;
        return h('tr', null,
          h('td', null, h('strong', null, c.nome), h('small', { class: 'muted block' }, [c.categoria, c.codigo, usos[c.id] ? 'em ' + usos[c.id] + ' peça(s)' : ''].filter(Boolean).join(' · ') || '—')),
          h('td', { class: 'num' }, UI.brl(cu), h('small', { class: 'muted block' }, UI.brl(c.preco) + ' / ' + (c.unidade || 'un') + (n(c.qtdPorUnidade) > 1 ? ' c/ ' + UI.int(c.qtdPorUnidade) : ''))),
          h('td', { class: 'num' }, h('strong', { class: s.saldo < 0 ? 'neg' : '' }, s.movs ? fmtUn(s.saldo) : '—'), h('div', null, situacao(s.saldo, n(c.estoqueMin), s.movs > 0))),
          h('td', { class: 'num' }, h('div', { class: 'affix min-rolos', title: 'Estoque mínimo (0 = sem aviso)' },
            h('input', { type: 'text', inputmode: 'numeric', 'aria-label': 'Estoque mínimo', value: UI.inNum(c.estoqueMin || 0),
              onchange: (e) => { Store.save('componentes', Object.assign(Store.get('componentes', c.id), { estoqueMin: Math.max(0, n(e.target.value)) })); render(); } }),
            h('span', null, 'un.'))),
          h('td', { class: 'num' }, s.consumo30 ? fmtUn(s.consumo30) : '—', porDia > 0 && s.saldo > 0 ? h('small', { class: 'muted block' }, 'dura ~' + UI.int(s.saldo / porDia) + ' dias') : null),
          h('td', { class: 'num' }, s.movs ? UI.brl(valor) : '—'),
          h('td', { class: 'acts' }, h('div', { class: 'acts-grid three' },
            h('button', { class: 'btn small primary', onclick: () => modalComponente('entrada', c.id, render) }, 'Entrada'),
            h('button', { class: 'btn small', onclick: () => modalComponente('ajuste', c.id, render) }, 'Ajuste'),
            h('button', { class: 'btn small', onclick: () => modalComponente('perda', c.id, render) }, 'Perda'),
            h('button', { class: 'btn small', onclick: () => historico(MC, 'componenteId', c.id, c.nome, render) }, 'Histórico'),
            h('button', { class: 'btn small', onclick: () => Cadastros.editar('componentes', c, render) }, 'Editar'),
            h('button', { class: 'btn small ghost-danger', onclick: () => excluirComponente(c, render) }, 'Excluir'))));
      });
      const repor = todos.filter((c) => compRepor(c, sc[c.id] || vazio));
      const exportar = () => {
        const linhas = [['Componente', 'Categoria', 'Código', 'Custo unitário', 'Saldo (un.)', 'Mínimo (un.)', 'Consumo 30 dias', 'Valor em estoque']];
        todos.forEach((c) => { const s = sc[c.id] || vazio; linhas.push([c.nome, c.categoria || '', c.codigo || '', Calc.custoComponente(c), Calc.r2(s.saldo), n(c.estoqueMin), Calc.r2(s.consumo30), Calc.r2(Math.max(0, s.saldo) * Calc.custoComponente(c))]); });
        UI.download('componentes_' + UI.today() + '.csv', UI.csv(linhas), 'text/csv');
      };
      const busca = h('input', { type: 'search', class: 'search', placeholder: 'Buscar componente, categoria ou código…', value: q, oninput: (e) => { q = e.target.value.toLowerCase(); render(); const el = wrap.querySelector('.search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
      wrap.replaceChildren(
        UI.pageHead('Componentes', 'Itens agregados às peças — tag NFC, parafusos, porcas, arruelas, ímãs, LEDs… Cadastro, custo e estoque.',
          h('button', { class: 'btn', onclick: exportar }, 'Exportar CSV'),
          h('button', { class: 'btn', onclick: () => Cadastros.editar('componentes', null, render) }, '+ Cadastrar sem estoque'),
          h('button', { class: 'btn primary', onclick: () => modalComponente('entrada', null, render) }, '+ Entrada (compra)')),
        repor.length ? h('div', { class: 'alert warn' }, h('strong', null, 'Repor: '), repor.map((c) => c.nome + ' (' + fmtUn((sc[c.id] || vazio).saldo) + ')').join(' · ')) : '',
        h('div', { class: 'card' },
          todos.length ? h('div', { class: 'toolbar' }, busca) : '',
          todos.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, ['Componente', 'Custo unitário', 'Saldo', 'Estoque mínimo', 'Consumo 30 dias', 'Valor em estoque', ''].map((t, i) => h('th', { class: i >= 1 && i <= 5 ? 'num' : null }, t)))),
            h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 7, class: 'muted center' }, 'Nada encontrado.'))),
            h('tfoot', null, h('tr', null, h('td', { colspan: 5 }, 'Valor total em estoque (custo)'), h('td', { class: 'num' }, UI.brl(valorTotal)), h('td', null, '')))))
            : UI.empty('Nenhum componente ainda. Lance a compra de um pacote (ex.: 100 parafusos M3): o componente é cadastrado junto.', h('button', { class: 'btn primary', onclick: () => modalComponente('entrada', null, render) }, '+ Entrada (compra)')),
          h('p', { class: 'help' }, 'Para usar um componente numa peça, adicione-o no quadro "Componentes" da precificação. Ao aprovar o orçamento ou registrar produção, ele sai do estoque.')),
        inicioCard(render));
    };
    render();
    return wrap;
  }

  window.Estoque = {
    filamentosPage, produtosPage, componentesPage, saldosFilamento, saldosProduto, saldosComponente, pecaDoItem, faltasFilamento, faltasComponente, alertasReposicao,
    registrarProducao, ressincronizarTodos, fmtG, filNome,
  };
})();
