/* ============================================
   CONVERT APP — PJe PDF Optimization Module
   Divisão por tamanho limite e compressão
   ============================================ */

const PjeOptimize = {
  options: {
    action: 'split', // 'split' or 'compress'
    maxMb: 5,
    customMb: 5,
    dpi: 150
  },
  
  init() {
    this.setupActionOptions();
    this.setupSplitOptions();
    this.setupCompressOptions();
    this.setupActionButton();
  },

  /* ---------- Action Mode Select (Split vs Compress) ---------- */
  setupActionOptions() {
    const buttons = document.querySelectorAll('#pje-action-options .page-size-option');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.options.action = btn.dataset.value;

        // Toggle UI panels
        const splitControls = document.getElementById('pje-split-controls');
        const compressControls = document.getElementById('pje-compress-controls');

        if (this.options.action === 'split') {
          if (splitControls) splitControls.style.display = 'block';
          if (compressControls) compressControls.style.display = 'none';
        } else {
          if (splitControls) splitControls.style.display = 'none';
          if (compressControls) compressControls.style.display = 'block';
        }
      });
    });
  },

  /* ---------- Split Specific Options ---------- */
  setupSplitOptions() {
    const sizeSelect = document.getElementById('select-pje-size');
    const customRow = document.getElementById('pje-custom-size-row');
    const customInput = document.getElementById('input-pje-custom-size');

    if (sizeSelect) {
      sizeSelect.addEventListener('change', () => {
        const val = sizeSelect.value;
        if (val === 'custom') {
          if (customRow) customRow.style.display = 'block';
          this.options.maxMb = parseFloat(customInput ? customInput.value : 5) || 5;
        } else {
          if (customRow) customRow.style.display = 'none';
          this.options.maxMb = parseFloat(val) || 5;
        }
      });
    }

    if (customInput) {
      customInput.addEventListener('input', () => {
        const val = parseFloat(customInput.value);
        if (!isNaN(val) && val > 0) {
          this.options.maxMb = val;
        }
      });
    }
  },

  /* ---------- Compress Specific Options ---------- */
  setupCompressOptions() {
    const buttons = document.querySelectorAll('#pje-compress-dpi-options .page-size-option');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.options.dpi = parseInt(btn.dataset.value) || 150;
      });
    });
  },

  /* ---------- Action Button Trigger ---------- */
  setupActionButton() {
    const btn = document.getElementById('btn-pje-optimize');
    if (btn) {
      btn.addEventListener('click', () => this.handlePjeOptimize());
    }
  },

  /* ---------- On Files Added ---------- */
  async onFilesAdded() {
    const files = FileManager.getSectionFiles('pje-optimize');

    // enforce single file mode
    if (files.length > 1) {
      const last = files[files.length - 1];
      for (const f of files) {
        if (f.id !== last.id) {
          // Silent local cleanup without alert
          FileManager.files.delete(f.id);
          FileManager.selectedFiles.delete(f.id);
        }
      }
      FileManager.sectionFiles['pje-optimize'] = [last];
      FileManager.renderSectionFiles('pje-optimize');
      return;
    }

    const workspace = document.getElementById('workspace-pje-optimize');
    const results = document.getElementById('results-pje-optimize');
    
    if (results) results.style.display = 'none';

    if (files.length === 0) {
      if (workspace) workspace.style.display = 'none';
      this.updateLivePreview(null);
      return;
    }

    const file = files[0];
    if (workspace) workspace.style.display = 'flex';

    const infoText = document.getElementById('pje-info-text');
    if (infoText) {
      infoText.textContent = `Carregando informações do PDF...`;
    }

    const optimizeBtn = document.getElementById('btn-pje-optimize');
    if (optimizeBtn) optimizeBtn.disabled = true;

    try {
      // Get page count from server
      const data = await App.api(`/api/pdf/page-count?fileId=${file.id}`);
      file.pageCount = data.pageCount || 1;

      if (infoText) {
        infoText.textContent = `${file.name} (${App.formatFileSize(file.size)}) — ${file.pageCount} página(s)`;
      }
      if (optimizeBtn) optimizeBtn.disabled = false;

      this.updateLivePreview(file);
    } catch (err) {
      console.error(err);
      if (infoText) {
        infoText.textContent = `Erro ao carregar PDF.`;
      }
      App.showToast('Erro ao ler PDF: ' + err.message, 'error');
    }
  },

  /* ---------- Update Live Preview (Show PDF structure) ---------- */
  updateLivePreview(file) {
    const container = document.getElementById('pje-live-preview-container');
    if (!container) return;

    if (!file) {
      container.innerHTML = `
        <div class="preview-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Aguardando carregamento do PDF...</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    const pageCount = file.pageCount || 1;
    const fragment = document.createDocumentFragment();

    // Create a beautiful structural mock of pages
    const gridDiv = document.createElement('div');
    gridDiv.style.display = 'grid';
    gridDiv.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    gridDiv.style.gap = '12px';
    gridDiv.style.width = '100%';
    gridDiv.style.padding = '12px';

    for (let i = 1; i <= pageCount; i++) {
      const pageBox = document.createElement('div');
      pageBox.className = 'pdf-page-preview size-a4';
      pageBox.style.width = '100%';
      pageBox.style.aspectRatio = '1/1.414';
      pageBox.style.height = 'auto';
      pageBox.style.background = 'rgba(255, 255, 255, 0.05)';
      pageBox.style.border = '1px solid var(--glass-border)';
      pageBox.style.borderRadius = '8px';
      pageBox.style.display = 'flex';
      pageBox.style.flexDirection = 'column';
      pageBox.style.alignItems = 'center';
      pageBox.style.justifyContent = 'center';
      pageBox.style.padding = '16px';
      pageBox.style.cursor = 'default';

      // SVG scale / document icon
      pageBox.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8; margin-bottom: 6px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Página ${i}</span>
      `;

      gridDiv.appendChild(pageBox);
    }

    fragment.appendChild(gridDiv);
    container.appendChild(fragment);
  },

  /* ---------- Action Handler ---------- */
  async handlePjeOptimize() {
    const files = FileManager.getSectionFiles('pje-optimize');
    if (files.length === 0) return;

    const file = files[0];
    const optimizeBtn = document.getElementById('btn-pje-optimize');
    if (optimizeBtn) optimizeBtn.disabled = true;

    const { action, maxMb, dpi } = this.options;
    const actionLabel = action === 'split' ? 'Dividindo PDF...' : 'Comprimindo PDF...';
    
    FloatingProgressWidget.show(actionLabel);

    try {
      let url = '';
      let payload = { fileId: file.id };

      if (action === 'split') {
        url = '/api/pdf/pje-split';
        payload.maxMb = maxMb;
      } else {
        url = '/api/pdf/pje-compress';
        payload.dpi = dpi;
      }

      const data = await App.api(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const results = data.file ? [data.file] : (data.files || []);
      
      // Render results below
      Converter.showResults('pje-optimize', results);

      // Save to history
      if (typeof History !== 'undefined') {
        const inputFiles = [{ name: file.name, size: file.size }];
        const outputFiles = results.map(f => ({
          id: f.id,
          name: f.originalName || f.filename,
          size: f.size || 0,
          path: f.path || ''
        }));
        const opName = action === 'split' ? 'Divisão de PDF (PJe)' : 'Compressão de PDF (PJe)';
        History.addEntry(opName, inputFiles, outputFiles);
      }

      FloatingProgressWidget.success(action === 'split' ? 'PDF dividido com sucesso!' : 'PDF comprimido com sucesso!', results);

    } catch (err) {
      console.error(err);
      App.showToast('Erro ao otimizar PDF: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro: ' + err.message);
    } finally {
      if (optimizeBtn) optimizeBtn.disabled = false;
    }
  }
};
