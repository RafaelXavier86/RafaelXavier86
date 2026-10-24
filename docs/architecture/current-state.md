# Estado atual do repositório — diagnóstico da Fase 0

**Data do inventário:** 24/10/2026
**Branch inspecionado:** `claude/eager-ritchie-mt3k0t` (commit `8739c81`)
**Escopo:** só inspeção. Nenhum código, dado ou estrutura foi alterado nesta fase.

Convenção usada em todos os documentos desta pasta:

- **Evidência**: o que existe no repositório, com arquivo e linha.
- **Hipótese**: o que se supõe, sem confirmação.
- **Pendência**: o que precisa de decisão ou validação do responsável.

---

## 1. Resumo executivo

O repositório tem **dois protótipos funcionais de front-end estático**, escritos em JavaScript puro, sem servidor, sem banco de dados e sem autenticação. Eles servem como **referência funcional** valiosa, mas **não são uma base técnica para o SaaS multiempresa** descrito em `arquitetura_multissetorial_claude_code_v1.md`.

Em comparação com a especificação, **não existe hoje nenhum dos itens de fundação**:

- tenant, identidade e permissões;
- banco relacional e migrações;
- auditoria;
- baseline e versionamento de templates;
- dependências entre atividades e CPM;
- documentos;
- API.

Os ativos reaproveitáveis são:

- **regras e cálculos puros e testados**: valor agregado, saúde por domínio PMBOK 8, adaptação (tailoring), burndown, riscos P × I e resumo de portfólio;
- **conteúdo de domínio**: modelos de projeto industriais, checklists, estados e terminologia em pt-BR;
- **o desenho das telas**, validado com o usuário.

## 2. Inventário

| Item | Situação | Evidência |
|---|---|---|
| Linguagem | JavaScript ES2020, sem TypeScript, módulos IIFE/UMD com variáveis globais | `projetos/js/*.js`, `js/*.js` |
| Framework web | Nenhum (DOM manual) | `projetos/js/ui.js` (`el()`, `form()`, `modal()`) |
| Build | Nenhum; os arquivos são servidos como estão | `package.json` (sem `build`) |
| Dependências | **Zero** (sem `dependencies` nem `devDependencies`; não há `node_modules`) | `package.json` |
| Back-end / API | **Inexistente** | — |
| Banco de dados | **Inexistente**. Persistência num único documento JSON no `localStorage` do navegador | `projetos/js/store.js:8` (`gestao-projetos-pmbok8:v1`), `js/store.js:8` (`core-tools-iatf:v1`) |
| Migrações | Só uma migração de documento, em código, no carregamento (v1 → v2: cliente em texto → cadastro) | `projetos/js/store.js:25` (`migrar`) |
| Autenticação / autorização | **Inexistentes** | — |
| Multiempresa (tenant) | **Inexistente**. Isolamento só implícito, pelo navegador e pela origem | — |
| Auditoria | **Inexistente**. Edições sobrescrevem; exclusões são físicas | `projetos/js/projeto.js:54`, `projetos/js/store.js:76` |
| Arquivos / anexos | **Inexistentes** (só campo de texto "evidência") | `js/modules/apqp.js:90` |
| Testes | 20 testes unitários com `node:test`, só de cálculos puros | `tests/calc.test.js`, `tests/projetos.test.js` |
| Testes de UI / E2E | Não versionados. Houve verificação manual com Playwright em sessão anterior, sem script no repositório | — |
| CI/CD | **Inexistente** (sem `.github/workflows`) | — |
| Documentação | `README.md` (app de Qualidade) e `projetos/README.md` (app de Projetos). Não havia ADRs nem `docs/` | — |
| Lint / formatação | Inexistente | — |
| Execução | `npm start` sobe `python3 -m http.server 8080`; também abre direto pelo `index.html` | `package.json` |
| Histórico | 4 commits, entre 22 e 24/10/2026. O branch de Core Tools está contido no branch atual | `git log` |

### 2.1 Aplicação A — Qualidade Core Tools / IATF 16949 (raiz)

Os módulos são registros num armazenamento genérico de coleções (`js/store.js`):

- Inspeções
- NC/8D
- Instrumentos e calibração
- APQP (entregáveis por fase)
- PPAP (18 elementos e nível de submissão)
- FMEA (AP AIAG-VDA)
- Plano de controle
- MSA (R&R)
- CEP/SPC

**Evidências:** `js/modules/*.js` e `js/calc.js` (fórmulas de SPC, MSA e AP, com testes em `tests/calc.test.js`).

- O **cliente** e o **projeto** são **texto livre** em cada registro: `js/modules/ppap.js:64`, `js/modules/fmea.js:28`, `js/modules/plano.js:25`, `js/modules/apqp.js:70`.
- Não há ligação por ID com o app de Projetos, e os armazenamentos são separados.

