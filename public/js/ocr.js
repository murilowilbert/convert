/* ============================================
   CONVERT APP — OCR Module
   Tesseract OCR frontend controller
   ============================================ */

const Ocr = {
  options: {
    language: 'por',
    outputFormat: 'pdf'
  },

  init() {
    this.setupOptions();
    this.setupActionButton();
  },

  /* ---------- Options Handler ---------- */
  setupOptions() {
    const langSelect = document.getElementById('select-ocr-lang');
    const formatSelect = document.getElementById('select-ocr-format');

    if (langSelect) {
      langSelect.addEventListener('change', () => {
        this.options.language = langSelect.value;
      });
    }

    if (formatSelect) {
      formatSelect.addEventListener('change', () => {
        this.options.outputFormat = formatSelect.value;
      });
    }
  },

  /* ---------- Action Button Trigger ---------- */
  setupActionButton() {
    const btn = document.getElementById('btn-ocr-start');
    if (btn) {
      btn.addEventListener('click', () => this.handleOcr());
    }
  },

  /* ---------- On Files Added ---------- */
  async onFilesAdded() {
    const files = FileManager.getSectionFiles('ocr');

    // enforce single file mode
    if (files.length > 1) {
      const last = files[files.length - 1];
      for (const f of files) {
        if (f.id !== last.id) {
          FileManager.files.delete(f.id);
          FileManager.selectedFiles.delete(f.id);
        }
      }
      FileManager.sectionFiles['ocr'] = [last];
      FileManager.renderSectionFiles('ocr');
      return;
    }

    const workspace = document.getElementById('workspace-ocr');
    const results = document.getElementById('results-ocr');
    
    if (results) results.style.display = 'none';

    if (files.length === 0) {
      if (workspace) workspace.style.display = 'none';
      this.updateLivePreview(null);
      return;
    }

    const file = files[0];
    if (workspace) workspace.style.display = 'flex';

    const infoText = document.getElementById('ocr-info-text');
    if (infoText) {
      infoText.textContent = `Carregando arquivo...`;
    }

    const startBtn = document.getElementById('btn-ocr-start');
    if (startBtn) startBtn.disabled = true;

    try {
      if (file.category === 'pdf') {
        const data = await App.api(`/api/pdf/page-count?fileId=${file.id}`);
        file.pageCount = data.pageCount || 1;
        if (infoText) {
          infoText.textContent = `${file.name} (${App.formatFileSize(file.size)}) — ${file.pageCount} página(s)`;
        }
      } else {
        file.pageCount = 1;
        if (infoText) {
          infoText.textContent = `${file.name} (${App.formatFileSize(file.size)})`;
        }
      }
      
      if (startBtn) startBtn.disabled = false;
      this.updateLivePreview(file);
    } catch (err) {
      console.error(err);
      if (infoText) {
        infoText.textContent = `Erro ao ler arquivo.`;
      }
      App.showToast('Erro ao ler arquivo: ' + err.message, 'error');
    }
  },

  /* ---------- Update Live Preview ---------- */
  updateLivePreview(file) {
    const container = document.getElementById('ocr-live-preview-container');
    if (!container) return;

    if (!file) {
      container.innerHTML = `
        <div class="preview-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Nenhum arquivo ativo...</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    const pageCount = file.pageCount || 1;
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

      if (file.category === 'image') {
        pageBox.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8; margin-bottom: 6px;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-align: center;">Imagem Principal</span>
        `;
      } else {
        pageBox.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8; margin-bottom: 6px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Página ${i}</span>
        `;
      }

      gridDiv.appendChild(pageBox);
    }

    container.appendChild(gridDiv);
  },

  /* ---------- Action Handler ---------- */
  async handleOcr() {
    const files = FileManager.getSectionFiles('ocr');
    if (files.length === 0) return;

    const file = files[0];
    const startBtn = document.getElementById('btn-ocr-start');
    if (startBtn) startBtn.disabled = true;

    FloatingProgressWidget.show('Reconhecendo texto (OCR)... Isso pode levar algum tempo.');

    try {
      const data = await App.api('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          language: this.options.language,
          outputFormat: this.options.outputFormat
        })
      });

      const results = data.file ? [data.file] : (data.files || []);

      // Exibe os resultados
      Converter.showResults('ocr', results);

      // Salva no histórico
      if (typeof History !== 'undefined') {
        const inputFiles = [{ id: file.id, name: file.name, size: file.size }];
        const outputFiles = results.map(f => ({
          id: f.id,
          name: f.originalName || f.filename,
          size: f.size || 0,
          path: f.path || ''
        }));
        
        const label = this.options.outputFormat === 'pdf' ? 'OCR (PDF Pesquisável)' : 'OCR (Extração de Texto)';
        History.addEntry(label, inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('Reconhecimento concluído com sucesso!', results);
    } catch (err) {
      console.error(err);
      App.showToast('Erro ao realizar OCR: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro no OCR: ' + err.message);
    } finally {
      if (startBtn) startBtn.disabled = false;
    }
  }
};
