/* ============================================
   CONVERT APP — Upload Module
   Drag & drop + file input upload handling
   ============================================ */

const Upload = {
  instances: {},

  init() {
    this.setupDropZone('convert', null, (files) => {
      FileManager.addFiles(files, 'convert');
      Converter.onFilesAdded('convert');
    });

    this.setupDropZone('img-to-pdf', 'image/*', (files) => {
      FileManager.addFiles(files, 'img-to-pdf');
      ImageLayout.onFilesAdded();
    });

    this.setupDropZone('pdf-to-img', '.pdf', (files) => {
      FileManager.addFiles(files, 'pdf-to-img');
      Converter.onFilesAdded('pdf-to-img');
    });

    this.setupDropZone('merge-pdf', '.pdf', (files) => {
      FileManager.addFiles(files, 'merge-pdf');
      PdfTools.onMergeFilesAdded();
    });

    this.setupDropZone('split-pdf', '.pdf', (files) => {
      FileManager.addFiles(files, 'split-pdf');
      PdfTools.onSplitFileAdded();
    });

    this.setupDropZone('spreadsheet', '.xlsx,.xls,.csv,.ods,.tsv', (files) => {
      FileManager.addFiles(files, 'spreadsheet');
      Converter.onFilesAdded('spreadsheet');
    });

    this.setupDropZone('documents', '.docx,.doc,.txt', (files) => {
      FileManager.addFiles(files, 'documents');
      Converter.onFilesAdded('documents');
    });

    this.setupDropZone('pje-optimize', '.pdf', (files) => {
      FileManager.addFiles(files, 'pje-optimize');
      PjeOptimize.onFilesAdded();
    });

    this.setupDropZone('ocr', 'image/*,.pdf', (files) => {
      FileManager.addFiles(files, 'ocr');
      Ocr.onFilesAdded();
    });

    this.setupDropZone('media-compress', 'audio/*,video/*,.mp3,.wav,.ogg,.m4a,.aac,.mp4,.avi,.mkv,.mov,.3gp,.webm', (files) => {
      FileManager.addFiles(files, 'media-compress');
      MediaCompress.onFilesAdded();
    });
  },

  setupDropZone(sectionId, acceptTypes, onFilesUploaded) {
    const dropZone = document.getElementById('drop-zone-' + sectionId);
    const browseBtn = document.getElementById('btn-browse-' + sectionId);
    if (!dropZone) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.id = 'file-input-' + sectionId;
    if (acceptTypes) {
      fileInput.accept = acceptTypes;
    }
    dropZone.appendChild(fileInput);

    this.instances[sectionId] = {
      dropZone,
      fileInput,
      acceptTypes,
      onFilesUploaded
    };

    /* Drag Events */
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.upload(files, sectionId);
      }
    });

    /* Click to Browse */
    dropZone.addEventListener('click', (e) => {
      if (e.target === fileInput || e.target.closest('.drop-zone-btn')) {
        return;
      }
      fileInput.click();
    });

    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this.upload(fileInput.files, sectionId);
        fileInput.value = '';
      }
    });
  },

  async upload(files, sectionId) {
    const instance = this.instances[sectionId];
    if (!instance) return;

    const BATCH_SIZE = 50;
    const totalFiles = files.length;
    const batches = [];
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      batches.push(Array.from(files).slice(i, i + BATCH_SIZE));
    }

    const progressBar = document.getElementById('progress-' + sectionId);
    const progressFill = document.getElementById('progress-fill-' + sectionId);

    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';

    let uploadedFiles = [];
    const totalBatches = batches.length;

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batchFiles = batches[b];
        const formData = new FormData();
        batchFiles.forEach(file => {
          formData.append('files', file);
        });

        const baseProgressPercent = (b / totalBatches) * 100;
        const batchWeight = 100 / totalBatches;

        const batchResults = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && progressFill) {
              const batchPercent = (e.loaded / e.total) * batchWeight;
              const overallPercent = Math.round(baseProgressPercent + batchPercent);
              progressFill.style.width = overallPercent + '%';
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(Array.isArray(response.files || response) ? (response.files || response) : [response]);
              } catch (err) {
                reject(new Error('Erro ao processar resposta do servidor'));
              }
            } else {
              let errorMsg = 'Erro ao enviar lote ' + (b + 1);
              try {
                const errData = JSON.parse(xhr.responseText);
                errorMsg = errData.error || errData.message || errorMsg;
              } catch (_) {}
              reject(new Error(errorMsg));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Erro de conexão ao enviar arquivos')));
          xhr.addEventListener('abort', () => reject(new Error('Envio cancelado')));

          xhr.open('POST', App.baseUrl + '/api/upload');
          xhr.send(formData);
        });

        uploadedFiles = uploadedFiles.concat(batchResults);
      }

      if (progressFill) progressFill.style.width = '100%';
      App.showToast(uploadedFiles.length + ' arquivo(s) enviado(s) com sucesso', 'success');
      instance.onFilesUploaded(uploadedFiles);
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (progressBar) {
        setTimeout(() => {
          progressBar.style.display = 'none';
          if (progressFill) progressFill.style.width = '0%';
        }, 500);
      }
    }
  }
};
