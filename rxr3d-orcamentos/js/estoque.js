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
  const VENDIDO = ['aprovado', 'concluido'];

  const TIPOS_F = {
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
  const vazio = { saldo: 0, movs: 0, consumo30: 0, vendas30: 0 };

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
    const mf = [], mp = [];
    if (ativo) {
      for (const it of o.itens || []) {
        const peca = pecaDoItem(it);
        if (it.atendimento === 'estoque' && peca) {
          mp.push({ data, pecaId: peca.id, tipo: 'venda', qtd: -n(it.quantidade), origem, ref: ref + ' · ' + it.descricao });
        } else {
          for (const c of Dashboard.consumoItem(it)) {
            if (c.filamentoId && n(c.g)) mf.push({ data, filamentoId: c.filamentoId, tipo: 'consumo-venda', g: -n(c.g), origem, ref: ref + ' · ' + it.descricao });
          }
        }
      }
    }
    const tinha = Store.all(MF).some((r) => r.origem === origem) || Store.all(MP).some((r) => r.origem === origem);
    if (!tinha && !mf.length && !mp.length) return;
    Store.replaceWhere(MF, (r) => r.origem === origem, mf);
    Store.replaceWhere(MP, (r) => r.origem === origem, mp);
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

  function registrarProducao({ pecaId, qtd, data, descontar, obs }) {
    const peca = Store.get('pecas', pecaId);
    const origem = 'prod:' + Store.uid();
    const ref = 'Produção · ' + peca.nome + ' (' + qtd + ' un.)';
    Store.replaceWhere(MP, () => false, [{ data, pecaId, tipo: 'producao', qtd, origem, ref, obs }]);
    if (descontar) {
      Store.replaceWhere(MF, () => false, consumoProducao(peca, qtd).map((c) => ({ data, filamentoId: c.filamentoId, tipo: 'consumo-producao', g: -c.g, origem, ref, obs })));
    }
  }

  // ---------------------------------------------------------------- modais de lançamento
  function modalFilamento(tipo, filamentoId, onDone) {
    const fils = Store.all('filamentos').sort((a, b) => filNome(a).localeCompare(filNome(b), 'pt-BR'));
    if (!fils.length) { UI.toast('Cadastre os filamentos primeiro.', 'warn'); return; }
    const titulos = { entrada: 'Entrada de filamento (compra)', perda: 'Perda / descarte de filamento', ajuste: 'Ajuste de inventário' };
    const fs = [
      { key: 'filamentoId', label: 'Filamento', type: 'select', options: fils.map((f) => [f.id, filNome(f)]), default: filamentoId, required: true, span: 3 },
      { key: 'data', label: 'Data', type: 'date', default: UI.today(), span: 1 },
      { key: 'qtd', label: tipo === 'ajuste' ? 'Saldo contado' : 'Quantidade', type: 'num', required: true, span: 2,
        help: tipo === 'ajuste' ? 'Quanto há de fato na prateleira (rolos fechados + sobras).' : null },
      { key: 'unidade', label: 'Unidade', type: 'select', options: [['rolos', 'Rolos'], ['g', 'Gramas'], ['kg', 'kg']], default: tipo === 'entrada' ? 'rolos' : 'g', span: 2 },
    ];
    if (tipo === 'entrada') {
      fs.push({ key: 'valor', label: 'Valor total pago (com frete)', type: 'money', span: 2, help: 'Opcional.' });
      fs.push({ key: 'atualizar', label: 'Atualizar o preço do rolo no cadastro', type: 'check', span: 2 });
    }
    fs.push({ key: 'obs', label: 'Observação', span: 4, placeholder: tipo === 'entrada' ? 'ex.: loja, nota fiscal' : 'ex.: impressão falhou, umidade' });
    const form = UI.form(fs, { atualizar: true });
    const info = h('p', { class: 'help span-4' });
    form.append(info);
    const saldos = saldosFilamento();
    const mostra = () => {
      const f = fils.find((x) => x.id === form.elements.filamentoId.value);
      info.textContent = f ? 'Saldo atual: ' + fmtG((saldos[f.id] || vazio).saldo) + ' · rolo de ' + fmtG(pesoRolo(f)) + ' · preço cadastrado ' + UI.brl(f.preco) + '/rolo' : '';
    };
    form.addEventListener('change', mostra);
    mostra();
    UI.modal(titulos[tipo], form, {
      actions: [
        { label: 'Cancelar', onClick: (c) => c() },
        { label: 'Lançar', kind: 'primary', onClick: (c) => {
          if (!UI.validate(form, fs)) return;
          const v = UI.readForm(form, fs);
          const f = fils.find((x) => x.id === v.filamentoId);
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
          if (tipo === 'entrada' && v.atualizar && n(v.valor) > 0 && v.unidade === 'rolos' && n(v.qtd) > 0) {
            Store.save('filamentos', Object.assign({}, f, { preco: Calc.r2(n(v.valor) / n(v.qtd)) }));
            UI.toast('Entrada lançada. Preço do rolo atualizado para ' + UI.brl(n(v.valor) / n(v.qtd)) + '.');
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
    const fmt = col === MF ? fmtG : (v) => UI.int(v) + ' un.';
    const tipos = col === MF ? TIPOS_F : TIPOS_P;
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
                if (prod) { Store.replaceWhere(MF, (r) => r.origem === m.origem, []); Store.replaceWhere(MP, (r) => r.origem === m.origem, []); }
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

  function filamentosPage() {
    const wrap = h('div');
    const render = () => {
      const sf = saldosFilamento();
      const fils = Store.all('filamentos').sort((a, b) => filNome(a).localeCompare(filNome(b), 'pt-BR'));
      let valorTotal = 0;
      const rows = fils.map((f) => {
        const s = sf[f.id] || vazio;
        const minimo = minFil(f);
        const valor = Math.max(0, s.saldo) * Calc.custoPorGrama(f);
        valorTotal += valor;
        const porDia = s.consumo30 / 30;
        return h('tr', null,
          h('td', null, h('strong', null, filNome(f))),
          h('td', { class: 'num' }, h('strong', { class: s.saldo < 0 ? 'neg' : '' }, s.movs ? fmtG(s.saldo) : '—'), h('div', null, situacao(s.saldo, minimo, s.movs > 0))),
          h('td', { class: 'num' }, s.movs && pesoRolo(f) ? UI.num(s.saldo / pesoRolo(f), 2) : '—'),
          h('td', { class: 'num muted' }, minimo ? fmtG(minimo) : '—'),
          h('td', { class: 'num' }, s.consumo30 ? fmtG(s.consumo30) : '—'),
          h('td', { class: 'num' }, porDia > 0 && s.saldo > 0 ? '~' + UI.int(s.saldo / porDia) + ' dias' : '—'),
          h('td', { class: 'num' }, s.movs ? UI.brl(valor) : '—'),
          h('td', { class: 'acts' }, h('div', { class: 'acts-grid' },
            h('button', { class: 'btn small', onclick: () => modalFilamento('entrada', f.id, render) }, 'Entrada'),
            h('button', { class: 'btn small', onclick: () => modalFilamento('ajuste', f.id, render) }, 'Ajuste'),
            h('button', { class: 'btn small', onclick: () => modalFilamento('perda', f.id, render) }, 'Perda'),
            h('button', { class: 'btn small', onclick: () => historico(MF, 'filamentoId', f.id, filNome(f), render) }, 'Histórico'))));
      });
      const repor = fils.filter((f) => { const s = sf[f.id] || vazio; return s.movs && s.saldo < Math.max(minFil(f), 0.0001); });
      const exportar = () => {
        const linhas = [['Filamento', 'Saldo (g)', 'Rolos', 'Mínimo (g)', 'Consumo 30 dias (g)', 'Valor em estoque']];
        fils.forEach((f) => { const s = sf[f.id] || vazio; linhas.push([filNome(f), Calc.r2(s.saldo), pesoRolo(f) ? Calc.r2(s.saldo / pesoRolo(f)) : '', minFil(f), Calc.r2(s.consumo30), Calc.r2(Math.max(0, s.saldo) * Calc.custoPorGrama(f))]); });
        UI.download('estoque_filamentos_' + UI.today() + '.csv', UI.csv(linhas), 'text/csv');
      };
      wrap.replaceChildren(
        UI.pageHead('Estoque de filamentos', 'Saldo = entradas − consumo das vendas e produções − perdas ± ajustes.',
          h('button', { class: 'btn', onclick: exportar }, 'Exportar CSV'),
          h('button', { class: 'btn primary', onclick: () => modalFilamento('entrada', fils[0] && fils[0].id, render) }, '+ Entrada (compra)')),
        repor.length ? h('div', { class: 'alert warn' }, h('strong', null, 'Repor: '), repor.map((f) => filNome(f) + ' (' + fmtG((sf[f.id] || vazio).saldo) + ')').join(' · ')) : '',
        h('div', { class: 'card' },
          fils.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, ['Filamento', 'Saldo', 'Rolos', 'Mínimo', 'Consumo 30 dias', 'Dura', 'Valor em estoque', ''].map((t, i) => h('th', { class: i >= 1 && i <= 6 ? 'num' : null }, t)))),
            h('tbody', null, rows),
            h('tfoot', null, h('tr', null, h('td', { colspan: 6 }, 'Valor total em estoque (custo)'), h('td', { class: 'num' }, UI.brl(valorTotal)), h('td', null, '')))))
            : UI.empty('Nenhum filamento cadastrado.', h('a', { class: 'btn', href: '#/filamentos' }, 'Cadastrar filamentos')),
          h('p', { class: 'help' }, 'O estoque mínimo (em rolos) é definido no cadastro do filamento. "Dura" estima quantos dias o saldo dura no ritmo de consumo dos últimos 30 dias.')),
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

  function alertasReposicao() {
    const sf = saldosFilamento();
    const sp = saldosProduto();
    const fil = Store.all('filamentos').filter((f) => { const s = sf[f.id] || vazio; return s.movs && s.saldo < Math.max(minFil(f), 0.0001); });
    const prod = Store.all('pecas').filter((p) => n(p.estoqueMin) && (sp[p.id] || vazio).saldo < n(p.estoqueMin));
    return { fil, prod };
  }

  window.Estoque = {
    filamentosPage, produtosPage, saldosFilamento, saldosProduto, pecaDoItem, faltasFilamento, alertasReposicao,
    registrarProducao, ressincronizarTodos, fmtG, filNome,
  };
})();
