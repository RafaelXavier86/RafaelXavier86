# RXR 3D — Precificação e Orçamentos

Sistema de **precificação, orçamentos e controle de vendas** para peças em impressão 3D, com a identidade visual RXR 3D.

Funciona **direto no navegador e sem internet**. Não precisa instalar nada nem ter servidor. Todo o histórico fica salvo no seu computador.

## Como usar

1. Copie a pasta `rxr3d-orcamentos` para o seu computador (ex.: `Documentos\RXR3D`).
2. Dê dois cliques em **`index.html`**. Ele abre no Chrome ou no Edge. Crie um favorito ou um atalho na área de trabalho.
3. Para conhecer o sistema, vá em **Configurações e backup → Carregar dados de exemplo**. Depois use **Apagar todos os dados** para começar do zero.
4. Comece pelos cadastros de custo: **Filamentos**, **Equipamentos**, **Embalagens** e **Parâmetros de custo** (tarifa de energia, perdas etc.).
5. Em **Configurações**, preencha os dados da empresa que aparecem no cabeçalho do PDF: endereço, telefone e e-mail.

> **Importante:** os dados ficam no navegador em que você usa o sistema. Use sempre o mesmo navegador e a mesma pasta. Faça **backup** periodicamente em *Configurações e backup → Baixar backup* e guarde o arquivo `.json` em outro lugar, como um pendrive ou a nuvem. O Dashboard avisa quando o último backup passa de 7 dias. Limpar os "dados de navegação" do navegador apaga o histórico; para recuperá-lo, use *Restaurar backup*.

## Módulos

| Módulo | O que faz |
|---|---|
| **Dashboard** | Visão global ou por ano/mês com faturamento, custos, lucro, margem média, horas impressas, peças produzidas, conversão de orçamentos e valor em aberto. Traz o gráfico **Receita × Custos × Lucro**, os **produtos mais rentáveis** e o resumo mês a mês. Clique em um mês da tabela para filtrar. |
| **Calcular preço** | Composição de preço de uma peça com resultado ao vivo e **comparativo por canal** (venda direta, Mercado Livre Clássico/Premium e Shopee). |
| **Catálogo de peças** | Peças já precificadas, sempre recalculadas com os custos atuais. Delas você cria um orçamento com um clique. |
| **Orçamentos** | Histórico completo com busca, filtro por status e período, e exportação CSV para o Excel. Cada orçamento tem itens, desconto, acréscimo, condições, **PDF** e envio por **WhatsApp**. |
| **Clientes** | Nome, telefone/WhatsApp, CPF/CNPJ (validado), e-mail e endereço completo. O endereço é preenchido automaticamente pelo CEP quando há internet. |
| **Filamentos** | Material, fabricante, cor, **preço do rolo com frete incluso**, peso e unidade. O sistema calcula o custo por grama. |
| **Equipamentos** | Marca, modelo, potência e valor de compra, com vida útil opcional. Mostra o custo de energia e a depreciação por hora. |
| **Embalagens** | Tipo, dimensão, unidade, quantidade por unidade (ex.: pacote com 50) e valor. |
| **Parâmetros de custo** | Tarifa de energia (R$/kWh), vida útil padrão, manutenção/h, taxa de perdas, custos fixos mensais rateados por hora, imposto, % de acabamento e de projeto, margem padrão, validade e condições do orçamento. |
| **Marketplaces** | Comissão %, taxa fixa por faixa de preço e teto de comissão de cada canal. Todos os valores são editáveis, e você pode criar novos canais. |

## Como o preço é calculado

Por peça:

- **Material** = peso (g) × (preço do rolo com frete ÷ peso do rolo em g)
- **Energia** = potência (kW) × horas × tarifa (R$/kWh)
- **Depreciação** = valor de compra ÷ vida útil (h) × horas
- **Manutenção** = R$/h × horas
- **Custos fixos** = (custos fixos mensais ÷ horas de impressão por mês) × horas
- **Perdas/falhas** = % sobre a soma acima

