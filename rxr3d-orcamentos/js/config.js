/* RXR 3D — parâmetros de custo, taxas de marketplace, dados da empresa e backup. */
(function () {
  'use strict';
  const { h } = UI;
  const n = Calc.n;

  // ---------------------------------------------------------------- parâmetros de custo
  const PARAM_FIELDS = [
    { type: 'section', label: 'Custos de produção' },
    { key: 'tarifaKwh', label: 'Tarifa de energia', type: 'money', suffix: '/kWh', span: 1, help: 'Valor total da conta ÷ kWh consumidos (com impostos e bandeira).' },
    { key: 'vidaUtilH', label: 'Vida útil padrão do equipamento', type: 'num', suffix: 'h', span: 1, help: 'Usada na depreciação: valor de compra ÷ vida útil.' },
    { key: 'manutencaoH', label: 'Manutenção por hora', type: 'money', suffix: '/h', span: 1, help: 'Bicos, correias, PEI, graxa… ÷ horas.' },
    { key: 'taxaFalha', label: 'Taxa de perdas / falhas', type: 'pct', span: 1, help: 'Acrescida ao custo de produção.' },
    { key: 'custoFixoMensal', label: 'Custos fixos mensais', type: 'money', span: 1, help: 'Aluguel, internet, softwares, pró-labore… (opcional).' },
    { key: 'horasMes', label: 'Horas de impressão por mês', type: 'num', suffix: 'h', span: 1, help: 'Para ratear os custos fixos por hora.' },
    { key: 'imposto', label: 'Imposto sobre a venda', type: 'pct', span: 1, help: 'Ex.: alíquota do Simples Nacional. MEI: 0.' },
    { type: 'section', label: 'Precificação' },
    { key: 'acabamentoPct', label: 'Acréscimo por acabamento', type: 'pct', span: 1 },
    { key: 'projetoPct', label: 'Acréscimo por projeto customizado', type: 'pct', span: 1 },
    { key: 'margemPadrao', label: 'Margem padrão', type: 'pct', span: 1, help: 'Sugerida em cada nova composição.' },
  ];
  const ORC_FIELDS = [
    { key: 'validadeDias', label: 'Validade do orçamento', type: 'num', suffix: 'dias', span: 1 },
    { key: 'condicoes', label: 'Condições padrão (saem no PDF)', type: 'textarea', rows: 4, span: 4 },
  ];

  function parametros() {
    const s = Store.settings();
    const f1 = UI.form(PARAM_FIELDS, s.params);
    const f2 = UI.form(ORC_FIELDS, s.orcamento);
    const info = h('div', { class: 'alert info' });
    const atualiza = () => {
      const p = UI.readForm(f1, PARAM_FIELDS);
      info.textContent = 'Custo fixo rateado: ' + UI.brl(Calc.custoFixoHora(p)) + ' por hora de impressão.';
    };
    f1.addEventListener('input', atualiza);
    atualiza();
    const salvar = () => {
      const st = Store.settings();
      st.params = Object.assign(st.params, UI.readForm(f1, PARAM_FIELDS));
      st.orcamento = Object.assign(st.orcamento, UI.readForm(f2, ORC_FIELDS));
      Store.setSettings({ params: st.params, orcamento: st.orcamento });
      UI.toast('Parâmetros salvos. Novas composições já usam os valores atualizados.');
    };
    return h('div', null,
      UI.pageHead('Parâmetros de custo', 'Valores usados em todas as composições de preço. Orçamentos já emitidos guardam os valores da época.',
        h('button', { class: 'btn primary', onclick: salvar }, 'Salvar')),
      h('div', { class: 'card' }, f1, info),
      h('div', { class: 'card' }, h('h3', null, 'Orçamentos'), f2));
  }

  // ---------------------------------------------------------------- marketplaces
  function marketplaces() {
    let canais = Store.settings().canais;
    const lista = h('div');
    const salvar = () => { Store.setSettings({ canais }); UI.toast('Taxas salvas.'); };

    const render = () => {
      lista.replaceChildren(...canais.map((c, ci) => {
        const faixasBody = h('tbody');
        const renderFaixas = () => {
          faixasBody.replaceChildren(...c.faixas.map((f, fi) => h('tr', null,
            h('td', null, h('div', { class: 'affix' }, h('span', null, 'até R$'),
              h('input', { type: 'text', inputmode: 'decimal', placeholder: 'sem limite', value: f.ate === null || f.ate === '' ? '' : UI.inNum(f.ate, 2), oninput: (e) => { f.ate = e.target.value.trim() === '' ? null : n(e.target.value); } }))),
            h('td', null, h('div', { class: 'affix' }, h('input', { type: 'text', inputmode: 'decimal', value: UI.inNum(f.comissao), oninput: (e) => { f.comissao = n(e.target.value); } }), h('span', null, '%'))),
            h('td', null, h('div', { class: 'affix' }, h('span', null, 'R$'), h('input', { type: 'text', inputmode: 'decimal', value: UI.inNum(f.fixa, 2), oninput: (e) => { f.fixa = n(e.target.value); } }))),
            h('td', null, c.faixas.length > 1 ? h('button', { class: 'btn-icon', 'aria-label': 'Remover faixa', onclick: () => { c.faixas.splice(fi, 1); renderFaixas(); } }, '✕') : null))));
        };
        renderFaixas();
        return h('div', { class: 'card canal' + (c.ativo ? '' : ' off') },
          h('div', { class: 'card-head' },
            h('input', { type: 'text', class: 'title-input', value: c.nome, 'aria-label': 'Nome do canal', oninput: (e) => { c.nome = e.target.value; } }),
            h('label', { class: 'check-label' }, h('input', { type: 'checkbox', checked: c.ativo, onchange: (e) => { c.ativo = e.target.checked; render(); } }), ' Ativo'),
            c.id !== 'direto' ? h('button', { class: 'btn small ghost-danger', onclick: () => UI.confirm('Remover o canal "' + c.nome + '"?', () => { canais.splice(ci, 1); render(); }, 'Remover') }, 'Remover') : null),
          h('table', { class: 'table compact faixas' },
            h('thead', null, h('tr', null, h('th', null, 'Faixa de preço unitário'), h('th', null, 'Comissão'), h('th', null, 'Taxa fixa por unidade'), h('th', null, ''))),
            faixasBody),
          h('div', { class: 'inline-group' },
            h('button', { class: 'btn small', onclick: () => { c.faixas.push({ ate: null, comissao: c.faixas.length ? c.faixas[c.faixas.length - 1].comissao : 0, fixa: 0 }); renderFaixas(); } }, '+ Faixa'),
            h('label', { class: 'inline' }, 'Teto da comissão por unidade: R$ ',
              h('input', { type: 'text', inputmode: 'decimal', class: 'money-in', placeholder: 'sem teto', value: n(c.teto) ? UI.inNum(c.teto, 2) : '', oninput: (e) => { c.teto = n(e.target.value); } }))),
          h('textarea', { rows: 2, class: 'obs', placeholder: 'Anotações sobre este canal', oninput: (e) => { c.obs = e.target.value; } }, c.obs || ''));
      }));
    };
    render();
    return h('div', null,
      UI.pageHead('Marketplaces', 'Comissões e taxas por canal. A precificação calcula o preço que mantém sua margem depois das taxas.',
        h('button', { class: 'btn', onclick: () => { canais.push({ id: Store.uid(), nome: 'Novo canal', ativo: true, teto: 0, obs: '', faixas: [{ ate: null, comissao: 0, fixa: 0 }] }); render(); } }, '+ Canal'),
        h('button', { class: 'btn', onclick: () => UI.confirm('Restaurar as taxas de referência? Suas alterações nesta tela serão perdidas.', () => { canais = JSON.parse(JSON.stringify(Store.CANAIS_PADRAO)); Store.setSettings({ canais }); render(); }, 'Restaurar') }, 'Restaurar padrão'),
        h('button', { class: 'btn primary', onclick: salvar }, 'Salvar')),
      h('div', { class: 'alert warn' }, 'As taxas das plataformas mudam com frequência e variam por categoria, tipo de anúncio e tipo de conta (CPF/CNPJ). Os valores iniciais são apenas referência: confira na central do vendedor e ajuste aqui. As faixas usam o preço unitário de venda; a taxa da faixa vale para preços abaixo do limite.'),
      lista);
  }

  // ---------------------------------------------------------------- empresa e backup
  const EMP_FIELDS = [
    { key: 'nome', label: 'Nome da empresa', required: true, span: 2, help: 'Se contiver "3D", essa parte sai em laranja no PDF.' },
    { key: 'documento', label: 'CNPJ (opcional)', type: 'doc', span: 2 },
    { key: 'endereco', label: 'Endereço', span: 2, placeholder: 'Rua, número' },
    { key: 'cidade', label: 'Bairro, cidade - UF', span: 2 },
    { key: 'telefone', label: 'Telefone / WhatsApp', type: 'fone', span: 1 },
    { key: 'email', label: 'E-mail', span: 2 },
    { key: 'site', label: 'Site / Instagram', span: 1 },
  ];

  function config() {
    const s = Store.settings();
    const fe = UI.form(EMP_FIELDS, s.empresa);
    const salvarEmp = () => {
      if (!UI.validate(fe, EMP_FIELDS)) return;
      Store.setSettings({ empresa: Object.assign(Store.settings().empresa, UI.readForm(fe, EMP_FIELDS)) });
      UI.toast('Dados da empresa salvos.');
    };
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const txt = await f.text();
      UI.confirm('Restaurar o backup "' + f.name + '"? Todos os dados atuais serão substituídos.', () => {
        (async () => {
          try {
            const imagens = Store.importJSON(txt);
            if (imagens) await Imagens.substituirTodas(imagens);
            UI.toast('Backup restaurado.'); App.go('#/dashboard');
          } catch (err) { UI.toast('Falha ao restaurar: ' + err.message, 'bad'); }
        })();
      }, 'Restaurar');
      fileIn.value = '';
    } });
    const contagem = ['clientes', 'filamentos', 'equipamentos', 'embalagens', 'pecas', 'orcamentos'].map((k) => Store.all(k).length);
    const kb = Store.usage() * 2 / 1024;
    const imgInfo = h('p', { class: 'muted' });
    Imagens.todas().then((m) => {
      const v = Object.values(m);
      imgInfo.textContent = 'Imagens dos produtos: ' + v.length + ' arquivo(s), ' + UI.num(v.reduce((s, x) => s + x.length, 0) * 0.75 / 1024 / 1024, 1) + ' MB.';
    }).catch(() => { imgInfo.textContent = 'Este navegador bloqueou o banco de imagens (IndexedDB).'; });
    return h('div', null,
      UI.pageHead('Configurações', 'Dados da empresa para o PDF e cópias de segurança.', h('button', { class: 'btn primary', onclick: salvarEmp }, 'Salvar empresa')),
      h('div', { class: 'card' }, h('h3', null, 'Empresa (cabeçalho do orçamento)'), fe),
      h('div', { class: 'card' },
        h('h3', null, 'Backup e histórico'),
        h('p', null, 'Os dados ficam salvos neste navegador, neste computador (' + contagem[5] + ' orçamentos, ' + contagem[0] + ' clientes, ' + contagem[4] + ' peças no catálogo · ' + UI.num(kb, 0) + ' KB). ',
          'Faça um backup periodicamente e guarde o arquivo em outro lugar (pendrive, Google Drive, OneDrive). Limpar os dados de navegação do navegador apaga o histórico.'),
        h('p', { class: 'muted' }, 'Último backup: ' + (s.ultimoBackup ? new Date(s.ultimoBackup).toLocaleString('pt-BR') : 'nunca')),
        h('div', { class: 'inline-group' },
          h('button', { class: 'btn primary', onclick: async () => {
            const imagens = await Imagens.todas().catch(() => ({}));
            UI.download('backup_rxr3d_' + UI.today() + '.json', Store.exportJSON(imagens));
            UI.toast('Backup gerado (' + Object.keys(imagens).length + ' imagens incluídas).');
          } }, 'Baixar backup (.json)'),
          h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Restaurar backup…'), fileIn,
          h('button', { class: 'btn', onclick: async () => {
            const r = await Imagens.limpar();
            UI.toast(r.n ? r.n + ' imagem(ns) sem uso removida(s) (' + UI.num(r.bytes / 1024 / 1024 * 0.75, 1) + ' MB).' : 'Nenhuma imagem sem uso.');
          } }, 'Limpar imagens sem uso')),
        imgInfo),
      h('div', { class: 'card' },
        h('h3', null, 'Dados de exemplo'),
        h('p', null, 'Carrega filamentos, uma impressora, embalagens, clientes, peças e vendas fictícias dos últimos meses para conhecer o sistema. Os dados atuais são substituídos.'),
        h('div', { class: 'inline-group' },
          h('button', { class: 'btn', onclick: () => UI.confirm('Substituir todos os dados pelos dados de exemplo?', () => { Sample.load(); UI.toast('Dados de exemplo carregados.'); App.go('#/dashboard'); }, 'Carregar') }, 'Carregar dados de exemplo'),
          h('button', { class: 'btn ghost-danger', onclick: () => UI.confirm('Apagar TODOS os dados deste sistema? Faça um backup antes.', async () => { Store.reset(); await Imagens.substituirTodas({}); UI.toast('Dados apagados.'); App.go('#/dashboard'); }, 'Apagar tudo') }, 'Apagar todos os dados'))));
  }

  window.Config = { parametros, marketplaces, config };
})();
