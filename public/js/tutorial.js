/* ============================================
   CONVERT APP — Interactive Tutorial Engine
   Guia passo a passo com foco em elementos reais
   ============================================ */

const Tutorial = {
  activeTour: null,
  currentStepIndex: 0,
  steps: [],
  
  overlay: null,
  tooltip: null,
  highlightedElement: null,

  init() {
    this.createDomElements();
    this.setupResizeListener();
    this.setupHelpButtons();
  },

  setupHelpButtons() {
    const helpConfigs = {
      'btn-help-convert': 'convert',
      'btn-help-img-to-pdf': 'img-to-pdf',
      'btn-help-pdf-to-img': 'pdf-to-img',
      'btn-help-merge-pdf': 'merge-pdf',
      'btn-help-split-pdf': 'split-pdf',
      'btn-help-spreadsheet': 'spreadsheet',
      'btn-help-documents': 'documents',
      'btn-help-pje-optimize': 'pje-optimize',
      'btn-help-ocr': 'ocr',
      'btn-help-media-compress': 'media-compress',
      'btn-help-history': 'history'
    };

    Object.entries(helpConfigs).forEach(([btnId, tourName]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.start(tourName);
        });
      }
    });
  },

  createDomElements() {
    // 1. Dark Backdrop Overlay
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(5, 5, 10, 0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 999990;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // 2. Floating Tooltip Balloon
    const tooltip = document.createElement('div');
    tooltip.className = 'tutorial-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      z-index: 999995;
      background: var(--bg-secondary);
      border: 1.5px solid var(--accent-primary);
      border-radius: 12px;
      padding: 20px;
      width: 320px;
      box-shadow: 0 10px 30px rgba(108, 92, 231, 0.4), 0 0 15px rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transform: scale(0.9);
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: var(--font-family);
    `;
    document.body.appendChild(tooltip);
    this.tooltip = tooltip;
  },

  setupResizeListener() {
    window.addEventListener('resize', () => {
      if (this.activeTour) {
        this.positionHighlightAndTooltip();
      }
    });
    window.addEventListener('scroll', () => {
      if (this.activeTour) {
        this.positionHighlightAndTooltip();
      }
    }, true);
  },

  start(tourName) {
    const tours = {
      'convert': [
        {
          elementId: 'drop-zone-convert',
          title: '📁 1. Enviar Arquivos',
          description: 'Arraste e solte seus documentos, planilhas, fotos ou PDFs nesta área, ou clique no botão para selecionar os arquivos do computador.'
        },
        {
          elementId: 'controls-convert',
          title: '⚙️ 2. Escolher Formato',
          description: 'O sistema detecta automaticamente a categoria do arquivo e exibe a melhor opção de formato final de destino (ex: Word para PDF, Imagem para WebP).'
        },
        {
          elementId: 'btn-convert',
          title: '🚀 3. Iniciar Conversão',
          description: 'Clique em "Converter" para iniciar o processamento! Em instantes, o painel de resultados aparecerá abaixo para você baixar o arquivo convertido.'
        }
      ],
      'img-to-pdf': [
        {
          elementId: 'drop-zone-img-to-pdf',
          title: '📸 1. Enviar Imagens',
          description: 'Arraste suas fotos aqui ou selecione-as. O Convert suporta centenas de imagens simultâneas e converte arquivos do iPhone (.HEIC) automaticamente!'
        },
        {
          elementId: 'toolbar-img-to-pdf',
          title: '🔄 2. Controles de Seleção e Reordenação',
          description: 'Use o botão "Deselecionar Tudo" ou "Selecionar Tudo" para gerenciar em massa. Para alterar a ordem das páginas do PDF final, **segure o ícone de 4 setas** em cada card e arraste na ordem que preferir!'
        },
        {
          elementId: 'controls-img-to-pdf',
          title: '⚙️ 3. Configurações de Página',
          description: 'Personalize o tamanho do papel (A4, Carta ou Ajustar à imagem), modo de preenchimento, margem das folhas e ative a **Numeração de Páginas (Estilo Judicial)** para processos no PJe.'
        },
        {
          elementId: 'btn-create-pdf',
          title: '🚀 4. Gerar e Baixar PDF',
          description: 'Clique em "Criar PDF" para processar! Acompanhe a barra de progresso flutuante que subirá de 0% a 100% no canto inferior direito.'
        }
      ],
      'pdf-to-img': [
        {
          elementId: 'drop-zone-pdf-to-img',
          title: '📄 1. Enviar o PDF',
          description: 'Selecione ou arraste o documento PDF que você deseja desmembrar em imagens individuais.'
        },
        {
          elementId: 'controls-pdf-to-img',
          title: '⚙️ 2. Ajustes de Saída',
          description: 'Escolha se deseja salvar as páginas em formato PNG (alta qualidade) ou JPEG (mais leve), além de ajustar a resolução máxima das imagens geradas.'
        },
        {
          elementId: 'btn-pdf-to-img',
          title: '🚀 3. Extrair Páginas',
          description: 'Clique em "Extrair Imagens" para transformar cada página do PDF em um arquivo de foto individual e baixar tudo compactado em um arquivo .ZIP!'
        }
      ],
      'merge-pdf': [
        {
          elementId: 'drop-zone-merge-pdf',
          title: '📚 1. Upload de Múltiplos PDFs',
          description: 'Arraste os arquivos PDF que você deseja juntar e mesclar em um único arquivo final.'
        },
        {
          elementId: 'controls-merge-pdf',
          title: '↕️ 2. Organizar Sequência',
          description: 'Visualize e altere a ordem dos PDFs anexados clicando nas setas de Mover para cima ou para baixo, garantindo que a sequência das folhas fique correta.'
        },
        {
          elementId: 'btn-merge-pdf',
          title: '🚀 3. Mesclar PDFs',
          description: 'Clique em "Mesclar PDFs" para unir instantaneamente os documentos em um único arquivo estruturado!'
        }
      ],
      'split-pdf': [
        {
          elementId: 'drop-zone-split-pdf',
          title: '✂️ 1. Enviar PDF para Divisão',
          description: 'Adicione o PDF volumoso que você precisa recortar ou fracionar.'
        },
        {
          elementId: 'controls-split-pdf',
          title: '⚙️ 2. Definir Intervalo de Páginas',
          description: 'Defina as regras de extração! Você pode extrair todas as páginas separadas, escolher um intervalo personalizado (ex: 2-5, 8-12) ou fatiar em blocos menores.'
        },
        {
          elementId: 'btn-split-pdf',
          title: '🚀 3. Executar Divisão',
          description: 'Clique em "Dividir PDF" para obter os arquivos gerados prontos para download.'
        }
      ],
      'pje-optimize': [
        {
          elementId: 'drop-zone-pje-optimize',
          title: '⚖️ 1. Enviar Peça ou Processo',
          description: 'Suba o PDF jurídico (petição, provas judiciais, certidões) que precisa enviar ao PJe ou outro portal de tribunal que possui limites estritos de tamanho.'
        },
        {
          elementId: 'controls-pje-optimize',
          title: '⚙️ 2. Escolher Modo PJe',
          description: 'Escolha entre **Dividir por tamanho** (ex: criar fatias sequenciais de no máximo 5MB cada) ou **Comprimir e Achatar** (compacta fotos, otimiza fontes antigas e achata formulários/assinaturas digitais para evitar erros de leitura nos tribunais).'
        },
        {
          elementId: 'btn-pje-optimize',
          title: '🚀 3. Otimizar para o Tribunal',
          description: 'Clique no botão de ação para finalizar. O Convert processará o documento com alto desempenho e garantirá arquivos compatíveis com o PJe!'
        }
      ],
      'spreadsheet': [
        {
          elementId: 'drop-zone-spreadsheet',
          title: '📊 1. Upload de Planilhas',
          description: 'Adicione planilhas em formato Excel (.xlsx), CSV ou ODS para converter ou otimizar.'
        },
        {
          elementId: 'controls-spreadsheet',
          title: '⚙️ 2. Configurar Saída',
          description: 'Defina se quer converter XLS/CSV para XLSX moderno ou exportar dados no formato ideal para importações em outros sistemas.'
        },
        {
          elementId: 'btn-convert-spreadsheet',
          title: '🚀 3. Processar Planilha',
          description: 'Conclua a operação e baixe a planilha convertida e higienizada.'
        }
      ],
      'documents': [
        {
          elementId: 'drop-zone-documents',
          title: '✍️ 1. Enviar Documento',
          description: 'Adicione arquivos de texto em formato Word (.docx, .doc), Rich Text (.rtf) ou PDF.'
        },
        {
          elementId: 'controls-documents',
          title: '⚙️ 2. Ajustes e Destino',
          description: 'Escolha se deseja converter Word em PDF de alta fidelidade ou converter PDF em Word editável.'
        },
        {
          elementId: 'btn-convert-documents',
          title: '🚀 3. Executar Conversão',
          description: 'Finalize o processamento do seu documento de texto de forma rápida e segura!'
        }
      ],
      'ocr': [
        {
          elementId: 'drop-zone-ocr',
          title: '🔍 1. Upload para OCR',
          description: 'Suba o PDF digitalizado (sem texto copiável) ou imagem (foto de contrato, certidão, petição escaneada) de onde precisa extrair o texto.'
        },
        {
          elementId: 'controls-ocr',
          title: '⚙️ 2. Opções de OCR',
          description: 'Selecione o idioma do arquivo (Português é o padrão de alta precisão) e escolha se deseja gerar um **PDF Pesquisável (com texto selecionável via Ctrl+F)** ou exportar apenas o texto puro (.TXT).'
        },
        {
          elementId: 'btn-ocr-start',
          title: '🚀 3. Iniciar Leitura',
          description: 'Clique em "Iniciar Reconhecimento". O Convert lerá página por página e montará o arquivo final pronto para baixar!'
        }
      ],
      'media-compress': [
        {
          elementId: 'drop-zone-media-compress',
          title: '🎬 1. Upload de Áudio/Vídeo',
          description: 'Adicione a mídia que você gravou no celular, no WhatsApp ou recebeu como prova para seu processo.'
        },
        {
          elementId: 'controls-media-compress',
          title: '⚙️ 2. Regras de Tamanho',
          description: 'Para **Vídeos**, escolha entre Compressão Inteligente ou defina o tamanho limite do tribunal (ex: 10MB, 20MB). Para **Áudios**, ele converte automaticamente para MP3 mono super encolhido.'
        },
        {
          elementId: 'btn-media-compress-start',
          title: '🚀 3. Executar Compressão',
          description: 'Clique em "Comprimir Mídia". O FFmpeg processará o arquivo rapidamente e reduzirá drasticamente o peso para caber no seu processo!'
        }
      ],
      'history': [
        {
          elementId: 'history-list',
          title: '📜 1. Histórico de Operações',
          description: 'Aqui você acompanha todas as conversões, divisões e otimizações realizadas no aplicativo. É possível baixar novamente qualquer arquivo gerado enquanto o servidor estiver rodando!'
        },
        {
          elementId: 'history-list',
          title: '👁️ 2. Visualização Rápida (Hover)',
          description: 'Passe o mouse por cima do nome de qualquer arquivo de entrada na lista para abrir um balãozinho com a pré-visualização do conteúdo. Muito útil para conferir qual arquivo era sem precisar abrir de novo!'
        },
        {
          elementId: 'btn-clear-history',
          title: '🧹 3. Limpar Histórico',
          description: 'Deseja limpar sua lista de atividades? Clique em "Limpar Histórico" para zerar todos os registros salvos localmente.'
        }
      ]
    };

    const tourSteps = tours[tourName];
    if (!tourSteps) return;

    this.steps = tourSteps;
    this.currentStepIndex = 0;
    this.activeTour = tourName;

    // Show overlay
    if (this.overlay) {
      this.overlay.style.opacity = '1';
      this.overlay.style.pointerEvents = 'auto';
    }
    if (this.tooltip) {
      this.tooltip.style.opacity = '1';
      this.tooltip.style.pointerEvents = 'auto';
    }

    this.renderStep();
  },

  renderStep() {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) {
      this.finish();
      return;
    }

    const step = this.steps[this.currentStepIndex];
    const target = document.getElementById(step.elementId);

    if (!target || target.offsetParent === null) {
      // If target not visible (e.g. workspace hidden), skip to next or finish
      this.currentStepIndex++;
      this.renderStep();
      return;
    }

    // Scroll element into view smoothly if needed
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Highlight target element
    this.highlightElement(target);

    // Build Tooltip HTML
    const isLast = this.currentStepIndex === this.steps.length - 1;
    this.tooltip.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.5px;">Passo ${this.currentStepIndex + 1} de ${this.steps.length}</span>
        <button class="tutorial-close-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; padding:0; line-height:1;">&times;</button>
      </div>
      <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif;">${step.title}</h4>
      <p style="margin: 0 0 16px 0; font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; font-weight: 400;">${step.description}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <button class="btn-secondary btn-sm" id="tutorial-prev-btn" style="padding: 6px 12px; font-size: 12.5px; opacity: ${this.currentStepIndex === 0 ? '0.3' : '1'}" ${this.currentStepIndex === 0 ? 'disabled' : ''}>Anterior</button>
        <button class="btn-primary btn-sm" id="tutorial-next-btn" style="padding: 6px 16px; font-size: 12.5px;">${isLast ? 'Entendi!' : 'Próximo'}</button>
      </div>
    `;

    // Position tooltip
    setTimeout(() => {
      this.positionHighlightAndTooltip();
      this.tooltip.style.transform = 'scale(1)';
    }, 150);

    // Attach button listeners
    this.tooltip.querySelector('#tutorial-next-btn').addEventListener('click', () => {
      this.currentStepIndex++;
      this.renderStep();
    });

    const prevBtn = this.tooltip.querySelector('#tutorial-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentStepIndex > 0) {
          this.currentStepIndex--;
          this.renderStep();
        }
      });
    }

    this.tooltip.querySelector('.tutorial-close-btn').addEventListener('click', () => {
      this.finish();
    });
  },

  highlightElement(el) {
    if (this.highlightedElement) {
      this.highlightedElement.style.position = '';
      this.highlightedElement.style.zIndex = '';
      this.highlightedElement.style.boxShadow = '';
      this.highlightedElement.style.pointerEvents = '';
    }

    this.highlightedElement = el;
    el.style.position = 'relative';
    el.style.zIndex = '999992';
    el.style.boxShadow = '0 0 0 6px rgba(108, 92, 231, 0.35), 0 10px 40px rgba(0, 0, 0, 0.5)';
    el.style.pointerEvents = 'auto'; // allow interaction with the element
  },

  positionHighlightAndTooltip() {
    if (!this.highlightedElement || !this.tooltip) return;

    const elRect = this.highlightedElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    let top = 0;
    let left = 0;

    // Calculate optimal placement: prefer below, then above, then sides
    const spacing = 15;
    
    // Check if there is enough space below
    if (elRect.bottom + tooltipRect.height + spacing < window.innerHeight) {
      top = elRect.bottom + spacing;
      left = elRect.left + (elRect.width - tooltipRect.width) / 2;
    } else if (elRect.top - tooltipRect.height - spacing > 0) {
      // Place above
      top = elRect.top - tooltipRect.height - spacing;
      left = elRect.left + (elRect.width - tooltipRect.width) / 2;
    } else {
      // Place in center of screen if no space
      top = (window.innerHeight - tooltipRect.height) / 2;
      left = (window.innerWidth - tooltipRect.width) / 2;
    }

    // Keep within window bounds
    const margin = 10;
    if (left < margin) left = margin;
    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tooltipRect.width - margin;
    }

    this.tooltip.style.top = top + 'px';
    this.tooltip.style.left = left + 'px';
  },

  finish() {
    if (this.highlightedElement) {
      this.highlightedElement.style.position = '';
      this.highlightedElement.style.zIndex = '';
      this.highlightedElement.style.boxShadow = '';
      this.highlightedElement.style.pointerEvents = '';
      this.highlightedElement = null;
    }

    if (this.overlay) {
      this.overlay.style.opacity = '0';
      this.overlay.style.pointerEvents = 'none';
    }
    if (this.tooltip) {
      this.tooltip.style.opacity = '0';
      this.tooltip.style.transform = 'scale(0.9)';
      this.tooltip.style.pointerEvents = 'none';
    }

    this.activeTour = null;
    App.showToast('Tutorial concluído!', 'info');
  }
};
