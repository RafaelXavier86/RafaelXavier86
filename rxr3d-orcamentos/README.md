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
| **Calcular preço** | Composição de preço de uma peça (com uma ou várias partes/materiais) com resultado ao vivo e **comparativo por canal** (venda direta, Mercado Livre Clássico/Premium e Shopee). |
| **Catálogo de peças** | Peças já precificadas, sempre recalculadas com os custos atuais. Delas você cria um orçamento com um clique. |
| **Orçamentos** | Histórico completo com busca, filtro por status e período, e exportação CSV para o Excel. Cada orçamento tem itens, desconto, acréscimo, condições, **PDF** e envio por **WhatsApp**. |
| **Clientes** | Nome, telefone/WhatsApp, CPF/CNPJ (validado), e-mail e endereço completo. O endereço é preenchido automaticamente pelo CEP quando há internet. |
| **Filamentos** | Em *Estoque*: material, fabricante, cor, **preço do rolo com frete incluso**, peso e unidade, junto com o saldo em estoque. O sistema calcula o custo por grama. |
| **Equipamentos** | Marca, modelo, potência e valor de compra, com vida útil opcional. Mostra o custo de energia e a depreciação por hora. |
| **Componentes** | Em *Estoque*: tag NFC, parafusos, ímãs etc., com custo por unidade (mesmo comprando em pacote), estoque e estoque mínimo. São usados na estrutura das peças. |
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

## Peças com vários materiais ou cores (multipartes)

Na precificação, o quadro **Materiais e partes da peça** tem uma linha por parte ou cor:

| Campo | O que informar |
|---|---|
| Parte | Nome opcional (ex.: Letras, Base, Suporte) |
| Filamento | O filamento/cor daquela parte |
| Peso | Gramas da parte, conforme o fatiador |
| Tempo (h : min) | Tempo de impressão da parte |
| Qtd | Quantas vezes essa parte é impressa por peça/conjunto (ex.: 8 letras) |

- Use **+ Adicionar parte / cor** para cada material. Peças de um material só usam uma linha.
- O custo de cada filamento entra separado na *Composição do custo*. Peso e tempo do conjunto aparecem somados logo abaixo do quadro.
- **Impressão multicor de uma vez (AMS):** lance o tempo só na linha principal; nas outras cores, informe apenas o peso gasto, incluindo a purga.
- Peças com materiais diferentes recebem SKU `RXR-MULT-0001`.
- **Controle de gasto:** cada venda guarda os gramas usados de cada filamento. O Dashboard mostra o quadro **Consumo de filamento** do período, com kg, rolos equivalentes, custo do material e % do total.

## Controle de estoque

O menu **Estoque** tem duas telas. O saldo de cada item é a soma das suas movimentações, e cada uma pode ser vista em **Histórico**.

### Filamentos (cadastro + estoque)
Cadastro, preço e estoque ficam numa tela só (**Estoque → Filamentos**). Na **Entrada (compra)**, escolha **+ Novo filamento** para cadastrar e lançar a compra de uma vez: o preço do rolo é calculado pelo valor pago. Para um filamento que você não quer controlar no estoque, use **+ Cadastrar sem estoque**. Na precificação, a lista de filamentos mostra o saldo de cada um, e o botão **+ Novo filamento** do quadro de partes cadastra sem sair da tela.

- **Entrada (compra):** informe os rolos (ou g/kg) e, se quiser, o valor pago com frete. Marque *Atualizar o preço do rolo no cadastro* para que a precificação passe a usar o preço da última compra.
- **Consumo automático:** ao marcar um orçamento como **Aprovado** ou **Concluído**, o sistema desconta os gramas de cada filamento usados nas peças. Mudar itens, quantidades ou status, ou excluir o orçamento, refaz o desconto automaticamente. Recusar ou voltar para "em aberto" devolve o filamento.
- **Perda / descarte** (impressão falhou, filamento úmido) e **Ajuste de inventário**: informe o saldo contado na prateleira e o sistema lança a diferença.
- Para cada filamento a tela mostra o saldo, os rolos equivalentes, a situação (OK / Repor / Zerado), o consumo dos últimos 30 dias, quanto tempo o saldo dura nesse ritmo e o valor em estoque.
- O **estoque mínimo** (em rolos) é editado direto na tabela de Filamentos. O padrão é 1 rolo; use 0 para não receber aviso. Abaixo do mínimo, a situação vira **Repor** e o Dashboard avisa.
- Na precificação, se um filamento controlado não tiver saldo suficiente para a peça, aparece o aviso **Estoque insuficiente**.

