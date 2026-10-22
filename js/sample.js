/* Dados de exemplo para demonstração (peças e empresas fictícias). */
(function () {
  'use strict';

  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  }
  const rand = rng(42);
  const normal = (m, s) => m + s * Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const round = (v, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d);
  const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  const PECA = { codigoPeca: 'SUP-4471', descricaoPeca: 'Suporte do coxim do motor', cliente: 'Montadora Exemplo S.A.' };
  const CARACS = [
    { operacao: '20 Usinagem', maquina: 'Centro de usinagem CU-03', numCaracteristica: '1', caracteristica: 'Diâmetro do furo Ø25', tipo: 'Produto', classe: 'SC', nominal: '25.000', lie: '24.950', lse: '25.050', metodo: 'Súbito ±0,001', amostra: '5', frequencia: '1x / hora', controle: 'Carta X̄-R', reacao: 'Parar máquina, segregar desde a última verificação OK, acionar líder', m: 25.0, s: 0.009 },
    { operacao: '20 Usinagem', maquina: 'Centro de usinagem CU-03', numCaracteristica: '2', caracteristica: 'Distância entre furos 80', tipo: 'Produto', classe: '', nominal: '80.00', lie: '79.90', lse: '80.10', metodo: 'Paquímetro digital', amostra: '1', frequencia: 'Início de turno', controle: 'Folha de verificação', reacao: 'Ajustar e reinspecionar lote', m: 80.0, s: 0.03 },
    { operacao: '30 Furação', maquina: 'Furadeira FR-01', numCaracteristica: '3', caracteristica: 'Rosca M10x1,5', tipo: 'Produto', classe: 'CC', nominal: '', lie: '', lse: '', metodo: 'Calibrador P/NP', amostra: '5', frequencia: '1x / hora', controle: '100% visual + calibrador', reacao: 'Segregar lote, 100% inspeção, abrir NC', m: null },
    { operacao: '40 Pintura', maquina: 'Cabine KTL', numCaracteristica: '4', caracteristica: 'Espessura de camada (µm)', tipo: 'Produto', classe: '', nominal: '25', lie: '18', lse: '35', metodo: 'Medidor de camada', amostra: '3', frequencia: '2x / turno', controle: 'Registro', reacao: 'Ajustar parâmetros, reinspecionar', m: 26, s: 2.6 },
    { operacao: '40 Pintura', maquina: 'Cabine KTL', numCaracteristica: '5', caracteristica: 'Temperatura da estufa (°C)', tipo: 'Processo', classe: '', nominal: '180', lie: '170', lse: '190', metodo: 'Termopar', amostra: '1', frequencia: 'Contínuo', controle: 'Registrador', reacao: 'Bloquear lote e avaliar cura', m: 180, s: 2 },
    { operacao: '50 Inspeção final', maquina: 'Bancada IF-02', numCaracteristica: '6', caracteristica: 'Aspecto visual (riscos, falhas de pintura)', tipo: 'Produto', classe: '', nominal: '', lie: '', lse: '', metodo: 'Visual — padrão de aparência', amostra: '100%', frequencia: 'Contínuo', controle: 'Inspeção 100%', reacao: 'Segregar peça, registrar defeito', m: null },
  ];

  function load() {
    const plan = Store.save('planos', Object.assign({
      numero: Common.nextNumber('planos', 'PC'), fase: 'Produção', revisao: '03', dataRevisao: dayOffset(-60), nivelAlteracao: 'C',
      fornecedor: 'Planta 1', equipe: 'Qualidade, Engenharia, Produção', itens: CARACS.map(({ m, s, ...i }) => i),
    }, PECA));

    // Inspeções dos últimos 30 dias
    const tipos = ['Primeira peça / Setup', 'Processo (patrulha)', 'Processo (patrulha)', 'Inspeção final'];
    const inspetores = ['Ana Souza', 'Carlos Lima', 'Juliana Reis'];
    for (let k = 0; k < 24; k++) {
      const shift = k === 7 || k === 16 ? 2.2 : 1; // algumas inspeções com variação maior
      const caracteristicas = CARACS.filter((c) => c.tipo === 'Produto').map((c) => {
        const row = { caracteristica: `${c.operacao} — ${c.caracteristica}`, classe: c.classe, nominal: c.nominal, lie: c.lie, lse: c.lse, instrumento: c.metodo };
        if (c.m === null) row.atributo = rand() < 0.06 ? 'NOK' : 'OK';
        else row.medido = round(normal(c.m + (shift > 1 ? c.s * 3.5 : 0), c.s * shift), c.m > 50 ? 2 : 3);
        return row;
      });
      const qtdIns = [5, 13, 32][k % 3];
      const rec = Object.assign({
        numero: Common.nextNumber('inspecoes', 'INS'), data: dayOffset(-29 + k), hora: `${String(6 + (k * 3) % 14).padStart(2, '0')}:${k % 2 ? '30' : '05'}`,
        tipo: tipos[k % tipos.length], operacao: 'Linha 2', maquina: 'CU-03', lote: `L${dayOffset(-29 + k).replace(/-/g, '').slice(2)}-${(k % 3) + 1}`,
        turno: ['1º', '2º', '3º'][k % 3], qtdLote: '500', qtdInspecionada: String(qtdIns), inspetor: inspetores[k % 3], planoControle: plan.numero, caracteristicas,
      }, PECA);
      rec.resultado = Inspecoes.overall(rec);
      rec.qtdReprovada = rec.resultado === 'NOK' ? String(1 + Math.floor(rand() * 3)) : '0';
      rec.disposicao = rec.resultado === 'OK' ? 'Aprovado' : 'Segregado';
      Store.save('inspecoes', rec);
    }

    // Inspeção de recebimento de outro item
    Store.save('inspecoes', {
      numero: Common.nextNumber('inspecoes', 'INS'), data: dayOffset(-3), hora: '08:15', tipo: 'Recebimento', codigoPeca: 'MP-1020', descricaoPeca: 'Barra de aço SAE 1045 Ø32',
      fornecedor: 'Aços Fictícios Ltda.', lote: 'C-88123', qtdLote: '2000', qtdInspecionada: '5', qtdReprovada: '0', inspetor: 'Ana Souza', resultado: 'OK', disposicao: 'Aprovado',
      caracteristicas: [
        { caracteristica: 'Diâmetro', nominal: '32', lie: '31.8', lse: '32.2', instrumento: 'Micrômetro', medido: '32.05' },
        { caracteristica: 'Dureza (HB)', nominal: '', lie: '170', lse: '210', instrumento: 'Durômetro', medido: '188' },
        { caracteristica: 'Certificado de qualidade do material', atributo: 'OK' },
      ],
    });

    // CEP: 25 subgrupos de 5
    const subgrupos = [];
    for (let i = 0; i < 25; i++) {
      const sg = { data: dayOffset(-25 + i), hora: '10:00' };
      for (let j = 1; j <= 5; j++) sg[`x${j}`] = round(normal(25.002, 0.0085), 4);
      subgrupos.push(sg);
    }
    Store.save('spc', Object.assign({
      numero: Common.nextNumber('spc', 'CEP'), caracteristica: 'Diâmetro do furo Ø25', classe: 'SC', operacao: '20 Usinagem', maquina: 'CU-03', unidade: 'mm',
      nominal: '25.000', lie: '24.950', lse: '25.050', n: '5', instrumento: 'Súbito ±0,001', responsavel: 'Carlos Lima', tipoEstudo: 'Monitoramento contínuo', subgrupos,
    }, PECA));

    // MSA: 3 operadores × 3 ensaios × 10 peças
    const partsTrue = Array.from({ length: 10 }, () => normal(25.0, 0.012));
    const bias = { A: 0, B: 0.0012, C: -0.0008 };
    const leituras = [];
    ['A', 'B', 'C'].forEach((op) => [1, 2, 3].forEach((t) => {
      const row = { op, ensaio: t };
      partsTrue.forEach((v, p) => { row[`p${p + 1}`] = round(v + bias[op] + normal(0, 0.0009), 4); });
      leituras.push(row);
    }));
    Store.save('msa', {
      numero: Common.nextNumber('msa', 'MSA'), data: dayOffset(-40), codigoPeca: PECA.codigoPeca, caracteristica: 'Diâmetro do furo Ø25', instrumento: 'Súbito ±0,001',
      codInstrumento: 'SUB-007', resolucao: '0.001', responsavel: 'Juliana Reis', lie: '24.950', lse: '25.050', nOps: '3', nEnsaios: '3', nPecas: '10',
      operadorA: 'Ana Souza', operadorB: 'Carlos Lima', operadorC: 'Juliana Reis', leituras,
    });

    // PFMEA
    Store.save('fmea', Object.assign({
      numero: Common.nextNumber('fmea', 'FMEA'), tipo: 'PFMEA', item: 'Usinagem e pintura do suporte', responsavel: 'Eng. de Processos', dataInicio: dayOffset(-200), revisao: '04',
      equipe: 'Qualidade (Ana Souza), Processos (Marcos Dias), Produção (Carlos Lima), Manutenção (Paulo Alves)',
      itens: [
        { etapa: '20 Usinagem', funcao: 'Usinar furo Ø25 ±0,05', modo: 'Diâmetro acima do especificado', efeito: 'Folga no coxim, ruído e vibração', s: '7', classe: 'SC', causa: 'Desgaste da ferramenta', prevencao: 'Troca preventiva a cada 2.000 peças', o: '4', deteccao: 'Medição com súbito 5 pç/hora + CEP', d: '4', acao: 'Implementar compensação automática de desgaste', responsavel: 'Marcos Dias', prazo: dayOffset(20), status: 'Em andamento' },
        { etapa: '30 Furação', funcao: 'Roscar M10x1,5', modo: 'Rosca incompleta', efeito: 'Impossibilidade de fixação; risco de soltura do motor', s: '9', classe: 'CC', causa: 'Quebra do macho', prevencao: 'Monitoramento de torque do fuso', o: '3', deteccao: 'Calibrador P/NP por amostragem', d: '6', acao: 'Sensor de presença de rosca (poka-yoke) 100%', responsavel: 'Paulo Alves', prazo: dayOffset(-5), status: 'Pendente' },
        { etapa: '40 Pintura', funcao: 'Aplicar camada KTL 18–35 µm', modo: 'Camada abaixo do mínimo', efeito: 'Corrosão prematura', s: '6', causa: 'Tensão do banho abaixo do padrão', prevencao: 'Controle diário de parâmetros do banho', o: '3', deteccao: 'Medidor de camada 2x/turno', d: '5', acao: '', status: '' },
        { etapa: '40 Pintura', funcao: 'Cura na estufa 180 °C', modo: 'Cura insuficiente', efeito: 'Baixa aderência da pintura', s: '6', causa: 'Falha do queimador', prevencao: 'Manutenção preventiva', o: '2', deteccao: 'Alarme de temperatura', d: '2', acao: '', status: '' },
        { etapa: '50 Inspeção final', funcao: 'Garantir aspecto conforme padrão', modo: 'Risco na superfície não detectado', efeito: 'Reclamação de aparência', s: '4', causa: 'Iluminação inadequada na bancada', prevencao: 'Padrão de iluminação 1000 lux', o: '5', deteccao: 'Inspeção visual 100%', d: '7', acao: 'Instalar luminária e padrão de defeitos', responsavel: 'Ana Souza', prazo: dayOffset(-15), status: 'Concluído' },
      ],
    }, PECA));

    // PPAP nível 3
    const ppap = Object.assign({ numero: Common.nextNumber('ppap', 'PPAP'), revisaoDesenho: 'C', nivel: '3', motivo: 'Alteração de engenharia', statusPSW: 'Em análise', responsavel: 'Ana Souza', dataSubmissao: dayOffset(-10), pesoPeca: '1.25' }, PECA);
    App.module('ppap').prepare(ppap);
    ppap.elementos.forEach((e, i) => { e.status = i < 13 ? 'Concluído' : i === 14 ? 'N/A' : 'Em andamento'; e.responsavel = 'Ana Souza'; e.prazo = dayOffset(i < 13 ? -20 : 7); });
    Store.save('ppap', ppap);

    // APQP
    const apqp = Object.assign({ numero: Common.nextNumber('apqp', 'APQP'), projeto: 'Suporte do coxim — nova plataforma', lider: 'Marcos Dias', equipe: 'Qualidade, Processos, Compras, Logística', dataInicio: dayOffset(-240), gate: dayOffset(-10), sop: dayOffset(45), status: 'Em andamento' }, PECA);
    App.module('apqp').prepare(apqp);
    apqp.entregaveis.forEach((e) => {
      const f = Number(e.fase.slice(-1));
      e.status = f <= 3 ? 'Concluído' : f === 4 ? (rand() < 0.5 ? 'Concluído' : 'Em andamento') : 'Pendente';
      e.prazo = dayOffset(f <= 3 ? -100 + f * 20 : f === 4 ? 15 : 120);
      e.responsavel = ['Marcos Dias', 'Ana Souza', 'Carlos Lima'][f % 3];
    });
    Store.save('apqp', apqp);

    // NC / 8D
    Store.save('ncs', Object.assign({
      numero: Common.nextNumber('ncs', 'NC'), dataAbertura: dayOffset(-12), origem: 'Cliente', status: 'Em análise', titulo: 'Rosca M10 incompleta detectada na linha do cliente', lote: 'L-2209-2', qtdAfetada: '12', gravidade: 'Crítica (segurança)', prazo: dayOffset(18),
      d1: 'Ana Souza (Qualidade, líder), Marcos Dias (Processos), Paulo Alves (Manutenção), Carlos Lima (Produção)',
      d2: 'O quê: rosca M10 incompleta. Onde: linha de montagem do cliente. Quando: turno 2. Quantas: 12 peças em 500. Como detectado: parafuso não atingiu o torque.',
      d3: 'Bloqueio de estoque interno e em trânsito; seleção 100% com calibrador P/NP; peças seladas com etiqueta verde.',
      d4: 'Ocorrência: macho quebrado sem detecção pelo monitoramento. Não detecção: amostragem por hora insuficiente para falha súbita.',
    }, PECA));
    Store.save('ncs', {
      numero: Common.nextNumber('ncs', 'NC'), dataAbertura: dayOffset(-45), dataFechamento: dayOffset(-8), origem: 'Interna', status: 'Fechada', titulo: 'Riscos na superfície pintada', codigoPeca: PECA.codigoPeca, gravidade: 'Baixa',
      d1: 'Ana Souza, Carlos Lima', d2: 'Riscos detectados na inspeção final', d3: 'Seleção do lote', d4: 'Iluminação inadequada e manuseio sem proteção', d5: 'Instalar luminária e separadores nas caixas', d6: 'Eficácia verificada por 30 dias sem ocorrência', d7: 'Atualização da PFMEA e instrução de trabalho', d8: 'Equipe reconhecida na reunião mensal',
      fmeaAtualizada: true, pcAtualizado: true, eficaciaVerificada: true, licaoAprendida: true,
    });

    // Instrumentos
    [
      { codigo: 'SUB-007', descricao: 'Súbito para furo Ø25', tipo: 'Dispositivo de controle', resolucao: '0,001 mm', local: 'Linha 2 — CU-03', ultimaCalibracao: dayOffset(-200), periodicidade: '12', laboratorio: 'Lab. Metrologia Exemplo', acreditado: true },
      { codigo: 'PAQ-015', descricao: 'Paquímetro digital 0–150 mm', tipo: 'Paquímetro', resolucao: '0,01 mm', local: 'Linha 2', ultimaCalibracao: dayOffset(-375), periodicidade: '12', laboratorio: 'Lab. Metrologia Exemplo', acreditado: true },
      { codigo: 'CAL-M10', descricao: 'Calibrador de rosca M10x1,5 P/NP', tipo: 'Calibrador passa/não passa', local: 'Furadeira FR-01', ultimaCalibracao: dayOffset(-170), periodicidade: '6', laboratorio: 'Laboratório interno', acreditado: false },
      { codigo: 'CAM-002', descricao: 'Medidor de espessura de camada', tipo: 'Outro', resolucao: '0,1 µm', local: 'Pintura', ultimaCalibracao: dayOffset(-90), periodicidade: '12', laboratorio: 'Lab. Metrologia Exemplo', acreditado: true },
    ].forEach((i) => {
      i.situacao = 'Em uso';
      i.registros = [{ data: i.ultimaCalibracao, certificado: `CERT-${Math.floor(rand() * 90000 + 10000)}`, laboratorio: i.laboratorio, resultado: 'Aprovado' }];
      i.proximaCalibracao = Instrumentos.nextDate(i);
      Store.save('instrumentos', i);
    });
  }

  window.Sample = { load };
})();
