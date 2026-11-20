/*
 * RXR 3D — imagens dos produtos.
 * Ficam no IndexedDB do navegador (sem o limite de ~5 MB do localStorage),
 * já reduzidas e comprimidas, e entram no backup junto com os demais dados.
 */
(function () {
  'use strict';
  const { h } = UI;
  const DB = 'rxr3d-imagens';
  const STORE = 'imagens';
  const MAX = 1000;        // maior lado em pixels
  const QUALIDADE = 0.85;  // JPEG
  const cache = new Map();

  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const st = t.objectStore(STORE);
      const req = fn(st);
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  /** Reduz a imagem e devolve um data URL JPEG (fundo branco onde houver transparência). */
  function comprimir(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('O arquivo não é uma imagem.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * s));
        const hh = Math.max(1, Math.round(img.naturalHeight * s));
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, hh);
        ctx.drawImage(img, 0, 0, w, hh);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', QUALIDADE));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
      img.src = url;
    });
  }

  const Imagens = {
    async salvar(file) {
      const data = await comprimir(file);
      const id = 'img_' + Store.uid();
      await tx('readwrite', (st) => st.put(data, id));
      cache.set(id, data);
      return id;
    },
    async get(id) {
      if (!id) return null;
      if (cache.has(id)) return cache.get(id);
      try {
        const data = await tx('readonly', (st) => st.get(id));
        if (data) cache.set(id, data);
        return data || null;
      } catch (e) { return null; }
    },
    async getMany(ids) {
      const out = {};
      await Promise.all([...new Set(ids.filter(Boolean))].map(async (id) => { out[id] = await Imagens.get(id); }));
      return out;
    },
    async remover(id) {
      cache.delete(id);
      await tx('readwrite', (st) => st.delete(id));
    },
    async todas() {
      const d = await db();
      return new Promise((resolve, reject) => {
        const out = {};
        const req = d.transaction(STORE).objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (cur) { out[cur.key] = cur.value; cur.continue(); } else resolve(out);
        };
        req.onerror = () => reject(req.error);
      });
    },
    async substituirTodas(mapa) {
      cache.clear();
      await tx('readwrite', (st) => st.clear());
      const entries = Object.entries(mapa || {});
      if (entries.length) await tx('readwrite', (st) => { entries.forEach(([k, v]) => st.put(v, k)); });
    },
    /** Ids referenciados por peças do catálogo e itens de orçamento. */
    usadas() {
      const ids = new Set();
      Store.all('pecas').forEach((p) => p.input && p.input.imagemId && ids.add(p.input.imagemId));
      Store.all('orcamentos').forEach((o) => o.itens.forEach((i) => {
        if (i.imagemId) ids.add(i.imagemId);
        if (i.input && i.input.imagemId) ids.add(i.input.imagemId);
      }));
      return ids;
    },
    /** Apaga imagens que não estão em nenhuma peça ou orçamento. */
    async limpar() {
      const usadas = Imagens.usadas();
      const todas = await Imagens.todas();
      let n = 0, bytes = 0;
      for (const [id, v] of Object.entries(todas)) {
        if (!usadas.has(id)) { await Imagens.remover(id); n++; bytes += v.length; }
      }
      return { n, bytes };
    },

    /**
     * Campo de imagem: miniatura + botões Anexar/Trocar/Remover.
     * Não apaga a imagem antiga do banco (pode estar em uso em outro orçamento).
     */
    campo(imagemId, onChange, { label = 'Imagem do produto (sai no PDF)' } = {}) {
      let atual = imagemId || '';
      const thumb = h('div', { class: 'img-thumb' });
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const btnAdd = h('button', { type: 'button', class: 'btn small' });
      const btnDel = h('button', { type: 'button', class: 'btn small ghost-danger' }, 'Remover');
      const render = async () => {
        btnAdd.textContent = atual ? 'Trocar imagem' : 'Anexar imagem';
        btnDel.hidden = !atual;
        const data = await Imagens.get(atual);
        thumb.replaceChildren(data ? h('img', { src: data, alt: 'Imagem do produto' }) : h('span', null, atual ? 'imagem não encontrada' : 'sem imagem'));
        thumb.classList.toggle('vazia', !data);
      };
      const usarArquivo = async (f) => {
        if (!f) return;
        try {
          atual = await Imagens.salvar(f);
          await render();
          onChange(atual);
        } catch (e) { UI.toast(e.message, 'bad'); }
      };
      btnAdd.addEventListener('click', () => file.click());
      thumb.addEventListener('click', () => file.click());
      file.addEventListener('change', () => { usarArquivo(file.files[0]); file.value = ''; });
      btnDel.addEventListener('click', () => { atual = ''; render(); onChange(''); });
      // arrastar e soltar
      thumb.addEventListener('dragover', (e) => { e.preventDefault(); thumb.classList.add('drop'); });
      thumb.addEventListener('dragleave', () => thumb.classList.remove('drop'));
      thumb.addEventListener('drop', (e) => { e.preventDefault(); thumb.classList.remove('drop'); usarArquivo(e.dataTransfer.files[0]); });
      render();
      return h('div', { class: 'img-field' },
        h('label', null, label),
        h('div', { class: 'img-row' }, thumb,
          h('div', { class: 'img-actions' }, btnAdd, btnDel, file,
            h('small', { class: 'help' }, 'JPG ou PNG. Clique ou arraste a foto para o quadro. A imagem é reduzida automaticamente.'))));
    },
  };

  window.Imagens = Imagens;
})();

/* Miniatura assíncrona para listas e tabelas. */
(function () {
  'use strict';
  Imagens.mini = function (id, onClick) {
    const box = UI.h('span', { class: 'mini-thumb' + (id ? '' : ' vazia') + (onClick ? ' clicavel' : ''), title: onClick ? (id ? 'Trocar imagem' : 'Anexar imagem') : null });
    if (onClick) box.addEventListener('click', onClick);
    if (id) Imagens.get(id).then((d) => { if (d) box.replaceChildren(UI.h('img', { src: d, alt: '' })); else box.classList.add('vazia'); });
    else if (onClick) box.textContent = '+';
    return box;
  };
})();
