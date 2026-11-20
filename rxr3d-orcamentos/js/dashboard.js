/* RXR 3D — dashboard: visão global e mês a mês. */
(function () {
  'use strict';
  const { h } = UI;
  const n = Calc.n;
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const SERIES = [
    { key: 'receita', label: 'Receita', color: '#168BEE' },
    { key: 'custo', label: 'Custos', color: '#334155' },
    { key: 'lucro', label: 'Lucro', color: '#FF7900' },
  ];

  const state = { ano: String(new Date().getFullYear()), mes: '' };
  const dataVenda = (o) => o.dataVenda || o.data || '';

  function agregar(vendas) {
    const a = { receita: 0, custo: 0, lucro: 0, horas: 0, pecas: 0, pedidos: vendas.length };
    for (const o of vendas) {
      const t = Calc.totaisOrcamento(o);
      a.receita += t.total; a.custo += t.custo; a.lucro += t.lucro; a.horas += t.horas; a.pecas += t.pecas;
    }
    a.margem = a.receita ? a.lucro / a.receita * 100 : 0;
    a.ticket = a.pedidos ? a.receita / a.pedidos : 0;
    return a;
  }

  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return 'R$ ' + UI.num(v / 1e6, 1) + ' mi';
    if (a >= 1e3) return 'R$ ' + UI.num(v / 1e3, a >= 1e4 ? 0 : 1) + ' mil';
    return 'R$ ' + UI.num(v, 0);
  }

  function niceMax(v) {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  function chart(grupos) {
    const W = 760, H = 300, L = 70, R = 12, T = 16, B = 34;
    const vals = grupos.flatMap((g) => SERIES.map((s) => g[s.key]));
    const max = niceMax(Math.max(0, ...vals));
    const min = Math.min(0, ...vals) < 0 ? -niceMax(-Math.min(...vals)) : 0;
    const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Gráfico de receita, custos e lucro' });
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * i / 4;
      svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }));
      svg.append(el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, compact(v)));
    }
    const gw = (W - L - R) / Math.max(1, grupos.length);
    const bw = Math.min(18, (gw - 10) / SERIES.length);
    grupos.forEach((g, i) => {
      const cx = L + gw * i + gw / 2;
      SERIES.forEach((s, j) => {
        const v = g[s.key];
        const x = cx - (bw * SERIES.length) / 2 + j * bw;
        const y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
        const r = el('rect', { x: x + 1, y: y0, width: Math.max(1, bw - 2), height: Math.max(v ? 1 : 0, y1 - y0), fill: s.color, rx: 2 });
        r.append(el('title', null, `${g.label} · ${s.label}: ${UI.brl(v)}`));
        svg.append(r);
      });
      svg.append(el('text', { x: cx, y: H - 12, 'text-anchor': 'middle', class: 'tick' }, g.label));
    });
    return h('div', null,
      h('div', { class: 'legend' }, SERIES.map((s) => h('span', null, h('i', { style: 'background:' + s.color }), s.label))),
      svg);
  }

  function topProdutos(vendas) {
    const map = new Map();
    for (const o of vendas) {
      for (const it of o.itens) {
        const nome = (it.nomeOrig || it.descricao || '').trim();
        if (!nome) continue;
        const k = nome.toLowerCase();
        const p = map.get(k) || { nome, qtd: 0, receita: 0, custo: 0, lucro: 0, horas: 0 };
        p.qtd += n(it.quantidade); p.receita += n(it.valorTotal); p.custo += n(it.custoTotal); p.lucro += n(it.lucro); p.horas += n(it.horas);
        map.set(k, p);
      }
    }
    return [...map.values()].sort((a, b) => b.lucro - a.lucro).slice(0, 10);
  }

  function page() {
    const todas = Store.all('orcamentos');
    const vendasTodas = Orcamentos.vendas();
    const anos = [...new Set([String(new Date().getFullYear()), ...todas.map((o) => dataVenda(o).slice(0, 4)).filter(Boolean)])].sort().reverse();
    const wrap = h('div');

    const render = () => {
      const noPeriodo = (d) => (!state.ano || d.slice(0, 4) === state.ano) && (!state.mes || d.slice(5, 7) === state.mes);
      const vendas = vendasTodas.filter((o) => noPeriodo(dataVenda(o)));
      const a = agregar(vendas);
      const emitidos = todas.filter((o) => noPeriodo(o.data || ''));
      const decididos = emitidos.filter((o) => ['aprovado', 'concluido', 'recusado'].includes(o.status));
      const conversao = decididos.length ? decididos.filter((o) => Orcamentos.VENDIDO.includes(o.status)).length / decididos.length * 100 : 0;
      const abertos = todas.filter((o) => ['aberto', 'enviado'].includes(o.status));
      const valorAberto = abertos.reduce((s, o) => s + Calc.totaisOrcamento(o).total, 0);

      let grupos;
      let tituloGraf;
      if (state.ano) {
        grupos = MESES.map((m, i) => {
          const mm = String(i + 1).padStart(2, '0');
          const g = agregar(vendasTodas.filter((o) => dataVenda(o).slice(0, 7) === state.ano + '-' + mm));
          return { label: m, receita: g.receita, custo: g.custo, lucro: g.lucro };
        });
        tituloGraf = 'Receita × Custos × Lucro — ' + state.ano + ' mês a mês';
      } else {
        grupos = anos.slice().reverse().map((y) => {
          const g = agregar(vendasTodas.filter((o) => dataVenda(o).slice(0, 4) === y));
          return { label: y, receita: g.receita, custo: g.custo, lucro: g.lucro };
        });
        tituloGraf = 'Receita × Custos × Lucro — por ano';
      }

      const periodo = !state.ano ? 'Visão global (todo o histórico)' : (state.mes ? MESES_LONGOS[+state.mes - 1] + ' de ' + state.ano : 'Ano de ' + state.ano);
      const k = (label, value, sub, cls) => h('div', { class: 'kpi ' + (cls || '') }, h('span', { class: 'kpi-label' }, label), h('strong', null, value), sub ? h('small', null, sub) : null);
      const top = topProdutos(vendas);

      // tabela mês a mês (ano selecionado)
      const tabelaMeses = state.ano ? h('div', { class: 'card' }, h('h3', null, 'Resumo mês a mês — ' + state.ano),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['Mês', 'Pedidos', 'Faturamento', 'Custos', 'Lucro', 'Margem', 'Horas', 'Peças'].map((t, i) => h('th', { class: i ? 'num' : null }, t)))),
          h('tbody', null, MESES_LONGOS.map((m, i) => {
            const mm = String(i + 1).padStart(2, '0');
            const g = agregar(vendasTodas.filter((o) => dataVenda(o).slice(0, 7) === state.ano + '-' + mm));
            return h('tr', { class: (state.mes === mm ? 'hl' : '') + (g.pedidos ? '' : ' muted'), style: 'cursor:pointer', onclick: () => { state.mes = state.mes === mm ? '' : mm; mesSel.value = state.mes; render(); } },
              h('td', null, m), h('td', { class: 'num' }, UI.int(g.pedidos)), h('td', { class: 'num' }, UI.brl(g.receita)), h('td', { class: 'num' }, UI.brl(g.custo)),
              h('td', { class: 'num ' + (g.lucro < 0 ? 'neg' : '') }, UI.brl(g.lucro)), h('td', { class: 'num' }, g.receita ? UI.pct(g.margem) : '—'),
              h('td', { class: 'num' }, UI.horas(g.horas)), h('td', { class: 'num' }, UI.int(g.pecas)));
          })),
          h('tfoot', null, (() => { const g = agregar(vendasTodas.filter((o) => dataVenda(o).slice(0, 4) === state.ano)); return h('tr', null,
            h('td', null, 'Total'), h('td', { class: 'num' }, UI.int(g.pedidos)), h('td', { class: 'num' }, UI.brl(g.receita)), h('td', { class: 'num' }, UI.brl(g.custo)),
            h('td', { class: 'num' }, UI.brl(g.lucro)), h('td', { class: 'num' }, UI.pct(g.margem)), h('td', { class: 'num' }, UI.horas(g.horas)), h('td', { class: 'num' }, UI.int(g.pecas))); })())))) : null;

      body.replaceChildren(
        h('p', { class: 'periodo' }, periodo),
        h('div', { class: 'kpis big' },
          k('Faturamento', UI.brl(a.receita), a.pedidos + ' pedido(s) · ticket ' + UI.brl(a.ticket), 'blue'),
          k('Custos', UI.brl(a.custo)),
          k('Lucro', UI.brl(a.lucro), null, a.lucro < 0 ? 'neg' : 'orange'),
          k('Margem média', UI.pct(a.margem)),
          k('Horas impressas', UI.horas(a.horas), a.horas ? 'lucro/hora ' + UI.brl(a.lucro / a.horas) : null),
          k('Peças produzidas', UI.int(a.pecas)),
          k('Conversão de orçamentos', decididos.length ? UI.pct(conversao, 0) : '—', decididos.length + ' decidido(s) no período'),
          k('Em aberto agora', UI.brl(valorAberto), abertos.length + ' orçamento(s) aguardando')),
        h('div', { class: 'card' }, h('h3', null, tituloGraf), chart(grupos)),
        h('div', { class: 'card' }, h('h3', null, 'Produtos mais rentáveis'), h('p', { class: 'sub' }, 'Ordenados pelo lucro no período (descontos e acréscimos do orçamento não são rateados por produto).'),
          top.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, ['#', 'Produto', 'Qtd', 'Faturamento', 'Lucro', 'Margem', 'Lucro/hora'].map((t, i) => h('th', { class: i >= 2 ? 'num' : null }, t)))),
            h('tbody', null, top.map((p, i) => h('tr', null,
              h('td', { class: 'muted' }, String(i + 1)), h('td', null, h('strong', null, p.nome)), h('td', { class: 'num' }, UI.int(p.qtd)),
              h('td', { class: 'num' }, UI.brl(p.receita)), h('td', { class: 'num ' + (p.lucro < 0 ? 'neg' : 'pos') }, UI.brl(p.lucro)),
              h('td', { class: 'num' }, p.receita ? UI.pct(p.lucro / p.receita * 100) : '—'), h('td', { class: 'num' }, p.horas ? UI.brl(p.lucro / p.horas) : '—'))))))
            : UI.empty('Nenhuma venda no período. Orçamentos com status Aprovado ou Concluído aparecem aqui.')),
        tabelaMeses);
    };

    const anoSel = h('select', { 'aria-label': 'Ano', onchange: (e) => { state.ano = e.target.value; if (!state.ano) { state.mes = ''; mesSel.value = ''; } mesSel.disabled = !state.ano; render(); } },
      h('option', { value: '' }, 'Visão global'), anos.map((y) => h('option', { value: y, selected: y === state.ano }, y)));
    const mesSel = h('select', { 'aria-label': 'Mês', disabled: !state.ano, onchange: (e) => { state.mes = e.target.value; render(); } },
      h('option', { value: '' }, 'Ano inteiro'), MESES_LONGOS.map((m, i) => { const v = String(i + 1).padStart(2, '0'); return h('option', { value: v, selected: v === state.mes }, m); }));
    const body = h('div');

    const s = Store.settings();
    const dias = s.ultimoBackup ? Math.floor((Date.now() - new Date(s.ultimoBackup)) / 864e5) : null;
    const lembrete = (todas.length && (dias === null || dias >= 7))
      ? h('div', { class: 'alert warn' }, dias === null ? 'Você ainda não fez nenhum backup. ' : 'Último backup há ' + dias + ' dias. ',
        h('a', { href: '#/config' }, 'Fazer backup agora'), ' — os dados ficam apenas neste navegador.')
      : null;

    wrap.append(UI.pageHead('Dashboard', 'Vendas = orçamentos aprovados ou concluídos, pela data da venda.', anoSel, mesSel), lembrete, body);
    render();
    return wrap;
  }

  window.Dashboard = { page, agregar, topProdutos };
})();