### 2.2 Aplicação B — Gestão de Projetos Industriais (`projetos/`)

O documento JSON tem a forma `{ version: 2, settings, clientes[], projetos[] }` (`projetos/js/store.js`). Cada **projeto é um agregado único**, com listas embutidas:

- `tarefas`, `marcos`, `sprints`
- `equipe`, `partes`, `riscos`
- `mudancas`, `questoes`, `licoes`, `indicadores`
- `raci`, `encerramento`

As telas são:

- Painel geral e Clientes;
- dentro do projeto: Visão geral, Termo de abertura, Tarefas (Kanban/EAP), Cronograma (Gantt), Sprints, Equipe/RACI, Partes interessadas, Riscos, Finanças (EVM), Governança e Encerramento;
- Guia PMBOK 8 e Configurações/backup.

## 3. Cobertura da especificação pelo que existe

Legenda: ✅ coberto (como protótipo) · ◐ parcial ou com semântica diferente · ✗ ausente.

| Contexto da especificação | Situação | Observação |
|---|---|---|
| Identity & Tenancy | ✗ | Sem usuários, papéis, empresa ou planta |
| Organization | ◐ | Clientes externos/internos (`projetos/js/store.js:69`). Sem fornecedores, equipes globais nem calendários. **O "cliente interno" mistura cliente com unidade organizacional** (ver C-07 em `data-model.md`) |
| Portfolio & Projects | ◐ | Projeto, termo de abertura, status e painel consolidado. Sem programa/portfólio formal. Código único só no navegador |
| Planning | ◐ | EAP de um nível (fase em texto), datas, Gantt sem dependências. **Sem dependências, calendário, CPM ou baseline** |
| Execution | ◐ | Kanban e status de tarefa. Sem apontamento de horas, impedimentos formais nem evidências anexas |
| Finance | ◐ | Orçamento e EVM. **O EVM usa % subjetivo** (`projetos/js/calc.js:72`), sem revisões de orçamento e sem compromissos/pagos. Valores em `float` |
| Resources | ◐ | Membros com % de alocação e custo/hora. Pessoa identificada **pelo nome** (`projetos/js/projeto.js:294`, `:620`, `:659`) |
| Governance | ◐ | Riscos, mudanças, questões/decisões e gates. **A mudança é só um registro**: não gera revisão nem tem aprovação segregada (`projetos/js/projeto.js:31`) |
| Documents | ✗ | — |
| Communication | ✗ | Só o relatório de status copiado como texto |
| Configuration | ◐ | Modelos fixos no código (`projetos/js/pmbok.js:98`), **sem versão**. O projeto não guarda qual modelo/versão o originou (`buildFromTemplate`, `projetos/js/pmbok.js:155`) |
| Analytics | ◐ | Saúde por domínio PMBOK 8 e resumo de portfólio, calculados na hora, sem eventos nem fatos |
| Industrial extension | ◐ | O app A tem APQP/PPAP/FMEA/plano de controle isolados. O app B tem o modelo Stage-Gate + APQP. **Os dois não se ligam** |
| Civil extension | ✗ | Nenhum artefato |
| Agile extension | ◐ | Sprints, pontos, burndown e velocidade **dentro do núcleo** do app B |
| Improvement extension | ◐ | Modelo DMAIC e indicadores de valor (linha de base → meta) |
| Qualidade operacional (inspeções, NC/8D, calibração, MSA, SPC) | ◐ no app A | **Não tem contexto na especificação** (ver lacuna L-01) |

## 4. Lacunas identificadas

Cada lacuna traz entre parênteses o item da especificação (§) e o critério de aceitação (CA) que ela afeta.

