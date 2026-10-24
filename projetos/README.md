# Gestão de Projetos Industriais — PMBOK® 8

Aplicação web para planejar, acompanhar e encerrar projetos de uma indústria metalúrgica: **novo produto, melhoria contínua, manutenção/parada, investimento (CAPEX), segurança (NR-12/EHS) e automação/Indústria 4.0**. Foi construída sobre os conceitos da **8ª edição do PMBOK® Guide** e funciona com abordagem **preditiva, híbrida ou adaptativa (ágil)**.

Funciona direto no navegador, sem instalação nem servidor. Os dados ficam no navegador (localStorage), com backup e restauração em JSON.

## Como o PMBOK 8 aparece no sistema

| Conceito do PMBOK 8 | Onde |
|---|---|
| **6 princípios** (visão holística, foco no valor, qualidade incorporada, liderança responsável, sustentabilidade, cultura empoderada) | Guia PMBOK 8. Também aparecem nos campos: indicadores de valor, sustentabilidade, RACI e lições aprendidas |
| **7 domínios de desempenho**: Governança, Escopo, Cronograma, Finanças, Partes interessadas, Recursos, Riscos | Cada aba do projeto pertence a um domínio. A **saúde do projeto** é calculada domínio a domínio |
| **5 áreas de foco**: Iniciação, Planejamento, Execução, Monitoramento e controle, Encerramento | Barra de etapas no topo de cada projeto |
| **Adaptação (tailoring)** e abordagens de entrega | Questionário do *Novo projeto*, que sugere a abordagem preditiva, híbrida ou adaptativa |

## Módulos

- **Painel geral**: resumo de tudo o que está em andamento, de todos os clientes:
  - indicadores consolidados: projetos ativos, críticos e em atenção, orçamento e gasto, avanço médio ponderado pelo orçamento, riscos altos e tarefas atrasadas;
  - quadro **por cliente**, com saúde, orçamento, avanço e próximo marco de cada um;
  - **marcos e gates dos próximos 30 dias** (e os atrasados);
  - **pontos de atenção**, com o motivo de cada projeto crítico ou em atenção;
  - lista de **todos os projetos**, com filtros por cliente, tipo, abordagem e situação, e exportação em CSV.
- **Clientes**: cadastro de clientes **externos** (montadoras, OEMs) e **internos** (áreas da fábrica, para manutenção e melhorias), com segmento, contato e observações. A página de cada cliente mostra os indicadores e todos os projetos dele. Um cliente com projetos não pode ser excluído.
- **Novo projeto**: cliente (dá para cadastrar um novo na hora), dados básicos, questionário de adaptação com a abordagem sugerida e estrutura inicial gerada pelo modelo do tipo de projeto:
  - Novo produto: Stage-Gate + APQP, do conceito ao SOP, com DFMEA, PFMEA, ferramental e PPAP
  - Melhoria contínua: DMAIC, com tollgates
  - Manutenção: parada planejada, com APR, LOTO e comissionamento
  - CAPEX: FEL 1–3, execução e comissionamento
  - Segurança: NR-12 e apreciação de riscos ISO 12100
  - Automação: descoberta e sprints
