const test = require('node:test');
const assert = require('node:assert');
const Calc = require('../js/calc.js');

const close = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

const params = { tarifaKwh: 1, vidaUtilH: 5000, manutencaoH: 0, taxaFalha: 0, custoFixoMensal: 0, horasMes: 0, imposto: 0, acabamentoPct: 5, projetoPct: 30 };
const filamento = { preco: 100, peso: 1, unidade: 'kg' };          // R$ 0,10/g
const equipamento = { potencia: 200, valor: 5000 };                 // energia 0,20/h · depreciação 1,00/h
const direto = { id: 'direto', faixas: [{ ate: null, comissao: 0, fixa: 0 }] };

test('conversão de números no formato brasileiro', () => {
  assert.strictEqual(Calc.n('1.234,56'), 1234.56);
  assert.strictEqual(Calc.n('12,5'), 12.5);
  assert.strictEqual(Calc.n('R$ 10'), 10);
  assert.strictEqual(Calc.n(''), 0);
});

test('custo por grama do filamento (rolo com frete)', () => {
  close(Calc.custoPorGrama({ preco: 120, peso: 1, unidade: 'kg' }), 0.12);
  close(Calc.custoPorGrama({ preco: 60, peso: 500, unidade: 'g' }), 0.12);
});

test('composição básica com margem sobre o preço', () => {
  const r = Calc.compor({ pesoG: 100, minutos: 120, quantidade: 1, margem: 50 }, { filamento, equipamento, canal: direto, params });
  // material 10 + energia 0,40 + depreciação 2 = 12,40
  close(r.custoTotal, 12.4);
  close(r.precoUnitario, 24.8);
  close(r.lucro, 12.4);
  close(r.margemPct, 50);
  close(r.markup, 2);
  close(r.lucroHora, 6.2);
});

test('acabamento +5% e projeto +30% sobre o custo', () => {
  const base = Calc.compor({ pesoG: 100, minutos: 0, quantidade: 1, margem: 0 }, { filamento, equipamento, canal: direto, params });
  const acab = Calc.compor({ pesoG: 100, minutos: 0, quantidade: 1, margem: 0, acabamento: true }, { filamento, equipamento, canal: direto, params });
  const proj = Calc.compor({ pesoG: 100, minutos: 0, quantidade: 1, margem: 0, acabamento: true, projeto: true }, { filamento, equipamento, canal: direto, params });
  close(base.custoTotal, 10);
  close(acab.custoTotal, 10.5);
  close(proj.custoTotal, 13.5);
});

test('embalagem por quantidade de peças por embalagem', () => {
  const embalagem = { valor: 50, qtdPorUnidade: 25 }; // R$ 2 cada
  const r = Calc.compor({ pesoG: 10, minutos: 0, quantidade: 7, pecasPorEmbalagem: 3, margem: 0 }, { filamento, equipamento, embalagem, canal: direto, params });
  assert.strictEqual(r.lote.qtdEmbalagens, 3);
  close(r.lote.embalagem, 6);
  close(r.custoTotal, 7 + 6);
});

test('frete repassado entra no preço sem margem; absorvido entra no custo', () => {
  const rep = Calc.compor({ pesoG: 100, quantidade: 1, margem: 50, frete: 20, freteRepassado: true }, { filamento, equipamento, canal: direto, params });
  close(rep.precoUnitario, 20);
  close(rep.precoTotal, 40);
  close(rep.lucro, 10);
  const abs = Calc.compor({ pesoG: 100, quantidade: 1, margem: 50, frete: 20, freteRepassado: false }, { filamento, equipamento, canal: direto, params });
  close(abs.precoTotal, 60);
  close(abs.lucro, 30);
});

test('marketplace: margem mantida após comissão e taxa fixa por faixa', () => {
  const ml = { id: 'ml', teto: 0, faixas: [{ ate: 29, comissao: 12, fixa: 6.25 }, { ate: 50, comissao: 12, fixa: 6.5 }, { ate: 79, comissao: 12, fixa: 6.75 }, { ate: null, comissao: 12, fixa: 0 }] };
  const r = Calc.compor({ pesoG: 100, quantidade: 1, margem: 30 }, { filamento, equipamento, canal: ml, params });
  // custo 10: p = (10 + 6.25)/(1-0.3-0.12) = 28,017 (< 29, faixa 1)
  close(r.precoUnitario, 16.25 / 0.58);
  close(r.margemPct, 30);
  const caro = Calc.compor({ pesoG: 1000, quantidade: 1, margem: 30 }, { filamento, equipamento, canal: ml, params });
  // custo 100: p = 100/0.58 = 172,41 (faixa sem taxa fixa)
  close(caro.precoUnitario, 100 / 0.58);
  close(caro.margemPct, 30);
});

test('marketplace: fronteira entre faixas usa o menor preço válido', () => {
  // custo 40: faixa ≤79 daria (40+6,75)/0,58 = 80,6 (fora); faixa >79 daria 40/0,58 = 68,97 (<79) → usa 79
  const ml = { id: 'ml', teto: 0, faixas: [{ ate: 79, comissao: 12, fixa: 6.75 }, { ate: null, comissao: 12, fixa: 0 }] };
  const p = Calc.precoPorMargem(40, 30, ml, 0);
  close(p, 79);
  const t = Calc.taxasCanal(ml, p);
  assert.ok((p - t.total - 40) / p >= 0.3 - 1e-9);
});

