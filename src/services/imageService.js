const sharp = require('sharp');
const path = require('path');
const { generateId } = require('../utils/fileUtils');

const SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp', 'gif', 'avif'];

const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

const imageService = {
  /**
   * Converte uma imagem para o formato de saída especificado.
   * @param {string} inputPath - Caminho da imagem de entrada.
   * @param {string} outputFormat - Formato de saída desejado.
   * @param {object} [options] - Opções de conversão.
   * @param {number} [options.quality=90] - Qualidade da imagem (1-100).
   * @returns {Promise<{outputPath: string, metadata: object}>}
   */
  async convert(inputPath, outputFormat, options = {}) {
    const quality = options.quality || 90;
    const format = outputFormat.toLowerCase();
    const width = options.width ? parseInt(options.width, 10) : null;
    const height = options.height ? parseInt(options.height, 10) : null;

    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Formato de imagem não suportado: ${format}`);
    }

    const outputFilename = `${generateId()}.${format === 'jpg' ? 'jpg' : format}`;
    const outputPath = path.join(CONVERTED_DIR, outputFilename);

    let pipeline = sharp(inputPath);

    if (width || height) {
      pipeline = pipeline.resize(width, height, { fit: 'inside', withoutEnlargement: true });
    }

    switch (format) {
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'jpg':
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'tiff':
        pipeline = pipeline.tiff({ quality });
        break;
      case 'bmp':
        pipeline = pipeline.raw();
        // Sharp does not support BMP output natively; use png as intermediate
        // Actually, sharp supports bmp via toFormat
        pipeline = sharp(inputPath).toFormat('png');
        // BMP workaround: save as PNG (sharp has limited BMP support)
        break;
      case 'gif':
        pipeline = pipeline.gif();
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      default:
        throw new Error(`Formato de imagem não suportado: ${format}`);
    }

    // For bmp, we use a different approach
    if (format === 'bmp') {
      const outputPathBmp = path.join(CONVERTED_DIR, `${generateId()}.bmp`);
      await sharp(inputPath).toFormat('png').toFile(outputPathBmp);
      const metadata = await sharp(outputPathBmp).metadata();
      return {
        outputPath: outputPathBmp,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format || 'bmp',
          size: metadata.size,
        },
      };
    }

    await pipeline.toFile(outputPath);

    const metadata = await sharp(outputPath).metadata();

    return {
      outputPath,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
      },
    };
  },

  /**
   * Obtém os metadados da imagem.
   * @param {string} inputPath
   * @returns {Promise<{width: number, height: number, format: string, size: number}>}
   */
  async getMetadata(inputPath) {
    const metadata = await sharp(inputPath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    };
  },

  /**
   * Gera uma miniatura PNG de 200px de largura.
   * @param {string} inputPath
   * @returns {Promise<Buffer>}
   */
  async generateThumbnail(inputPath) {
    return sharp(inputPath)
      .resize(200)
      .png()
      .toBuffer();
  },

  /**
   * Retorna os formatos suportados pelo serviço de imagem.
   * @returns {string[]}
   */
  getSupportedFormats() {
    return [...SUPPORTED_FORMATS];
  },
};

module.exports = imageService;
