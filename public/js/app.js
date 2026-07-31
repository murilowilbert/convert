/* ============================================
   CONVERT APP — Main Application Controller
   ============================================ */

/* ============================================
   CUSTOM SELECT DROPDOWN (MedPet Style)
   ============================================ */
const CustomDropdown = {
  initAll() {
    const selects = document.querySelectorAll('select.control-select');
    selects.forEach(select => {
      this.create(select);
    });
  },

  create(select) {
    if (select.dataset.customized === 'true') return;
    select.dataset.customized = 'true';

    // Hide native select
    select.style.display = 'none';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-dropdown-wrapper';
    wrapper.id = (select.id || 'select') + '-custom-wrapper';

    // Create button
    const btn = document.createElement('button');
    btn.className = 'custom-dropdown-btn';
    btn.type = 'button';
    
    const selectedSpan = document.createElement('span');
    selectedSpan.className = 'selected-value';
    
    // Get currently selected option text
    const activeOpt = select.options[select.selectedIndex] || select.options[0];
    selectedSpan.textContent = activeOpt ? activeOpt.textContent : 'Selecione...';
    
    btn.appendChild(selectedSpan);

    // Chevron SVG
    btn.innerHTML += `
      <svg class="dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `;

    // Create menu
    const menu = document.createElement('ul');
    menu.className = 'custom-dropdown-menu';
    menu.style.display = 'none';

    // Populate menu options
    const renderOptions = () => {
      menu.innerHTML = '';
      Array.from(select.options).forEach((opt, idx) => {
        const li = document.createElement('li');
        li.className = 'custom-dropdown-option';
        if (opt.value === select.value) {
          li.classList.add('active');
        }
        li.dataset.value = opt.value;
        li.dataset.index = idx;
        li.textContent = opt.textContent;

        li.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Update native select value
          select.value = opt.value;
          
          // Trigger change event
          const event = new Event('change', { bubbles: true });
          select.dispatchEvent(event);

          // Update active class on options
          menu.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
          li.classList.add('active');

          // Update label text
          selectedSpan.textContent = opt.textContent;

          // Close menu
          menu.style.display = 'none';
          btn.classList.remove('active');
        });

        menu.appendChild(li);
      });
    };

    renderOptions();

    // Toggle menu
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'block';
      
      // Close all other open custom dropdowns first
      document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
      });
      document.querySelectorAll('.custom-dropdown-btn').forEach(b => {
        if (b !== btn) b.classList.remove('active');
      });

      menu.style.display = isVisible ? 'none' : 'block';
      btn.classList.toggle('active', !isVisible);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        menu.style.display = 'none';
        btn.classList.remove('active');
      }
    });

    // Watch for programmatic changes on native select
    const observer = new MutationObserver(() => {
      renderOptions();
      const currentOpt = select.options[select.selectedIndex] || select.options[0];
      if (currentOpt) {
        selectedSpan.textContent = currentOpt.textContent;
      }
    });
    observer.observe(select, { childList: true, subtree: true, attributes: true });

    // Also listen to change event to keep in sync
    select.addEventListener('change', () => {
      const currentOpt = select.options[select.selectedIndex];
      if (currentOpt) {
        selectedSpan.textContent = currentOpt.textContent;
        menu.querySelectorAll('.custom-dropdown-option').forEach(li => {
          li.classList.toggle('active', li.dataset.value === select.value);
        });
      }
    });

    // Insert wrapper in DOM
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select); // move native select inside wrapper
    wrapper.appendChild(btn);
    wrapper.appendChild(menu);
  }
};