| ID | Lacuna | Impacto | Origem na especificação |
|---|---|---|---|
| L-01 | O contexto **Quality** (inspeção, NC/8D, calibração, MSA, SPC, plano de controle como registro vivo) existe no app A, mas não aparece no mapa de contextos. `industrial_characteristic_link` pressupõe características que não têm dono | Alto: decide se o app A é migrado, integrado ou descontinuado | §3, §4 |
| L-02 | Não há tenant, usuário nem permissão | Bloqueia F1 e todo o resto | §2.3, CA-1, CA-7 |
| L-03 | Não há banco relacional, migrações nem integridade referencial. As referências são por **nome** (responsável, dono do risco, RACI) | Integridade e auditoria impossíveis | §4 |
| L-04 | Não há auditoria nem imutabilidade. Exclusão é física e edição sobrescreve | Fere o princípio 4 | §2.4, §5 |
| L-05 | Não há baseline: as datas planejadas são sobrescritas e o VP do EVM sai do plano **atual** | O EVM fica inválido para controle | §5, CA-3 |
| L-06 | Não há dependências, calendário nem CPM | Sem reprogramação nem caminho crítico | §4, §5, CA-3 |
| L-07 | O EVM usa % de avanço subjetivo, sem método de medição | Contraria a regra do §5 | §5 |
| L-08 | Valores monetários em `float`, sem moeda | Contraria a regra de integridade | §4 |
| L-09 | Os modelos não têm versão e o projeto não guarda snapshot nem a versão de origem | Contraria o princípio 6 | §2.6, §6, CA-2 |
| L-10 | A mudança aprovada não gera revisão de escopo, prazo ou custo, e não há segregação | Contraria a regra do §5 | CA-4, CA-7 |
| L-11 | Não há documentos, revisões nem bloqueio de edição após liberação | — | CA-5 |
| L-12 | Não há nada do setor de construção civil | Escopo inteiro de F5 | §8, CA-6 |
| L-13 | Não há API, OpenAPI, idempotência nem paginação | — | §9 |
| L-14 | Não há CI, observabilidade, backups nem teste de restauração | — | §9 |
| L-15 | Dados de exemplo são carregados automaticamente no primeiro acesso (`projetos/js/app.js:599`) | Contraria o CA-9 se for levado à produção | CA-9 |
| L-16 | Sprints estão no núcleo; a especificação os coloca como extensão opcional | Exige refatoração de fronteira | §1, §3 |
| L-17 | Não há testes de interface versionados | Regressões passam despercebidas | §2.5 |

## 5. Ativos aproveitáveis

| Ativo | Destino proposto | Evidência |
|---|---|---|
| Cálculo de EVM (VP, VA, CR, IDP, IDC, ENT, VNT, IDPT) | Portar para o pacote de domínio **Finance**, com dinheiro em unidades menores, baseline e método de medição | `projetos/js/calc.js:72`; testes em `tests/projetos.test.js` |
| Saúde pelos 7 domínios do PMBOK 8 | **Analytics** (projeção calculada sobre fatos) | `projetos/js/calc.js:192` |
| Tailoring da abordagem | **Configuration** (assistente de criação de projeto) | `projetos/js/calc.js:173`, `projetos/js/pmbok.js` (`TAILORING`) |
| Modelos Stage-Gate/APQP, DMAIC, parada, CAPEX/FEL, NR-12, ágil | Insumo dos templates **GEN-001 / IND-001** e de futuros templates de manutenção e melhoria | `projetos/js/pmbok.js:98` |
| Fórmulas de SPC, MSA e AP de FMEA | Contexto Quality / extensão industrial, se L-01 for aprovado | `js/calc.js`; `tests/calc.test.js` |
| Telas validadas (painel, cliente, Kanban, Gantt, mapa de calor) | Referência de UX para o novo front-end | `projetos/js/app.js`, `projetos/js/projeto.js` |
| Migração de documento JSON v1 → v2 | Padrão para o **importador** de dados legados (JSON → banco) | `projetos/js/store.js:25` |

## 6. Decisões já embutidas no código existente

| Decisão implícita | Evidência | Hipótese | Pendência |
|---|---|---|---|
| Persistência local, por navegador | `projetos/js/store.js:8` | Foi escolha de protótipo, não requisito | Confirmar que os dados atuais **são ou não** produtivos e se precisam ser importados |
| IDs gerados no cliente (`Date.now` em base 36 + aleatório) | `projetos/js/pmbok.js:149`, `js/store.js:28` | Não servem para ambiente multiusuário | Adotar UUIDv7 gerado no servidor (`data-model.md`) |
| Datas como texto `AAAA-MM-DD`, tratadas em UTC | `projetos/js/calc.js:18` | Funciona para datas de calendário, não para instantes | Separar `date` (calendário) de `timestamptz` (instante) |
| Enums de status em português e em texto | `projetos/js/pmbok.js:67`, `projetos/js/projeto.js:30` | — | Definir máquinas de estado formais (`domain-rules.md`) |
| PMBOK 8 como referencial de organização da UI | `projetos/js/pmbok.js` | O usuário quer o PMBOK 8 como linguagem comum | A especificação não cita o PMBOK. Ver P-10 em `roadmap.md` |
| Um "cliente interno" representa uma área da fábrica | `projetos/js/sample.js` (`Operações — Estamparia`) | Era o atalho para projetos internos | Separar `organization_unit` de `client` (C-07) |

## 7. Conclusão da inspeção

1. **Não há stack de servidor para preservar.** A stack de referência do §9 (TypeScript, PostgreSQL) não entra em conflito com nada existente. A decisão continua pendente com o responsável (P-01).
2. Os dois apps devem ser **congelados como protótipos de referência**: continuam funcionando, mas não recebem novas funcionalidades estruturais. A nova plataforma deve nascer em diretórios próprios, sem apagar nem reescrever os protótipos.
3. As regras de cálculo existentes devem virar **casos de teste de referência** (golden tests) do novo domínio, com as correções exigidas pela especificação: baseline, método de medição e dinheiro exato.
