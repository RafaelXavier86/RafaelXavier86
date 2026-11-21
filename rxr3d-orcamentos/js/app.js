/* RXR 3D — navegação e inicialização. */
(function () {
  'use strict';
  const { h } = UI;

  const NAV = [
    { group: null, items: [['#/dashboard', 'Dashboard', '▦']] },
    { group: 'Precificação', items: [['#/precificacao', 'Calcular preço', '＄'], ['#/pecas', 'Catálogo de peças', '◫']] },
    { group: 'Estoque', items: [['#/filamentos', 'Filamentos', '◉'], ['#/estoque-produtos', 'Produtos acabados', '▤']] },
    { group: 'Vendas', items: [['#/orcamentos', 'Orçamentos', '≡'], ['#/clientes', 'Clientes', '☺']] },
    { group: 'Custos', items: [['#/equipamentos', 'Equipamentos', '⎙'], ['#/embalagens', 'Embalagens', '▣'], ['#/parametros', 'Parâmetros de custo', '⚙']] },
    { group: 'Sistema', items: [['#/marketplaces', 'Marketplaces', '⇄'], ['#/config', 'Configurações e backup', '⛁']] },
  ];

  function route() {
    const hash = location.hash || '#/dashboard';
    const [, base, id] = hash.split('/');
    switch (base) {
      case 'precificacao': return Precificacao.page(id);
      case 'pecas': return Precificacao.catalogo();
      case 'filamentos': case 'estoque-filamentos': return Estoque.filamentosPage();
      case 'estoque-produtos': return Estoque.produtosPage();
      case 'orcamentos': return id ? Orcamentos.editor(id) : Orcamentos.lista();
      case 'clientes': case 'equipamentos': case 'embalagens': return Cadastros.page(base);
      case 'parametros': return Config.parametros();
      case 'marketplaces': return Config.marketplaces();
      case 'config': return Config.config();
      default: return Dashboard.page();
    }
  }

  function renderNav() {
    let cur = '#/' + ((location.hash || '#/dashboard').split('/')[1] || 'dashboard');
    if (cur === '#/estoque-filamentos') cur = '#/filamentos';
    const nav = document.getElementById('nav');
    nav.replaceChildren(...NAV.map((g) => h('div', { class: 'nav-group' },
      g.group ? h('span', { class: 'nav-title' }, g.group) : null,
      g.items.map(([href, label, ico]) => h('a', { href, class: href === cur ? 'active' : null, 'aria-current': href === cur ? 'page' : null },
        h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), label)))));
  }

  function render() {
    renderNav();
    const main = document.getElementById('main');
    main.replaceChildren(route());
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    document.body.classList.remove('nav-open');
    document.getElementById('brand-company').textContent = Store.settings().empresa.nome;
  }

  window.App = { go(hash) { if (location.hash === hash) render(); else location.hash = hash; }, render };

  window.addEventListener('hashchange', render);
  document.getElementById('menu-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  render();
})();