test('teto de comissão (Shopee)', () => {
  const shopee = { id: 's', teto: 100, faixas: [{ ate: null, comissao: 20, fixa: 4 }] };
  const p = Calc.precoPorMargem(1000, 30, shopee, 0);
  // comissão travada em 100: p = (1000 + 4 + 100) / 0.7
  close(p, 1104 / 0.7);
  const r = Calc.compor({ pesoG: 10000, quantidade: 1, margem: 30 }, { filamento, equipamento, canal: shopee, params });
  close(r.margemPct, 30);
});

test('imposto sobre a venda e margem impossível', () => {
  const r = Calc.compor({ pesoG: 100, quantidade: 1, margem: 30 }, { filamento, equipamento, canal: direto, params: Object.assign({}, params, { imposto: 6 }) });
  close(r.margemPct, 30);
  close(r.lote.imposto, r.precoTotal * 0.06);
  const x = Calc.compor({ pesoG: 100, quantidade: 1, margem: 95 }, { filamento, equipamento, canal: { faixas: [{ ate: null, comissao: 10, fixa: 0 }] }, params });
  assert.ok(x.erro);
});

test('preço manual calcula a margem resultante', () => {
  const r = Calc.compor({ pesoG: 100, quantidade: 2, margem: 0, precoManual: 25 }, { filamento, equipamento, canal: direto, params });
  close(r.precoTotal, 50);
  close(r.lucro, 30);
  close(r.margemPct, 60);
});

test('custos de energia, depreciação, manutenção, fixos e falhas', () => {
  const p = Object.assign({}, params, { manutencaoH: 0.5, custoFixoMensal: 400, horasMes: 200, taxaFalha: 10 });
  const r = Calc.compor({ pesoG: 0, minutos: 60, quantidade: 1, margem: 0 }, { filamento, equipamento, canal: direto, params: p });
  // energia 0,2 + depreciação 1 + manutenção 0,5 + fixo 2 = 3,7 ; +10% = 4,07
  close(r.custoTotal, 4.07);
});

test('totais do orçamento', () => {
  const t = Calc.totaisOrcamento({ desconto: 10, acrescimo: 5, itens: [
    { valorTotal: 100, custoTotal: 60, horas: 2, pecas: 1 },
    { valorTotal: 50, custoTotal: 20, horas: 1, pecas: 3 },
  ] });
  close(t.total, 145);
  close(t.lucro, 65);
  assert.strictEqual(t.pecas, 4);
});

test('validação de CPF e CNPJ', () => {
  assert.ok(Calc.validaDocumento('529.982.247-25'));
  assert.ok(!Calc.validaDocumento('529.982.247-24'));
  assert.ok(Calc.validaDocumento('11.222.333/0001-81'));
  assert.ok(!Calc.validaDocumento('11.111.111/1111-11'));
});

test('SKU: geração e normalização', () => {
  assert.strictEqual(Calc.gerarSku('RXR', 'PLA', 1), 'RXR-PLA-0001');
  assert.strictEqual(Calc.gerarSku('rxr', 'PLA Silk', 12), 'RXR-PLA-0012');
  assert.strictEqual(Calc.gerarSku('RXR', 'PETG-CF', 3), 'RXR-PETG-0003');
  assert.strictEqual(Calc.gerarSku('RXR', 'Nylon (PA)', 7), 'RXR-NYLO-0007');
  assert.strictEqual(Calc.gerarSku('', '', 5), 'RXR-GEN-0005');
  assert.strictEqual(Calc.normSku(' vaso  geométrico 01 '), 'VASO-GEOMETRICO-01');
});

test('peça multipartes: cada parte com filamento, peso, tempo e quantidade', () => {
  const filamentos = {
    pla: { preco: 100, peso: 1, unidade: 'kg' },   // 0,10/g
    petg: { preco: 150, peso: 1, unidade: 'kg' },  // 0,15/g
  };
  const input = {
    quantidade: 2, margem: 0,
    partes: [
      { nome: 'Letras', filamentoId: 'pla', pesoG: 30, minutos: 60, qtd: 3 },  // 90 g · 3 h · R$ 9
      { nome: 'Base', filamentoId: 'petg', pesoG: 100, minutos: 120, qtd: 1 }, // 100 g · 2 h · R$ 15
    ],
  };
  const r = Calc.compor(input, { filamentos, equipamento: { potencia: 0, valor: 0 }, canal: direto, params });
  close(r.unit.material, 24);
  close(r.pesoPecaG, 190);
  close(r.horasPeca, 5);
  close(r.horasTotal, 10);
  close(r.custoTotal, 48);
  const pla = r.consumo.find((c) => c.filamentoId === 'pla');
  const petg = r.consumo.find((c) => c.filamentoId === 'petg');
  close(pla.g, 180); close(pla.custo, 18);
  close(petg.g, 200); close(petg.custo, 30);
});

test('formato antigo (um material) continua igual', () => {
  const a = Calc.compor({ pesoG: 100, minutos: 120, quantidade: 1, margem: 50 }, { filamento, equipamento, canal: direto, params });
  const b = Calc.compor({ quantidade: 1, margem: 50, partes: [{ filamentoId: 'x', pesoG: 100, minutos: 120, qtd: 1 }] }, { filamentos: { x: filamento }, equipamento, canal: direto, params });
  close(a.precoUnitario, b.precoUnitario);
  close(a.precoUnitario, 24.8);
});
