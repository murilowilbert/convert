/* ============================================
   CONVERT APP — PDF Tools Module
   Merge and Split PDF functionality
   ============================================ */

const PdfTools = {
  mergeFiles: [],
  splitFile: null,
  splitPageCount: 0,
  draggedItem: null,

  init() {
    this.setupMergeSection();
    this.setupSplitSection();
  },

  /* ==========================================
     MERGE PDF
     ========================================== */

  setupMergeSection() {
    const btnMerge = document.getElementById('btn-merge-pdf');
    if (btnMerge) {
      btnMerge.addEventListener('click', () => this.handleMerge());
    }

    const sizeOpts = document.querySelectorAll('#page-size-options-merge .page-size-option');
    sizeOpts.forEach(opt => {
      opt.addEventListener('click', () => {
        sizeOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.updateMergePreview();
      });
    });

    const numOpts = document.querySelectorAll('#page-number-options-merge .page-size-option');
    numOpts.forEach(opt => {
      opt.addEventListener('click', () => {
        numOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.updateMergePreview();
      });
    });
  },

  onMergeFilesAdded() {
    const files = FileManager.getSectionFiles('merge-pdf');
    this.mergeFiles = [...files];

    const sortableContainer = document.getElementById('sortable-merge-pdf');
    const workspace = document.getElementById('workspace-merge-pdf');
    const results = document.getElementById('results-merge-pdf');

    if (results) results.style.display = 'none';

    if (this.mergeFiles.length === 0) {
      if (sortableContainer) sortableContainer.style.display = 'none';
      if (workspace) workspace.style.display = 'none';
      return;
    }

    if (sortableContainer) sortableContainer.style.display = 'block';
    if (workspace) workspace.style.display = 'flex';

    this.renderSortableList();
    this.updateMergeCount();
    this.updateMergePreview();
  },

  renderSortableList() {
    const list = document.getElementById('sortable-list-merge-pdf');
    if (!list) return;

    list.innerHTML = '';

    this.mergeFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.className = 'sortable-item';
      li.dataset.fileId = file.id;
      li.draggable = true;
      li.id = 'sortable-item-' + file.id;

      li.innerHTML =
        '<span class="drag-handle" title="Arrastar para reordenar">⠿</span>' +
        '<span class="item-number">' + (index + 1) + '</span>' +
        '<span class="item-name" title="' + file.name + '">' + file.name + '</span>' +
        '<span class="item-size">' + App.formatFileSize(file.size) + '</span>' +
        '<button class="item-remove" type="button" title="Remover">&times;</button>';

      /* Remove button */
      const removeBtn = li.querySelector('.item-remove');
      removeBtn.addEventListener('click', () => {
        this.removeMergeFile(file.id);
      });

      /* Drag events */
      li.addEventListener('dragstart', (e) => {
        this.draggedItem = li;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', file.id);
      });

      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        this.draggedItem = null;
        list.querySelectorAll('.sortable-item').forEach(item => {
          item.classList.remove('drag-over-item');
        });
        this.updateMergeOrder();
      });

      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this.draggedItem && this.draggedItem !== li) {
          li.classList.add('drag-over-item');
        }
      });

      li.addEventListener('dragleave', () => {
        li.classList.remove('drag-over-item');
      });

      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over-item');
        if (this.draggedItem && this.draggedItem !== li) {
          const allItems = Array.from(list.querySelectorAll('.sortable-item'));
          const fromIdx = allItems.indexOf(this.draggedItem);
          const toIdx = allItems.indexOf(li);

          if (fromIdx < toIdx) {
            list.insertBefore(this.draggedItem, li.nextSibling);
          } else {
            list.insertBefore(this.draggedItem, li);
          }
        }
      });

      list.appendChild(li);
    });
  },

  removeMergeFile(fileId) {
    this.mergeFiles = this.mergeFiles.filter(f => f.id !== fileId);
    FileManager.removeFile(fileId, 'merge-pdf');

    const item = document.getElementById('sortable-item-' + fileId);
    if (item) {
      item.style.transition = 'all 0.3s ease';
      item.style.opacity = '0';
      item.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        item.remove();
        this.updateMergeOrder();
        this.updateMergeCount();
      }, 300);
    }

    if (this.mergeFiles.length === 0) {
      const sortableContainer = document.getElementById('sortable-merge-pdf');
      const actionBar = document.getElementById('action-bar-merge-pdf');
      if (sortableContainer) sortableContainer.style.display = 'none';
      if (actionBar) actionBar.style.display = 'none';
    }
  },

  updateMergeOrder() {
    const list = document.getElementById('sortable-list-merge-pdf');
    if (!list) return;

    const items = list.querySelectorAll('.sortable-item');
    const newOrder = [];

    items.forEach((item, index) => {
      const fileId = item.dataset.fileId;
      const file = this.mergeFiles.find(f => f.id === fileId);
      if (file) newOrder.push(file);

      const numEl = item.querySelector('.item-number');
      if (numEl) numEl.textContent = index + 1;
    });

    this.mergeFiles = newOrder;
  },

  updateMergeCount() {
    const countEl = document.getElementById('merge-count');
    if (countEl) {
      countEl.textContent = this.mergeFiles.length + ' PDF(s) para juntar';
    }

    const btn = document.getElementById('btn-merge-pdf');
    if (btn) {
      btn.disabled = this.mergeFiles.length < 2;
    }
  },

  async handleMerge() {
    if (this.mergeFiles.length < 2) {
      App.showToast('Adicione pelo menos 2 PDFs para juntar', 'warning');
      return;
    }

    this.updateMergeOrder();
    const fileIds = this.mergeFiles.map(f => f.id);

    const btn = document.getElementById('btn-merge-pdf');
    if (btn) btn.disabled = true;

    FloatingProgressWidget.show('Juntando PDFs...');

    try {
      const data = await App.api('/api/pdf/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: fileIds })
      });

      const results = data.file ? [data.file] : (data.files || [data]);
      Converter.showResults('merge-pdf', results);

      /* Save to history */
      if (typeof History !== 'undefined') {
        const inputFiles = this.mergeFiles.map(f => ({ id: f.id, name: f.name, size: f.size }));
        const outputFiles = results.map(f => ({
          id: f.id || f.fileId,
          name: f.name || f.originalName || 'documentos_mesclados.pdf',
          size: f.size || 0,
          path: f.path || f.outputPath || ''
        }));
        History.addEntry('Juntar PDFs', inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('PDFs combinados com sucesso!', results);
    } catch (err) {
      App.showToast('Erro ao juntar PDFs: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro ao juntar PDFs: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
      this.updateMergeCount();
    }
  },

  /* ==========================================
     SPLIT PDF
     ========================================== */

  setupSplitSection() {
    /* Split mode options */
    const modeOptions = document.querySelectorAll('#split-mode-options .page-size-option');
    modeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        modeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.updateSplitModeUI(opt.dataset.value);
        this.updateSplitPreview();
      });
    });

    const startPage = document.getElementById('split-start-page');
    const endPage = document.getElementById('split-end-page');
    const specificPages = document.getElementById('split-specific-pages');

    if (startPage) startPage.addEventListener('input', () => this.updateSplitPreview());
    if (endPage) endPage.addEventListener('input', () => this.updateSplitPreview());
    if (specificPages) specificPages.addEventListener('input', () => this.updateSplitPreview());

    /* Split button */
    const btnSplit = document.getElementById('btn-split-pdf');
    if (btnSplit) {
      btnSplit.addEventListener('click', () => this.handleSplit());
    }
  },

  updateSplitModeUI(mode) {
    const rangeControls = document.getElementById('split-range-controls');
    const specificControls = document.getElementById('split-specific-controls');

    if (rangeControls) rangeControls.style.display = mode === 'range' ? 'flex' : 'none';
    if (specificControls) specificControls.style.display = mode === 'specific' ? 'flex' : 'none';
  },

  async onSplitFileAdded() {
    const files = FileManager.getSectionFiles('split-pdf');

    const workspace = document.getElementById('workspace-split-pdf');
    const results = document.getElementById('results-split-pdf');

    if (results) results.style.display = 'none';

    if (files.length === 0) {
      this.splitFile = null;
      this.splitPageCount = 0;
      if (workspace) workspace.style.display = 'none';
      return;
    }

    this.splitFile = files[0];

    if (workspace) workspace.style.display = 'flex';

    const infoEl = document.getElementById('pdf-info-split');
    if (infoEl) {
      infoEl.textContent = this.splitFile.name + ' — carregando...';
    }

    /* Get page count */
    try {
      const data = await App.api('/api/pdf/page-count?fileId=' + this.splitFile.id);
      this.splitPageCount = data.pageCount || 0;
      if (infoEl) {
        infoEl.textContent = this.splitFile.name + ' — ' + this.splitPageCount + ' página(s)';
      }
      const endPage = document.getElementById('split-end-page');
      if (endPage) {
        endPage.placeholder = this.splitPageCount;
        endPage.max = this.splitPageCount;
        endPage.value = this.splitPageCount;
      }
      const startPage = document.getElementById('split-start-page');
      if (startPage) {
        startPage.value = 1;
      }
    } catch (err) {
      if (infoEl) {
        infoEl.textContent = this.splitFile.name;
      }
    }

    const btn = document.getElementById('btn-split-pdf');
    if (btn) btn.disabled = false;

    this.updateSplitPreview();
  },

  async handleSplit() {
    if (!this.splitFile) {
      App.showToast('Adicione um arquivo PDF primeiro', 'warning');
      return;
    }

    const modeActive = document.querySelector('#split-mode-options .page-size-option.active');
    const mode = modeActive ? modeActive.dataset.value : 'all';

    let splitConfig = { mode: mode };

    if (mode === 'range') {
      const startPage = parseInt(document.getElementById('split-start-page').value) || 1;
      const endPage = parseInt(document.getElementById('split-end-page').value) || this.splitPageCount;
      splitConfig.startPage = startPage;
      splitConfig.endPage = endPage;
    } else if (mode === 'specific') {
      const pages = document.getElementById('split-specific-pages').value.trim();
      if (!pages) {
        App.showToast('Informe as páginas a serem extraídas', 'warning');
        return;
      }
      splitConfig.pages = pages;
    }

    const btn = document.getElementById('btn-split-pdf');
    if (btn) btn.disabled = true;

    FloatingProgressWidget.show('Dividindo PDF...');

    try {
      const data = await App.api('/api/pdf/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: this.splitFile.id,
          ...splitConfig
        })
      });

      const results = data.files || data.pages || (data.file ? [data.file] : [data]);
      Converter.showResults('split-pdf', results);

      /* Save to history */
      if (typeof History !== 'undefined') {
        const inputFiles = [{ id: this.splitFile.id, name: this.splitFile.name, size: this.splitFile.size }];
        const outputFiles = results.map(f => ({
          id: f.id || f.fileId,
          name: f.name || f.originalName || 'pdf_dividido.pdf',
          size: f.size || 0,
          path: f.path || f.outputPath || ''
        }));
        History.addEntry('Dividir PDF', inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('PDF dividido com sucesso!', results);
    } catch (err) {
      App.showToast('Erro ao dividir PDF: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro ao dividir PDF: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /* ---------- Live Merge Sequence Preview ---------- */
  updateMergePreview() {
    const container = document.getElementById('merge-live-preview-container');
    if (!container) return;

    if (this.mergeFiles.length === 0) {
      container.innerHTML = `
        <div class="preview-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Ordene os arquivos para ver a estrutura final</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    const pageSize = document.querySelector('#page-size-options-merge .page-size-option.active') 
      ? document.querySelector('#page-size-options-merge .page-size-option.active').dataset.value 
      : 'auto';
    const pagination = document.querySelector('#page-number-options-merge .page-size-option.active')
      ? document.querySelector('#page-number-options-merge .page-size-option.active').dataset.value
      : 'no';

    this.mergeFiles.forEach((file, index) => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page-preview size-a4';
      pageDiv.style.background = '#ffffff';

      const pageContent = document.createElement('div');
      pageContent.className = 'pdf-page-content';

      const cell = document.createElement('div');
      cell.className = 'pdf-page-cell';

      const img = document.createElement('img');
      img.className = 'pdf-page-img fit-contain';
      img.src = `${App.baseUrl}/api/files/${file.id}/thumbnail?page=1`;
      img.alt = file.name;
      img.loading = 'lazy';

      cell.appendChild(img);
      pageContent.appendChild(cell);
      pageDiv.appendChild(pageContent);

      const numBadge = document.createElement('div');
      numBadge.className = 'pdf-page-number';
      numBadge.textContent = `#${index + 1} — ${file.name}`;
      pageDiv.appendChild(numBadge);

      container.appendChild(pageDiv);
    });
  },

  /* ---------- Live Split Highlight Preview ---------- */
  updateSplitPreview() {
    const container = document.getElementById('split-live-preview-container');
    if (!container || !this.splitFile) return;

    const pageCount = this.splitPageCount || 1;
    container.innerHTML = '';

    const modeActive = document.querySelector('#split-mode-options .page-size-option.active');
    const mode = modeActive ? modeActive.dataset.value : 'all';

    let pagesToExtract = [];

    if (mode === 'all') {
      for (let i = 1; i <= pageCount; i++) pagesToExtract.push(i);
    } else if (mode === 'range') {
      const startPageVal = parseInt(document.getElementById('split-start-page').value) || 1;
      const endPageVal = parseInt(document.getElementById('split-end-page').value) || pageCount;
      for (let i = startPageVal; i <= endPageVal; i++) {
        if (i >= 1 && i <= pageCount) pagesToExtract.push(i);
      }
    } else if (mode === 'specific') {
      const pagesStr = document.getElementById('split-specific-pages').value.trim();
      if (pagesStr) {
        const parts = pagesStr.split(',');
        parts.forEach(part => {
          const range = part.trim().split('-');
          if (range.length === 2) {
            const start = parseInt(range[0], 10);
            const end = parseInt(range[1], 10);
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= end; i++) {
                if (i >= 1 && i <= pageCount) pagesToExtract.push(i);
              }
            }
          } else {
            const page = parseInt(part.trim(), 10);
            if (!isNaN(page) && page >= 1 && page <= pageCount) {
              pagesToExtract.push(page);
            }
          }
        });
      }
    }

    const extractSet = new Set(pagesToExtract);
    const limit = Math.min(pageCount, 20);

    for (let pageNum = 1; pageNum <= limit; pageNum++) {
      const isSelected = extractSet.has(pageNum);

      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page-preview size-a4';
      pageDiv.style.background = '#ffffff';
      
      if (isSelected) {
        pageDiv.style.boxShadow = '0 0 0 2px var(--accent-primary), 0 10px 25px rgba(0, 0, 0, 0.6)';
        pageDiv.style.opacity = '1';
      } else {
        pageDiv.style.opacity = '0.4';
      }

      const pageContent = document.createElement('div');
      pageContent.className = 'pdf-page-content';

      const cell = document.createElement('div');
      cell.className = 'pdf-page-cell';

      const img = document.createElement('img');
      img.className = 'pdf-page-img fit-contain';
      img.src = `${App.baseUrl}/api/files/${this.splitFile.id}/thumbnail?page=${pageNum}`;
      img.alt = `Página ${pageNum}`;
      img.loading = 'lazy';

      cell.appendChild(img);
      pageContent.appendChild(cell);
      pageDiv.appendChild(pageContent);

      const label = document.createElement('div');
      label.className = 'pdf-page-number';
      label.textContent = `Pág. ${pageNum} ${isSelected ? '✓' : ''}`;
      if (isSelected) {
        label.style.background = 'var(--accent-primary)';
      }
      pageDiv.appendChild(label);

      container.appendChild(pageDiv);
    }

    if (pageCount > limit) {
      const indicator = document.createElement('div');
      indicator.className = 'preview-empty-state';
      indicator.style.minHeight = '60px';
      indicator.style.padding = '10px';
      indicator.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">+ ${pageCount - limit} página(s) adicionais no PDF</p>`;
      container.appendChild(indicator);
    }
  }
};
