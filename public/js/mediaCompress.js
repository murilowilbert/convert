/* ============================================
   CONVERT APP — Media Compressor Module
   FFmpeg media compress frontend controller
   ============================================ */

const MediaCompress = {
  options: {
    mode: 'intelligent', // 'intelligent' or 'limit'
    limitMb: 10
  },

  init() {
    this.setupVideoOptions();
    this.setupActionButton();
  },

  /* ---------- Options Handler ---------- */
  setupVideoOptions() {
    const modeButtons = document.querySelectorAll('#media-video-modes .page-size-option');
    const limitRow = document.getElementById('media-video-limit-row');
    const limitSelect = document.getElementById('select-media-video-limit');

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.options.mode = btn.dataset.value;

        if (this.options.mode === 'limit') {
          if (limitRow) limitRow.style.display = 'block';
        } else {
          if (limitRow) limitRow.style.display = 'none';
        }

        // Atualiza a estimativa de tamanho instantaneamente ao mudar de modo
        const files = FileManager.getSectionFiles('media-compress');
        if (files.length > 0) {
          this.updateSavingsDisplay(files[0]);
        }
      });
    });

    if (limitSelect) {
      limitSelect.addEventListener('change', () => {
        this.options.limitMb = parseFloat(limitSelect.value) || 10;
        
        // Atualiza a estimativa de tamanho instantaneamente ao mudar o limite
        const files = FileManager.getSectionFiles('media-compress');
        if (files.length > 0) {
          this.updateSavingsDisplay(files[0]);
        }
      });
    }
  },

  /* ---------- Action Button Trigger ---------- */
  setupActionButton() {
    const btn = document.getElementById('btn-media-compress-start');
    if (btn) {
      btn.addEventListener('click', () => this.handleCompress());
    }
  },

  /* ---------- On Files Added ---------- */
  async onFilesAdded() {
    const files = FileManager.getSectionFiles('media-compress');

    // enforce single file mode
    if (files.length > 1) {
      const last = files[files.length - 1];
      for (const f of files) {
        if (f.id !== last.id) {
          FileManager.files.delete(f.id);
          FileManager.selectedFiles.delete(f.id);
        }
      }
      FileManager.sectionFiles['media-compress'] = [last];
      FileManager.renderSectionFiles('media-compress');
      return;
    }

    const workspace = document.getElementById('workspace-media-compress');
    const results = document.getElementById('results-media-compress');
    
    if (results) results.style.display = 'none';

    if (files.length === 0) {
      if (workspace) workspace.style.display = 'none';
      this.updateLivePreview(null);
      return;
    }

    const file = files[0];
    if (workspace) workspace.style.display = 'flex';

    const infoText = document.getElementById('media-compress-info-text');
    if (infoText) {
      infoText.textContent = `Carregando informações da mídia...`;
    }

    const startBtn = document.getElementById('btn-media-compress-start');
    if (startBtn) startBtn.disabled = true;

    // Toggle controls based on category
    const videoControls = document.getElementById('media-video-controls');
    const audioControls = document.getElementById('media-audio-controls');

    if (file.category === 'video') {
      if (videoControls) videoControls.style.display = 'block';
      if (audioControls) audioControls.style.display = 'none';
      if (infoText) infoText.textContent = `Vídeo: ${file.name} (${App.formatFileSize(file.size)})`;
    } else {
      if (videoControls) videoControls.style.display = 'none';
      if (audioControls) audioControls.style.display = 'block';
      if (infoText) infoText.textContent = `Áudio: ${file.name} (${App.formatFileSize(file.size)})`;
    }

    this.updateLivePreview(file);

    // Carrega informações extras de duração da API do servidor
    try {
      const data = await App.api(`/api/media/info?fileId=${file.id}`);
      file.duration = data.duration || 0;
    } catch (err) {
      console.warn('[MediaCompress] Erro ao carregar informações de duração da mídia:', err);
      file.duration = 0;
    }

    if (infoText) {
      const durText = file.duration ? ` — ${Math.round(file.duration)}s` : '';
      if (file.category === 'video') {
        infoText.textContent = `Vídeo: ${file.name} (${App.formatFileSize(file.size)})${durText}`;
      } else {
        infoText.textContent = `Áudio: ${file.name} (${App.formatFileSize(file.size)})${durText}`;
      }
    }

    if (startBtn) startBtn.disabled = false;
    this.updateSavingsDisplay(file);
  },

  /* ---------- Update Live Preview ---------- */
  updateLivePreview(file) {
    const container = document.getElementById('media-compress-live-preview-container');
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

    if (file.category === 'video') {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; padding: 24px; background: rgba(255,255,255,0.02); border: 1px dashed var(--glass-border); border-radius: 12px; width: 100%;">
          <div style="width: 100%; max-width: 320px; aspect-ratio: 16/10; overflow: hidden; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <img src="${App.baseUrl}/api/files/${file.id}/thumbnail" alt="${file.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\'font-size: 64px;\'>🎬</div>';" />
          </div>
          <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; text-align: center; margin: 0 0 8px 0; word-break: break-all;">
            ${file.name}
          </h4>
          <span class="badge badge-image" style="margin-bottom: 12px;">
            Vídeo
          </span>
          
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; margin-top: 6px;">
            <span style="font-size: 13px; color: var(--text-secondary);">
              Tamanho Original: <strong>${App.formatFileSize(file.size)}</strong>
            </span>
            <div id="media-compress-savings-estimate" style="font-size: 13px; color: var(--accent-primary); font-weight: 600; text-align: center; margin-top: 4px; padding: 6px 12px; background: rgba(108, 92, 231, 0.08); border: 1px solid rgba(108, 92, 231, 0.15); border-radius: 8px;">
              Calculando estimativa de tamanho...
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; padding: 24px; background: rgba(255,255,255,0.02); border: 1px dashed var(--glass-border); border-radius: 12px; width: 100%;">
          <div style="font-size: 64px; margin-bottom: 16px;">
            🎵
          </div>
          <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; text-align: center; margin: 0 0 8px 0; word-break: break-all;">
            ${file.name}
          </h4>
          <span class="badge badge-document" style="margin-bottom: 12px;">
            Áudio
          </span>
          
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; margin-top: 6px;">
            <span style="font-size: 13px; color: var(--text-secondary);">
              Tamanho Original: <strong>${App.formatFileSize(file.size)}</strong>
            </span>
            <div id="media-compress-savings-estimate" style="font-size: 13px; color: var(--accent-primary); font-weight: 600; text-align: center; margin-top: 4px; padding: 6px 12px; background: rgba(108, 92, 231, 0.08); border: 1px solid rgba(108, 92, 231, 0.15); border-radius: 8px;">
              Calculando estimativa de tamanho...
            </div>
          </div>
        </div>
      `;
    }
  },

  /* ---------- Update Savings Display ---------- */
  updateSavingsDisplay(file) {
    const estimateEl = document.getElementById('media-compress-savings-estimate');
    if (!estimateEl) return;

    if (!file) {
      estimateEl.style.display = 'none';
      return;
    }

    estimateEl.style.display = 'block';
    let label = '';

    if (file.category === 'video') {
      if (this.options.mode === 'intelligent') {
        // WhatsApp CRF 28: reduz cerca de 65% a 85% do tamanho original
        const minEst = file.size * 0.15;
        const maxEst = file.size * 0.35;
        const savedPercent = 75; // Economia média
        label = `Tamanho Estimado: <strong style="color: #00ffcc;">~${App.formatFileSize(minEst)} a ${App.formatFileSize(maxEst)}</strong> (Redução de ~${savedPercent}%)`;
      } else {
        // Modo peso limite (target: limitMb * 0.92)
        const limitBytes = this.options.limitMb * 1024 * 1024;
        const estBytes = limitBytes * 0.90; // targeted slightly below safety margin

        if (estBytes >= file.size) {
          label = `Tamanho Estimado: <strong style="color: #00ffcc;">Original já é menor (${App.formatFileSize(file.size)})</strong>`;
        } else {
          const savedPercent = Math.round((1 - estBytes / file.size) * 100);
          label = `Tamanho Estimado: <strong style="color: #00ffcc;">~${App.formatFileSize(estBytes)}</strong> (Redução de ~${savedPercent}%)`;
        }
      }
    } else {
      // Audio: Constant 64kbps mono MP3
      if (file.duration) {
        const estBytes = file.duration * 8000; // 64kbps = 8000 bytes/sec
        if (estBytes >= file.size) {
          label = `Tamanho Estimado: <strong style="color: #00ffcc;">Original já é menor (${App.formatFileSize(file.size)})</strong>`;
        } else {
          const savedPercent = Math.round((1 - estBytes / file.size) * 100);
          label = `Tamanho Estimado: <strong style="color: #00ffcc;">~${App.formatFileSize(estBytes)}</strong> (Redução de ~${savedPercent}%)`;
        }
      } else {
        // Fallback
        const estBytes = file.size * 0.20;
        label = `Tamanho Estimado: <strong style="color: #00ffcc;">~${App.formatFileSize(estBytes)}</strong> (Redução de ~80%)`;
      }
    }

    estimateEl.innerHTML = label;
  },

  /* ---------- Action Handler ---------- */
  async handleCompress() {
    const files = FileManager.getSectionFiles('media-compress');
    if (files.length === 0) return;

    const file = files[0];
    const startBtn = document.getElementById('btn-media-compress-start');
    if (startBtn) startBtn.disabled = true;

    const opLabel = file.category === 'video' ? 'Comprimindo vídeo via FFmpeg...' : 'Comprimindo áudio em MP3...';
    FloatingProgressWidget.show(opLabel + ' Isso pode levar algum tempo.');

    try {
      const data = await App.api('/api/media/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          mode: this.options.mode,
          limitMb: this.options.limitMb
        })
      });

      const results = data.file ? [data.file] : (data.files || []);

      // Exibe os resultados
      Converter.showResults('media-compress', results);

      // Salva no histórico
      if (typeof History !== 'undefined') {
        const inputFiles = [{ id: file.id, name: file.name, size: file.size }];
        const outputFiles = results.map(f => ({
          id: f.id,
          name: f.originalName || f.filename,
          size: f.size || 0,
          path: f.path || ''
        }));
        
        const label = file.category === 'video' ? 'Compressão de Vídeo (WhatsApp)' : 'Compressão de Áudio (MP3 Leve)';
        History.addEntry(label, inputFiles, outputFiles);
      }

      FloatingProgressWidget.success('Mídia comprimida com sucesso!', results);
    } catch (err) {
      console.error(err);
      App.showToast('Erro ao comprimir mídia: ' + err.message, 'error');
      FloatingProgressWidget.error('Erro na compressão: ' + err.message);
    } finally {
      if (startBtn) startBtn.disabled = false;
    }
  }
};
