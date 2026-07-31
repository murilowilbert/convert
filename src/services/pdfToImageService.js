const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createCanvas } = require('@napi-rs/canvas');
const { generateId, ensureDir } = require('../utils/fileUtils');

const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

let pdfjsLib = null;

/**
 * Carrega o pdfjs-dist de forma lazy.
 */
async function getPdfjsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).toString();
    pdfjsLib.VerbosityLevel = pdfjsLib.VerbosityLevel || {};
  }
  return pdfjsLib;
}

/**
 * Cria um CanvasFactory personalizado para o @napi-rs/canvas.
 */
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

const pdfToImageService = {
  /**
   * Converte páginas do PDF em imagens.
   * @param {string} pdfPath - Caminho do PDF.
   * @param {object} [options] - Opções de conversão.
   * @param {'png'|'jpg'} [options.format='png'] - Formato de saída.
   * @param {number} [options.scale=2.0] - Escala de renderização.
   * @param {'all'|number[]} [options.pages='all'] - Páginas a converter.
   * @returns {Promise<Array<{page: number, outputPath: string}>>}
   */
  async convert(pdfPath, options = {}) {
    const format = (options.format || 'png').toLowerCase();
    const scale = options.scale || 2.0;
    const pages = options.pages || 'all';

    ensureDir(CONVERTED_DIR);

    const lib = await getPdfjsLib();
    const data = new Uint8Array(await fs.promises.readFile(pdfPath));
    const doc = await lib.getDocument({
      data,
      verbosity: 0, // ERRORS only
    }).promise;

    const totalPages = doc.numPages;

    let pageNumbers = [];
    if (pages === 'all') {
      pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (Array.isArray(pages)) {
      pageNumbers = pages.filter((p) => p >= 1 && p <= totalPages);
    }

    if (pageNumbers.length === 0) {
      throw new Error('Nenhuma página válida especificada para conversão.');
    }

    const results = [];
    const canvasFactory = new NodeCanvasFactory();

    for (const pageNum of pageNumbers) {
      const buffer = await this.renderPage(pdfPath, pageNum, scale, doc, canvasFactory);

      const extension = format === 'jpg' ? 'jpg' : 'png';
      const outputFilename = `${generateId()}_pagina_${pageNum}.${extension}`;
      const outputPath = path.join(CONVERTED_DIR, outputFilename);

      if (format === 'jpg') {
        // Se o buffer veio como PNG, precisa converter
        const sharp = require('sharp');
        const jpgBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
        await fs.promises.writeFile(outputPath, jpgBuffer);
      } else {
        await fs.promises.writeFile(outputPath, buffer);
      }

      results.push({ page: pageNum, outputPath });
    }

    await doc.destroy();

    return results;
  },

  /**
   * Retorna o número de páginas do PDF.
   * @param {string} pdfPath
   * @returns {Promise<number>}
   */
  async getPageCount(pdfPath) {
    const lib = await getPdfjsLib();
    const data = new Uint8Array(await fs.promises.readFile(pdfPath));
    const doc = await lib.getDocument({
      data,
      verbosity: 0,
    }).promise;
    const count = doc.numPages;
    await doc.destroy();
    return count;
  },

  /**
   * Renderiza uma página do PDF e retorna um Buffer PNG.
   * @param {string} pdfPath - Caminho do PDF.
   * @param {number} pageNum - Número da página (1-indexed).
   * @param {number} [scale=2.0] - Escala.
   * @param {object} [existingDoc] - Documento PDF já carregado (opcional).
   * @param {NodeCanvasFactory} [existingFactory] - Fábrica de canvas (opcional).
   * @returns {Promise<Buffer>}
   */
  async renderPage(pdfPath, pageNum, scale = 2.0, existingDoc = null, existingFactory = null) {
    const lib = await getPdfjsLib();
    let doc = existingDoc;
    let shouldDestroy = false;

    if (!doc) {
      const data = new Uint8Array(await fs.promises.readFile(pdfPath));
      doc = await lib.getDocument({
        data,
        verbosity: 0,
      }).promise;
      shouldDestroy = true;
    }

    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvasFactory = existingFactory || new NodeCanvasFactory();
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory,
    }).promise;

    const buffer = canvas.toBuffer('image/png');

    if (shouldDestroy) {
      await doc.destroy();
    }

    return buffer;
  },
};

module.exports = pdfToImageService;
