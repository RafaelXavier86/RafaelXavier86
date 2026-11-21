/* RXR 3D — dados de exemplo (fictícios) para conhecer o sistema. */
(function () {
  'use strict';

  function load() {
    Store.reset();
    const fil = [
      { material: 'PLA', fabricante: 'Voolt3D', cor: 'Preto', preco: 109.9, peso: 1, unidade: 'kg' },
      { material: 'PLA', fabricante: '3D Fila', cor: 'Branco', preco: 119.9, peso: 1, unidade: 'kg' },
      { material: 'PETG', fabricante: 'Voolt3D', cor: 'Cinza', preco: 129.9, peso: 1, unidade: 'kg' },
      { material: 'TPU', fabricante: 'Sunlu', cor: 'Vermelho', preco: 159.9, peso: 1, unidade: 'kg' },
      { material: 'PLA Silk', fabricante: 'Sunlu', cor: 'Dourado', preco: 139.9, peso: 1, unidade: 'kg' },
    ].map((f) => Store.save('filamentos', f));
    const eq = [
      Store.save('equipamentos', { marca: 'Bambu Lab', modelo: 'P1S', potencia: 150, valor: 6500, vidaUtil: 6000 }),
      Store.save('equipamentos', { marca: 'Creality', modelo: 'Ender 3 V3', potencia: 120, valor: 1900, vidaUtil: 4000 }),
    ];
    const emb = [
      Store.save('embalagens', { tipo: 'Caixa de papelão', dimensao: '16 × 11 × 6 cm', unidade: 'pct', qtdPorUnidade: 25, valor: 52.5 }),
      Store.save('embalagens', { tipo: 'Envelope de segurança', dimensao: '26 × 36 cm', unidade: 'pct', qtdPorUnidade: 100, valor: 39.9 }),
      Store.save('embalagens', { tipo: 'Caixa presente', dimensao: '20 × 20 × 10 cm', unidade: 'un', qtdPorUnidade: 1, valor: 6.9 }),
    ];
    const cli = [
      { nome: 'Ana Paula Souza', telefone: '(11) 98888-1234', documento: '529.982.247-25', email: 'ana@exemplo.com', cep: '06401-000', endereco: 'Rua das Flores', numero: '120', bairro: 'Centro', cidade: 'Barueri', uf: 'SP' },
      { nome: 'Oficina Moto Peças Ltda.', telefone: '(11) 4199-0000', documento: '11.222.333/0001-81', email: 'compras@exemplo.com', cep: '06454-000', endereco: 'Av. Industrial', numero: '1500', bairro: 'Alphaville', cidade: 'Barueri', uf: 'SP' },
      { nome: 'Carlos Henrique Lima', telefone: '(11) 97777-5678', documento: '', email: '', cep: '', endereco: '', numero: '', bairro: '', cidade: 'Osasco', uf: 'SP' },
      { nome: 'Mercado Livre (vendas)', telefone: '', documento: '', email: '', cidade: '', uf: '' },
      { nome: 'Shopee (vendas)', telefone: '', documento: '', email: '', cidade: '', uf: '' },
    ].map((c) => Store.save('clientes', c));

    const cats = { 'Suporte de headset': 'Games', 'Vaso geométrico': 'Decoração', 'Chaveiro personalizado': 'Brindes', 'Engrenagem PETG (reposição)': 'Peças técnicas', 'Organizador de mesa': 'Organização', 'Capa TPU para controle': 'Games', 'Letreiro 3D multipartes': 'Decoração' };
    const pecas = [
      { nome: 'Suporte de headset', filamentoId: fil[0].id, equipamentoId: eq[0].id, pesoG: 85, minutos: 210, embalagemId: emb[0].id, margem: 45 },
      { nome: 'Vaso geométrico', filamentoId: fil[4].id, equipamentoId: eq[0].id, pesoG: 120, minutos: 300, acabamento: true, embalagemId: emb[2].id, margem: 50 },
      { nome: 'Chaveiro personalizado', filamentoId: fil[1].id, equipamentoId: eq[1].id, pesoG: 8, minutos: 25, projeto: true, embalagemId: emb[1].id, pecasPorEmbalagem: 10, margem: 60 },
      { nome: 'Engrenagem PETG (reposição)', filamentoId: fil[2].id, equipamentoId: eq[0].id, pesoG: 45, minutos: 150, projeto: true, margem: 50 },
      { nome: 'Organizador de mesa', filamentoId: fil[0].id, equipamentoId: eq[1].id, pesoG: 210, minutos: 540, embalagemId: emb[0].id, margem: 40 },
      { nome: 'Letreiro 3D multipartes', equipamentoId: eq[0].id, margem: 45, acabamento: true, projeto: true, embalagemId: emb[2].id,
        partes: [
          { nome: 'Letras', filamentoId: fil[1].id, pesoG: 22, minutos: 50, qtd: 6 },
          { nome: 'Contorno das letras', filamentoId: fil[0].id, pesoG: 9, minutos: 0, qtd: 6 },
          { nome: 'Base', filamentoId: fil[2].id, pesoG: 140, minutos: 260, qtd: 1 },
        ] },
      { nome: 'Capa TPU para controle', filamentoId: fil[3].id, equipamentoId: eq[0].id, pesoG: 35, minutos: 120, embalagemId: emb[1].id, margem: 45 },
    ].map((p) => {
      if (p.partes) {
        p.filamentoId = p.partes[0].filamentoId;
        p.pesoG = p.partes.reduce((s, x) => s + x.pesoG * x.qtd, 0);
        p.minutos = p.partes.reduce((s, x) => s + x.minutos * x.qtd, 0);
      }
      const mats = [...new Set((p.partes || [p]).map((x) => fil.find((f) => f.id === x.filamentoId).material))];
      const material = mats.length > 1 ? 'MULTI' : mats[0];
      p.sku = Store.nextSku(material);
      p.categoria = cats[p.nome];
      return p;
    }).map((p) => Store.save('pecas', { nome: p.nome, sku: p.sku, categoria: p.categoria, input: Object.assign({ quantidade: 1, pecasPorEmbalagem: 1, acabamento: false, projeto: false, frete: 0, freteRepassado: true, canalId: 'direto', precoManual: '' }, p) }));

    // vendas e orçamentos espalhados nos últimos 10 meses
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const hoje = new Date();
    const plano = [];
    for (let m = 9; m >= 0; m--) {
      const qtdPedidos = 3 + Math.floor(rnd() * 4) + (9 - m > 5 ? 2 : 0);
      for (let k = 0; k < qtdPedidos; k++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1 + Math.floor(rnd() * 27));
        if (d > hoje) continue;
        plano.push(d);
      }
    }
    plano.sort((a, b) => a - b);
    plano.forEach((d, idx) => {
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const canalSorteio = rnd();
      const canalId = canalSorteio < 0.55 ? 'direto' : canalSorteio < 0.8 ? 'ml-classico' : 'shopee';
      const cliente = canalId === 'ml-classico' ? cli[3] : canalId === 'shopee' ? cli[4] : cli[Math.floor(rnd() * 3)];
      const nItens = 1 + Math.floor(rnd() * 2);
      const itens = [];
      for (let j = 0; j < nItens; j++) {
        const p = pecas[Math.floor(rnd() * pecas.length)];
        const qtd = p.nome.startsWith('Chaveiro') ? 10 + Math.floor(rnd() * 3) * 10 : 1 + Math.floor(rnd() * 3);
        const input = Object.assign({}, p.input, { quantidade: qtd, canalId });
        itens.push(Precificacao.toItem(input, Precificacao.calcular(input)));
      }
      const recente = (hoje - d) / 864e5 < 12;
      const status = recente ? (rnd() < 0.5 ? 'aberto' : 'enviado') : (rnd() < 0.15 ? 'recusado' : (rnd() < 0.85 ? 'concluido' : 'aprovado'));
      const o = Orcamentos.novo(itens);
      Object.assign(o, {
        data: iso, validade: UI.addDays(iso, 7), status, clienteId: cliente.id, cliente,
        dataVenda: ['aprovado', 'concluido'].includes(status) ? UI.addDays(iso, Math.floor(rnd() * 3)) : '',
        desconto: canalId === 'direto' && rnd() < 0.2 ? 5 : 0,
      });
      if (o.dataVenda > UI.today()) o.dataVenda = UI.today();
      Store.save('orcamentos', o);
      return idx;
    });
  }

  window.Sample = { load };
})();
