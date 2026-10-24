/*
 * Dados de exemplo: quatro projetos típicos de uma metalúrgica, montados a partir
 * dos modelos e com datas relativas a hoje, para o sistema abrir num estado realista.
 */
(function () {
  'use strict';

  const { addDays, plannedFraction } = Calc;

  // Avança as tarefas como se o projeto tivesse começado no passado
  function simular(tarefas, hoje, cfg) {
    tarefas.forEach((t, i) => {
      t.responsavel = cfg.pessoas[i % cfg.pessoas.length];
      const plan = cfg.custo ? Math.round(cfg.custo(t, i)) : 0;
      t.custoPlanejado = plan || '';
      const fator = cfg.fator || 1;
      if (t.fim < hoje) {
        t.status = 'concluida';
        t.progresso = 100;
        t.concluidoEm = t.sprint ? addDays(t.fim, -2 * (i % 3)) : t.fim;
        t.custoReal = plan ? Math.round(plan * fator) : '';
      } else if (t.inicio <= hoje) {
        t.status = 'andamento';
        t.progresso = Math.round(plannedFraction(t, hoje) * 85 / 5) * 5;
        t.custoReal = plan ? Math.round(plan * t.progresso / 100 * fator) : '';
      } else {
        t.status = cfg.backlog ? 'backlog' : 'afazer';
      }
    });
  }
  function tarefa(p, trecho) { return p.tarefas.find((t) => t.titulo.includes(trecho)); }
  function fecharMarcos(p, hoje) {
    p.marcos.forEach((m) => { if (m.data < hoje) { m.status = 'aprovado'; m.decisao = 'Aprovado para seguir'; } });
  }

  function npd(hoje) {
    const inicio = addDays(hoje, -75);
    const m = Ref.buildFromTemplate('npd', inicio);
    const p = {
      id: Ref.uid(), codigo: 'PRJ-EX-001', nome: 'Suporte estampado do eixo traseiro — Montadora A',
      tipo: 'npd', abordagem: 'hibrido', status: 'andamento', area: 'Estamparia', fase: 'execucao',
      gerente: 'Marina Couto', patrocinador: 'Diretor Industrial', cliente: 'Montadora A (externo)',
      inicio, fim: m.fim, orcamento: 420000, aprovadoEm: inicio,
      justificativa: 'Novo item de alto volume (180 mil peças/ano) para a plataforma 2027 da Montadora A. Consolida a empresa como fornecedora de estampados estruturais.',
      objetivos: 'Aprovar o PPAP nível 3 até o Gate 4 e iniciar a produção seriada (SOP) na data contratada, com custo de peça dentro da cotação.',
      escopoIncluido: 'Projeto do produto (co-design com o cliente), ferramental progressivo, dispositivo de solda, PPAP nível 3 e preparação da linha 2 da estamparia.',
      escopoExcluido: 'Embalagem retornável (fornecida pelo cliente) e pintura KTL (terceirizada).',
      entregaveis: 'Desenhos liberados, DFMEA/PFMEA, plano de controle, ferramental aprovado, PSW assinado.',
      premissas: 'Aço DP600 disponível em 45 dias; prensa 630 t com 30% de capacidade livre.',
      restricoes: 'SOP contratual; orçamento de ferramental limitado a R$ 250 mil.',
      criteriosSucesso: 'PPAP aprovado sem desvio; Cpk ≥ 1,67 nas características especiais; SOP na data.',
      sustentabilidade: 'Aninhamento (nesting) da tira para reduzir sucata; ferramental com vida útil de 1,5 milhão de golpes; retorno da sucata à usina.',
      indicadores: [
        { id: Ref.uid(), nome: 'Faturamento anual do item', unidade: 'R$ mil', base: 0, meta: 4800, atual: '' },
        { id: Ref.uid(), nome: 'Aproveitamento da chapa', unidade: '%', base: 62, meta: 74, atual: 71 },
      ],
      equipe: [
        { id: Ref.uid(), nome: 'Marina Couto', papel: 'Gerente de projeto', area: 'Engenharia de produto', alocacao: 60, custoHora: 145, contato: 'ramal 2210' },
        { id: Ref.uid(), nome: 'Rogério Lima', papel: 'Engenheiro de processos', area: 'Engenharia de processos', alocacao: 80, custoHora: 120, contato: 'ramal 2231' },
        { id: Ref.uid(), nome: 'Patrícia Nunes', papel: 'Analista de qualidade (APQP)', area: 'Qualidade', alocacao: 50, custoHora: 95, contato: 'ramal 2302' },
        { id: Ref.uid(), nome: 'Diego Ramos', papel: 'Projetista de ferramentas', area: 'Ferramentaria', alocacao: 100, custoHora: 110, contato: 'ramal 2415' },
        { id: Ref.uid(), nome: 'Eduardo Sato', papel: 'Comprador', area: 'Suprimentos', alocacao: 20, custoHora: 85, contato: 'ramal 2120' },
      ],
      partes: [
        { id: Ref.uid(), nome: 'Engenharia do cliente', cargo: 'Montadora A', poder: 5, interesse: 5, atitude: 'apoiador', desejada: 'lider', estrategia: 'Reunião técnica semanal e acesso ao status do PPAP', frequencia: 'Semanal' },
        { id: Ref.uid(), nome: 'Diretor Industrial', cargo: 'Patrocinador', poder: 5, interesse: 4, atitude: 'apoiador', desejada: 'apoiador', estrategia: 'Relatório de status e decisão nos gates', frequencia: 'Quinzenal' },
        { id: Ref.uid(), nome: 'Gerente de Produção', cargo: 'Estamparia', poder: 4, interesse: 3, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Envolver no try-out e no plano de capacidade da prensa 630 t', frequencia: 'Semanal' },
        { id: Ref.uid(), nome: 'Usina de aço', cargo: 'Fornecedor DP600', poder: 3, interesse: 2, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Programação firme de pedidos com 60 dias', frequencia: 'Mensal' },
        { id: Ref.uid(), nome: 'SESMT', cargo: 'Segurança do trabalho', poder: 3, interesse: 2, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Validar proteções do dispositivo de solda', frequencia: 'Nos gates' },
      ],
      riscos: [
        { id: Ref.uid(), codigo: 'R-01', descricao: 'Retorno elástico acima da tolerância no try-out, exigindo novas correções no ferramental', categoria: 'Técnico', tipo: 'ameaca', probabilidade: 4, impacto: 4, resposta: 'mitigar', plano: 'Simulação de conformação (CAE) antes da usinagem e reserva de 2 ciclos de correção', dono: 'Diego Ramos', gatilho: 'Desvio > 0,5 mm na 1ª medição 3D', status: 'tratamento' },
        { id: Ref.uid(), codigo: 'R-02', descricao: 'Reprovação do PPAP por capabilidade insuficiente nas características especiais', categoria: 'Qualidade', tipo: 'ameaca', probabilidade: 3, impacto: 5, resposta: 'mitigar', plano: 'Estudo de capabilidade preliminar no lote piloto; dispositivo de controle com R&R < 10%', dono: 'Patrícia Nunes', gatilho: 'Cpk < 1,33 no piloto', status: 'aberto' },
        { id: Ref.uid(), codigo: 'R-03', descricao: 'Atraso na entrega das bobinas de DP600 pela usina', categoria: 'Fornecedor / compras', tipo: 'ameaca', probabilidade: 3, impacto: 4, resposta: 'mitigar', plano: 'Homologar segundo fornecedor e manter estoque de 2 lotes', dono: 'Eduardo Sato', gatilho: 'Confirmação de embarque não recebida 30 dias antes', status: 'aberto' },
        { id: Ref.uid(), codigo: 'R-04', descricao: 'Reaproveitar o dispositivo de solda do projeto anterior com adaptação', categoria: 'Custo', tipo: 'oportunidade', probabilidade: 3, impacto: 3, resposta: 'explorar', plano: 'Avaliar adaptação com a ferramentaria', dono: 'Rogério Lima', gatilho: '', status: 'aberto' },
      ],
      marcos: m.marcos, sprints: m.sprints, tarefas: m.tarefas,
      mudancas: [
        { id: Ref.uid(), codigo: 'CR-01', data: addDays(hoje, -40), descricao: 'Cliente alterou a espessura de 3,00 para 2,65 mm', solicitante: 'Engenharia do cliente', impactoEscopo: 'Revisão dos desenhos e da simulação', impactoPrazo: 5, impactoCusto: 12000, status: 'aprovada', decisao: 'Aprovada no comitê; custo repassado ao cliente' },
        { id: Ref.uid(), codigo: 'CR-02', data: addDays(hoje, -6), descricao: 'Inclusão de furo oblongo para passagem de chicote', solicitante: 'Engenharia do cliente', impactoEscopo: 'Novo punção no ferramental', impactoPrazo: 7, impactoCusto: 18500, status: 'analise', decisao: '' },
      ],
      questoes: [
        { id: Ref.uid(), data: addDays(hoje, -10), tipo: 'questao', descricao: 'Definir quem fornece a embalagem para o lote piloto', responsavel: 'Eduardo Sato', prazo: addDays(hoje, 5), status: 'aberta' },
        { id: Ref.uid(), data: addDays(hoje, -35), tipo: 'decisao', descricao: 'Ferramental progressivo em vez de ferramentas individuais (menor custo por peça)', responsavel: 'Diretor Industrial', prazo: '', status: 'fechada' },
      ],
      licoes: [
        { id: Ref.uid(), data: addDays(hoje, -30), fase: 'Projeto do produto', categoria: 'melhorar', descricao: 'A mudança de espessura chegou depois da simulação pronta.', recomendacao: 'Congelar espessura e material com o cliente antes de iniciar a simulação CAE.' },
      ],
      raci: {}, encerramento: {},
    };
    const custos = { ferramental: 185000 };
    simular(p.tarefas, hoje, {
      pessoas: ['Marina Couto', 'Rogério Lima', 'Patrícia Nunes', 'Diego Ramos'],
      custo: (t) => (t.titulo.includes('ferramental e dispositivos') ? custos.ferramental : Calc.duration(t) * 1600),
      fator: 1.12,
    });
    const pc = tarefa(p, 'Plano de controle');
    pc.status = 'andamento'; pc.progresso = 60; pc.concluidoEm = ''; pc.custoReal = Math.round(pc.custoPlanejado * 0.7);
    tarefa(p, 'ferramental e dispositivos').responsavel = 'Diego Ramos';
    tarefa(p, 'PPAP').responsavel = 'Patrícia Nunes';
    fecharMarcos(p, hoje);
    return p;
  }

  function melhoria(hoje) {
    const inicio = addDays(hoje, -40);
    const m = Ref.buildFromTemplate('melhoria', inicio);
    const p = {
      id: Ref.uid(), codigo: 'PRJ-EX-002', nome: 'Redução de refugo na solda robotizada — Célula 3',
      tipo: 'melhoria', abordagem: 'hibrido', status: 'andamento', area: 'Soldagem', fase: 'execucao',
      gerente: 'Juliana Prado', patrocinador: 'Gerente de Produção', cliente: 'Produção (interno)',
      inicio, fim: m.fim, orcamento: 45000, aprovadoEm: inicio,
      justificativa: 'Refugo de 4,2% na célula 3 gera R$ 38 mil/mês de custo da não qualidade e retrabalho no turno C.',
      objetivos: 'Reduzir o refugo da célula 3 de 4,2% para 1,5% em 3 meses e manter por 60 dias.',
      escopoIncluido: 'Robôs R1 e R2 da célula 3, dispositivos de fixação, parâmetros de solda e arame.',
      escopoExcluido: 'Troca dos robôs; demais células de solda.',
      entregaveis: 'Causas raiz validadas, parâmetros padronizados, plano de controle revisado, poka-yoke de posicionamento.',
      premissas: 'Disponibilidade de 4 h/semana da célula para testes.', restricoes: 'Sem parada adicional da linha.',
      criteriosSucesso: 'Refugo ≤ 1,5% por 8 semanas seguidas.',
      sustentabilidade: 'Menos sucata e menos consumo de arame e gás de proteção por peça boa.',
      indicadores: [
        { id: Ref.uid(), nome: 'Refugo da célula 3', unidade: '%', base: 4.2, meta: 1.5, atual: 3.1 },
        { id: Ref.uid(), nome: 'Custo da não qualidade', unidade: 'R$ mil/mês', base: 38, meta: 12, atual: 29 },
      ],
      equipe: [
        { id: Ref.uid(), nome: 'Juliana Prado', papel: 'Líder Black Belt', area: 'Excelência operacional', alocacao: 50, custoHora: 130, contato: 'ramal 2501' },
        { id: Ref.uid(), nome: 'Carlos Menezes', papel: 'Supervisor de produção', area: 'Soldagem', alocacao: 20, custoHora: 90, contato: 'ramal 2610' },
        { id: Ref.uid(), nome: 'Fábio Teixeira', papel: 'Técnico de robótica', area: 'Manutenção', alocacao: 40, custoHora: 80, contato: 'ramal 2702' },
        { id: Ref.uid(), nome: 'Patrícia Nunes', papel: 'Analista de qualidade', area: 'Qualidade', alocacao: 30, custoHora: 95, contato: 'ramal 2302' },
      ],
      partes: [
        { id: Ref.uid(), nome: 'Gerente de Produção', cargo: 'Patrocinador', poder: 5, interesse: 5, atitude: 'apoiador', desejada: 'lider', estrategia: 'Tollgates e gemba quinzenal', frequencia: 'Quinzenal' },
        { id: Ref.uid(), nome: 'Operadores do turno C', cargo: 'Célula 3', poder: 2, interesse: 5, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Participação no Ishikawa e no piloto; quadro de gestão à vista', frequencia: 'Diária' },
        { id: Ref.uid(), nome: 'Controladoria', cargo: 'Validação dos ganhos', poder: 3, interesse: 2, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Validar a linha de base e os ganhos', frequencia: 'Mensal' },
      ],
      riscos: [
        { id: Ref.uid(), codigo: 'R-01', descricao: 'Variação do lote de arame mascarar o efeito dos novos parâmetros', categoria: 'Qualidade', tipo: 'ameaca', probabilidade: 3, impacto: 3, resposta: 'mitigar', plano: 'Fixar um lote de arame durante o piloto', dono: 'Juliana Prado', gatilho: '', status: 'aberto' },
        { id: Ref.uid(), codigo: 'R-02', descricao: 'Ganho se perder após o fim do projeto', categoria: 'Operação / produção', tipo: 'ameaca', probabilidade: 2, impacto: 4, resposta: 'mitigar', plano: 'Plano de controle e auditoria escalonada', dono: 'Carlos Menezes', gatilho: '', status: 'aberto' },
      ],
      marcos: m.marcos, sprints: m.sprints, tarefas: m.tarefas,
      mudancas: [], questoes: [], licoes: [], raci: {}, encerramento: {},
    };
    simular(p.tarefas, hoje, {
      pessoas: ['Juliana Prado', 'Fábio Teixeira', 'Patrícia Nunes', 'Carlos Menezes'],
      custo: (t) => Calc.duration(t) * 520, fator: 0.95,
    });
    fecharMarcos(p, hoje);
    return p;
  }

  function manutencao(hoje) {
    const inicio = addDays(hoje, -45);
    const m = Ref.buildFromTemplate('manutencao', inicio);
    const p = {
      id: Ref.uid(), codigo: 'PRJ-EX-003', nome: 'Parada anual — Prensa hidráulica 800 t',
      tipo: 'manutencao', abordagem: 'preditivo', status: 'andamento', area: 'Manutenção', fase: 'planejamento',
      gerente: 'Anderson Faria', patrocinador: 'Gerente de Manutenção', cliente: 'Estamparia (interno)',
      inicio, fim: m.fim, orcamento: 310000, aprovadoEm: inicio,
      justificativa: 'Vazamentos no cilindro principal e desgaste das guias elevaram as paradas não programadas a 9% do tempo disponível.',
      objetivos: 'Executar a revisão geral em 11 dias de parada e devolver a prensa com MTBF > 400 h.',
      escopoIncluido: 'Recuperação do cilindro principal, troca das vedações, ajuste das guias, revisão da unidade hidráulica e do painel.',
      escopoExcluido: 'Retrofit do CLP (projeto separado).',
      entregaveis: 'Prensa liberada à produção, histórico atualizado, plano de manutenção preventiva revisado.',
      premissas: 'Produção antecipada de 12 dias de estoque.', restricoes: 'Janela de parada fixa nas férias coletivas.',
      criteriosSucesso: 'Parada concluída dentro da janela e sem acidentes; MTBF > 400 h nos 3 meses seguintes.',
      sustentabilidade: 'Destinação correta de 2.000 L de óleo hidráulico usado (rerrefino) e bacia de contenção.',
      indicadores: [
        { id: Ref.uid(), nome: 'Paradas não programadas', unidade: '% do tempo', base: 9, meta: 2, atual: '' },
        { id: Ref.uid(), nome: 'MTBF da prensa', unidade: 'h', base: 120, meta: 400, atual: '' },
      ],
      equipe: [
        { id: Ref.uid(), nome: 'Anderson Faria', papel: 'Planejador de manutenção', area: 'Manutenção', alocacao: 70, custoHora: 100, contato: 'ramal 2720' },
        { id: Ref.uid(), nome: 'Fábio Teixeira', papel: 'Técnico eletromecânico', area: 'Manutenção', alocacao: 40, custoHora: 80, contato: 'ramal 2702' },
        { id: Ref.uid(), nome: 'Eduardo Sato', papel: 'Comprador', area: 'Suprimentos', alocacao: 30, custoHora: 85, contato: 'ramal 2120' },
        { id: Ref.uid(), nome: 'Luana Bastos', papel: 'Técnica de segurança', area: 'SESMT', alocacao: 20, custoHora: 75, contato: 'ramal 2050' },
      ],
      partes: [
        { id: Ref.uid(), nome: 'Gerente de Manutenção', cargo: 'Patrocinador', poder: 5, interesse: 5, atitude: 'apoiador', desejada: 'apoiador', estrategia: 'Reunião diária durante a parada', frequencia: 'Semanal' },
        { id: Ref.uid(), nome: 'PCP', cargo: 'Planejamento da produção', poder: 4, interesse: 5, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Alinhar formação de estoque e data de retorno', frequencia: 'Semanal' },
        { id: Ref.uid(), nome: 'Empresa de recuperação de cilindros', cargo: 'Terceiro', poder: 4, interesse: 3, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Contrato com multa por atraso e inspeção na fábrica deles', frequencia: 'Semanal' },
      ],
      riscos: [
        { id: Ref.uid(), codigo: 'R-01', descricao: 'Cilindro com trinca exigir troca completa (importado, 12 semanas)', categoria: 'Fornecedor / compras', tipo: 'ameaca', probabilidade: 4, impacto: 5, resposta: 'mitigar', plano: '', dono: 'Anderson Faria', gatilho: 'Laudo de líquido penetrante', status: 'aberto' },
        { id: Ref.uid(), codigo: 'R-02', descricao: 'Acidente em trabalho em altura na troca das guias', categoria: 'Segurança e meio ambiente', tipo: 'ameaca', probabilidade: 2, impacto: 5, resposta: 'evitar', plano: 'Plataforma com guarda-corpo, PT e APR por atividade', dono: 'Luana Bastos', gatilho: '', status: 'aberto' },
      ],
      marcos: m.marcos, sprints: m.sprints, tarefas: m.tarefas,
      mudancas: [], questoes: [
        { id: Ref.uid(), data: addDays(hoje, -3), tipo: 'questao', descricao: 'Vedações importadas retidas na alfândega', responsavel: 'Eduardo Sato', prazo: addDays(hoje, 2), status: 'aberta' },
      ], licoes: [], raci: {}, encerramento: {},
    };
    simular(p.tarefas, hoje, {
      pessoas: ['Anderson Faria', 'Fábio Teixeira', 'Eduardo Sato', 'Luana Bastos'],
      custo: (t) => (t.titulo.includes('Compra de peças') ? 140000 : t.titulo.includes('terceiros') ? 70000 : Calc.duration(t) * 1200),
      fator: 1.05,
    });
    const compra = tarefa(p, 'Compra de peças');
    compra.status = 'bloqueada'; compra.progresso = 40; compra.custoReal = 52000; compra.responsavel = 'Eduardo Sato';
    compra.descricao = 'Vedações retidas na alfândega; aguardando liberação.';
    const terc = tarefa(p, 'terceiros');
    terc.status = 'andamento'; terc.progresso = 50; terc.concluidoEm = '';
    fecharMarcos(p, hoje);
    return p;
  }

  function digital(hoje) {
    const inicio = addDays(hoje, -30);
    const m = Ref.buildFromTemplate('digital', inicio);
    const p = {
      id: Ref.uid(), codigo: 'PRJ-EX-004', nome: 'OEE em tempo real — Estamparia',
      tipo: 'digital', abordagem: 'adaptativo', status: 'andamento', area: 'Engenharia industrial', fase: 'execucao',
      gerente: 'Thiago Moura', patrocinador: 'Gerente Industrial', cliente: 'Estamparia (interno)',
      inicio, fim: m.fim, orcamento: 95000, aprovadoEm: inicio,
      justificativa: 'O OEE é apurado em planilha no dia seguinte; as perdas por pequenas paradas não aparecem.',
      objetivos: 'Mostrar o OEE de 6 prensas em tempo real e reduzir pequenas paradas em 30%.',
      escopoIncluido: 'Coleta de sinais das 6 prensas, painel de OEE, apontamento de paradas e integração com o ERP.',
      escopoExcluido: 'Linhas de solda (fase 2).',
      entregaveis: 'Painéis na fábrica, aplicativo de apontamento, relatório de perdas.',
      premissas: 'Rede industrial disponível nas prensas.', restricoes: 'Sem acesso à rede corporativa a partir do chão de fábrica.',
      criteriosSucesso: 'OEE visível em tempo real nas 6 prensas e usado nas reuniões de turno.',
      sustentabilidade: 'Medição de energia por prensa incluída no painel para identificar consumo em vazio.',
      indicadores: [
        { id: Ref.uid(), nome: 'OEE da estamparia', unidade: '%', base: 58, meta: 70, atual: 61 },
        { id: Ref.uid(), nome: 'Pequenas paradas', unidade: 'h/semana', base: 22, meta: 15, atual: 19 },
      ],
      equipe: [
        { id: Ref.uid(), nome: 'Thiago Moura', papel: 'Product owner', area: 'Engenharia industrial', alocacao: 50, custoHora: 120, contato: 'ramal 2290' },
        { id: Ref.uid(), nome: 'Bianca Freitas', papel: 'Desenvolvedora', area: 'TI industrial', alocacao: 100, custoHora: 110, contato: 'ramal 2810' },
        { id: Ref.uid(), nome: 'Rafael Antunes', papel: 'Analista de automação', area: 'Automação', alocacao: 80, custoHora: 105, contato: 'ramal 2820' },
      ],
      partes: [
        { id: Ref.uid(), nome: 'Supervisores da estamparia', cargo: 'Usuários', poder: 3, interesse: 5, atitude: 'apoiador', desejada: 'lider', estrategia: 'Revisão de cada sprint na própria fábrica', frequencia: 'A cada sprint' },
        { id: Ref.uid(), nome: 'TI corporativa', cargo: 'Segurança da informação', poder: 4, interesse: 2, atitude: 'neutro', desejada: 'apoiador', estrategia: 'Aprovar arquitetura de rede (DMZ industrial) antes do sprint 3', frequencia: 'Mensal' },
      ],
      riscos: [
        { id: Ref.uid(), codigo: 'R-01', descricao: 'CLPs antigos de 2 prensas sem protocolo aberto', categoria: 'Técnico', tipo: 'ameaca', probabilidade: 3, impacto: 3, resposta: 'mitigar', plano: 'Usar sensores e gateway IoT nessas prensas', dono: 'Rafael Antunes', gatilho: '', status: 'tratamento' },
      ],
      marcos: m.marcos, sprints: m.sprints, tarefas: m.tarefas,
      mudancas: [], questoes: [], licoes: [
        { id: Ref.uid(), data: addDays(hoje, -12), fase: 'Sprint 1 — MVP', categoria: 'funcionou', descricao: 'Revisão do sprint feita ao lado da prensa trouxe ajustes que não apareceriam na sala de reunião.', recomendacao: 'Manter as revisões no gemba.' },
      ], raci: {}, encerramento: {},
    };
    simular(p.tarefas, hoje, { pessoas: ['Bianca Freitas', 'Rafael Antunes', 'Thiago Moura'], custo: (t) => Calc.duration(t) * 900, backlog: true });
    // No sprint em curso, o primeiro item já foi concluído
    const atual = p.sprints.find((s) => s.inicio <= hoje && s.fim >= hoje);
    if (atual && Calc.daysBetween(atual.inicio, hoje) >= 2) {
      const t = p.tarefas.find((x) => x.sprint === atual.id);
      t.status = 'concluida'; t.progresso = 100; t.concluidoEm = addDays(hoje, -1); t.custoReal = t.custoPlanejado;
    }
    fecharMarcos(p, hoje);
    return p;
  }

  window.Sample = {
    projetos(hoje) { return [npd(hoje), melhoria(hoje), manutencao(hoje), digital(hoje)]; },
  };
})();
