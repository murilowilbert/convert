const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { generateId, ensureDir } = require('../utils/fileUtils');

const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

// Dimensões de páginas em pontos (72 pontos por polegada)
const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

// Layout de grade para múltiplas imagens por página: [colunas, linhas]
const GRID_LAYOUTS = {
  1: [1, 1],
  2: [1, 2],
  4: [2, 2],
  6: [2, 3],
  9: [3, 3],
  12: [3, 4],
};

const pdfService = {
  /**
   * Cria um PDF a partir de imagens.
   * @param {string[]} imagePaths - Caminhos das imagens.
   * @param {object} [options] - Opções de criação.
   * @param {number} [options.margin=0] - Margem em pontos.
   * @param {'a4'|'letter'|'fit'} [options.pageSize='a4'] - Tamanho da página.
   * @param {1|2|4|6} [options.imagesPerPage=1] - Imagens por página.
   * @param {number} [options.quality=90] - Qualidade da imagem.
   * @returns {Promise<string>} outputPath
   */
  async imagesToPdf(imagePaths, options = {}) {
    const margin = options.margin || 0;
    const pageSize = options.pageSize || 'a4';
    const imagesPerPage = options.imagesPerPage || 1;

    const pdfDoc = await PDFDocument.create();

    if (pageSize === 'fit' && imagesPerPage === 1) {
      // Cada página = dimensões da imagem + margens
      let pageIndex = 0;
      for (const imgItem of imagePaths) {
        pageIndex++;
        const imgPath = typeof imgItem === 'string' ? imgItem : imgItem.path;
        const rotation = typeof imgItem === 'string' ? 0 : (imgItem.rotation || 0);

        const imgBuffer = await this._getEmbeddableBuffer(imgPath, null, null, null, null, rotation, options.resolution);
        const imgType = await this._detectImageType(imgBuffer);
        const embedded = imgType === 'png'
          ? await pdfDoc.embedPng(imgBuffer)
          : await pdfDoc.embedJpg(imgBuffer);

        const imgWidth = embedded.width;
        const imgHeight = embedded.height;
        const pageWidth = imgWidth + margin * 2;
        const pageHeight = imgHeight + margin * 2;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embedded, {
          x: margin,
          y: margin,
          width: imgWidth,
          height: imgHeight,
        });

        // Carimba a numeração se a opção estiver ativa
        if (options.numberPages) {
          const { StandardFonts, rgb } = require('pdf-lib');
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const text = `Pág. ${pageIndex}`;
          const fontSize = 9;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const drawY = margin > 15 ? margin / 2 : 12;

          // Desenha um fundo branco retangular sob o número para visibilidade máxima
          page.drawRectangle({
            x: pageWidth - textWidth - 30,
            y: drawY - 4,
            width: textWidth + 10,
            height: fontSize + 8,
            color: rgb(1, 1, 1),
            opacity: 0.9
          });

          page.drawText(text, {
            x: pageWidth - textWidth - 25,
            y: drawY,
            size: fontSize,
            font: font,
            color: rgb(0.07, 0.1, 0.15)
          });
        }
      }
    } else {
      // Página com tamanho fixo (A4 ou Letter)
      const dimensions = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
      const { width: pageWidth, height: pageHeight } = dimensions;
      const [cols, rows] = GRID_LAYOUTS[imagesPerPage] || GRID_LAYOUTS[1];

      const cellWidth = (pageWidth - margin * 2) / cols;
      const cellHeight = (pageHeight - margin * 2) / rows;

      // Agrupa as imagens por página
      const chunks = [];
      for (let i = 0; i < imagePaths.length; i += imagesPerPage) {
        chunks.push(imagePaths.slice(i, i + imagesPerPage));
      }

      let pageIndex = 0;
      for (const chunk of chunks) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        pageIndex++;

        for (let i = 0; i < chunk.length; i++) {
          const imgItem = chunk[i];
          const imgPath = typeof imgItem === 'string' ? imgItem : imgItem.path;
          const rotation = typeof imgItem === 'string' ? 0 : (imgItem.rotation || 0);

          const col = i % cols;
          const row = Math.floor(i / cols);

          const imgBuffer = await this._getEmbeddableBuffer(
            imgPath,
            cellWidth,
            cellHeight,
            options.fitMode,
            options.quality,
            rotation,
            options.resolution
          );
          const imgType = await this._detectImageType(imgBuffer);
          const embedded = imgType === 'png'
            ? await pdfDoc.embedPng(imgBuffer)
            : await pdfDoc.embedJpg(imgBuffer);

          // Calcula dimensões mantendo proporção
          const imgWidth = embedded.width;
          const imgHeight = embedded.height;
          const scaleX = cellWidth / imgWidth;
          const scaleY = cellHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY);

          const drawWidth = imgWidth * scale;
          const drawHeight = imgHeight * scale;

          // Centraliza a imagem na célula
          const cellX = margin + col * cellWidth;
          const cellY = pageHeight - margin - (row + 1) * cellHeight;
          const offsetX = (cellWidth - drawWidth) / 2;
          const offsetY = (cellHeight - drawHeight) / 2;

          page.drawImage(embedded, {
            x: cellX + offsetX,
            y: cellY + offsetY,
            width: drawWidth,
            height: drawHeight,
          });
        }

        // Carimba a numeração se a opção estiver ativa
        if (options.numberPages) {
          const { StandardFonts, rgb } = require('pdf-lib');
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const text = `Pág. ${pageIndex}`;
          const fontSize = 9;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const drawY = margin > 15 ? margin / 2 : 12;

          // Desenha um fundo branco retangular sob o número para visibilidade máxima
          page.drawRectangle({
            x: pageWidth - textWidth - 30,
            y: drawY - 4,
            width: textWidth + 10,
            height: fontSize + 8,
            color: rgb(1, 1, 1),
            opacity: 0.9
          });

          page.drawText(text, {
            x: pageWidth - textWidth - 25,
            y: drawY,
            size: fontSize,
            font: font,
            color: rgb(0.07, 0.1, 0.15)
          });
        }
      }
    }

    const outputFilename = `${generateId()}.pdf`;
    const outputPath = path.join(CONVERTED_DIR, outputFilename);
    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(outputPath, pdfBytes);

    return outputPath;
  },

  /**
   * Mescla múltiplos PDFs em um único arquivo.
   * @param {string[]} pdfPaths - Caminhos dos PDFs.
   * @param {string} [outputPath] - Caminho de saída opcional.
   * @returns {Promise<string>} outputPath
   */
  async mergePdfs(pdfPaths, outputPath) {
    if (!pdfPaths || pdfPaths.length === 0) {
      throw new Error('Nenhum PDF fornecido para mesclagem.');
    }

    const mergedPdf = await PDFDocument.create();

    for (const pdfPath of pdfPaths) {
      const pdfBytes = await fs.promises.readFile(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }

    if (!outputPath) {
      outputPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
    }

    const mergedBytes = await mergedPdf.save();
    await fs.promises.writeFile(outputPath, mergedBytes);

    return outputPath;
  },

  /**
   * Divide um PDF em páginas individuais ou extrai páginas específicas.
   * @param {string} pdfPath - Caminho do PDF.
   * @param {object} [options] - Opções de divisão.
   * @param {'all'|number[]|string} [options.pages='all'] - Páginas a extrair.
   * @returns {Promise<string[]>} outputPaths
   */
  async splitPdf(pdfPath, options = {}) {
    const pages = options.pages || 'all';
    const pdfBytes = await fs.promises.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();

    let pageIndices = [];

    if (pages === 'all') {
      pageIndices = Array.from({ length: totalPages }, (_, i) => i);
    } else if (Array.isArray(pages)) {
      // Páginas são 1-indexed na entrada, converter para 0-indexed
      pageIndices = pages.map((p) => p - 1).filter((p) => p >= 0 && p < totalPages);
    } else if (typeof pages === 'string') {
      // Formato "2-7"
      const match = pages.match(/^(\d+)-(\d+)$/);
      if (!match) {
        throw new Error(`Formato de intervalo de páginas inválido: ${pages}. Use o formato "2-7".`);
      }

      const start = parseInt(match[1], 10) - 1;
      const end = parseInt(match[2], 10) - 1;

      if (start < 0 || end >= totalPages || start > end) {
        throw new Error(
          `Intervalo de páginas inválido: ${pages}. O documento tem ${totalPages} página(s).`
        );
      }

      for (let i = start; i <= end; i++) {
        pageIndices.push(i);
      }
    }

    if (pageIndices.length === 0) {
      throw new Error('Nenhuma página válida especificada para extração.');
    }

    const outputPaths = [];

    for (const pageIndex of pageIndices) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
      newPdf.addPage(copiedPage);

      const outputFilename = `${generateId()}_pagina_${pageIndex + 1}.pdf`;
      const outputPath = path.join(CONVERTED_DIR, outputFilename);

      const newPdfBytes = await newPdf.save();
      await fs.promises.writeFile(outputPath, newPdfBytes);

      outputPaths.push(outputPath);
    }

    return outputPaths;
  },

  /**
   * Retorna o número de páginas de um PDF.
   * @param {string} pdfPath - Caminho do PDF.
   * @returns {Promise<number>}
   */
  async getPageCount(pdfPath) {
    const pdfBytes = await fs.promises.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    return pdf.getPageCount();
  },

  /**
   * Converte a imagem para um buffer PNG ou JPG que pode ser embutido no PDF.
   * pdf-lib só suporta PNG e JPG nativamente.
   */
  async _getEmbeddableBuffer(imgPath, cellWidth, cellHeight, fitMode, quality = 90, rotation = 0, resolution = 'original') {
    const ext = path.extname(imgPath).toLowerCase();

    let pipeline = sharp(imgPath);

    if (rotation && rotation !== 0) {
      pipeline = pipeline.rotate(rotation);
    }

    // Limit maximum photo resolution if set
    let maxDim = null;
    if (resolution === '1080' || resolution === '1080p') maxDim = 1920;
    else if (resolution === '720' || resolution === '720p') maxDim = 1280;
    else if (resolution === '2160' || resolution === '2160p' || resolution === '4k') maxDim = 3840;

    if (maxDim) {
      pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
    }

    // Se fitMode é cover (cortar e preencher) e temos as dimensões da célula
    if (fitMode === 'cover' && cellWidth && cellHeight) {
      // Converte pontos PDF para pixels (escala de 2x para boa resolução)
      const targetWidth = Math.round(cellWidth * 2);
      const targetHeight = Math.round(cellHeight * 2);

      return pipeline
        .resize(targetWidth, targetHeight, { fit: 'cover' })
        .jpeg({ quality })
        .toBuffer();
    }

    // Se já é PNG ou JPG, e não é cover, e não tem rotação, e não tem limite de resolução, podemos ler o arquivo diretamente
    if (['.png', '.jpg', '.jpeg'].includes(ext) && (!rotation || rotation === 0) && !maxDim) {
      if (['.jpg', '.jpeg'].includes(ext) && quality < 100) {
        return pipeline.jpeg({ quality }).toBuffer();
      }
      return fs.promises.readFile(imgPath);
    }

    // Caso contrário, converte usando sharp
    if (['.jpg', '.jpeg'].includes(ext)) {
      return pipeline.jpeg({ quality }).toBuffer();
    }
    return pipeline.png().toBuffer();
  },

  /**
   * Detecta o tipo da imagem no buffer (PNG ou JPG).
   */
  async _detectImageType(buffer) {
    // Verifica o magic number do PNG: 137 80 78 71
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'png';
    }
    // JPG começa com FF D8
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      return 'jpg';
    }
    // Padrão: tenta como PNG
    return 'png';
  },
};

module.exports = pdfService;
