/*
 * Referência do PMBOK® Guide 8ª edição (PMI) usada pela aplicação:
 * princípios, domínios de desempenho, áreas de foco, abordagens de entrega
 * e modelos de projeto típicos de uma metalúrgica.
 * Os nomes em português são traduções livres dos termos do guia.
 * Funciona no navegador (window.Ref) e no Node (require) para testes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calc.js'));
  else root.Ref = factory(root.Calc);
})(typeof self !== 'undefined' ? self : this, function (Calc) {
  'use strict';

  const PRINCIPIOS = [
    { nome: 'Adotar uma visão holística', texto: 'Enxergar o projeto como um sistema: estratégia da empresa, operação, cliente, fornecedores e a própria fábrica se influenciam. Uma mudança no ferramental mexe em prazo, custo, qualidade e segurança.' },
    { nome: 'Focar no valor', texto: 'O projeto existe para gerar resultado: redução de refugo, aumento de OEE, novo faturamento, conformidade legal. Defina indicadores de valor no termo de abertura e acompanhe-os até depois da entrega.' },
    { nome: 'Incorporar a qualidade nos processos e nas entregas', texto: 'Qualidade é planejada, não inspecionada no fim: DFMEA/PFMEA, plano de controle, critérios de aceite e revisões em cada gate.' },
    { nome: 'Ser um líder responsável', texto: 'Liderança que assume compromissos, presta contas e decide com transparência, com papéis claros (RACI) e decisões registradas.' },
    { nome: 'Integrar a sustentabilidade em todas as áreas do projeto', texto: 'Considerar impactos ambientais (energia, resíduos, emissões), sociais (segurança, ergonomia, comunidade) e econômicos (custo do ciclo de vida) desde o início.' },
    { nome: 'Construir uma cultura empoderada', texto: 'Equipes com autonomia para resolver problemas no chão de fábrica, segurança psicológica para apontar riscos e aprendizado contínuo (lições aprendidas).' },
  ];

  const DOMINIOS = [
    { key: 'governanca', nome: 'Governança', texto: 'Estrutura de decisão, papéis, gates de aprovação, controle de mudanças e alinhamento com a estratégia e o portfólio.', onde: 'Termo de abertura, Governança (marcos/gates, mudanças, decisões)' },
    { key: 'escopo', nome: 'Escopo', texto: 'O que será entregue e o que fica de fora: requisitos, EAP/backlog, critérios de aceite e validação das entregas.', onde: 'Termo de abertura, Tarefas (EAP e backlog)' },
    { key: 'cronograma', nome: 'Cronograma', texto: 'Sequência, durações, marcos e cadência das entregas, seja em fases preditivas ou em sprints.', onde: 'Cronograma (Gantt), Sprints e burndown' },
    { key: 'financas', nome: 'Finanças', texto: 'Orçamento, reservas, custos reais e previsões. Inclui o caso de negócio e o retorno esperado.', onde: 'Finanças (valor agregado) e Termo de abertura' },
    { key: 'partes', nome: 'Partes interessadas', texto: 'Identificar, analisar e engajar quem afeta ou é afetado pelo projeto: cliente, produção, manutenção, qualidade, SESMT, fornecedores, sindicato, órgãos reguladores.', onde: 'Partes interessadas (poder × interesse e comunicação)' },
    { key: 'recursos', nome: 'Recursos', texto: 'Pessoas, equipamentos, materiais e serviços: alocação, capacidade, papéis e desenvolvimento da equipe.', onde: 'Equipe (alocação, carga e matriz RACI)' },
    { key: 'riscos', nome: 'Riscos', texto: 'Incertezas que podem afetar os objetivos: ameaças e oportunidades, análise P × I, respostas e monitoramento.', onde: 'Riscos (registro e mapa de calor)' },
  ];

  const AREAS_FOCO = [
    { key: 'iniciacao', nome: 'Iniciação', texto: 'Autorizar o projeto, definir objetivos, caso de negócio, patrocinador e partes interessadas.' },
    { key: 'planejamento', nome: 'Planejamento', texto: 'Detalhar escopo, cronograma, custos, riscos, recursos e comunicação na medida certa para a abordagem escolhida.' },
    { key: 'execucao', nome: 'Execução', texto: 'Realizar o trabalho, gerenciar a equipe, comprar, comunicar e entregar.' },
    { key: 'monitoramento', nome: 'Monitoramento e controle', texto: 'Comparar realizado × planejado, controlar mudanças e agir sobre desvios.' },
    { key: 'encerramento', nome: 'Encerramento', texto: 'Aceite formal, transferência para a operação, medição de benefícios e lições aprendidas.' },
  ];

  const ABORDAGENS = {
    preditivo: { nome: 'Preditiva', texto: 'Escopo, prazo e custo definidos cedo e controlados por linha de base. Indicada quando mudar depois é caro: obras, compra de máquinas, ferramentais, paradas de manutenção.' },
    hibrido: { nome: 'Híbrida', texto: 'Combina fases e gates preditivos com ciclos iterativos onde há incerteza. Típica de desenvolvimento de produto: projeto do produto em iterações, ferramental e PPAP em fases.' },
    adaptativo: { nome: 'Adaptativa (ágil)', texto: 'Entregas em ciclos curtos (sprints), backlog priorizado e feedback frequente. Indicada para automação, software de chão de fábrica e melhorias com experimentação.' },
  };

  const TAILORING = [
    { key: 'requisitos', curto: 'clareza dos requisitos', pergunta: 'Os requisitos e especificações estão claros e estáveis?', opcoes: ['Totalmente definidos (desenho/especificação do cliente)', 'Quase todos definidos', 'Parcialmente definidos', 'Pouco definidos', 'Vagos, vão surgir durante o projeto'] },
    { key: 'inovacao', curto: 'incerteza técnica', pergunta: 'Qual o grau de inovação ou incerteza técnica?', opcoes: ['Repetição de algo já feito', 'Pequena adaptação', 'Moderada', 'Alta', 'Tecnologia nova para a empresa'] },
    { key: 'custoMudanca', curto: 'custo de mudar o que já foi feito', pergunta: 'Quanto custa mudar algo depois de feito?', opcoes: ['Muito caro ou impossível (aço cortado, concreto, ferramental)', 'Caro', 'Moderado', 'Barato', 'Quase nada (software, layout de bancada)'] },
    { key: 'incremental', curto: 'entregas parciais úteis', pergunta: 'É possível entregar em partes que já gerem valor?', opcoes: ['Não, só funciona completo', 'Raramente', 'Em alguns pontos', 'Na maior parte', 'Sim, cada ciclo entrega algo útil'] },
    { key: 'feedback', curto: 'feedback frequente do cliente/usuário', pergunta: 'O cliente/usuário consegue dar retorno com frequência?', opcoes: ['Só no aceite final', 'Nos gates', 'Mensalmente', 'Quinzenalmente', 'Toda semana ou mais'] },
    { key: 'regulacao', curto: 'baixa exigência formal', pergunta: 'Quanta documentação formal e aprovação é exigida (PPAP, NR, auditorias)?', opcoes: ['Muita, com aprovações formais por etapa', 'Bastante', 'Moderada', 'Pouca', 'Quase nenhuma'] },
    { key: 'equipe', curto: 'equipe dedicada e próxima', pergunta: 'Como é a equipe?', opcoes: ['Grande, parcial e distribuída', 'Parcial, em várias áreas', 'Mista', 'Pequena e quase dedicada', 'Pequena, dedicada e no mesmo local'] },
  ];

  const TIPOS = {
    npd: { nome: 'Desenvolvimento de novo produto', curto: 'Novo produto', abordagem: 'hibrido', metodo: 'Stage-Gate + APQP' },
    melhoria: { nome: 'Melhoria contínua (DMAIC / Lean)', curto: 'Melhoria contínua', abordagem: 'hibrido', metodo: 'DMAIC' },
    manutencao: { nome: 'Manutenção / parada planejada', curto: 'Manutenção', abordagem: 'preditivo', metodo: 'Parada planejada' },
    capex: { nome: 'Investimento / implantação de equipamento (CAPEX)', curto: 'CAPEX', abordagem: 'preditivo', metodo: 'FEL (Front-End Loading)' },
    ehs: { nome: 'Segurança e meio ambiente (NR-12, EHS)', curto: 'Segurança/EHS', abordagem: 'preditivo', metodo: 'Apreciação de riscos ISO 12100' },
    digital: { nome: 'Automação e Indústria 4.0', curto: 'Automação/4.0', abordagem: 'adaptativo', metodo: 'Scrum / Kanban' },
    outro: { nome: 'Outro', curto: 'Outro', abordagem: 'hibrido', metodo: 'Livre' },
  };

  const STATUS_PROJETO = [
    ['proposta', 'Proposta'], ['aprovado', 'Aprovado'], ['andamento', 'Em andamento'],
    ['pausado', 'Pausado'], ['concluido', 'Concluído'], ['cancelado', 'Cancelado'],
  ];
  const STATUS_TAREFA = [
    ['backlog', 'Backlog'], ['afazer', 'A fazer'], ['andamento', 'Em andamento'],
    ['bloqueada', 'Bloqueada'], ['concluida', 'Concluída'],
  ];
  const PRIORIDADES = [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']];
  const CATEGORIAS_RISCO = ['Técnico', 'Fornecedor / compras', 'Qualidade', 'Segurança e meio ambiente', 'Cronograma', 'Custo', 'Pessoas', 'Regulatório / cliente', 'Operação / produção'];
  const RESPOSTAS_RISCO = {
    ameaca: [['evitar', 'Evitar'], ['mitigar', 'Mitigar'], ['transferir', 'Transferir'], ['aceitar', 'Aceitar'], ['escalar', 'Escalar']],
    oportunidade: [['explorar', 'Explorar'], ['melhorar', 'Melhorar'], ['compartilhar', 'Compartilhar'], ['aceitar', 'Aceitar'], ['escalar', 'Escalar']],
  };

  const CHECKLIST_ENCERRAMENTO = [
    ['aceite', 'Entregas aceitas formalmente pelo patrocinador/cliente'],
    ['operacao', 'Transferência para a operação concluída (produção, manutenção, qualidade)'],
    ['documentos', 'Documentação técnica atualizada (desenhos, POPs, planos de controle e de manutenção)'],
    ['compras', 'Pedidos de compra e contratos encerrados'],
    ['custos', 'Custos finais apurados e comparados ao orçamento'],
    ['valor', 'Benefícios medidos em relação ao caso de negócio'],
    ['sustentabilidade', 'Impactos ambientais e de segurança verificados'],
    ['licoes', 'Lições aprendidas registradas e divulgadas'],
    ['equipe', 'Equipe liberada e reconhecida'],
  ];

  /*
   * Modelos: fases em sequência; cada fase termina num marco/gate.
   * Tarefa: [título, duração em dias corridos, pontos (opcional)].
   */
  const MODELOS = {
    npd: [
      { fase: 'Conceito e viabilidade', gate: 'Gate 1 — Aprovação do conceito', tarefas: [['Levantar requisitos do cliente (voz do cliente)', 5], ['Análise de viabilidade técnica e de capacidade', 7], ['Estimativa de custo e caso de negócio', 5]] },
      { fase: 'Projeto do produto', gate: 'Gate 2 — Liberação do projeto', tarefas: [['Modelamento 3D, desenhos e especificações', 15], ['DFMEA', 5], ['Análise de tolerâncias e seleção de materiais', 5], ['Revisão de projeto (design review)', 2]] },
      { fase: 'Projeto do processo', gate: 'Gate 3 — Liberação do processo', tarefas: [['Fluxograma do processo e PFMEA', 7], ['Plano de controle de pré-lançamento', 4], ['Projeto e fabricação do ferramental e dispositivos', 30], ['Try-out do ferramental', 5]] },
      { fase: 'Validação', gate: 'Gate 4 — PPAP aprovado', tarefas: [['Lote piloto', 3], ['MSA e estudo de capabilidade', 5], ['Ensaios de validação do produto', 10], ['Submissão do PPAP', 5]] },
      { fase: 'Lançamento', gate: 'Gate 5 — Início da produção (SOP)', tarefas: [['Treinamento da produção', 3], ['Início da produção seriada', 1], ['Lições aprendidas e encerramento', 2]] },
    ],
    melhoria: [
      { fase: 'Definir', gate: 'Tollgate D — Termo aprovado', tarefas: [['Termo de abertura e SIPOC', 3], ['Voz do cliente e CTQs', 3], ['Linha de base do indicador', 3]] },
      { fase: 'Medir', gate: 'Tollgate M — Dados confiáveis', tarefas: [['Plano de coleta de dados', 2], ['MSA do sistema de medição', 3], ['Coleta de dados', 10]] },
      { fase: 'Analisar', gate: 'Tollgate A — Causas validadas', tarefas: [['Ishikawa e 5 porquês', 3], ['Pareto e análise estatística', 4], ['Validação das causas raiz', 3]] },
      { fase: 'Melhorar', gate: 'Tollgate I — Solução comprovada', tarefas: [['Geração e priorização de soluções', 3], ['Piloto da solução (PDCA)', 10], ['Implementação na linha', 7]] },
      { fase: 'Controlar', gate: 'Tollgate C — Ganho sustentado', tarefas: [['Padronização (instrução de trabalho)', 3], ['Plano de controle e poka-yoke', 3], ['Acompanhamento do resultado', 15], ['Encerramento e reconhecimento da equipe', 1]] },
    ],
    manutencao: [
      { fase: 'Escopo da parada', gate: 'Escopo congelado', tarefas: [['Levantamento de pendências e ordens de serviço', 5], ['Definição do escopo da parada', 3], ['Análise preliminar de riscos (APR)', 3]] },
      { fase: 'Planejamento', gate: 'Liberação da parada', tarefas: [['Plano detalhado e sequenciamento', 5], ['Compra de peças e materiais críticos', 20], ['Contratação de serviços de terceiros', 10], ['Permissões de trabalho e plano de bloqueio (LOTO)', 3]] },
      { fase: 'Execução da parada', gate: 'Fim dos serviços', tarefas: [['Desmontagem e inspeção', 3], ['Substituições e reparos', 5], ['Montagem e ajustes', 3]] },
      { fase: 'Comissionamento', gate: 'Equipamento liberado à produção', tarefas: [['Testes e partida assistida', 2], ['Liberação para a produção', 1]] },
      { fase: 'Encerramento', gate: 'Parada encerrada', tarefas: [['Atualização do histórico e do plano de manutenção', 3], ['Relatório da parada e lições aprendidas', 2]] },
    ],
    capex: [
      { fase: 'FEL 1 — Oportunidade', gate: 'Gate FEL 1 — Seguir para seleção', tarefas: [['Necessidade, alternativas e premissas', 5], ['Estimativa de ordem de grandeza (±30%)', 5]] },
      { fase: 'FEL 2 — Seleção', gate: 'Gate FEL 2 — Alternativa escolhida', tarefas: [['Especificação técnica', 10], ['Cotações e equalização técnica/comercial', 15], ['Análise de retorno (VPL, TIR, payback)', 5]] },
      { fase: 'FEL 3 — Projeto básico', gate: 'Gate FEL 3 — Investimento aprovado', tarefas: [['Layout e projeto de utilidades', 10], ['Adequação à NR-12 e apreciação de riscos', 5], ['Aprovação do investimento', 3]] },
      { fase: 'Execução', gate: 'Equipamento instalado', tarefas: [['Fabricação e entrega do equipamento', 60], ['Obras civis e infraestrutura', 20], ['Instalação mecânica e elétrica', 10]] },
      { fase: 'Comissionamento e partida', gate: 'Aceite final', tarefas: [['Testes FAT/SAT', 5], ['Treinamento de operação e manutenção', 3], ['Ramp-up da produção', 15], ['Documentação as built e encerramento', 5]] },
    ],
    ehs: [
      { fase: 'Diagnóstico', gate: 'Diagnóstico aprovado', tarefas: [['Inventário de máquinas e equipamentos', 5], ['Apreciação de riscos (ISO 12100)', 10]] },
      { fase: 'Planejamento', gate: 'Plano de adequação aprovado', tarefas: [['Plano de adequação priorizado', 5], ['Projeto de proteções e sistemas de segurança', 15]] },
      { fase: 'Implementação', gate: 'Proteções validadas', tarefas: [['Instalação de proteções e intertravamentos', 20], ['Validação dos sistemas de segurança', 5]] },
      { fase: 'Encerramento', gate: 'Laudo emitido', tarefas: [['Treinamentos e procedimentos', 5], ['Documentação e laudo técnico', 5]] },
    ],
    digital: [
      { fase: 'Descoberta', gate: 'Visão do produto aprovada', tarefas: [['Visão do produto e objetivos (OKR)', 3, 3], ['Mapeamento do processo e histórias de usuário', 5, 5]] },
      { fase: 'Sprint 1 — MVP', sprint: true, gate: 'Revisão do sprint 1', tarefas: [['Coleta de dados das máquinas piloto', 10, 8], ['Banco de dados e cadastro de máquinas', 10, 5], ['Tela de status em tempo real', 10, 5]] },
      { fase: 'Sprint 2', sprint: true, gate: 'Revisão do sprint 2', tarefas: [['Cálculo e painel de OEE', 10, 8], ['Apontamento de paradas pelo operador', 10, 5], ['Relatório de perdas por turno', 10, 3]] },
      { fase: 'Sprint 3', sprint: true, gate: 'Revisão do sprint 3', tarefas: [['Alertas para a manutenção', 10, 5], ['Integração com o ERP', 10, 8], ['Ajustes do feedback dos usuários', 10, 3]] },
      { fase: 'Implantação', gate: 'Go-live', tarefas: [['Treinamento e go-live', 3, 3], ['Retrospectiva e encerramento', 1, 1]] },
    ],
    outro: [
      { fase: 'Iniciação', gate: 'Projeto autorizado', tarefas: [['Termo de abertura', 3]] },
      { fase: 'Planejamento', gate: 'Plano aprovado', tarefas: [['Plano do projeto', 5]] },
      { fase: 'Execução', gate: 'Entregas concluídas', tarefas: [['Execução das entregas', 20]] },
      { fase: 'Encerramento', gate: 'Projeto encerrado', tarefas: [['Lições aprendidas e encerramento', 2]] },
    ],
  };

  let seq = 0;
  function uid() { return Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6); }

  /*
   * Gera tarefas, marcos e sprints a partir do modelo do tipo de projeto.
   * Tarefas de uma fase correm em sequência, exceto em fases de sprint, onde correm em paralelo.
   */
  function buildFromTemplate(tipo, inicio) {
    const modelo = MODELOS[tipo] || MODELOS.outro;
    const tarefas = [], marcos = [], sprints = [];
    let cursor = inicio;
    modelo.forEach((f) => {
      let fimFase = cursor;
      let sprintId = '';
      if (f.sprint) {
        const dur = Math.max(...f.tarefas.map((t) => t[1]));
        sprintId = uid();
        sprints.push({ id: sprintId, nome: f.fase, inicio: cursor, fim: Calc.addDays(cursor, dur - 1), meta: f.tarefas.map((t) => t[0]).join('; ') });
      }
      f.tarefas.forEach(([titulo, dias, pontos]) => {
        const ini = f.sprint ? cursor : fimFase;
        const fim = Calc.addDays(ini, dias - 1);
        tarefas.push({
          id: uid(), fase: f.fase, titulo, responsavel: '', inicio: ini, fim, progresso: 0,
          status: 'afazer', prioridade: 'media', pontos: pontos || '', sprint: sprintId,
          custoPlanejado: '', custoReal: '', descricao: '', concluidoEm: '',
        });
        const prox = Calc.addDays(fim, 1);
        if (f.sprint) { if (prox > fimFase) fimFase = prox; } else fimFase = prox;
      });
      marcos.push({ id: uid(), nome: f.gate, data: Calc.addDays(fimFase, -1), criterios: `Entregas da fase "${f.fase}" concluídas e revisadas`, status: 'pendente', decisao: '', decisor: '' });
      cursor = fimFase;
    });
    return { tarefas, marcos, sprints, fim: Calc.addDays(cursor, -1) };
  }

  function label(list, v) { const f = list.find((o) => o[0] === v); return f ? f[1] : v || ''; }

  return {
    PRINCIPIOS, DOMINIOS, AREAS_FOCO, ABORDAGENS, TAILORING, TIPOS, MODELOS,
    STATUS_PROJETO, STATUS_TAREFA, PRIORIDADES, CATEGORIAS_RISCO, RESPOSTAS_RISCO, CHECKLIST_ENCERRAMENTO,
    buildFromTemplate, label, uid,
  };
});