const App = {
  currentSection: 'convert',
  baseUrl: '',

  init() {
    this.setupNavigation();
    this.setupMobileMenu();
    this.setupSidebarToggle();
    this.setupClearAll();

    Upload.init();
    FileManager.init();
    Converter.init();
    PdfTools.init();
    ImageLayout.init();
    PjeOptimize.init();
    Ocr.init();
    MediaCompress.init();
    History.init();
    Tutorial.init();
    FloatingProgressWidget.init();

    // Initialize custom dropdowns globally
    CustomDropdown.initAll();

    // Global keyboard listener for Ctrl + Z (Undo)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          return;
        }
        e.preventDefault();
        FileManager.undo();
      }
    });

    this.navigate('convert');
  },

  /* ---------- Navigation ---------- */
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.getAttribute('data-section');
        this.navigate(section);
      });
    });
  },

  navigate(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => sec.classList.remove('active'));

    const target = document.getElementById('section-' + sectionId);
    if (target) {
      target.classList.add('active');
    }

    const navItems = document.querySelectorAll('.nav-item[data-section]');
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === sectionId) {
        item.classList.add('active');
      }
    });

    this.currentSection = sectionId;

    /* Refresh history when navigating to it */
    if (sectionId === 'history' && typeof History !== 'undefined') {
      History.loadHistory();
    }
  },

  /* ---------- Mobile Menu ---------- */
  setupMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !toggle.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });

      const navItems = document.querySelectorAll('.nav-item[data-section]');
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
          }
        });
      });
    }
  },

  /* ---------- Sidebar Toggle (Collapse / Hide) ---------- */
  setupSidebarToggle() {
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const expandBtn = document.getElementById('sidebar-expand-btn');

    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        document.body.classList.add('sidebar-collapsed');
        if (expandBtn) expandBtn.style.display = 'flex';
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        document.body.classList.remove('sidebar-collapsed');
        expandBtn.style.display = 'none';
      });
    }
  },

  /* ---------- Clear All ---------- */
  setupClearAll() {
    const clearBtn = document.getElementById('nav-clear-all');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        const confirmed = await this.confirmDialog(
          'Tem certeza que deseja limpar todos os arquivos? Esta ação não pode ser desfeita.'
        );
        if (confirmed) {
          await this.clearAll();
        }
      });
    }
  },

  async clearAll() {
    try {
      await this.api('/api/files', { method: 'DELETE' });
      FileManager.clearFiles();

      const fileLists = document.querySelectorAll('.file-list');
      fileLists.forEach(list => { list.innerHTML = ''; });

      const sortableList = document.getElementById('sortable-list-merge-pdf');
      if (sortableList) sortableList.innerHTML = '';

      // Hide all workspaces and standalone panels to avoid permanently hiding nested .controls-panel elements (like preview boxes)
      const workspaces = document.querySelectorAll('[id^="workspace-"]');
      workspaces.forEach(ws => { ws.style.display = 'none'; });

      const spreadsheetControls = document.getElementById('controls-spreadsheet');
      if (spreadsheetControls) spreadsheetControls.style.display = 'none';

      const documentsControls = document.getElementById('controls-documents');
      if (documentsControls) documentsControls.style.display = 'none';

      const actionBars = document.querySelectorAll('[id^="action-bar-"]');
      actionBars.forEach(bar => { bar.style.display = 'none'; });

      const resultsPanels = document.querySelectorAll('.results-panel');
      resultsPanels.forEach(panel => { panel.style.display = 'none'; });

      const sortableContainer = document.getElementById('sortable-merge-pdf');
      if (sortableContainer) sortableContainer.style.display = 'none';

      /* Hide img-to-pdf workspace and toolbar */
      const workspace = document.getElementById('workspace-img-to-pdf');
      if (workspace) workspace.style.display = 'none';
      const toolbar = document.getElementById('toolbar-img-to-pdf');
      if (toolbar) toolbar.style.display = 'none';

      /* Hide pje-optimize workspace */
      const pjeWorkspace = document.getElementById('workspace-pje-optimize');
      if (pjeWorkspace) pjeWorkspace.style.display = 'none';

      this.showToast('Todos os arquivos foram removidos', 'success');
    } catch (err) {
      this.showToast('Erro ao limpar arquivos: ' + err.message, 'error');
    }
  },

  /* ---------- Toast Notifications ---------- */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast ' + type;

    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    toast.innerHTML =
      '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
      '<span class="toast-message">' + message + '</span>' +
      '<button class="toast-close" type="button">&times;</button>';

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.style.animation = 'slideOut 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  },

  /* ---------- Loading Overlay ---------- */
  showLoading(element) {
    if (!element) return;
    element.style.position = 'relative';
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-' + (element.id || Date.now());
    overlay.innerHTML = '<div class="spinner"></div>';
    element.appendChild(overlay);
  },

  hideLoading(element) {
    if (!element) return;
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
  },

  /* ---------- Utility Functions ---------- */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + units[i];
  },

  getFileIcon(category, extension) {
    const icons = {
      image: '🖼️',
      pdf: '📄',
      spreadsheet: '📊',
      document: '📝',
      video: '🎬',
      audio: '🎵'
    };
    return icons[category] || '📎';
  },

  getFileBadgeClass(category) {
    const classes = {
      image: 'badge-image',
      pdf: 'badge-pdf',
      spreadsheet: 'badge-spreadsheet',
      document: 'badge-document',
      video: 'badge-image',
      audio: 'badge-document'
    };
    return classes[category] || 'badge-other';
  },

  getCategoryLabel(category) {
    const labels = {
      image: 'Imagem',
      pdf: 'PDF',
      spreadsheet: 'Planilha',
      document: 'Documento',
      video: 'Vídeo',
      audio: 'Áudio'
    };
    return labels[category] || 'Arquivo';
  },

  detectCategory(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg', 'ico'];
    const pdfExts = ['pdf'];
    const spreadsheetExts = ['xlsx', 'xls', 'csv', 'ods', 'tsv'];
    const documentExts = ['docx', 'doc', 'txt', 'rtf', 'odt'];
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', '3gp', 'webm'];
    const audioExts = ['mp3', 'ogg', 'wav', 'm4a', 'aac'];

    if (imageExts.includes(ext)) return 'image';
    if (pdfExts.includes(ext)) return 'pdf';
    if (spreadsheetExts.includes(ext)) return 'spreadsheet';
    if (documentExts.includes(ext)) return 'document';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    return 'other';
  },

  /* ---------- Confirm Dialog ---------- */
  confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      const msgEl = document.getElementById('modal-message');
      const confirmBtn = document.getElementById('modal-confirm');
      const cancelBtn = document.getElementById('modal-cancel');

      msgEl.textContent = message;
      overlay.style.display = 'flex';

      const cleanup = () => {
        overlay.style.display = 'none';
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      const onOverlayClick = (e) => {
        if (e.target === overlay) { cleanup(); resolve(false); }
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
    });
  },

  /* ---------- API Wrapper ---------- */
  async api(url, options = {}) {
    try {
      const response = await fetch(this.baseUrl + url, {
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });

      if (!response.ok) {
        let errorMsg = 'Erro no servidor';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return response;
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error('Não foi possível conectar ao servidor. Verifique se o servidor está rodando.');
      }
      throw err;
    }
  }
};

