# Critérios de aceitação

**Status:** proposta. Detalha os 9 critérios do §11 da especificação em cenários testáveis (Dado / Quando / Então), indicando nível de teste e fase.

Níveis de teste:
- **U** = unitário de domínio
- **I** = integração com banco real
- **A** = API (contrato)
- **E** = ponta a ponta (navegador)

## CA-1 — Isolamento entre tenants (F1; ampliado a cada fase)

| # | Dado | Quando | Então | Nível |
|---|---|---|---|---|
| 1.1 | Usuário do tenant A autenticado; projeto P pertence ao tenant B | `GET /projects/{P}` | 404 (não 403, para não revelar existência) | A |
| 1.2 | Idem | `GET /projects?search=<código de P>` | P não aparece; a contagem total não muda | A |
| 1.3 | Idem | `PATCH`/`DELETE` em P ou filhos de P | 404; nada muda no banco; tentativa registrada em log de segurança | A, I |
| 1.4 | Conexão de banco com `app.tenant_id = A` | `SELECT` direto em qualquer tabela de tenant | Só linhas de A. **Teste automático percorre todas as tabelas com `tenant_id`** e falha se alguma não tiver RLS | I |
| 1.5 | Exportação (CSV/relatório) solicitada em A | Gerada | Contém só dados de A, inclusive em *joins* e agregações | A |
| 1.6 | Anexo de B | Usuário de A pede a URL do arquivo ou adivinha a chave | Negado; URL temporária só emitida após autorização; a chave inclui o tenant | A (F2) |
| 1.7 | *Worker* processando evento de B | Executa | Contexto de tenant = B; falha se ausente | I |
| 1.8 | Usuário com vínculo em A e B | Troca de tenant | Cache, permissões e sessão do tenant anterior invalidados | A |
| 1.9 | Inferência | Códigos sequenciais, mensagens de erro, tempos de resposta | Sem diferença observável que revele dados de B (códigos por tenant; erros genéricos) | A |

## CA-2 — Template versionado (F2; base no Incremento 1)

| # | Cenário | Nível |
|---|---|---|
| 2.1 | Criar projeto a partir de GEN-001 v1 grava `template_version_id = v1` e cópia completa (EAP, atividades, marcos, checklists) com mapeamento definição → instância | I |
| 2.2 | Publicar GEN-001 v2 **não altera** nenhum projeto criado com v1 (comparação por hash do snapshot) | I |
| 2.3 | Comparar v1 × v2 mostra o diff (componentes adicionados, removidos e alterados) | A |
| 2.4 | Versão publicada não aceita edição (só nova versão) | A |
| 2.5 | Instanciação repetida com a mesma *Idempotency-Key* não cria projeto duplicado | A |
| 2.6 | Falha no meio da instanciação não deixa projeto parcial (transação) | I |

## CA-3 — Reprogramação sem tocar a baseline (F3)

| # | Cenário | Nível |
|---|---|---|
| 3.1 | Dada baseline aprovada e cadeia A → B → C (FS) no caminho crítico, aumentar a duração de A em 2 dias úteis recalcula B e C considerando calendário e feriados | U, I |
| 3.2 | A baseline aprovada fica byte a byte igual (snapshot inalterado) | I |
| 3.3 | Variação baseline × atual é calculada por atividade e no término do projeto | U |
| 3.4 | Ciclo de dependência é rejeitado com erro explicativo | U |
| 3.5 | Restrição "não iniciar antes de" é respeitada no recálculo | U |

## CA-4 — Mudança aprovada gera histórico e revisão (F3)

| # | Cenário | Nível |
|---|---|---|
| 4.1 | Mudança com impacto de prazo acima do limite, ao ser aprovada, publica `ChangeApproved` e gera baseline v(n+1) em rascunho vinculada | I |
| 4.2 | Idem para custo → `budget_revision` v(n+1) | I |
| 4.3 | A mudança só passa a `implementada` quando as revisões vinculadas forem aprovadas | U |
| 4.4 | O histórico mostra a cadeia mudança → revisões → aprovações → eventos de auditoria | A |

## CA-5 — Documento aprovado bloqueia edição (F2)

| # | Cenário | Nível |
|---|---|---|
| 5.1 | Revisão `liberada` rejeita alteração de metadados e arquivo | A |
| 5.2 | Criar nova revisão a partir da liberada inicia o fluxo de aprovação; a anterior continua consultável | A |
| 5.3 | Todas as revisões listadas com autor, aprovador, datas e hash do arquivo | A |

## CA-6 — Medição de obra (F5)

| # | Cenário | Nível |
|---|---|---|
| 6.1 | Segunda medição aprovada para o mesmo contrato, item e período é rejeitada | I |
| 6.2 | Quantidade acumulada maior que a contratada (incluindo aditivos aprovados) é rejeitada | U |
| 6.3 | Estorno gera lançamento negativo vinculado; os totais reconciliam (Σ medições = acumulado) | I |

## CA-7 — Segregação de funções (F3)

| # | Cenário | Nível |
|---|---|---|
| 7.1 | Com segregação ativa, o solicitante tenta aprovar a própria mudança | A — 403 + auditoria |
| 7.2 | Com segregação desativada (configuração versionada), a mesma ação é permitida e registrada | A |
| 7.3 | Ação originada por IA nunca é aceita como aprovação (DR-13) | A |

## CA-8 — Cálculos testados (contínuo)

- Cada cálculo tem testes de: caso normal, limites (zero, divisão por zero, datas iguais, valores máximos) e erros (entrada inválida).
- Casos de referência portados de `tests/projetos.test.js`: EVM, burndown, tailoring, saúde e resumo.
- Dinheiro sempre em unidade menor; teste de arredondamento.
- Cobertura mínima proposta para `domain/`: 90% de linhas e 100% das fórmulas listadas em `domain-rules.md` §3.

## CA-9 — Fluxos completos sem dados fictícios em produção (F2/F4/F5)

| # | Cenário | Nível |
|---|---|---|
| 9.1 | GEN-001: criar projeto → planejar → aprovar baseline → executar → mudar → encerrar | E |
| 9.2 | IND-001 com projeto real (P-12) | E + validação do usuário |
| 9.3 | CIV-001 com caso real (P-11) | E + validação do usuário |
| 9.4 | O ambiente de produção recusa carga de *seed* de demonstração | I |

## Critérios de aceite da própria Fase 0

| # | Critério | Situação |
|---|---|---|
| F0.1 | Os 9 documentos existem em `docs/architecture/` | ✅ |
| F0.2 | Diagramas Mermaid de contextos, ERD e dependências | ✅ `context-map.md`, `data-model.md`, `module-dependencies.md` |
| F0.3 | Cada decisão tem evidência, hipótese e pendência | ✅ |
| F0.4 | Consistência de IDs, tenants, estados, revisões e eventos validada | ✅ `data-model.md` §5 (C-01 a C-17) |
| F0.5 | Conflitos e perguntas bloqueantes listados | ✅ `roadmap.md` §3–4 |
| F0.6 | Primeiro incremento vertical recomendado | ✅ `roadmap.md` §2 |
| F0.7 | Nenhuma alteração estrutural, migração ou dependência instalada | ✅ Só arquivos `.md` novos |
| F0.8 | Aprovação do responsável | ⏳ Pendente |
