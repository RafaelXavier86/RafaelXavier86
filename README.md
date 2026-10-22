# Qualidade Core Tools — IATF 16949

Aplicação web para **lançamento e relatório** dos registros de qualidade automotiva, cobrindo as ferramentas do **Core Tools (AIAG)** e os requisitos da **IATF 16949**.

Funciona direto no navegador, sem instalação nem servidor de banco de dados. Os dados ficam salvos no navegador (localStorage), e o próprio sistema faz backup e restauração em arquivo JSON.

## Módulos

| Módulo | Referência | O que faz |
|---|---|---|
| **Inspeções de Qualidade** | IATF 8.6 / 9.1.1 | Inspeções de recebimento, setup/primeira peça, processo, final, auditoria de produto e layout. Avalia OK/NOK por característica (LIE/LSE ou atributo), destaca características especiais (CC/SC) e carrega as características do Plano de Controle. Se a inspeção reprovar, abre uma NC/8D já preenchida. |
| **NC / 8D** | IATF 8.7 / 10.2 | Não conformidades internas, de cliente e de fornecedor, tratadas pelas disciplinas D1–D8, com verificação de FMEA, Plano de Controle, eficácia e lições aprendidas. |
| **Instrumentos e Calibração** | IATF 7.1.5.2.1 | Cadastro de instrumentos, histórico de calibrações e alerta de instrumentos vencidos ou que vencem em 30 dias. |
| **APQP** | Manual APQP 2ª ed. | Entregáveis das 5 fases, com responsável, prazo, status e andamento de cada fase. |
| **PPAP** | Manual PPAP 4ª ed. | Os 18 elementos, com o requisito de cada um (submeter/reter) conforme o nível de submissão (1 a 5), e o status do PSW. |
| **FMEA** | Manual AIAG-VDA 2019 | PFMEA/DFMEA com S/O/D e **Prioridade de Ação (AP)** calculada automaticamente. O NPR aparece só como referência. |
| **Plano de Controle** | IATF 8.5.1.1 / Anexo A | Características de produto e processo, especificações, técnica de medição, amostragem e plano de reação. |
| **MSA (R&R)** | Manual MSA 4ª ed. | Estudo de R&R pelo método da Média e Amplitude (2–3 operadores, 2–3 ensaios, 2–10 peças): EV, AV, R&R, PV, %R&R (variação total e tolerância) e ndc. |
| **CEP / SPC** | Manual SPC 2ª ed. | Cartas X̄-R (n = 2–10) e I-MR (n = 1), Cp, Cpk, Pp, Ppk, histograma e sinais de instabilidade. |

### Relatórios

O menu **Relatórios** filtra por período (e, nas inspeções, também por peça, cliente, tipo, inspetor e resultado) e mostra:

- indicadores: total de inspeções, taxa de aprovação e PPM reprovado;
- **Pareto** das características não conformes e resumo por peça;
- relatórios de NC/8D, ações de FMEA com AP Alta, capabilidade, MSA, calibração, PPAP e APQP.

Todo relatório e todo registro podem ser:

- **exportados em CSV**, que abre direto no Excel em português (separador `;`). O CSV de inspeções sai com uma linha por característica medida;
- **impressos ou salvos em PDF**, com cabeçalho da empresa e campos de assinatura.

## Como usar

1. Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). Para usar em rede, publique a pasta em qualquer servidor estático. Exemplos: GitHub Pages, ou `npm start` para um servidor local em `http://localhost:8080`.
2. Em **Configurações**, informe o nome da empresa, que aparece nos relatórios.
3. No primeiro acesso, use **Carregar dados de exemplo** para conhecer o sistema.
4. Faça **backups** periódicos em *Configurações e backup*, porque os dados ficam somente no navegador em que foram lançados.

## Estrutura

```
index.html          Página principal
css/style.css       Estilos (tema claro/escuro, celular/tablet e impressão)
js/calc.js          Cálculos estatísticos (SPC, MSA, AP da FMEA)
js/store.js         Armazenamento local e backup
js/ui.js            Componentes de interface, exportação CSV, impressão e gráficos SVG
js/app.js           Rotas, menu e telas genéricas de lista/edição
js/modules/*.js     Um arquivo por módulo (campos, cálculos, relatórios)
js/pages.js         Painel, Relatórios e Configurações
js/sample.js        Dados de exemplo
tests/              Testes dos cálculos (npm test)
```

## Testes

```
npm test
```

Os testes conferem as constantes e fórmulas de SPC (X̄-R, I-MR, Cp/Cpk), do R&R e da tabela de Prioridade de Ação AIAG-VDA.

## Próximos passos sugeridos

- Banco de dados centralizado com login de usuários, para vários inspetores e computadores compartilharem os mesmos dados.
- Estudos de MSA por atributos (Kappa) e de linearidade/tendência.
- Anexos (fotos, certificados) nas inspeções e nas NCs.
