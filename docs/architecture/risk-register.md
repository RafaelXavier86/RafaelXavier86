# Registro de riscos da arquitetura

**Escala:** probabilidade (P) e impacto (I) de 1 a 5. Nível = P × I.

- **Alto:** ≥ 15
- **Médio:** 8 a 14
- **Baixo:** ≤ 7

Esta é a mesma regra usada no protótipo (`projetos/js/calc.js`, `riskLevel`).

**Responsável:** "A definir" até a aprovação da equipe (pendência).

| ID | Risco (causa → evento → efeito) | P | I | Nível | Resposta | Ação / gatilho | Fase |
|---|---|---|---|---|---|---|---|
| R-01 | Política RLS ausente ou incorreta numa tabela, ou um *worker*/exportação sem contexto de tenant → leitura entre empresas → incidente de privacidade (LGPD) e perda de confiança | 3 | 5 | **15 Alto** | Mitigar | Suite de isolamento obrigatória no CI cobrindo API, SQL, exportação, anexos e workers. Teste que **falha se uma tabela de tenant não tiver RLS**. Papel da aplicação sem `BYPASSRLS`. Gatilho: qualquer tabela nova sem teste | F1 |
| R-02 | Stack não decidida (P-01) → início da F1 adiado ou retrabalho | 3 | 4 | 12 Médio | Mitigar | Recomendação explícita no roadmap. Decisão registrada em ADR antes da F1 | F0 |
| R-03 | Escopo multissetorial amplo (industrial + civil + ágil + melhoria) para equipe pequena → fases longas sem entrega validada | 4 | 4 | **16 Alto** | Mitigar | Incrementos verticais. F5 (civil) condicionada a P-11. Gates com usuário real | Todas |
| R-04 | Auditoria só com hashes (C-08) ou eventos fora da transação → trilha incompleta → não se prova quem mudou baseline ou custo | 3 | 4 | 12 Médio | Mitigar | `change_set` + hash encadeado. Outbox no mesmo commit. Teste de reconstrução | F1 |
| R-05 | Fronteiras de módulo violadas por atalho (import direto, *join* entre schemas) → acoplamento entre setores → extração e manutenção caras | 4 | 3 | 12 Médio | Mitigar | Verificação automática no CI (ADR-002). GRANT por schema. Revisão de PR | F1+ |
| R-06 | Cálculos de cronograma e EVM com regras ambíguas (calendário, curva de VP, ENT) → números diferentes da planilha da controladoria → descrédito do sistema | 4 | 4 | **16 Alto** | Mitigar | P-05/P-06 respondidas antes da F3. Testes de referência portados do protótipo. Gate de reconciliação com planilha real | F3 |
| R-07 | Template alterado propaga para projetos existentes, ou o mapeamento de IDs se perde → projetos mudam sem rastro | 2 | 5 | 10 Médio | Evitar | Snapshot imutável na instanciação. Teste de CA-2 no Incremento 1 | F2 |
| R-08 | Dinheiro em ponto flutuante herdado do protótipo → diferenças de centavos em totais e medições | 3 | 3 | 9 Médio | Evitar | Tipo `Money` no shared-kernel. Proibição de `number` para valores no lint | F1 |
| R-09 | Pessoas identificadas por nome nos dados atuais → importação liga tarefas à pessoa errada | 4 | 2 | 8 Médio | Mitigar | Importador com tela de conciliação nome → usuário (P-14) | F6 |
| R-10 | Conteúdo normativo licenciado (AIAG, VDA, CSR) embutido sem licença → risco jurídico; ou alegação implícita de conformidade | 2 | 4 | 8 Médio | Evitar | Parametrizar a partir de fonte fornecida pelo cliente. Textos sem alegação de certificação (DR-16) | F4 |
| R-11 | O app Core Tools segue evoluindo em paralelo → duas fontes da verdade para APQP/PPAP | 3 | 3 | 9 Médio | Mitigar | Congelar os protótipos (só correções). Decidir P-02 | F0 |
| R-12 | Dados de demonstração vão para produção → relatórios contaminados (CA-9) | 2 | 3 | 6 Baixo | Evitar | Seeds só por *flag* de ambiente. Teste que falha em produção | F1 |
| R-13 | Segregação de funções mal configurada → usuário aprova a própria mudança → controle interno falho | 2 | 4 | 8 Médio | Mitigar | Regra no domínio + teste CA-7. Matriz de aprovação (P-08) | F3 |
| R-14 | Ausência de backup e teste de restauração → perda de dados num incidente | 2 | 5 | 10 Médio | Mitigar | Backup automatizado + restauração testada antes do primeiro tenant real | F1 (antes da produção) |
| R-15 | Ação de IA aprova algo sem humano → decisão sem responsável | 1 | 5 | 5 Baixo | Evitar | DR-13. A IA só gera rascunhos; a aprovação exige ator humano com permissão | F6 |
| R-16 | Requisitos de identidade (IdP, MFA, assinatura ICP-Brasil) descobertos tarde → refação de autenticação | 3 | 3 | 9 Médio | Mitigar | P-13 antes da F1. OIDC genérico | F1 |
| R-17 | Validação só com dados fictícios → produto não aderente à operação real | 3 | 4 | 12 Médio | Mitigar | P-12: caso real e validador nomeados antes do Gate 3 | F2–F4 |

## Mapa de calor (riscos atuais)

| Impacto ↓ / Probabilidade → | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | R-15 | R-07, R-14 | R-01 | | |
| **4** | | R-10, R-13 | R-04, R-17 | R-03, R-06 | |
| **3** | | R-12 | R-08, R-11, R-16 | R-05 | |
| **2** | | | | R-09 | |
| **1** | | | | | |
