# ADR-001 — Monólito modular com contextos delimitados

- **Status:** Proposto (aguardando aprovação do responsável)
- **Data:** 24/10/2026
- **Decisores:** responsável pelo produto (pendente), arquiteto (Claude Code, proponente)

## Contexto

A especificação (§2.1) pede um monólito modular inicial com contratos explícitos e possibilidade de extração posterior. O que se sabe hoje:

- **Não existe back-end nem banco a preservar.** O repositório tem dois protótipos estáticos em JavaScript (`current-state.md` §2).
- **O produto é multiempresa (SaaS)**, com núcleo universal e 4 extensões setoriais. A ordem de grandeza de escala ainda é desconhecida (P-09).
- **A equipe de desenvolvimento é pequena** (hipótese, sem evidência no repositório) e conta com agente de IA.
- **Requisitos fortes de consistência transacional:** baseline, revisões, auditoria e medições precisam de atomicidade entre agregados do mesmo tenant.

## Decisão

Construir **uma única aplicação de servidor implantável (monólito)**, organizada em **módulos por contexto delimitado** (`context-map.md`), com:

1. **Interface pública por módulo** (`public/`). Proibido importar internos de outro módulo, com verificação automática em CI.
2. **Um *schema* PostgreSQL por módulo**, sem *joins* entre schemas no código de domínio. Leitura cruzada via interface pública ou projeção.
3. **Comunicação assíncrona por eventos versionados** com *transactional outbox* e consumo idempotente, mesmo dentro do processo.
4. **Extensões setoriais como módulos** que dependem só de contratos do núcleo e se registram em pontos de extensão.
5. **Banco único PostgreSQL** com RLS por `tenant_id` como defesa em profundidade, além da autorização na aplicação.

## Alternativas consideradas

| Alternativa | Prós | Contras | Motivo de descarte |
|---|---|---|---|
| Microsserviços desde o início | Escala e implantação independentes | Custo operacional alto, consistência distribuída (sagas) para baseline e revisões, equipe pequena | Prematuro: nenhum requisito de escala justifica |
| Monólito sem módulos (camadas técnicas) | Começo mais rápido | Acoplamento entre setores, extração futura cara, viola §2.2 e §5 (extensões sem acesso a tabelas privadas) | Viola princípios da especificação |
| Evoluir os protótipos estáticos (localStorage) | Reaproveita UI | Sem servidor, sem tenant, sem auditoria, sem integridade; isolamento impossível de provar (CA-1) | Inviável para SaaS |
| BaaS (p. ex. Supabase/Firebase) com lógica no cliente | Entrega rápida | Regras críticas (baseline, segregação, medição) no cliente ou em funções dispersas; RLS vira a única barreira | Contraria §9 ("RLS não substitui autorização") |

## Consequências

**Positivas**
- Transações ACID entre agregados do mesmo tenant: baseline e eventos de outbox no mesmo commit.
- Uma única implantação, observabilidade e pipeline de CI.
- Limites de módulo verificáveis, com extração futura possível para contextos de carga distinta (p. ex. Analytics, Documents).

**Negativas e riscos**
- A disciplina de fronteiras depende de ferramenta e revisão (R-05 em `risk-register.md`).
- Um *schema* por módulo exige cuidado com FKs entre contextos: só para tabelas públicas de identidade (C-17).
- Escala vertical inicial; Analytics pode precisar de réplica de leitura.

## Evidência, hipóteses e pendências

| Tipo | Item |
|---|---|
| Evidência | Não há código de servidor (`package.json` sem dependências; nenhum arquivo de API) |
| Evidência | Os cálculos puros já estão isolados em `projetos/js/calc.js` e `js/calc.js`, o que favorece a camada `domain/` sem I/O |
| Hipótese | Equipe pequena e volume inicial de dezenas de tenants e milhares de projetos |
| Hipótese | TypeScript em todo o stack (web + API) reduz o custo de contexto do agente e dos revisores |
| Pendência | P-01: stack definitiva (NestJS × alternativa; ORM/SQL builder; Next.js) |
| Pendência | P-09: modelo de implantação (SaaS público × instância dedicada por cliente) |
| Pendência | Ferramenta de verificação de fronteiras (ADR-002) |
| Pendência | Política de *schema* por módulo e papéis de banco (ADR-003) |

## ADRs futuras previstas

| ADR | Tema |
|---|---|
| ADR-002 | Verificação de fronteiras de módulos em CI |
| ADR-003 | Estratégia de multiempresa no banco: RLS, papéis, FKs compostas e testes de isolamento |
| ADR-004 | Identidade: OIDC, MFA, RBAC + escopos de projeto/objeto |
| ADR-005 | Motor de templates: formato, versionamento, snapshot e mapeamento de IDs |
| ADR-006 | Calendário e algoritmo de CPM |
| ADR-007 | Dinheiro, moeda e arredondamento |
| ADR-008 | Destino dos protótipos e importação de dados legados |
