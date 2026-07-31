/* ============================================
   CONVERT APP — File Manager Module
   File tracking, rendering, selection, removal
   With Shift+Click range selection support
   ============================================ */

const FileManager = {
  files: new Map(),
  selectedFiles: new Set(),
  sectionFiles: {},
  lastClickedIndex: {},  /* Track last clicked index per section for Shift+Click */
  undoStack: [],

  pushUndoState(sectionId) {
    if (!sectionId) return;
    const snapshot = {
      sectionId: sectionId,
      selectedFiles: new Set(this.selectedFiles),
      sectionFiles: JSON.parse(JSON.stringify(this.sectionFiles[sectionId] || []))
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  },

  undo() {
    if (this.undoStack.length === 0) {
      App.showToast('Nada para desfazer', 'info');
      return;
    }
    const snapshot = this.undoStack.pop();
    const sectionId = snapshot.sectionId;

    this.selectedFiles = snapshot.selectedFiles;
    this.sectionFiles[sectionId] = snapshot.sectionFiles;
    
    // Restore file properties like rotation
    this.sectionFiles[sectionId].forEach(f => {
      if (this.files.has(f.id)) {
        const file = this.files.get(f.id);
        file.rotation = f.rotation;
      } else {
        this.files.set(f.id, f);
      }
    });

    this.renderSectionFiles(sectionId);
    this.updateSelectionCount(sectionId);
    App.showToast('Ação desfeita (Ctrl+Z)', 'success');
  },

  moveFileLeft(fileId, sectionId) {
    const arr = this.sectionFiles[sectionId] || [];
    const idx = arr.findIndex(f => f.id === fileId);
    if (idx > 0) {
      this.pushUndoState(sectionId);
      const temp = arr[idx];
      arr[idx] = arr[idx - 1];
      arr[idx - 1] = temp;
      this.renderSectionFiles(sectionId);
      this.updateSelectionCount(sectionId);
    }
  },

  moveFileRight(fileId, sectionId) {
    const arr = this.sectionFiles[sectionId] || [];
    const idx = arr.findIndex(f => f.id === fileId);
    if (idx < arr.length - 1 && idx !== -1) {
      this.pushUndoState(sectionId);
      const temp = arr[idx];
      arr[idx] = arr[idx + 1];
      arr[idx + 1] = temp;
      this.renderSectionFiles(sectionId);
      this.updateSelectionCount(sectionId);
    }
  },

  init() {
    this.sectionFiles = {
      'convert': [],
      'img-to-pdf': [],
      'pdf-to-img': [],
      'merge-pdf': [],
      'split-pdf': [],
      'spreadsheet': [],
      'documents': [],
      'pje-optimize': [],
      'ocr': [],
      'media-compress': []
    };
  },

  addFiles(filesArray, sectionId) {
    if (!Array.isArray(filesArray)) return;

    filesArray.forEach(file => {
      const fileId = file.id || file.fileId || ('f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
      const fileInfo = {
        id: fileId,
        name: file.name || file.originalName || file.filename || 'arquivo',
        size: file.size || 0,
        type: file.type || file.mimeType || '',
        category: file.category || App.detectCategory(file.name || file.originalName || ''),
        extension: (file.name || file.originalName || '').split('.').pop().toLowerCase(),
        section: sectionId
      };
      this.files.set(fileId, fileInfo);

      if (!this.sectionFiles[sectionId]) {
        this.sectionFiles[sectionId] = [];
      }
      this.sectionFiles[sectionId].push(fileInfo);
      
      // Auto-select files by default upon import
      this.selectedFiles.add(fileId);
    });

    this.renderSectionFiles(sectionId);

    /* Re-show controls and action bar that may have been hidden by removeFile when files became empty */
    const controls = document.getElementById('controls-' + sectionId);
    const actionBar = document.getElementById('action-bar-' + sectionId);
    if (controls) controls.style.display = '';
    if (actionBar) actionBar.style.display = '';
  },

  renderSectionFiles(sectionId) {
    const container = document.getElementById('file-list-' + sectionId);
    if (!container) return;

    const files = this.sectionFiles[sectionId] || [];
    const options = {
      selectable: true,
      removable: true,
      sortable: false
    };

    this.renderFileList(container, files, options, sectionId);
  },

  renderFileList(container, files, options, sectionId) {
    container.innerHTML = '';

    if (files.length === 0) {
      return;
    }

    /* For large file lists, use DocumentFragment for performance */
    const fragment = document.createDocumentFragment();

    files.forEach((file, index) => {
      const card = document.createElement('div');
      card.className = 'file-card';
      card.dataset.fileId = file.id;
      card.dataset.index = index;
      card.id = 'file-card-' + file.id;

      if (this.selectedFiles.has(file.id)) {
        card.classList.add('selected');
      }

      /* Thumbnail */
      const thumb = document.createElement('div');
      thumb.className = 'file-card-thumb';

      if (file.category === 'image' || file.category === 'pdf' || file.category === 'video') {
        const img = document.createElement('img');
        img.src = App.baseUrl + '/api/files/' + file.id + '/thumbnail';
        img.alt = file.name;
        img.loading = 'lazy';
        img.setAttribute('draggable', 'false');
        if (file.rotation && file.rotation !== 0) {
          img.style.transform = `rotate(${file.rotation}deg)`;
        }
        img.onerror = function () {
          this.style.display = 'none';
          const icon = document.createElement('span');
          icon.className = 'file-icon';
          icon.textContent = App.getFileIcon(file.category, file.extension);
          thumb.appendChild(icon);
        };
        thumb.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = App.getFileIcon(file.category, file.extension);
        thumb.appendChild(icon);
      }

      card.appendChild(thumb);

      /* File Name */
      const name = document.createElement('div');
      name.className = 'file-card-name';
      name.textContent = file.name;
      name.title = file.name;
      card.appendChild(name);

      /* File Info */
      const info = document.createElement('div');
      info.className = 'file-card-info';

      const sizeBadge = document.createElement('span');
      sizeBadge.textContent = App.formatFileSize(file.size);
      info.appendChild(sizeBadge);

      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge ' + App.getFileBadgeClass(file.category);
      typeBadge.textContent = App.getCategoryLabel(file.category);
      info.appendChild(typeBadge);

      card.appendChild(info);

      /* Check Mark */
      if (options.selectable) {
        const check = document.createElement('div');
        check.className = 'file-card-check';
        check.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        card.appendChild(check);
      }

      /* Remove Button */
      if (options.removable) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-card-remove';
        removeBtn.type = 'button';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remover arquivo';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeFile(file.id, sectionId);
        });
        card.appendChild(removeBtn);
      }

      /* Rotate Button (for images only) */
      if (file.category === 'image') {
        const rotateBtn = document.createElement('button');
        rotateBtn.className = 'file-card-rotate';
        rotateBtn.type = 'button';
        rotateBtn.title = 'Girar 90°';
        rotateBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        `;
        rotateBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.rotateImage(file.id, sectionId);
        });
        card.appendChild(rotateBtn);
      }

      /* Drag Handle — Click-to-Move Reorder (for img-to-pdf section only) */
      if (sectionId === 'img-to-pdf') {
        const dragBtn = document.createElement('div');
        dragBtn.className = 'file-card-drag';
        dragBtn.title = 'Clique para reordenar';
        dragBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="5 9 2 12 5 15"/>
            <polyline points="9 5 12 2 15 5"/>
            <polyline points="15 19 12 22 9 19"/>
            <polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
        `;
        dragBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.startClickReordering(card, file, container, sectionId);
        });
        card.appendChild(dragBtn);
      }

      /* Selection Toggle with Shift+Click support */
      if (options.selectable) {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.file-card-remove') || e.target.closest('.file-card-rotate') || e.target.closest('.file-card-drag')) return;

          const currentIndex = index;

          if (e.shiftKey && this.lastClickedIndex[sectionId] !== undefined) {
            /* Shift+Click: select range */
            const lastIndex = this.lastClickedIndex[sectionId];
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            this.selectRange(sectionId, start, end);
          } else {
            /* Normal click: toggle single */
            this.toggleSelection(file.id);
            card.classList.toggle('selected', this.selectedFiles.has(file.id));
          }

          this.lastClickedIndex[sectionId] = currentIndex;
          this.updateSelectionCount(sectionId);
        });
      }

      fragment.appendChild(card);
    });

    container.appendChild(fragment);

    this.lastClickedIndex[sectionId] = undefined;
    this.updateSelectionCount(sectionId);
  },

  /* Select a range of files by index */
  selectRange(sectionId, startIdx, endIdx) {
    this.pushUndoState(sectionId);
    const files = this.sectionFiles[sectionId] || [];
    const container = document.getElementById('file-list-' + sectionId);

    for (let i = startIdx; i <= endIdx; i++) {
      if (i < files.length) {
        this.selectedFiles.add(files[i].id);
      }
    }

    /* Update card UI */
    if (container) {
      const cards = container.querySelectorAll('.file-card');
      cards.forEach((card, idx) => {
        if (idx >= startIdx && idx <= endIdx) {
          card.classList.add('selected');
        }
      });
    }
  },

  toggleSelection(fileId) {
    this.pushUndoState(fileId ? this.files.get(fileId)?.section : 'img-to-pdf');
    if (this.selectedFiles.has(fileId)) {
      this.selectedFiles.delete(fileId);
    } else {
      this.selectedFiles.add(fileId);
    }
  },

  selectAll(sectionId) {
    this.pushUndoState(sectionId);
    const files = this.sectionFiles[sectionId] || [];
    files.forEach(f => this.selectedFiles.add(f.id));

    const container = document.getElementById('file-list-' + sectionId);
    if (container) {
      container.querySelectorAll('.file-card').forEach(c => c.classList.add('selected'));
    }
    this.updateSelectionCount(sectionId);
  },

  deselectAll(sectionId) {
    this.pushUndoState(sectionId || 'img-to-pdf');
    if (sectionId) {
      const files = this.sectionFiles[sectionId] || [];
      files.forEach(f => this.selectedFiles.delete(f.id));

      const container = document.getElementById('file-list-' + sectionId);
      if (container) {
        container.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
      }
      this.updateSelectionCount(sectionId);
    } else {
      this.selectedFiles.clear();
      document.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
    }
  },

  getSelectedFiles(sectionId) {
    const files = sectionId ? (this.sectionFiles[sectionId] || []) : Array.from(this.files.values());
    return files.filter(f => this.selectedFiles.has(f.id));
  },

  getFilesByCategory(category) {
    return Array.from(this.files.values()).filter(f => f.category === category);
  },

  getSectionFiles(sectionId) {
    return this.sectionFiles[sectionId] || [];
  },

  async removeFile(fileId, sectionId) {
    this.pushUndoState(sectionId || 'img-to-pdf');
    try {
      await App.api('/api/files/' + fileId, { method: 'DELETE' });
    } catch (err) {
      /* File may not exist on server, continue with UI removal */
    }

    this.files.delete(fileId);
    this.selectedFiles.delete(fileId);

    if (sectionId && this.sectionFiles[sectionId]) {
      this.sectionFiles[sectionId] = this.sectionFiles[sectionId].filter(f => f.id !== fileId);
    }

    const card = document.getElementById('file-card-' + fileId);
    if (card) {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.8)';
      setTimeout(() => card.remove(), 300);
    }

    this.updateSelectionCount(sectionId);

    if (sectionId) {
      const remaining = this.sectionFiles[sectionId].length;
      if (remaining === 0) {
        const controls = document.getElementById('controls-' + sectionId);
        const actionBar = document.getElementById('action-bar-' + sectionId);
        if (controls) controls.style.display = 'none';
        if (actionBar) actionBar.style.display = 'none';

        if (sectionId === 'merge-pdf') {
          const sortable = document.getElementById('sortable-merge-pdf');
          if (sortable) sortable.style.display = 'none';
          PdfTools.onMergeFilesAdded();
        }
        if (sectionId === 'split-pdf') {
          PdfTools.onSplitFileAdded();
        }
        if (sectionId === 'img-to-pdf') {
          ImageLayout.onFilesAdded();
        }
        if (sectionId === 'pje-optimize') {
          PjeOptimize.onFilesAdded();
        }
        if (sectionId === 'ocr') {
          Ocr.onFilesAdded();
        }
        if (sectionId === 'media-compress') {
          MediaCompress.onFilesAdded();
        }
      }
    }

    App.showToast('Arquivo removido', 'info');
  },

  clearFiles() {
    this.files.clear();
    this.selectedFiles.clear();
    this.lastClickedIndex = {};
    Object.keys(this.sectionFiles).forEach(key => {
      this.sectionFiles[key] = [];
    });
  },

  updateSelectionCount(sectionId) {
    if (!sectionId) return;

    const selected = this.getSelectedFiles(sectionId);
    const total = (this.sectionFiles[sectionId] || []).length;
    const countEl = document.getElementById('selected-count-' + sectionId);

    if (countEl) {
      if (total > 0) {
        countEl.textContent = selected.length + ' de ' + total + ' arquivo(s) selecionado(s)';
      } else {
        countEl.textContent = '0 arquivo(s) selecionado(s)';
      }
    }

    /* Enable/disable action buttons based on selection */
    const btnMap = {
      'convert': 'btn-convert',
      'img-to-pdf': 'btn-create-pdf',
      'pdf-to-img': 'btn-pdf-to-img',
      'spreadsheet': 'btn-convert-spreadsheet',
      'documents': 'btn-convert-documents'
    };

    const btnId = btnMap[sectionId];
    if (btnId) {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = selected.length === 0;
      }
    }

    if (sectionId === 'img-to-pdf' && typeof ImageLayout !== 'undefined') {
      ImageLayout.updateLivePreview();
    }
    if (sectionId === 'convert' && typeof Converter !== 'undefined') {
      Converter.updateConvertPreview();
    }
    if (sectionId === 'pdf-to-img' && typeof Converter !== 'undefined') {
      Converter.updatePdfToImgPreview();
    }
  },

  rotateImage(fileId, sectionId) {
    this.pushUndoState(sectionId || 'img-to-pdf');
    const file = this.files.get(fileId);
    if (!file || file.category !== 'image') return;

    file.rotation = (file.rotation || 0) + 90;
    if (file.rotation >= 360) {
      file.rotation = 0;
    }

    const card = document.getElementById('file-card-' + fileId);
    if (card) {
      const img = card.querySelector('.file-card-thumb img');
      if (img) {
        img.style.transform = `rotate(${file.rotation}deg)`;
        img.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    }

    this.updateSelectionCount(sectionId);
  },

  activeReorder: null,

  startClickReordering(movingCard, file, container, sectionId) {
    if (this.activeReorder) {
      this.activeReorder.commit();
      return;
    }

    // Save original DOM position and parent in case of cancel
    const originalParent = movingCard.parentNode;
    const originalNextSibling = movingCard.nextSibling;

    // Style movingCard as placeholder
    movingCard.classList.add('dragging-active-reorder');
    container.classList.add('reordering-active-container');

    // Create shadow companion
    const shadowCompanion = movingCard.cloneNode(true);
    shadowCompanion.classList.remove('dragging-active-reorder');
    shadowCompanion.classList.add('reorder-shadow-companion');
    
    // Set width and height of shadow same as card
    const rect = movingCard.getBoundingClientRect();
    shadowCompanion.style.width = rect.width + 'px';
    shadowCompanion.style.height = rect.height + 'px';
    
    // Position shadow centered on current mouse coordinates
    document.body.appendChild(shadowCompanion);

    // Initial position
    shadowCompanion.style.left = (window.event?.clientX || rect.left) - rect.width / 2 + 'px';
    shadowCompanion.style.top = (window.event?.clientY || rect.top) - rect.height / 2 + 'px';

    const onMouseMove = (e) => {
      shadowCompanion.style.left = (e.clientX - rect.width / 2) + 'px';
      shadowCompanion.style.top = (e.clientY - rect.height / 2) + 'px';

      // Check if mouse is hovering over any card in container
      const hoveredCard = document.elementFromPoint(e.clientX, e.clientY)?.closest('.file-card');
      if (hoveredCard && hoveredCard !== movingCard && hoveredCard.parentNode === container) {
        const hoverRect = hoveredCard.getBoundingClientRect();
        const isAfter = (e.clientX > hoverRect.left + hoverRect.width / 2) || (e.clientY > hoverRect.top + hoverRect.height / 2);
        
        if (isAfter) {
          container.insertBefore(movingCard, hoveredCard.nextSibling);
        } else {
          container.insertBefore(movingCard, hoveredCard);
        }
      }
    };

    const onClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      commit();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        cancel();
      }
    };

    const cleanListeners = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };

    const commit = () => {
      cleanListeners();

      // Fade out shadow companion
      shadowCompanion.style.opacity = '0';
      shadowCompanion.style.transform = 'scale(0.9) translateY(10px)';
      shadowCompanion.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => shadowCompanion.remove(), 200);

      movingCard.classList.remove('dragging-active-reorder');
      container.classList.remove('reordering-active-container');

      // Read new visual DOM order of cards
      const newOrder = [];
      const DOMcards = container.querySelectorAll('.file-card');
      DOMcards.forEach(c => {
        const fId = c.dataset.fileId;
        const found = this.sectionFiles[sectionId].find(f => f.id === fId);
        if (found) {
          newOrder.push(found);
        }
      });

      this.pushUndoState(sectionId);
      this.sectionFiles[sectionId] = newOrder;

      // Rerender so everything (like indexes, preview) is up-to-date and clean
      this.renderSectionFiles(sectionId);
      this.updateSelectionCount(sectionId);
      
      this.activeReorder = null;
      App.showToast('Ordem das imagens atualizada!', 'success');
    };

    const cancel = () => {
      cleanListeners();
      shadowCompanion.remove();

      movingCard.classList.remove('dragging-active-reorder');
      container.classList.remove('reordering-active-container');

      // Restore DOM position
      if (originalNextSibling) {
        originalParent.insertBefore(movingCard, originalNextSibling);
      } else {
        originalParent.appendChild(movingCard);
      }

      this.activeReorder = null;
      App.showToast('Reordenação cancelada', 'info');
    };

    // Attach listeners after current call stack to avoid self-clicking
    setTimeout(() => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
    }, 50);

    this.activeReorder = { commit, cancel };
    
    App.showToast('Passe o mouse sobre as fotos e clique no local desejado para soltar.', 'info');
  }
};
