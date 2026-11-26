/*
 * RXR 3D — motor de cálculo de custos e precificação.
 * Funções puras (sem acesso à tela ou ao armazenamento), usadas pelo app e pelos testes.
 */
(function (root) {
  'use strict';

  const n = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined || v === '') return 0;
    const s = String(v).trim().replace(/\s|R\$|%/g, '');
    // "1.234,56" -> 1234.56 ; "12,5" -> 12.5 ; "12.5" -> 12.5
    const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const x = parseFloat(norm);
    return isFinite(x) ? x : 0;
  };

  const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

  /** Custo do filamento por grama (preço do rolo com frete ÷ peso em gramas). */
  function custoPorGrama(filamento) {
    if (!filamento) return 0;
    const peso = n(filamento.peso) * (String(filamento.unidade).toLowerCase() === 'kg' ? 1000 : 1);
    return peso > 0 ? n(filamento.preco) / peso : 0;
  }

  /** Custo de uma embalagem individual (valor ÷ quantidade contida na unidade de compra). */
  function custoEmbalagem(emb) {
    if (!emb) return 0;
    const q = n(emb.qtdPorUnidade) || 1;
    return n(emb.valor) / q;
  }

  /** Rateio dos custos fixos mensais por hora de impressão. */
  function custoFixoHora(params) {
    const h = n(params.horasMes);
    return h > 0 ? n(params.custoFixoMensal) / h : 0;
  }

  /** Taxa da faixa de preço do canal (comissão % e taxa fixa por item). */
  function faixaDoPreco(canal, preco) {
    const faixas = (canal && canal.faixas && canal.faixas.length) ? sortFaixas(canal.faixas) : [{ ate: null, comissao: 0, fixa: 0 }];
    for (const f of faixas) {
      if (f.ate === null || f.ate === '' || f.ate === undefined || preco < n(f.ate)) return f;
    }
    return faixas[faixas.length - 1];
  }

  function sortFaixas(faixas) {
    return faixas.slice().sort((a, b) => {
      const aa = (a.ate === null || a.ate === '' || a.ate === undefined) ? Infinity : n(a.ate);
      const bb = (b.ate === null || b.ate === '' || b.ate === undefined) ? Infinity : n(b.ate);
      return aa - bb;
    });
  }

  /** Taxas do canal sobre um preço unitário: comissão (com teto) + taxa fixa. */
  function taxasCanal(canal, preco) {
    if (!canal) return { comissao: 0, fixa: 0, total: 0, pct: 0 };
    const f = faixaDoPreco(canal, preco);
    let comissao = preco * n(f.comissao) / 100;
    const teto = n(canal.teto);
    if (teto > 0 && comissao > teto) comissao = teto;
    const fixa = n(f.fixa);
    return { comissao, fixa, total: comissao + fixa, pct: n(f.comissao) };
  }

  /**
   * Preço unitário que entrega a margem desejada (sobre o preço de venda) depois
   * de comissão, taxa fixa e imposto.  p = (custo + fixa) / (1 − margem − comissão − imposto)
   * Considera as faixas de preço do canal e o teto da comissão.
   */
  function precoPorMargem(custoUnit, margemPct, canal, impostoPct) {
    const m = n(margemPct) / 100;
    const t = n(impostoPct) / 100;
    const faixas = (canal && canal.faixas && canal.faixas.length) ? sortFaixas(canal.faixas) : [{ ate: null, comissao: 0, fixa: 0 }];
    const teto = canal ? n(canal.teto) : 0;
    let melhor = null;
    let lo = 0;
    for (const f of faixas) {
      const hi = (f.ate === null || f.ate === '' || f.ate === undefined) ? Infinity : n(f.ate);
      const c = n(f.comissao) / 100;
      const fixa = n(f.fixa);
      const den = 1 - m - c - t;
      let p = den > 0 ? (custoUnit + fixa) / den : Infinity;
      if (teto > 0 && isFinite(p) && p * c > teto) {
        const den2 = 1 - m - t;
        p = den2 > 0 ? (custoUnit + fixa + teto) / den2 : Infinity;
      }
      if (isFinite(p)) {
        if (p < lo) p = lo; // cai abaixo da faixa: o menor preço da faixa já supera a margem
        if (p < hi && (melhor === null || p < melhor)) melhor = p;
      }
      lo = hi;
    }
    return melhor; // null quando margem + taxas >= 100%
  }

  /**
   * Composição completa de preço de uma peça.
   * input: { pesoG, minutos, quantidade, acabamento, projeto, pecasPorEmbalagem, margem,
   *          frete, freteRepassado, precoManual }
   * ctx:   { filamento, equipamento, embalagem, canal, params }
   */
  /**
   * Partes da peça (multimaterial / multicor). Sem "partes", usa o formato antigo
   * de um único material: { filamentoId, pesoG, minutos }.
   */
  function partesDe(input) {
    if (input && Array.isArray(input.partes) && input.partes.length) return input.partes;
    return [{ nome: '', filamentoId: input ? input.filamentoId : '', pesoG: input ? input.pesoG : 0, minutos: input ? input.minutos : 0, qtd: 1 }];
  }

  /** Custo de material, peso e tempo de um conjunto, e o consumo por filamento. */
  function materiais(input, ctx) {
    const partes = partesDe(input);
    const filDe = (id) => (ctx.filamentos ? ctx.filamentos[id] : null) || (ctx.filamentos && id ? null : ctx.filamento) || null;
    const consumo = {};
    let custo = 0, pesoG = 0, minutos = 0;
    const det = partes.map((pt) => {
      const q = Math.max(1, Math.round(n(pt.qtd) || 1));
      const fil = filDe(pt.filamentoId);
      const g = n(pt.pesoG) * q;
      const c = g * custoPorGrama(fil);
      const m = n(pt.minutos) * q;
      custo += c; pesoG += g; minutos += m;
      const k = pt.filamentoId || '_';
      if (!consumo[k]) consumo[k] = { filamentoId: pt.filamentoId || '', g: 0, custo: 0 };
      consumo[k].g += g;
      consumo[k].custo += c;
      return { nome: pt.nome || '', filamentoId: pt.filamentoId || '', qtd: q, pesoG: g, minutos: m, custo: c };
    });
    return { custo, pesoG, minutos, partes: det, consumo: Object.values(consumo) };
  }

  /** Custo de um componente (valor da unidade de compra ÷ quantidade que vem nela). */
  function custoComponente(c) {
    if (!c) return 0;
    const q = n(c.qtdPorUnidade) || 1;
    return n(c.preco) / q;
  }

  /** Componentes da peça (tag NFC, parafusos, ímãs…): custo e quantidade por peça. */
  function componentes(input, ctx) {
    const lista = (input && Array.isArray(input.componentes) ? input.componentes : []).filter((c) => c && c.componenteId && n(c.qtd) > 0);
    const mapa = ctx.componentes || {};
    let custo = 0;
    const det = lista.map((c) => {
      const comp = mapa[c.componenteId] || null;
      const unit = custoComponente(comp);
      const total = unit * n(c.qtd);
      custo += total;
      return { componenteId: c.componenteId, qtd: n(c.qtd), custoUnit: unit, custo: total };
    });
    return { custo, itens: det };
  }

  function compor(input, ctx) {
    const p = Object.assign({
      tarifaKwh: 0, vidaUtilH: 5000, manutencaoH: 0, taxaFalha: 0,
      custoFixoMensal: 0, horasMes: 0, imposto: 0, acabamentoPct: 5, projetoPct: 30,
    }, ctx.params || {});
    const eq = ctx.equipamento || {};
    const qtd = Math.max(1, Math.round(n(input.quantidade) || 1));
    const mat = materiais(input, ctx);
    const horasPeca = mat.minutos / 60;
    const pesoG = mat.pesoG;
    const vida = n(eq.vidaUtil) || n(p.vidaUtilH);

    // ---- custos de produção por peça (conjunto)
    const material = mat.custo;
    const energia = (n(eq.potencia) / 1000) * horasPeca * n(p.tarifaKwh);
    const depreciacao = vida > 0 ? (n(eq.valor) / vida) * horasPeca : 0;
    const manutencao = n(p.manutencaoH) * horasPeca;
    const fixo = custoFixoHora(p) * horasPeca;
    const producaoSemFalha = material + energia + depreciacao + manutencao + fixo;
    const falha = producaoSemFalha * n(p.taxaFalha) / 100;
    const comp = componentes(input, ctx);
    const producaoUnit = producaoSemFalha + falha + comp.custo;

    // ---- embalagem
    const ppe = Math.max(1, Math.round(n(input.pecasPorEmbalagem) || 1));
    const qtdEmbalagens = ctx.embalagem ? Math.ceil(qtd / ppe) : 0;
    const embalagem = qtdEmbalagens * custoEmbalagem(ctx.embalagem);

    // ---- acréscimos sobre o custo
    const custoBase = producaoUnit * qtd + embalagem;
    const acabamento = input.acabamento ? custoBase * n(p.acabamentoPct) / 100 : 0;
    const projeto = input.projeto ? custoBase * n(p.projetoPct) / 100 : 0;
    const custoProducao = custoBase + acabamento + projeto;

    // ---- frete: repassado ao cliente (entra no preço sem margem) ou absorvido (entra no custo)
    const frete = n(input.frete);
    const freteAbsorvido = input.freteRepassado ? 0 : frete;
    const freteCobrado = input.freteRepassado ? frete : 0;
    const custoAntesTaxas = custoProducao + freteAbsorvido;
    const custoUnitAntesTaxas = custoAntesTaxas / qtd;

    // ---- preço
    const canal = ctx.canal || null;
    let precoUnit;
    let erro = null;
    const manual = n(input.precoManual);
    if (manual > 0) {
      precoUnit = manual;
    } else {
      precoUnit = precoPorMargem(custoUnitAntesTaxas, input.margem, canal, p.imposto);
      if (precoUnit === null) {
        erro = 'Margem + taxas + imposto somam 100% ou mais: não há preço possível.';
        precoUnit = 0;
      }
    }
    const tx = taxasCanal(canal, precoUnit);
    const taxasPlataforma = tx.total * qtd;
    const imposto = precoUnit * qtd * n(p.imposto) / 100;

    const precoVendaPecas = precoUnit * qtd;
    const precoTotal = precoVendaPecas + freteCobrado;
    const custoTotal = custoAntesTaxas + taxasPlataforma + imposto + freteCobrado;
    const lucro = precoTotal - custoTotal;
    const horasTotal = horasPeca * qtd;

    return {
      erro,
      quantidade: qtd,
      horasPeca, horasTotal, pesoPecaG: pesoG, pesoTotalG: pesoG * qtd,
      partes: mat.partes,
      consumo: mat.consumo.map((c) => ({ filamentoId: c.filamentoId, g: c.g * qtd, custo: c.custo * qtd })),
      componentes: comp.itens,
      consumoComp: comp.itens.map((c) => ({ componenteId: c.componenteId, qtd: c.qtd * qtd, custo: c.custo * qtd })),
      unit: { material, energia, depreciacao, manutencao, fixo, falha, componentes: comp.custo, producao: producaoUnit },
      lote: {
        material: material * qtd, energia: energia * qtd, depreciacao: depreciacao * qtd,
        manutencao: manutencao * qtd, fixo: fixo * qtd, falha: falha * qtd,
        producao: producaoUnit * qtd, componentes: comp.custo * qtd, embalagem, qtdEmbalagens, acabamento, projeto,
        frete, freteAbsorvido, freteCobrado,
        comissao: tx.comissao * qtd, taxaFixa: tx.fixa * qtd, taxasPlataforma, imposto,
      },
      custoProducao,
      custoTotal,
      custoUnitario: custoTotal / qtd,
      precoUnitario: precoUnit,
      precoVendaPecas,
      precoTotal,
      lucro,
      lucroUnitario: lucro / qtd,
      margemPct: precoTotal > 0 ? (lucro / precoTotal) * 100 : 0,
      markup: custoTotal > 0 ? precoTotal / custoTotal : 0,
      lucroHora: horasTotal > 0 ? lucro / horasTotal : 0,
      comissaoPct: tx.pct,
    };
  }

  /** Totais de um orçamento (itens + desconto + acréscimo). */
  function totaisOrcamento(orc) {
    const itens = (orc && orc.itens) || [];
    let subtotal = 0, custo = 0, horas = 0, pecas = 0;
    for (const it of itens) {
      subtotal += n(it.valorTotal);
      custo += n(it.custoTotal);
      horas += n(it.horas);
      pecas += n(it.pecas);
    }
    const desconto = n(orc.desconto);
    const acrescimo = n(orc.acrescimo);
    const total = subtotal - desconto + acrescimo;
    const lucro = total - custo;
    return {
      subtotal, desconto, acrescimo, total, custo, lucro, horas, pecas,
      margemPct: total > 0 ? (lucro / total) * 100 : 0,
    };
  }

  /** Validação de CPF/CNPJ pelos dígitos verificadores. */
  function validaDocumento(doc) {
    const d = String(doc || '').replace(/\D/g, '');
    if (d.length === 11) {
      if (/^(\d)\1+$/.test(d)) return false;
      const dv = (len) => {
        let s = 0;
        for (let i = 0; i < len; i++) s += +d[i] * (len + 1 - i);
        const r = (s * 10) % 11;
        return r === 10 ? 0 : r;
      };
      return dv(9) === +d[9] && dv(10) === +d[10];
    }
    if (d.length === 14) {
      if (/^(\d)\1+$/.test(d)) return false;
      const dv = (len) => {
        const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let s = 0;
        for (let i = 0; i < len; i++) s += +d[i] * pesos[i];
        const r = s % 11;
        return r < 2 ? 0 : 11 - r;
      };
      return dv(12) === +d[12] && dv(13) === +d[13];
    }
    return false;
  }

  /** SKU em maiúsculas, sem acentos e espaços (só letras, números, "-" e "_"). */
  function normSku(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .trim().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '').replace(/-{2,}/g, '-');
  }

  /** Gera SKU no formato PREFIXO-MATERIAL-0001 (ex.: RXR-PETG-0012). */
  function gerarSku(prefixo, material, seq) {
    const pre = normSku(prefixo) || 'RXR';
    const mat = normSku(String(material || '').split(/[\s+\-/]/)[0]).replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN';
    return pre + '-' + mat + '-' + String(Math.max(1, Math.round(n(seq)))).padStart(4, '0');
  }

  const Calc = { custoComponente, componentes, partesDe, materiais, normSku, gerarSku, n, r2, custoPorGrama, custoEmbalagem, custoFixoHora, faixaDoPreco, taxasCanal, precoPorMargem, compor, totaisOrcamento, validaDocumento };

  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