Para o lote:

- **Custo base** = custo por peça × quantidade + embalagens. O número de embalagens é a quantidade ÷ peças por embalagem, arredondado para cima.
- **Acabamento = Sim** soma **+5%** do custo base. **Projeto = Sim** (customizado) soma **+30%**. Os dois percentuais são configuráveis.
- **Frete**: pode ser *cobrado do cliente* (entra no preço sem margem) ou *pago por mim* (entra no custo).
- **Preço de venda (unitário)** = (custo + taxa fixa da plataforma) ÷ (1 − margem − comissão − imposto). A margem é sobre o preço de venda e já desconta as taxas do marketplace. O cálculo considera as faixas de preço e o teto de comissão.
- Se preferir, informe um **preço manual** (ex.: o preço do anúncio) para ver a margem resultante.

**Resultado mostrado:** custo total, custo unitário, preço de venda, lucro em reais, margem percentual (lucro ÷ preço), markup (preço ÷ custo) e lucro por hora de impressão. Há também o detalhamento de cada custo.

> As taxas do Mercado Livre e da Shopee vêm preenchidas apenas como **referência**. Elas mudam com frequência e dependem da categoria, do tipo de anúncio e do tipo de conta. Confira na central do vendedor e ajuste em **Marketplaces**.

## PDF do orçamento

Em um orçamento, clique em **Gerar PDF** e escolha **"Salvar como PDF"** como destino na janela de impressão. O nome do arquivo já vem sugerido, por exemplo `Orcamento_0001_Nome_do_Cliente`. O layout segue a planilha modelo: cabeçalho com logo e dados da empresa, nº/emissão/validade, bloco do cliente, tabela de itens, subtotal, desconto, acréscimo, total, condições e assinaturas. As cores são as da identidade RXR 3D.

Custos e lucro **não** saem no PDF; eles aparecem só no quadro "Uso interno".

Dica: na janela de impressão, desmarque "Cabeçalhos e rodapés" para o PDF sair sem a data e o caminho do arquivo.

## Imagens dos produtos

- **Na peça do catálogo:** em *Calcular preço*, use **Anexar imagem**. Também dá para arrastar a foto para o quadro. A imagem acompanha a peça em todos os orçamentos criados a partir dela.
- **No orçamento:** clique na miniatura ao lado da descrição de qualquer item para anexar ou trocar a imagem só naquele orçamento. Itens avulsos também aceitam imagem.
- **No PDF:** no campo **Imagens no PDF** do orçamento, escolha *Miniatura na tabela*, *Galeria ampliada* (imagens grandes ao final, com o nº do item), *Miniatura + galeria* ou *Não mostrar*.
- As fotos são reduzidas automaticamente (até 1000 px, JPEG) e ficam num banco local do navegador (IndexedDB). Elas **entram no arquivo de backup**. Em *Configurações → Limpar imagens sem uso* você apaga as fotos que não estão em nenhuma peça ou orçamento.

## Dashboard: o que conta como venda

Contam como venda os orçamentos com status **Aprovado** ou **Concluído**, pela **data da venda**. Essa data é preenchida automaticamente ao aprovar e pode ser alterada. Para registrar vendas do Mercado Livre ou da Shopee, crie um orçamento com o canal correspondente na composição, use um cliente como "Mercado Livre (vendas)" e marque como *Concluído*.

## Estrutura

```
rxr3d-orcamentos/
├── index.html          abra este arquivo
├── assets/             logo e ícone
├── css/style.css       identidade visual (cores RXR 3D) e layout do PDF
├── js/calc.js          motor de cálculo (testado)
├── js/store.js         armazenamento local e backup
├── js/…                telas (dashboard, precificação, orçamentos, cadastros, configurações)
└── tests/calc.test.js  testes do cálculo: node --test tests/
```