- **Visão geral do projeto**: indicadores, saúde por domínio com o motivo de cada alerta, valor entregue, tarefas atrasadas e próximas, e principais riscos. O botão **Copiar relatório de status** gera um texto pronto para colar no e-mail ou no Teams.
- **Termo de abertura**: caso de negócio, objetivos, escopo incluído e excluído, premissas, restrições, critérios de sucesso, sustentabilidade e **indicadores de valor** (linha de base → meta).
- **Tarefas**: quadro **Kanban** com arrastar e soltar, ou **lista em EAP** por fase. Cada tarefa tem responsável, datas, avanço, pontos, sprint e custo planejado/real.
- **Cronograma**: **gráfico de Gantt** com resumo por fase, linha de hoje, tarefas atrasadas ou bloqueadas e marcos/gates.
- **Sprints**: ciclos com meta e retrospectiva, **burndown** e **velocidade**.
- **Equipe**: alocação, carga de trabalho (tarefas abertas e atrasadas por pessoa) e **matriz RACI** por fase, com alerta quando uma fase não tem exatamente um "A".
- **Partes interessadas**: matriz **poder × interesse**, engajamento atual × desejado e plano de comunicação.
- **Riscos**: registro de ameaças e oportunidades, **mapa de calor 5×5**, estratégias de resposta, dono e gatilho.
- **Finanças**: **gerenciamento do valor agregado**, com VP, VA, CR, IDP, IDC, ENT, EPT, VNT e IDPT, reserva e custos por fase.
- **Governança**: gates de decisão (go/no-go), **controle de mudanças** com impacto em prazo e custo, e registro de questões e decisões.
- **Encerramento**: checklist, benefícios realizados e **lições aprendidas**.

## Regras de saúde por domínio

| Domínio | Atenção | Crítico |
|---|---|---|
| Governança | sem patrocinador; termo não aprovado; 1 gate atrasado | mais de 1 gate atrasado, ou atraso maior que 14 dias |
| Escopo | escopo não descrito; sem tarefas; 1–2 mudanças pendentes | 3 ou mais mudanças pendentes |
| Cronograma | IDP < 0,95; 1–2 tarefas atrasadas | IDP < 0,80; 3 ou mais atrasadas; término do projeto vencido |
| Finanças | IDC < 0,95; ENT acima do orçamento; sem orçamento | IDC < 0,80; ENT acima do orçamento em mais de 10% |
| Partes interessadas | nenhuma cadastrada; parte influente resistente | parte influente resistente sem estratégia |
| Recursos | sem equipe; alocação > 100%; tarefa aberta sem responsável | — |
| Riscos | nenhum risco identificado; risco alto em aberto; risco ocorrido | risco alto (P × I ≥ 15) sem plano de resposta |

A saúde geral é a do pior domínio. Se 5 ou mais domínios estiverem em atenção, o projeto passa a crítico.

Quando as tarefas não têm custo, o IDP usa o avanço físico ponderado pela duração.

## Como usar

1. Abra `projetos/index.html` no navegador (Chrome, Edge ou Firefox), ou publique a pasta num servidor estático (por exemplo, GitHub Pages ou `npm start` na raiz e acesse `http://localhost:8080/projetos/`).
2. No primeiro acesso, o sistema abre com **4 clientes e 5 projetos de exemplo**. Use **Apagar exemplos e começar** quando quiser usar os seus.
3. Faça **backups** em *Configurações e backup*, porque os dados ficam só no navegador em que foram lançados.

## Estrutura

```
projetos/index.html     Página principal
projetos/css/style.css  Estilos (tema claro/escuro, celular e impressão)
projetos/js/calc.js     Cálculos: valor agregado, saúde por domínio, tailoring, riscos, burndown
projetos/js/pmbok.js    Referência do PMBOK 8 e modelos por tipo de projeto
projetos/js/store.js    Armazenamento local, backup e migração de dados
projetos/js/ui.js       Componentes de interface
projetos/js/app.js      Rotas, Painel geral, Clientes, Novo projeto, Guia e Configurações
projetos/js/projeto.js  Abas do projeto
projetos/js/sample.js   Projetos de exemplo
tests/projetos.test.js  Testes dos cálculos (npm test)
```

## Migração de dados

- Ao abrir um backup da versão anterior, o texto do campo "Cliente" de cada projeto vira um cliente cadastrado automaticamente.

## Próximos passos sugeridos

- Banco de dados central com login, para a equipe compartilhar os mesmos projetos.
- Dependências entre tarefas e caminho crítico.
- Anexos (desenhos, atas, laudos) e notificações por e-mail.

---
PMBOK é marca registrada do Project Management Institute (PMI). Este sistema aplica os conceitos do guia e não é afiliado ao PMI. Os termos em português são traduções livres.
