/* ============================================
   CONVERT APP — Converter Module
   File conversion, PDF-to-images, format loading
   ============================================ */

const Converter = {
  formatCache: {},

  init() {
    this.setupConvertSection();
    this.setupPdfToImgSection();
    this.setupSpreadsheetSection();
    this.setupDocumentsSection();
    this.setupConvertSliders();
  },

  /* ---------- Convert Section ---------- */
  setupConvertSection() {
    const btnConvert = document.getElementById('btn-convert');
    if (btnConvert) {
      btnConvert.addEventListener('click', () => {
        this.handleConvert('convert');
      });
    }
  },

  /* ---------- PDF to Images Section ---------- */
  setupPdfToImgSection() {
    const btnPdfToImg = document.getElementById('btn-pdf-to-img');
    if (btnPdfToImg) {
      btnPdfToImg.addEventListener('click', () => {
        this.handlePdfToImages();
      });
    }

    /* Scale options */
    const scaleOptions = document.querySelectorAll('#scale-options .page-size-option');
    scaleOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        scaleOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.updatePdfToImgPreview();
      });
    });

    const pageRange = document.getElementById('input-page-range');
    if (pageRange) {
      pageRange.addEventListener('input', () => {
        this.updatePdfToImgPreview();
      });
    }

    const imgFormat = document.getElementById('select-img-format');
    if (imgFormat) {
      imgFormat.addEventListener('change', () => {
        this.updatePdfToImgPreview();
      });
    }
  },

  /* ---------- Spreadsheet Section ---------- */
  setupSpreadsheetSection() {
    const btnConvert = document.getElementById('btn-convert-spreadsheet');
    if (btnConvert) {
      btnConvert.addEventListener('click', () => {
        this.handleConvert('spreadsheet');
      });
    }
  },

  /* ---------- Documents Section ---------- */
  setupDocumentsSection() {
    const btnConvert = document.getElementById('btn-convert-documents');
    if (btnConvert) {
      btnConvert.addEventListener('click', () => {
        this.handleConvert('documents');
      });
    }
  },

  /* ---------- On Files Added ---------- */
  async onFilesAdded(sectionId) {
    const files = FileManager.getSectionFiles(sectionId);
    if (files.length === 0) return;

    /* Hide previous results */
    const results = document.getElementById('results-' + sectionId);
    if (results) results.style.display = 'none';

    /* Load formats based on section/category */
    if (sectionId === 'convert') {
      const workspace = document.getElementById('workspace-convert');
      if (workspace) workspace.style.display = 'flex';

      const category = files[0].category;
      this.updateCategoryBadge(category);
      await this.loadFormats(category, 'select-format-convert');

      const imgOptions = document.getElementById('image-convert-options');
      if (imgOptions) {
        imgOptions.style.display = (category === 'image') ? 'flex' : 'none';
      }

      this.updateConvertPreview();
    } else if (sectionId === 'spreadsheet') {
      const controls = document.getElementById('controls-spreadsheet');
      const actionBar = document.getElementById('action-bar-spreadsheet');
      if (controls) controls.style.display = 'block';
      if (actionBar) actionBar.style.display = 'flex';
      await this.loadFormats('spreadsheet', 'select-format-spreadsheet');
    } else if (sectionId === 'documents') {
      const controls = document.getElementById('controls-documents');
      const actionBar = document.getElementById('action-bar-documents');
      if (controls) controls.style.display = 'block';
      if (actionBar) actionBar.style.display = 'flex';
      await this.loadFormats('document', 'select-format-documents');
    } else if (sectionId === 'pdf-to-img') {
      const workspace = document.getElementById('workspace-pdf-to-img');
      if (workspace) workspace.style.display = 'flex';

      const pdfInfo = document.getElementById('pdf-info-pdf-to-img');
      if (pdfInfo && files.length > 0) {
        pdfInfo.textContent = files[0].name;
        try {
          const data = await App.api('/api/pdf/page-count?fileId=' + files[0].id);
          const pageCount = data.pageCount || 0;
          pdfInfo.textContent = files[0].name + ' — ' + pageCount + ' página(s)';
          files[0].pageCount = pageCount;
        } catch (err) {
          pdfInfo.textContent = files[0].name;
        }
      }

      const btn = document.getElementById('btn-pdf-to-img');
      if (btn) btn.disabled = false;

      this.updatePdfToImgPreview();
    }
  },

  updateCategoryBadge(category) {
    const badge = document.getElementById('badge-category-convert');
    if (!badge) return;

    badge.className = 'badge ' + App.getFileBadgeClass(category);
    badge.textContent = App.getCategoryLabel(category);
  },

  async loadFormats(category, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    /* Try cache */
    if (this.formatCache[category]) {
      this.populateFormatSelect(select, this.formatCache[category]);
      return;
    }

    try {
      const data = await App.api('/api/formats/' + category);
      const formats = data.formats || data || [];
      this.formatCache[category] = formats;
      this.populateFormatSelect(select, formats);
    } catch (err) {
      /* Fallback formats */
      const fallbacks = {
        image: [
          { value: 'png', label: 'PNG' },
          { value: 'jpg', label: 'JPG' },
          { value: 'webp', label: 'WebP' },
          { value: 'bmp', label: 'BMP' },
          { value: 'gif', label: 'GIF' },
          { value: 'tiff', label: 'TIFF' },
          { value: 'ico', label: 'ICO' }
        ],
        pdf: [
          { value: 'png', label: 'PNG' },
          { value: 'jpg', label: 'JPG' }
        ],
        spreadsheet: [
          { value: 'xlsx', label: 'XLSX' },
          { value: 'csv', label: 'CSV' },
          { value: 'ods', label: 'ODS' },
          { value: 'tsv', label: 'TSV' },
          { value: 'pdf', label: 'PDF' }
        ],
        document: [
          { value: 'pdf', label: 'PDF' },
          { value: 'docx', label: 'DOCX' },
          { value: 'txt', label: 'TXT' },
          { value: 'rtf', label: 'RTF' }
        ]
      };

      const formats = fallbacks[category] || [
        { value: 'pdf', label: 'PDF' },
        { value: 'png', label: 'PNG' },
        { value: 'jpg', label: 'JPG' }
      ];

      this.formatCache[category] = formats;
      this.populateFormatSelect(select, formats);
    }
  },

  populateFormatSelect(select, formats) {
    select.innerHTML = '<option value="">Selecione um formato...</option>';
    formats.forEach(fmt => {
      const option = document.createElement('option');
      option.value = fmt.value || fmt.format || fmt;
      option.textContent = fmt.label || fmt.name || (fmt.value || fmt).toString().toUpperCase();
      select.appendChild(option);
    });
  },

  /* ---------- Convert Handler ---------- */
  async handleConvert(sectionId) {
    const selectMap = {
      'convert': 'select-format-convert',
      'spreadsheet': 'select-format-spreadsheet',
      'documents': 'select-format-documents'
    };

    const selectId = selectMap[sectionId];
    const select = document.getElementById(selectId);
    if (!select) return;

    const outputFormat = select.value;
    if (!outputFormat) {
      App.showToast('Selecione um formato de saída', 'warning');
      return;
    }

    const selectedFiles = FileManager.getSelectedFiles(sectionId);
    if (selectedFiles.length === 0) {
      App.showToast('Selecione pelo menos um arquivo', 'warning');
      return;
    }

    const fileIds = selectedFiles.map(f => f.id);

    const btnMap = {
      'convert': 'btn-convert',
      'spreadsheet': 'btn-convert-spreadsheet',
      'documents': 'btn-convert-documents'
    };
    const btn = document.getElementById(btnMap[sectionId]);
    if (btn) btn.disabled = true;

    FloatingProgressWidget.show('Convertendo arquivos...');

    try {
      const qualityEl = document.getElementById('slider-quality-convert');
      const widthEl = document.getElementById('input-width-convert');
      const heightEl = document.getElementById('input-height-convert');

      const options = {};
      if (qualityEl) options.quality = parseInt(qualityEl.value, 10);
      if (widthEl && widthEl.value) options.width = parseInt(widthEl.value, 10);
      if (heightEl && heightEl.value) options.height = parseInt(heightEl.value, 10);

      const data = await App.api('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: fileIds,
          outputFormat: outputFormat,
          options: options
        })
      });

      const results = data.files || data.results || (data.file ? [data.file] : [data]);
      this.showResults(sectionId, results);

      /* Save to history */
      if (typeof History !== 'undefined') {
        const opLabels = {
          'convert': 'Conversão de Imagem',
          'spreadsheet': 'Conversão de Planilha',
          'documents': 'Conversão de Documento'
        };
        const inputFiles = selectedFiles.map(f => ({ id: f.id, name: f.name, size: f.size }));
        const outputFiles = results.map(f => ({
          id: f.id || f.fileId,
          name: f.name || f.originalName || 'arquivo',
          size: f.size || 0,
          path: f.path || f.outputPath || ''
        }));
        History.addEntry(opLabels[sectionId] || 'Conversão', inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('Conversão concluída com sucesso!', results);
    } catch (err) {
      App.showToast('Erro na conversão: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro na conversão: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /* ---------- PDF to Images Handler ---------- */
  async handlePdfToImages() {
    const files = FileManager.getSectionFiles('pdf-to-img');
    if (files.length === 0) {
      App.showToast('Adicione um arquivo PDF primeiro', 'warning');
      return;
    }

    const fileId = files[0].id;
    const format = document.getElementById('select-img-format').value || 'png';
    const scaleActive = document.querySelector('#scale-options .page-size-option.active');
    const scale = scaleActive ? parseFloat(scaleActive.dataset.value) : 1;
    const pageRange = document.getElementById('input-page-range').value.trim() || '';

    const btn = document.getElementById('btn-pdf-to-img');
    if (btn) btn.disabled = true;

    FloatingProgressWidget.show('Extraindo imagens...');

    try {
      const data = await App.api('/api/convert/pdf-to-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: fileId,
          format: format,
          scale: scale,
          pageRange: pageRange
        })
      });

      const results = data.files || data.images || (data.file ? [data.file] : [data]);
      this.showResults('pdf-to-img', results);

      /* Save to history */
      if (typeof History !== 'undefined') {
        const inputFiles = [{ id: files[0].id, name: files[0].name, size: files[0].size }];
        const outputFiles = results.map(f => ({
          id: f.id || f.fileId,
          name: f.name || f.originalName || 'imagem',
          size: f.size || 0,
          path: f.path || f.outputPath || ''
        }));
        History.addEntry('PDF para Imagens', inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('Imagens extraídas com sucesso!', results);
    } catch (err) {
      App.showToast('Erro ao extrair imagens: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro ao extrair imagens: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /* ---------- Show Results ---------- */
  showResults(sectionId, files) {
    const resultsPanel = document.getElementById('results-' + sectionId);
    const resultsList = document.getElementById('results-list-' + sectionId);
    const resultsActions = document.getElementById('results-actions-' + sectionId);

    if (!resultsPanel || !resultsList) return;

    resultsList.innerHTML = '';
    if (resultsActions) resultsActions.innerHTML = '';

    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'result-item';

      const fileId = file.id || file.fileId;
      const fileName = file.name || file.filename || 'arquivo';
      const fileSize = file.size || 0;
      const ext = fileName.split('.').pop().toLowerCase();
      const category = App.detectCategory(fileName);

      item.innerHTML =
        '<div class="result-item-info">' +
          '<div class="result-item-icon">' + App.getFileIcon(category, ext) + '</div>' +
          '<div class="result-item-details">' +
            '<div class="result-item-name" title="' + fileName + '">' + fileName + '</div>' +
            '<div class="result-item-size">' + App.formatFileSize(fileSize) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="result-item-actions">' +
          '<button class="btn-primary btn-sm" data-file-id="' + fileId + '" data-file-name="' + fileName + '" type="button">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/>' +
              '<line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'Baixar' +
          '</button>' +
        '</div>';

      const downloadBtn = item.querySelector('.btn-primary');
      downloadBtn.addEventListener('click', () => {
        this.downloadFile(fileId, fileName);
      });

      resultsList.appendChild(item);
    });

    /* Download All ZIP button */
    if (files.length > 1 && resultsActions) {
      const allFileIds = files.map(f => f.id || f.fileId);
      const zipBtn = document.createElement('button');
      zipBtn.className = 'btn-primary';
      zipBtn.id = 'btn-download-all-' + sectionId;
      zipBtn.type = 'button';
      zipBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
          '<polyline points="7 10 12 15 17 10"/>' +
          '<line x1="12" y1="15" x2="12" y2="3"/>' +
        '</svg>' +
        'Baixar Todos (ZIP)';

      zipBtn.addEventListener('click', () => {
        this.downloadAllZip(allFileIds);
      });

      resultsActions.appendChild(zipBtn);
    }

      resultsPanel.style.display = 'block';
      resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

  /* ---------- Sliders and extra configs for Conversion ---------- */
  setupConvertSliders() {
    const slider = document.getElementById('slider-quality-convert');
    const valSpan = document.getElementById('slider-quality-convert-value');
    if (slider && valSpan) {
      slider.addEventListener('input', () => {
        valSpan.textContent = slider.value + '%';
        this.updateConvertPreview();
      });
    }

    const widthInput = document.getElementById('input-width-convert');
    const heightInput = document.getElementById('input-height-convert');
    if (widthInput) widthInput.addEventListener('input', () => this.updateConvertPreview());
    if (heightInput) heightInput.addEventListener('input', () => this.updateConvertPreview());

    const selectFormat = document.getElementById('select-format-convert');
    if (selectFormat) selectFormat.addEventListener('change', () => this.updateConvertPreview());
  },

  updateConvertPreview() {
    const files = FileManager.getSelectedFiles('convert');
    const container = document.getElementById('convert-live-preview-container');
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = `
        <div class="preview-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Selecione um arquivo para ver a prévia</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    const format = document.getElementById('select-format-convert').value || '...';
    const quality = document.getElementById('slider-quality-convert') ? document.getElementById('slider-quality-convert').value : '90';
    const width = document.getElementById('input-width-convert') ? document.getElementById('input-width-convert').value : '';
    const height = document.getElementById('input-height-convert') ? document.getElementById('input-height-convert').value : '';

    files.forEach(file => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page-preview size-fit';
      pageDiv.style.background = 'var(--bg-card)';
      pageDiv.style.border = '1px solid var(--glass-border)';
      pageDiv.style.padding = '12px';
      pageDiv.style.display = 'flex';
      pageDiv.style.flexDirection = 'column';
      pageDiv.style.justifyContent = 'center';
      pageDiv.style.alignItems = 'center';
      pageDiv.style.gap = '8px';

      const imgContainer = document.createElement('div');
      imgContainer.className = 'file-card-thumb';
      imgContainer.style.width = '100px';
      imgContainer.style.height = '100px';
      imgContainer.style.marginBottom = '0';

      if (file.category === 'image' || file.category === 'pdf') {
        const img = document.createElement('img');
        img.src = App.baseUrl + '/api/files/' + file.id + '/thumbnail';
        img.alt = file.name;
        img.style.objectFit = 'contain';
        imgContainer.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = App.getFileIcon(file.category, file.extension);
        imgContainer.appendChild(icon);
      }

      const infoDiv = document.createElement('div');
      infoDiv.style.textAlign = 'center';
      infoDiv.style.width = '100%';

      const directionSpan = document.createElement('div');
      directionSpan.style.fontSize = '12px';
      directionSpan.style.fontWeight = '700';
      directionSpan.style.color = 'var(--accent-primary)';
      directionSpan.style.marginBottom = '4px';
      directionSpan.textContent = `${file.extension.toUpperCase()} ➔ ${format.toUpperCase()}`;

      const nameSpan = document.createElement('div');
      nameSpan.className = 'file-card-name';
      nameSpan.textContent = file.name;

      infoDiv.appendChild(directionSpan);
      infoDiv.appendChild(nameSpan);

      if (file.category === 'image' && format !== '...') {
        const settingsSpan = document.createElement('div');
        settingsSpan.style.fontSize = '10px';
        settingsSpan.style.color = 'var(--text-muted)';
        settingsSpan.style.marginTop = '4px';
        
        let label = `Qualidade: ${quality}%`;
        if (width || height) {
          label += ` | ${width || 'Auto'}x${height || 'Auto'}px`;
        }
        settingsSpan.textContent = label;
        infoDiv.appendChild(settingsSpan);
      }

      pageDiv.appendChild(imgContainer);
      pageDiv.appendChild(infoDiv);
      container.appendChild(pageDiv);
    });
  },

  /* ---------- Live PDF-to-Image Page Preview ---------- */
  updatePdfToImgPreview() {
    const files = FileManager.getSectionFiles('pdf-to-img');
    const container = document.getElementById('pdf-to-img-live-preview-container');
    if (!container) return;

    if (files.length === 0) {
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

    const file = files[0];
    const pageCount = file.pageCount || 1;
    const pageRange = document.getElementById('input-page-range') ? document.getElementById('input-page-range').value.trim() : '';

    container.innerHTML = '';

    let pagesToRender = [];
    if (!pageRange) {
      const limit = Math.min(pageCount, 20);
      for (let i = 1; i <= limit; i++) pagesToRender.push(i);
    } else {
      const parts = pageRange.split(',');
      parts.forEach(part => {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const start = parseInt(range[0], 10);
          const end = parseInt(range[1], 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              if (i >= 1 && i <= pageCount) pagesToRender.push(i);
            }
          }
        } else {
          const page = parseInt(part.trim(), 10);
          if (!isNaN(page) && page >= 1 && page <= pageCount) {
            pagesToRender.push(page);
          }
        }
      });
    }

    pagesToRender = Array.from(new Set(pagesToRender)).sort((a, b) => a - b);

    if (pagesToRender.length === 0) {
      container.innerHTML = `
        <div class="preview-empty-state">
          <p>Nenhuma página selecionada no intervalo</p>
        </div>
      `;
      return;
    }

    pagesToRender.forEach(pageNum => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page-preview size-a4';
      pageDiv.style.background = '#ffffff';

      const pageContent = document.createElement('div');
      pageContent.className = 'pdf-page-content';

      const cell = document.createElement('div');
      cell.className = 'pdf-page-cell';

      const img = document.createElement('img');
      img.className = 'pdf-page-img fit-contain';
      img.src = `${App.baseUrl}/api/files/${file.id}/thumbnail?page=${pageNum}`;
      img.alt = `Página ${pageNum}`;
      img.loading = 'lazy';

      cell.appendChild(img);
      pageContent.appendChild(cell);
      pageDiv.appendChild(pageContent);

      const label = document.createElement('div');
      label.className = 'pdf-page-number';
      label.textContent = `Página ${pageNum}`;
      pageDiv.appendChild(label);

      container.appendChild(pageDiv);
    });
  },

  /* ---------- Download Helpers ---------- */
  downloadFile(fileId, fileName) {
    const a = document.createElement('a');
    a.href = App.baseUrl + '/api/download/' + fileId;
    a.download = fileName || 'download';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  },

  async downloadAllZip(fileIds) {
    try {
      const response = await fetch(App.baseUrl + '/api/download/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: fileIds })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar arquivo ZIP');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'convert_arquivos.zip';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 100);

      App.showToast('Download do ZIP iniciado', 'success');
    } catch (err) {
      App.showToast('Erro ao baixar ZIP: ' + err.message, 'error');
    }
  }
};