### Produtos acabados
- **Registrar produção:** soma unidades ao estoque do produto (SKU) e, por padrão, desconta o filamento usado. A janela mostra quanto de cada filamento será necessário e o saldo atual.
- **No orçamento**, cada item vindo do catálogo tem a opção **Produzir** (consome filamento ao aprovar) ou **Do estoque** (ao aprovar, sai do estoque de produto acabado, sem consumir filamento de novo). É o caso típico das vendas do Mercado Livre e da Shopee.
- **Saída** (brinde, amostra, peça quebrada) e **Ajuste de inventário** (quantidade contada).
- Para cada produto a tela mostra o saldo, o mínimo (editável na própria tabela), as vendas dos últimos 30 dias e o valor do estoque a preço de custo e a preço de venda.
- Excluir uma produção no Histórico desfaz tudo: o produto sai do estoque e o filamento volta.

### Início do controle
Só movimentam o estoque as vendas com **data da venda a partir da data de início**, definida no rodapé das telas de estoque. Assim o histórico antigo não é descontado. Ao começar, lance o estoque atual como **Entrada** (filamentos) ou **Ajuste de inventário** (produtos).

## Componentes e estrutura do produto

Para produtos que levam algo além de filamento (tag NFC, parafusos, porcas, arruelas, ímãs, LEDs, argolas…):

1. **Estoque → Componentes → Entrada (compra):** escolha **+ Novo componente**, informe o nome, a categoria, como compra (ex.: pacote com 100), quantos pacotes e o valor pago. O sistema calcula o **custo por unidade** (ex.: R$ 12,00 ÷ 100 = R$ 0,12 por parafuso) e lança o estoque. Use **+ Cadastrar sem estoque** para só cadastrar.
2. **Na precificação**, abaixo das partes impressas, o quadro **Componentes** monta a estrutura da peça: adicione quantos componentes quiser, com a quantidade por peça. O custo entra no custo da peça (sem a taxa de perdas, que vale só para a impressão) e aparece linha a linha na *Composição do custo*.
3. **Produtos customizados:** no orçamento, clique em **Editar** no item para acrescentar ou tirar componentes só daquele orçamento. O catálogo continua como estava.
4. **Estoque:** ao aprovar o orçamento (item "Produzir") ou registrar uma produção, os componentes saem do estoque junto com o filamento. Itens atendidos "Do estoque" não consomem de novo. A tela mostra saldo, estoque mínimo (editável na tabela), consumo de 30 dias e valor em estoque. Abaixo do mínimo, o Dashboard avisa.

## SKU (código das peças) e catálogo

- Cada peça do catálogo tem um **SKU** e uma **categoria**. Se o campo SKU ficar em branco, o código é gerado ao salvar no formato **PREFIXO-MATERIAL-0001** (ex.: `RXR-PLA-0001`, `RXR-PETG-0004`). A numeração é sequencial e nunca repete. O prefixo pode ser alterado em *Parâmetros de custo*.
- Você também pode digitar o seu próprio SKU. O sistema converte para maiúsculas e bloqueia códigos repetidos.
- Peças salvas antes desta versão aparecem com o aviso **Gerar SKUs automaticamente** no Catálogo.
- No **Catálogo de peças**: busca por SKU, nome, categoria ou material; filtro por categoria; ordenação por SKU, nome, categoria ou preço; **Exportar CSV**; e **Catálogo em PDF**.
- O **Catálogo em PDF** é uma vitrine para enviar aos clientes, com foto, SKU, nome, material e preço, agrupada por categoria. Opções: título, mostrar ou ocultar preços e o canal do preço (ex.: os preços do Mercado Livre). Ele respeita os filtros da tela; por exemplo, filtre "Decoração" para gerar um catálogo só dessa categoria.
- O SKU acompanha a peça nos orçamentos: aparece abaixo da descrição na tela e no PDF, e a busca de orçamentos também encontra pelo SKU.

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