/* ---------- Floating Progress Widget (Canva style) ---------- */
const FloatingProgressWidget = {
  element: null,
  badge: null,
  card: null,
  closeBtn: null,
  progressFill: null,
  percentText: null,
  loadingTitle: null,
  successTitle: null,
  actionsContainer: null,
  stateLoading: null,
  stateSuccess: null,
  
  lastFiles: [],
  lastTitle: '',
  collapseTimer: null,
  isExpanded: true,
  progressInterval: null,
  currentProgress: 0,

  init() {
    this.element = document.getElementById('floating-progress-widget');
    if (!this.element) return;

    this.badge = document.getElementById('widget-badge');
    this.card = document.getElementById('widget-card');
    this.closeBtn = document.getElementById('widget-close-btn');
    this.progressFill = document.getElementById('widget-progress-fill');
    this.percentText = document.getElementById('widget-progress-percent');
    this.loadingTitle = document.getElementById('widget-loading-title');
    this.successTitle = document.getElementById('widget-success-title');
    this.actionsContainer = document.getElementById('widget-actions');
    this.stateLoading = document.getElementById('widget-state-loading');
    this.stateSuccess = document.getElementById('widget-state-success');

    this.setupListeners();
  },

  setupListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
      });
    }

    if (this.badge) {
      this.badge.addEventListener('click', () => {
        this.expand();
      });
    }
  },

  show(title = 'Processando...') {
    clearTimeout(this.collapseTimer);
    clearInterval(this.progressInterval);
    this.lastTitle = title;
    this.isExpanded = true;

    if (this.element) this.element.style.display = 'flex';
    if (this.card) {
      this.card.style.display = 'block';
      this.card.style.transform = 'scale(1)';
      this.card.style.opacity = '1';
    }
    if (this.badge) this.badge.style.display = 'none';

    if (this.stateLoading) this.stateLoading.style.display = 'flex';
    if (this.stateSuccess) this.stateSuccess.style.display = 'none';
    if (this.loadingTitle) this.loadingTitle.textContent = title;
    
    // Smooth progress simulation from 0 to 95%
    this.currentProgress = 0;
    this.setProgress(0);
    this.progressInterval = setInterval(() => {
      if (this.currentProgress < 95) {
        const remaining = 95 - this.currentProgress;
        const step = Math.max(0.5, remaining * 0.05 + Math.random() * 0.5);
        this.currentProgress += step;
        this.setProgress(this.currentProgress);
      } else {
        clearInterval(this.progressInterval);
      }
    }, 100);
  },

  setProgress(percent) {
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    this.currentProgress = percent;

    if (this.percentText) {
      this.percentText.textContent = `${Math.round(percent)}%`;
    }

    if (this.progressFill) {
      this.progressFill.style.width = `${percent}%`;
    }
  },

  success(successTitle = 'Concluído!', files = []) {
    this.lastFiles = files;
    clearInterval(this.progressInterval);
    this.setProgress(100);

    setTimeout(() => {
      // Morph to success view
      if (this.stateLoading) this.stateLoading.style.display = 'none';
      if (this.stateSuccess) this.stateSuccess.style.display = 'flex';
      if (this.successTitle) this.successTitle.textContent = successTitle;

      // Render action buttons
      if (this.actionsContainer) {
        this.actionsContainer.innerHTML = '';
        if (files.length === 1) {
          const file = files[0];
          const fileId = file.id || file.fileId;
          const fileName = file.name || file.filename || 'download';
          
          const btn = document.createElement('button');
          btn.className = 'btn-primary';
          btn.type = 'button';
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Baixar PDF
          `;
          btn.addEventListener('click', () => {
            Converter.downloadFile(fileId, fileName);
          });
          this.actionsContainer.appendChild(btn);
        } else if (files.length > 1) {
          const allFileIds = files.map(f => f.id || f.fileId);
          const btnZip = document.createElement('button');
          btnZip.className = 'btn-primary';
          btnZip.type = 'button';
          btnZip.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Baixar Todos (ZIP)
          `;
          btnZip.addEventListener('click', () => {
            Converter.downloadAllZip(allFileIds);
          });
          this.actionsContainer.appendChild(btnZip);
        }
      }

      // Schedule elegant collapse to badge after exactly 1 second (1000ms)
      this.collapseTimer = setTimeout(() => {
        this.collapse();
      }, 1000);

    }, 300);
  },

  error(message = 'Erro ao processar') {
    clearInterval(this.progressInterval);
    if (this.stateLoading) this.stateLoading.style.display = 'none';
    if (this.stateSuccess) this.stateSuccess.style.display = 'flex';
    if (this.successTitle) this.successTitle.textContent = 'Ocorreu um erro';
    
    const subtitle = this.card.querySelector('.success-subtitle');
    if (subtitle) subtitle.textContent = message;

    const iconWrapper = this.card.querySelector('.success-icon-wrapper');
    if (iconWrapper) {
      iconWrapper.style.background = 'rgba(239, 68, 68, 0.15)';
      iconWrapper.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      iconWrapper.style.color = '#ef4444';
      iconWrapper.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
    }

    if (this.actionsContainer) {
      this.actionsContainer.innerHTML = '';
    }
  },

  collapse() {
    if (!this.isExpanded) return;
    this.isExpanded = false;

    if (this.card) {
      this.card.style.transform = 'scale(0.8)';
      this.card.style.opacity = '0';
      setTimeout(() => {
        this.card.style.display = 'none';
        if (this.badge) {
          this.badge.style.display = 'flex';
          this.badge.style.transform = 'scale(0)';
          setTimeout(() => {
            this.badge.style.transform = 'scale(1)';
          }, 50);
        }
      }, 300);
    }
  },

  expand() {
    if (this.isExpanded) return;
    this.isExpanded = true;

    clearTimeout(this.collapseTimer);

    if (this.badge) {
      this.badge.style.transform = 'scale(0)';
      setTimeout(() => {
        this.badge.style.display = 'none';
        if (this.card) {
          this.card.style.display = 'block';
          this.card.style.transform = 'scale(0.8)';
          this.card.style.opacity = '0';
          setTimeout(() => {
            this.card.style.transform = 'scale(1)';
            this.card.style.opacity = '1';
          }, 50);
        }
      }, 300);
    }
  },

  hide() {
    clearTimeout(this.collapseTimer);
    if (this.element) {
      this.element.style.display = 'none';
    }
  }
};

/* ---------- Initialize on DOM ready ---------- */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
