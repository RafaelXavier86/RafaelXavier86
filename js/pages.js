/* Páginas: Painel (indicadores), Relatórios e Configurações / Backup. */
(function () {
  'use strict';
  const { el, badge, fmt, fmtDate } = UI;

  const monthStart = () => UI.today().slice(0, 8) + '01';

  // ---------- Painel ----------

  App.page('dashboard', {
    render(root) {
      const insp = Store.all('inspecoes');
      const mes = insp.filter((i) => (i.data || '') >= monthStart());
      const ok = mes.filter((i) => i.resultado === 'OK').length;
      const taxa = mes.length ? (100 * ok) / mes.length : null;
      const ncsAbertas = Store.all('ncs').filter((n) => n.status !== 'Fechada');
      const ncsAtraso = ncsAbertas.filter((n) => n.prazo && n.prazo < UI.today());
      const ppapPend = Store.all('ppap').filter((p) => p.statusPSW !== 'Aprovado');
      const fmeaH = Store.all('fmea').flatMap((f) => (f.itens || []).filter((i) => FMEA.ap(i) === 'H' && i.status !== 'Concluído' && i.status !== 'N/A'));
      const instr = Store.all('instrumentos').map(Instrumentos.status);
      const vencidos = instr.filter((s) => s === 'Vencido').length;
      const aVencer = instr.filter((s) => s === 'Vence em 30 dias').length;
      const spcBaixo = Store.all('spc').filter((s) => { const a = SPC.analyze(s); return a && a.cpk !== null && a.cpk < 1.33; });

      UI.add(root,
        App.pageHeader('Painel da Qualidade', `Visão geral — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`, [
          el('a', { class: 'btn btn-primary', href: '#/m/inspecoes/novo' }, '+ Nova inspeção'),
          el('a', { class: 'btn btn-secondary', href: '#/m/ncs/novo' }, '+ Nova NC / 8D'),
        ]),
        Store.isEmpty() ? el('div', { class: 'card welcome' },
          el('h2', null, 'Bem-vindo!'),
          el('p', null, 'Este sistema reúne as ferramentas do Core Tools (APQP, PPAP, FMEA, MSA, CEP/SPC e Plano de Controle) e os registros exigidos pela IATF 16949 — inspeções, não conformidades/8D e calibração.'),
          el('p', null, 'Comece cadastrando um Plano de Controle e lance as inspeções a partir dele, ou carregue dados de exemplo para conhecer o sistema.'),
          el('div', { class: 'page-actions' },
            el('button', { class: 'btn btn-primary', onclick: () => { Sample.load(); location.reload(); } }, 'Carregar dados de exemplo'),
            el('a', { class: 'btn btn-secondary', href: '#/m/planos/novo' }, 'Cadastrar Plano de Controle'))) : null,
        el('div', { class: 'kpis kpis-lg' },
          Common.kpi('Inspeções no mês', mes.length),
          Common.kpi('Taxa de aprovação (mês)', taxa === null ? '—' : `${fmt(taxa, 1)}%`, taxa === null ? 'neutral' : taxa >= 98 ? 'ok' : taxa >= 95 ? 'warn' : 'bad'),
          Common.kpi('NCs / 8D abertas', ncsAbertas.length, ncsAbertas.length ? 'warn' : 'ok', ncsAtraso.length ? `${ncsAtraso.length} com prazo vencido` : null),
          Common.kpi('PPAP não aprovados', ppapPend.length, ppapPend.length ? 'warn' : 'ok'),
          Common.kpi('Ações FMEA AP Alta abertas', fmeaH.length, fmeaH.length ? 'bad' : 'ok'),
          Common.kpi('Instrumentos vencidos', vencidos, vencidos ? 'bad' : 'ok', aVencer ? `${aVencer} vencem em 30 dias` : null),
          Common.kpi('Características com Cpk < 1,33', spcBaixo.length, spcBaixo.length ? 'bad' : 'ok')),
        el('div', { class: 'grid-2' },
          el('div', { class: 'card' }, el('h2', null, 'Últimas inspeções'),
            UI.table([
              { label: 'Nº', key: 'numero' },
              { label: 'Data', render: (r) => fmtDate(r.data) },
              { label: 'Peça', key: 'codigoPeca' },
              { label: 'Tipo', key: 'tipo' },
              { label: 'Resultado', render: (r) => (r.resultado ? badge(r.resultado, UI.levelOf(r.resultado)) : '—') },
            ], insp.sort((a, b) => String(b.data + b.hora).localeCompare(String(a.data + a.hora))).slice(0, 8), { onRow: (r) => App.go(`#/m/inspecoes/${r.id}`) })),
          el('div', { class: 'card' }, el('h2', null, 'NCs / 8D em aberto'),
            UI.table([
              { label: 'Nº', key: 'numero' },
              { label: 'Problema', key: 'titulo' },
              { label: 'Origem', key: 'origem' },
              { label: 'Dias', render: (r) => NCs.daysOpen(r) },
              { label: 'Status', render: (r) => badge(r.status, r.prazo && r.prazo < UI.today() ? 'bad' : 'warn') },
            ], ncsAbertas.slice(0, 8), { onRow: (r) => App.go(`#/m/ncs/${r.id}`), empty: 'Nenhuma NC em aberto.' }))));
    },
  });

  // ---------- Relatórios ----------

  const REPORTS = {
    inspecoes: { label: 'Inspeções de qualidade', render: reportInspecoes },
    ncs: { label: 'Não conformidades / 8D', render: (h, f) => reportGeneric(h, f, 'ncs', 'dataAbertura') },
    fmea: { label: 'FMEA — ações de AP Alta', render: reportFmea },
    spc: { label: 'Capabilidade de processo (CEP)', render: (h, f) => reportGeneric(h, f, 'spc', 'atualizadoEm') },
    msa: { label: 'Estudos de MSA', render: (h, f) => reportGeneric(h, f, 'msa', 'data') },
    instrumentos: { label: 'Calibração — situação dos instrumentos', render: (h, f) => reportGeneric(h, f, 'instrumentos', null) },
    ppap: { label: 'Situação dos PPAPs', render: (h, f) => reportGeneric(h, f, 'ppap', 'dataSubmissao') },
    apqp: { label: 'Andamento dos projetos APQP', render: (h, f) => reportGeneric(h, f, 'apqp', 'dataInicio') },
  };

  App.page('relatorios', {
    render(root, params) {
      const filters = { tipo: params[0] || 'inspecoes', de: monthStart(), ate: UI.today() };
      const holder = el('div');
      const draw = () => { holder.replaceChildren(); REPORTS[filters.tipo].render(holder, filters); };
      const fields = [
        { key: 'tipo', label: 'Relatório', type: 'select', options: Object.entries(REPORTS).map(([k, v]) => [k, v.label]), span: 2 },
        { key: 'de', label: 'De', type: 'date' },
        { key: 'ate', label: 'Até', type: 'date' },
      ];
      UI.add(root,
        App.pageHeader('Relatórios', 'Filtre o período, visualize indicadores e exporte para Excel (CSV) ou imprima / salve em PDF.'),
        el('div', { class: 'card' }, UI.formGrid(fields, filters, draw)),
        holder);
      draw();
    },
  });

  function inPeriod(value, f) {
    if (!value) return !f.de && !f.ate;
    const v = String(value).slice(0, 10);
    return (!f.de || v >= f.de) && (!f.ate || v <= f.ate);
  }

  function reportActions(title, content, csvFn) {
    return el('div', { class: 'page-actions report-actions' },
      el('button', { class: 'btn btn-secondary', onclick: csvFn }, 'Exportar CSV (Excel)'),
      el('button', { class: 'btn btn-primary', onclick: () => UI.printReport(title, content()) }, 'Imprimir / PDF'));
  }

  function periodLabel(f) {
    return `Período: ${f.de ? fmtDate(f.de) : 'início'} a ${f.ate ? fmtDate(f.ate) : 'hoje'}`;
  }

  function reportInspecoes(holder, f) {
    const all = Store.all('inspecoes').filter((r) => inPeriod(r.data, f));
    const opt = (k) => [...new Set(all.map((r) => r[k]).filter(Boolean))].sort();
    const sub = f.sub || (f.sub = {});
    const subFields = [
      { key: 'codigoPeca', label: 'Peça', type: 'select', options: opt('codigoPeca') },
      { key: 'cliente', label: 'Cliente', type: 'select', options: opt('cliente') },
      { key: 'tipo', label: 'Tipo de inspeção', type: 'select', options: opt('tipo') },
      { key: 'inspetor', label: 'Inspetor', type: 'select', options: opt('inspetor') },
      { key: 'resultado', label: 'Resultado', type: 'select', options: ['OK', 'NOK'] },
    ];
    const body = el('div');
    const draw = () => {
      const recs = all.filter((r) => subFields.every((sf) => !sub[sf.key] || r[sf.key] === sub[sf.key]))
        .sort((a, b) => String(a.data + a.hora).localeCompare(String(b.data + b.hora)));
      body.replaceChildren(inspecoesContent(recs, f, sub));
      body.prepend(reportActions('Relatório de Inspeções de Qualidade', () => inspecoesContent(recs, f, sub),
        () => { const { headers, rows } = App.module('inspecoes').csv(recs); UI.downloadCSV(`relatorio-inspecoes-${UI.today()}.csv`, headers, rows); }));
    };
    UI.add(holder, el('div', { class: 'card' }, el('h3', null, 'Filtros adicionais'), UI.formGrid(subFields, sub, draw)), body);
    draw();
  }

  function inspecoesContent(recs, f, sub) {
    const ok = recs.filter((r) => r.resultado === 'OK').length;
    const nok = recs.filter((r) => r.resultado === 'NOK').length;
    const inspec = recs.reduce((a, r) => a + (Calc.num(r.qtdInspecionada) || 0), 0);
    const reprov = recs.reduce((a, r) => a + (Calc.num(r.qtdReprovada) || 0), 0);
    const ppm = inspec ? (1e6 * reprov) / inspec : null;

    const nokChars = {};
    const byPart = {};
    recs.forEach((r) => {
      const p = byPart[r.codigoPeca || '—'] = byPart[r.codigoPeca || '—'] || { peca: r.codigoPeca || '—', desc: r.descricaoPeca || '', total: 0, ok: 0, nok: 0 };
      p.total++;
      if (r.resultado === 'OK') p.ok++;
      if (r.resultado === 'NOK') p.nok++;
      (r.caracteristicas || []).forEach((c) => {
        if (Inspecoes.rowResult(c) === 'NOK') {
          const k = `${r.codigoPeca || ''} · ${c.caracteristica || '(sem nome)'}`;
          nokChars[k] = (nokChars[k] || 0) + 1;
        }
      });
    });
    const pareto = Object.entries(nokChars).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const filtros = Object.entries(sub || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ');

    return el('div', { class: 'report' },
      el('div', { class: 'card' },
        el('h2', null, 'Relatório de Inspeções de Qualidade'),
        el('p', { class: 'muted' }, periodLabel(f), filtros ? ` · ${filtros}` : ''),
        el('div', { class: 'kpis' },
          Common.kpi('Inspeções', recs.length),
          Common.kpi('Aprovadas', ok, 'ok'),
          Common.kpi('Reprovadas', nok, nok ? 'bad' : 'neutral'),
          Common.kpi('Taxa de aprovação', recs.length ? `${fmt((100 * ok) / recs.length, 1)}%` : '—'),
          Common.kpi('Peças inspecionadas', fmt(inspec, 0)),
          Common.kpi('PPM reprovado', ppm === null ? '—' : fmt(ppm, 0), ppm === null ? 'neutral' : ppm > 0 ? 'warn' : 'ok'))),
      pareto.length ? el('div', { class: 'card' }, UI.pareto({ title: 'Pareto — características não conformes (ocorrências)', items: pareto })) : null,
      el('div', { class: 'card' }, el('h3', null, 'Resumo por peça'),
        UI.table([
          { label: 'Peça', key: 'peca' }, { label: 'Descrição', key: 'desc' }, { label: 'Inspeções', key: 'total' },
          { label: 'OK', key: 'ok' }, { label: 'NOK', key: 'nok' },
          { label: '% aprovação', render: (p) => `${fmt((100 * p.ok) / p.total, 1)}%` },
        ], Object.values(byPart))),
      el('div', { class: 'card' }, el('h3', null, 'Inspeções do período'),
        UI.table([
          { label: 'Nº', key: 'numero' }, { label: 'Data', render: (r) => `${fmtDate(r.data)} ${r.hora || ''}` }, { label: 'Tipo', key: 'tipo' },
          { label: 'Peça', key: 'codigoPeca' }, { label: 'Lote', key: 'lote' }, { label: 'Inspetor', key: 'inspetor' },
          { label: 'Carac. NOK', render: (r) => (r.caracteristicas || []).filter((c) => Inspecoes.rowResult(c) === 'NOK').map((c) => c.caracteristica).join(', ') || '—' },
          { label: 'Resultado', render: (r) => (r.resultado ? badge(r.resultado, UI.levelOf(r.resultado)) : '—') },
          { label: 'Disposição', key: 'disposicao' },
        ], recs, { onRow: (r) => App.go(`#/m/inspecoes/${r.id}`) })));
  }

  function reportFmea(holder, f) {
    const rows = [];
    Store.all('fmea').forEach((r) => (r.itens || []).forEach((i) => { if (FMEA.ap(i) === 'H') rows.push(Object.assign({ fmea: r }, i)); }));
    const content = () => el('div', { class: 'report' }, el('div', { class: 'card' },
      el('h2', null, 'FMEA — itens com Prioridade de Ação Alta'),
      el('div', { class: 'kpis' },
        Common.kpi('Itens AP Alta', rows.length, rows.length ? 'bad' : 'ok'),
        Common.kpi('Sem ação concluída', rows.filter((i) => i.status !== 'Concluído' && i.status !== 'N/A').length, 'warn'),
        Common.kpi('Ações atrasadas', rows.filter((i) => Common.isLate(i.prazo, i.status)).length, 'bad')),
      UI.table([
        { label: 'FMEA', render: (i) => i.fmea.numero }, { label: 'Etapa', key: 'etapa' }, { label: 'Modo de falha', key: 'modo' },
        { label: 'S', key: 's' }, { label: 'O', key: 'o' }, { label: 'D', key: 'd' }, { label: 'Ação', key: 'acao' },
        { label: 'Responsável', key: 'responsavel' }, { label: 'Prazo', render: (i) => fmtDate(i.prazo) },
        { label: 'Status', render: (i) => badge(i.status || 'Pendente', Common.isLate(i.prazo, i.status) ? 'bad' : UI.levelOf(i.status || 'Pendente')) },
      ], rows, { onRow: (i) => App.go(`#/m/fmea/${i.fmea.id}`), empty: 'Nenhum item com AP Alta.' })));
    UI.add(holder,
      reportActions('FMEA — AP Alta', content, () => {
        const { headers, rows: csvRows } = App.module('fmea').csv(Store.all('fmea'));
        const apIdx = headers.indexOf('AP');
        UI.downloadCSV(`relatorio-fmea-ap-alta-${UI.today()}.csv`, headers, csvRows.filter((r) => r[apIdx] === 'H'));
      }),
      content());
  }

  function reportGeneric(holder, f, modId, dateKey) {
    const mod = App.module(modId);
    const recs = Store.all(mod.collection).filter((r) => !dateKey || inPeriod(r[dateKey], f));
    const content = () => el('div', { class: 'report' }, el('div', { class: 'card' },
      el('h2', null, REPORTS[modId].label),
      el('p', { class: 'muted' }, dateKey ? periodLabel(f) : 'Todos os registros', ` · ${recs.length} registro(s)`),
      UI.table(mod.listColumns, recs, { onRow: (r) => App.go(`#/m/${modId}/${r.id}`) })));
    UI.add(holder,
      reportActions(REPORTS[modId].label, content, () => App.exportCSV(mod, recs)),
      content());
  }

  // ---------- Configurações e backup ----------

  App.page('config', {
    render(root) {
      const s = Store.settings();
      const file = el('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
      file.addEventListener('change', () => {
        const f = file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try { Store.importAll(reader.result); UI.toast('Backup restaurado.'); setTimeout(() => location.reload(), 600); } catch (e) { UI.toast(e.message, 'bad'); }
        };
        reader.readAsText(f);
      });
      UI.add(root,
        App.pageHeader('Configurações e backup', 'Os dados ficam salvos neste navegador. Faça backups periódicos.'),
        el('div', { class: 'card' },
          el('h2', null, 'Dados da organização'),
          UI.formGrid([
            { key: 'empresa', label: 'Nome da empresa (aparece nos relatórios)', span: 2 },
            { key: 'planta', label: 'Planta / Unidade' },
            { key: 'inspetor', label: 'Inspetor padrão' },
          ], s, () => {}),
          el('div', { class: 'page-actions' }, el('button', {
            class: 'btn btn-primary',
            onclick: () => { Store.saveSettings(s); document.getElementById('brand-company').textContent = s.empresa || ''; UI.toast('Configurações salvas.'); },
          }, 'Salvar configurações'))),
        el('div', { class: 'card' },
          el('h2', null, 'Backup'),
          el('p', null, 'Exporte todos os registros para um arquivo JSON e restaure-o neste ou em outro computador.'),
          el('div', { class: 'page-actions left' },
            el('button', { class: 'btn btn-primary', onclick: () => UI.download(`backup-qualidade-${UI.today()}.json`, Store.exportAll(), 'application/json') }, 'Exportar backup'),
            el('button', { class: 'btn btn-secondary', onclick: () => file.click() }, 'Restaurar backup'),
            file)),
        el('div', { class: 'card' },
          el('h2', null, 'Dados de exemplo e limpeza'),
          el('div', { class: 'page-actions left' },
            el('button', { class: 'btn btn-secondary', onclick: () => { Sample.load(); UI.toast('Dados de exemplo adicionados.'); } }, 'Adicionar dados de exemplo'),
            el('button', { class: 'btn btn-danger', onclick: () => UI.confirm('Apagar TODOS os registros deste navegador? Faça um backup antes.', () => { Store.clear(); UI.toast('Dados apagados.'); }) }, 'Apagar todos os dados'))));
    },
  });
})();
