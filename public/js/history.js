/* ============================================
   CONVERT APP — History Module
   Manages operation history (persistent via server)
   ============================================ */

const History = {
  entries: [],

  async init() {
    this.setupClearButton();
    await this.loadHistory();
  },

  /* ---------- Load History from Server ---------- */
  async loadHistory() {
    try {
      const data = await App.api('/api/history');
      this.entries = data.history || data || [];
      this.render();
    } catch (err) {
      console.warn('Não foi possível carregar o histórico:', err.message);
      this.entries = [];
      this.render();
    }
  },

  /* ---------- Add Entry ---------- */
  async addEntry(operation, inputFiles, outputFiles) {
    try {
      const data = await App.api('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, inputFiles, outputFiles })
      });

      if (data.entry) {
        this.entries.unshift(data.entry);
      } else {
        await this.loadHistory();
      }
      this.render();
    } catch (err) {
      console.error('Erro ao salvar no histórico:', err.message);
    }
  },

  /* ---------- Clear History ---------- */
  setupClearButton() {
    const btn = document.getElementById('btn-clear-history');
    if (btn) {
      btn.addEventListener('click', async () => {
        const confirmed = await App.confirmDialog(
          'Tem certeza que deseja limpar todo o histórico? Os arquivos gerados não serão apagados.'
        );
        if (confirmed) {
          try {
            await App.api('/api/history', { method: 'DELETE' });
            this.entries = [];
            this.render();
            App.showToast('Histórico limpo com sucesso', 'success');
          } catch (err) {
            App.showToast('Erro ao limpar histórico: ' + err.message, 'error');
          }
        }
      });
    }
  },

  /* ---------- Remove Single Entry ---------- */
  async removeEntry(entryId) {
    try {
      await App.api('/api/history/' + entryId, { method: 'DELETE' });
      this.entries = this.entries.filter(e => e.id !== entryId);
      this.render();
    } catch (err) {
      App.showToast('Erro ao remover entrada: ' + err.message, 'error');
    }
  },

  /* ---------- Render History ---------- */
  render() {
    const container = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty');
    const clearBtn = document.getElementById('btn-clear-history');

    if (!container) return;

    /* Clear existing items but keep empty state */
    const existingItems = container.querySelectorAll('.history-item');
    existingItems.forEach(item => item.remove());

    if (this.entries.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    this.entries.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.id = 'history-item-' + entry.id;

      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const operationIcon = this.getOperationIcon(entry.operation);
      const operationBadgeClass = this.getOperationBadgeClass(entry.operation);

      /* Input files summary */
      const inputCount = (entry.inputFiles || []).length;
      
      const renderInputFileSpan = (f) => {
        const ext = f.name.split('.').pop().toLowerCase();
        const previewableExts = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'bmp', 'pdf'];
        const isPreviewable = previewableExts.includes(ext) && !!f.thumbnail;
        return `<span class="history-input-file-hover" data-thumbnail="${f.thumbnail || ''}" data-name="${f.name}" data-is-previewable="${isPreviewable}" style="${isPreviewable ? 'cursor: pointer; text-decoration: underline dashed rgba(255,255,255,0.3); text-underline-offset: 3px;' : ''}">${f.name}</span>`;
      };

      const inputNamesHtml = (entry.inputFiles || []).slice(0, 3).map(renderInputFileSpan).join(', ');

      const hasMoreInputs = inputCount > 3;
      const inputHtml = hasMoreInputs ? `
        <div class="history-input-summary" style="align-items: flex-start; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="history-label">Entrada:</span>
            <span>${inputNamesHtml} <button class="btn-ver-mais" data-entry-id="${entry.id}" type="button">Ver mais (${inputCount - 3})</button></span>
          </div>
          <div class="history-input-all-files" id="history-input-all-${entry.id}" style="display: none; width: 100%; margin-top: 8px; border-top: 1px dashed var(--glass-border); padding-top: 8px;">
            <ul style="list-style: disc; margin: 0 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 4px;">
              ${entry.inputFiles.map(f => {
                const ext = f.name.split('.').pop().toLowerCase();
                const previewableExts = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'bmp', 'pdf'];
                const isPreviewable = previewableExts.includes(ext) && !!f.thumbnail;
                return `
                <li style="font-size: 12px; color: var(--text-secondary); text-align: left; margin-bottom: 4px;">
                  <span class="history-input-file-hover" data-thumbnail="${f.thumbnail || ''}" data-name="${f.name}" data-is-previewable="${isPreviewable}" style="word-break: break-all; ${isPreviewable ? 'cursor: pointer; text-decoration: underline dashed rgba(255,255,255,0.3); text-underline-offset: 3px;' : ''}">${f.name}</span>
                  <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(${App.formatFileSize(f.size || 0)})</span>
                </li>
                `;
              }).join('')}
            </ul>
          </div>
        </div>
      ` : `
        <div class="history-input-summary">
          <span class="history-label">Entrada:</span>
          <span>${inputNamesHtml} (${inputCount} arquivo${inputCount !== 1 ? 's' : ''})</span>
        </div>
      `;

      /* Output files */
      const outputHtml = (entry.outputFiles || []).map(f => {
        const exists = f.outputExists !== false;
        return `
          <div class="history-output-file">
            <span class="history-output-name" title="${f.name}">${f.name}</span>
            <span class="history-output-size">${App.formatFileSize(f.size || 0)}</span>
            ${exists && f.id ? `
              <button class="btn-primary btn-sm btn-history-download" data-file-id="${f.id}" data-file-name="${f.name}" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Baixar
              </button>
            ` : `
              <span class="history-output-expired">Expirado</span>
            `}
          </div>
        `;
      }).join('');

      item.innerHTML = `
        <div class="history-item-header">
          <div class="history-item-left">
            <span class="history-item-icon">${operationIcon}</span>
            <div class="history-item-meta">
              <span class="badge ${operationBadgeClass}">${entry.operation}</span>
              <span class="history-item-date">${dateStr} às ${timeStr}</span>
            </div>
          </div>
          <button class="history-item-remove" type="button" title="Remover do histórico" data-entry-id="${entry.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="history-item-body">
          ${inputHtml}
          <div class="history-output-list">
            <span class="history-label">Saída:</span>
            ${outputHtml}
          </div>
        </div>
      `;

      /* Ver mais click listener */
      item.querySelectorAll('.btn-ver-mais').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const entryId = btn.dataset.entryId;
          const detailsEl = item.querySelector(`#history-input-all-${entryId}`);
          if (detailsEl) {
            const isHidden = detailsEl.style.display === 'none';
            detailsEl.style.display = isHidden ? 'block' : 'none';
            btn.textContent = isHidden ? 'Ocultar' : `Ver mais (${inputCount - 3})`;
          }
        });
      });

      /* Download buttons */
      item.querySelectorAll('.btn-history-download').forEach(btn => {
        btn.addEventListener('click', () => {
          Converter.downloadFile(btn.dataset.fileId, btn.dataset.fileName);
        });
      });

      /* Remove button */
      const removeBtn = item.querySelector('.history-item-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.removeEntry(entry.id);
        });
      }

      container.appendChild(item);
    });

    // Bind hover event listeners to newly rendered items
    this.bindHoverPreviews(container);
  },

  /* ---------- Bind Hover Previews ---------- */
  bindHoverPreviews(container) {
    const hoverEls = container.querySelectorAll('.history-input-file-hover');
    hoverEls.forEach(el => {
      const isPreviewable = el.dataset.isPreviewable === 'true';
      const thumbnail = el.dataset.thumbnail;
      if (isPreviewable && thumbnail) {
        el.addEventListener('mouseenter', () => {
          this.showTooltip(el, thumbnail, el.dataset.name);
        });
        el.addEventListener('mouseleave', () => {
          this.hideTooltip();
        });
      }
    });
  },

  /* ---------- Hover Preview Tooltip ---------- */
  showTooltip(targetEl, thumbnail, name) {
    let tooltip = document.getElementById('history-tooltip-preview');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'history-tooltip-preview';
      tooltip.className = 'history-tooltip-preview';
      document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
      <div class="history-tooltip-content">
        <img src="${thumbnail}" alt="${name}" style="max-width: 280px; max-height: 280px; object-fit: contain;" />
        <div class="history-tooltip-name">${name}</div>
      </div>
    `;

    tooltip.style.display = 'block';

    const rect = targetEl.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Tenta posicionar à direita do elemento com espaçamento seguro
    let left = rect.right + window.scrollX + 16;
    let top = rect.top + window.scrollY + (rect.height - tooltipRect.height) / 2;

    // Se estourar a tela na direita, posiciona à esquerda do texto
    if (left + tooltipRect.width > window.innerWidth - 15) {
      left = rect.left + window.scrollX - tooltipRect.width - 16;
    }

    // Garante limites da tela (topo, base e esquerda)
    if (left < 10) left = 10;
    if (top < window.scrollY + 10) {
      top = window.scrollY + 10;
    }
    if (top + tooltipRect.height > window.scrollY + window.innerHeight - 10) {
      top = window.scrollY + window.innerHeight - tooltipRect.height - 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // smooth fade in animation
    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'scale(1)';
    });
  },

  hideTooltip() {
    const tooltip = document.getElementById('history-tooltip-preview');
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'scale(0.96)';
    }
  },

  /* ---------- Operation Icons ---------- */
  getOperationIcon(operation) {
    const icons = {
      'Conversão de Imagem': '🖼️',
      'Imagens para PDF': '📄',
      'Juntar PDFs': '📎',
      'Dividir PDF': '✂️',
      'Conversão de Planilha': '📊',
      'Conversão de Documento': '📝',
      'PDF para Imagens': '🖼️',
      'OCR (PDF Pesquisável)': '🔍',
      'OCR (Extração de Texto)': '📝',
      'Compressão de Vídeo (WhatsApp)': '🎬',
      'Compressão de Áudio (MP3 Leve)': '🎵'
    };
    return icons[operation] || '🔄';
  },

  getOperationBadgeClass(operation) {
    const classes = {
      'Conversão de Imagem': 'badge-image',
      'Imagens para PDF': 'badge-pdf',
      'Juntar PDFs': 'badge-pdf',
      'Dividir PDF': 'badge-pdf',
      'Conversão de Planilha': 'badge-spreadsheet',
      'Conversão de Documento': 'badge-document',
      'PDF para Imagens': 'badge-image',
      'OCR (PDF Pesquisável)': 'badge-pdf',
      'OCR (Extração de Texto)': 'badge-document',
      'Compressão de Vídeo (WhatsApp)': 'badge-image',
      'Compressão de Áudio (MP3 Leve)': 'badge-document'
    };
    return classes[operation] || 'badge-other';
  }
};
