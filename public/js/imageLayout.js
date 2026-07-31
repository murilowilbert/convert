/* ============================================
   CONVERT APP — Image Layout Module
   Images-to-PDF with page size, grid, margin,
   quality, fit mode, real-time live preview,
   collapsible thumbnails, and select all/deselect
   ============================================ */

const ImageLayout = {
  options: {
    pageSize: 'a4',
    imagesPerPage: 1,
    margin: 0,
    quality: 90,
    fitMode: 'contain'
  },
  filesCollapsed: false,
  previewDebounceTimer: null,

  init() {
    this.setupPageSizeOptions();
    this.setupFitModeOptions();
    this.setupGridOptions();
    this.setupSliders();
    this.setupResolutionSelect();
    this.setupCreateButton();
    this.setupToggleFiles();
    this.setupSelectionButtons();
  },

  /* ---------- Page Size Options ---------- */
  setupPageSizeOptions() {
    const options = document.querySelectorAll('#page-size-options .page-size-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.options.pageSize = opt.dataset.value;
        this.debouncedPreview();
      });
    });
  },

  /* ---------- Fit Mode Options ---------- */
  setupFitModeOptions() {
    const options = document.querySelectorAll('#image-fit-options .page-size-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.options.fitMode = opt.dataset.value;
        this.debouncedPreview();
      });
    });
  },

  /* ---------- Grid Options ---------- */
  setupGridOptions() {
    const options = document.querySelectorAll('#grid-options .grid-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.options.imagesPerPage = parseInt(opt.dataset.value);
        this.debouncedPreview();
      });
    });
  },

  /* ---------- Sliders ---------- */
  setupSliders() {
    /* Margin slider */
    const marginSlider = document.getElementById('slider-margin');
    const marginValue = document.getElementById('slider-margin-value');

    if (marginSlider && marginValue) {
      marginSlider.addEventListener('input', () => {
        const val = marginSlider.value;
        this.options.margin = parseInt(val);
        marginValue.textContent = val + 'mm';
        this.debouncedPreview();
      });
    }

  },

  /* ---------- Resolution Select Option ---------- */
  setupResolutionSelect() {
    const sel = document.getElementById('select-resolution-img-to-pdf');
    if (sel) {
      this.options.resolution = sel.value;
      sel.addEventListener('change', () => {
        this.options.resolution = sel.value;
      });
    } else {
      this.options.resolution = 'original';
    }
  },

  /* ---------- Create PDF Button ---------- */
  setupCreateButton() {
    const btn = document.getElementById('btn-create-pdf');
    if (btn) {
      btn.addEventListener('click', () => this.handleCreatePdf());
    }
  },

  /* ---------- Toggle Files (Expand/Collapse) ---------- */
  setupToggleFiles() {
    const btn = document.getElementById('btn-toggle-files');
    if (btn) {
      btn.addEventListener('click', () => {
        this.filesCollapsed = !this.filesCollapsed;
        const collapsible = document.getElementById('file-list-collapsible-img-to-pdf');
        const text = document.getElementById('toggle-files-text');

        if (collapsible) {
          collapsible.classList.toggle('collapsed', this.filesCollapsed);
        }

        if (text) {
          text.textContent = this.filesCollapsed ? 'Expandir Imagens' : 'Recolher Imagens';
        }

        btn.classList.toggle('collapsed', this.filesCollapsed);
      });
    }
  },

  /* ---------- Select All / Deselect All Toggle Button ---------- */
  setupSelectionButtons() {
    const toggleBtn = document.getElementById('btn-toggle-select-all-img-to-pdf');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const files = FileManager.getSectionFiles('img-to-pdf');
        const selected = FileManager.getSelectedFiles('img-to-pdf');

        if (selected.length === files.length && files.length > 0) {
          // All selected -> Deselect all
          FileManager.deselectAll('img-to-pdf');
          App.showToast('Seleção limpa!', 'info');
        } else {
          // Some or none selected -> Select all
          FileManager.selectAll('img-to-pdf');
          App.showToast('Todas as imagens foram selecionadas!', 'success');
        }
        this.updateToggleSelectButtonState();
        this.debouncedPreview();
      });
    }
  },

  updateToggleSelectButtonState() {
    const toggleBtn = document.getElementById('btn-toggle-select-all-img-to-pdf');
    if (!toggleBtn) return;

    const files = FileManager.getSectionFiles('img-to-pdf');
    const selected = FileManager.getSelectedFiles('img-to-pdf');

    const iconSvg = toggleBtn.querySelector('.select-icon');
    const textSpan = toggleBtn.querySelector('.select-text');

    if (selected.length === files.length && files.length > 0) {
      // All selected -> option to Deselect
      toggleBtn.className = 'btn-toolbar btn-toolbar-muted';
      if (textSpan) textSpan.textContent = 'Deselecionar Tudo';
      if (iconSvg) {
        iconSvg.innerHTML = `
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        `;
      }
    } else {
      // Not all selected -> option to Select All
      toggleBtn.className = 'btn-toolbar btn-toolbar-accent';
      if (textSpan) textSpan.textContent = 'Selecionar Tudo';
      if (iconSvg) {
        iconSvg.innerHTML = `
          <polyline points="20 6 9 17 4 12"/>
        `;
      }
    }
  },

  /* ---------- Debounced Preview Update ---------- */
  debouncedPreview() {
    clearTimeout(this.previewDebounceTimer);
    this.previewDebounceTimer = setTimeout(() => {
      this.updateLivePreview();
    }, 150);
  },

  /* ---------- Update Live Preview ---------- */
  updateLivePreview() {
    this.updateToggleSelectButtonState();
    const selectedFiles = FileManager.getSelectedFiles('img-to-pdf');
    const previewContainer = document.getElementById('pdf-live-preview-container');

    if (!previewContainer) return;

    if (selectedFiles.length === 0) {
      previewContainer.innerHTML = `
        <div class="preview-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Selecione imagens para ver a prévia</p>
        </div>
      `;
      return;
    }

    previewContainer.innerHTML = '';

    const { pageSize, imagesPerPage, margin, fitMode } = this.options;

    /* Group images into pages */
    const pages = [];
    for (let i = 0; i < selectedFiles.length; i += imagesPerPage) {
      pages.push(selectedFiles.slice(i, i + imagesPerPage));
    }

    /* Grid layout configs */
    const gridConfigs = {
      1: { cols: 1, rows: 1 },
      2: { cols: 1, rows: 2 },
      4: { cols: 2, rows: 2 },
      6: { cols: 2, rows: 3 },
      9: { cols: 3, rows: 3 },
      12: { cols: 3, rows: 4 }
    };
    const config = gridConfigs[imagesPerPage] || { cols: 1, rows: 1 };

    /* Limit preview pages for performance (show max 20 pages) */
    const maxPreviewPages = Math.min(pages.length, 20);

    for (let pageIndex = 0; pageIndex < maxPreviewPages; pageIndex++) {
      const pageFiles = pages[pageIndex];
      const pageDiv = document.createElement('div');
      pageDiv.className = `pdf-page-preview size-${pageSize} grid-${imagesPerPage}`;

      const pageContent = document.createElement('div');
      pageContent.className = 'pdf-page-content';

      const visualPadding = Math.min(margin * 0.8, 24);
      pageContent.style.padding = `${visualPadding}px`;

      pageContent.style.display = 'grid';
      pageContent.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
      pageContent.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;
      pageContent.style.gap = `${Math.max(2, visualPadding / 2)}px`;
      pageContent.style.width = '100%';
      pageContent.style.height = '100%';

      pageFiles.forEach((file) => {
        const cell = document.createElement('div');
        cell.className = 'pdf-page-cell';
        cell.style.borderRadius = '3px';

        const img = document.createElement('img');
        img.className = `pdf-page-img fit-${fitMode}`;
        img.src = App.baseUrl + '/api/files/' + file.id + '/thumbnail';
        img.alt = file.name;
        img.loading = 'lazy';
        if (file.rotation && file.rotation !== 0) {
          img.style.transform = `rotate(${file.rotation}deg)`;
        }

        cell.appendChild(img);

        // Hover quick action buttons inside page cell
        const overlay = document.createElement('div');
        overlay.className = 'pdf-page-overlay-actions';

        // Rotate Button
        const rotBtn = document.createElement('button');
        rotBtn.className = 'overlay-action-btn';
        rotBtn.type = 'button';
        rotBtn.title = 'Girar 90°';
        rotBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        `;
        rotBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          FileManager.rotateImage(file.id, 'img-to-pdf');
        });

        // Exclude/Deselect Button
        const delBtn = document.createElement('button');
        delBtn.className = 'overlay-action-btn action-danger';
        delBtn.type = 'button';
        delBtn.title = 'Deselecionar';
        delBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        `;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          FileManager.toggleSelection(file.id);
          const topCard = document.getElementById('file-card-' + file.id);
          if (topCard) topCard.classList.remove('selected');
          FileManager.updateSelectionCount('img-to-pdf');
        });

        overlay.appendChild(rotBtn);
        overlay.appendChild(delBtn);
        cell.appendChild(overlay);

        pageContent.appendChild(cell);
      });

      pageDiv.appendChild(pageContent);

      const pageNum = document.createElement('div');
      pageNum.className = 'pdf-page-number';
      pageNum.textContent = `Pág. ${pageIndex + 1}` + (pages.length > maxPreviewPages && pageIndex === maxPreviewPages - 1 ? ` de ${pages.length}` : '');
      pageDiv.appendChild(pageNum);

      previewContainer.appendChild(pageDiv);
    }

    /* If more pages than shown, add indicator */
    if (pages.length > maxPreviewPages) {
      const moreIndicator = document.createElement('div');
      moreIndicator.className = 'preview-empty-state';
      moreIndicator.style.minHeight = '100px';
      moreIndicator.style.padding = '20px';
      moreIndicator.innerHTML = `<p style="font-size: 13px;">+ ${pages.length - maxPreviewPages} página(s) adicionais</p>`;
      previewContainer.appendChild(moreIndicator);
    }
  },

  /* ---------- On Files Added ---------- */
  onFilesAdded() {
    const files = FileManager.getSectionFiles('img-to-pdf');

    const workspace = document.getElementById('workspace-img-to-pdf');
    const toolbar = document.getElementById('toolbar-img-to-pdf');
    const results = document.getElementById('results-img-to-pdf');

    if (results) results.style.display = 'none';

    if (files.length === 0) {
      if (workspace) workspace.style.display = 'none';
      if (toolbar) toolbar.style.display = 'none';
      this.updateLivePreview();
      return;
    }

    if (workspace) workspace.style.display = 'flex';
    if (toolbar) toolbar.style.display = 'flex';

    /* Re-show controls that may have been hidden by removeFile zero-files cleanup */
    const controls = document.getElementById('controls-img-to-pdf');
    const actionBar = document.getElementById('action-bar-img-to-pdf');
    if (controls) controls.style.display = '';
    if (actionBar) actionBar.style.display = '';

    /* Update toolbar counter */
    const counter = document.getElementById('toolbar-counter-img-to-pdf');
    if (counter) {
      counter.textContent = files.length + ' imagem(ns)';
    }

    const countEl = document.getElementById('selected-count-img-to-pdf');
    const selected = FileManager.getSelectedFiles('img-to-pdf');
    if (countEl) {
      countEl.textContent = selected.length + ' de ' + files.length + ' imagem(ns) selecionada(s)';
    }

    const btn = document.getElementById('btn-create-pdf');
    if (btn) btn.disabled = selected.length === 0;

    this.debouncedPreview();
  },

  /* ---------- Create PDF Handler ---------- */
  async handleCreatePdf() {
    const selectedFiles = FileManager.getSelectedFiles('img-to-pdf');

    if (selectedFiles.length === 0) {
      App.showToast('Selecione pelo menos uma imagem', 'warning');
      return;
    }

    const fileIds = selectedFiles.map(f => f.id);

    const btn = document.getElementById('btn-create-pdf');
    if (btn) btn.disabled = true;

    FloatingProgressWidget.show('Criando PDF...');

    try {
      const numberPages = document.getElementById('checkbox-number-pages')?.checked || false;

      const data = await App.api('/api/pdf/images-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: [{
            fileIds: fileIds,
            files: selectedFiles.map(f => ({ id: f.id, rotation: f.rotation || 0 })),
            options: {
              pageSize: this.options.pageSize,
              imagesPerPage: this.options.imagesPerPage,
              margin: this.options.margin,
              quality: this.options.quality,
              fitMode: this.options.fitMode,
              resolution: this.options.resolution || 'original',
              numberPages: numberPages
            }
          }]
        })
      });

      const results = data.file ? [data.file] : (data.files || [data]);
      Converter.showResults('img-to-pdf', results);

      /* Save to history */
      if (typeof History !== 'undefined') {
        const inputFiles = selectedFiles.map(f => ({ id: f.id, name: f.name, size: f.size }));
        const outputFiles = results.map(f => ({
          id: f.id || f.fileId,
          name: f.name || f.originalName || 'imagens_para_pdf.pdf',
          size: f.size || 0,
          path: f.path || f.outputPath || ''
        }));
        History.addEntry('Imagens para PDF', inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('PDF criado com sucesso!', results);
    } catch (err) {
      App.showToast('Erro ao criar PDF: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro ao criar PDF: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};
