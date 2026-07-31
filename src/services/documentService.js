const mammoth = require('mammoth');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/fileUtils');

const SUPPORTED_FORMATS = ['pdf', 'html', 'txt'];

const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

const documentService = {
  /**
   * Converte um documento para o formato de saída especificado.
   * @param {string} inputPath - Caminho do documento de entrada.
   * @param {string} outputFormat - Formato de saída desejado.
   * @param {string} originalName - Nome original do arquivo.
   * @returns {Promise<string>} outputPath
   */
  async convert(inputPath, outputFormat, originalName) {
    const format = outputFormat.toLowerCase();

    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Formato de documento não suportado: ${format}`);
    }

    const baseName = path.basename(originalName || 'documento', path.extname(originalName || ''));
    const outputFilename = `${baseName}_${generateId()}.${format}`;
    const outputPath = path.join(CONVERTED_DIR, outputFilename);

    const inputExt = path.extname(inputPath).toLowerCase();

    switch (format) {
      case 'html':
        await this._convertToHtml(inputPath, outputPath, inputExt);
        break;
      case 'txt':
        await this._convertToTxt(inputPath, outputPath, inputExt);
        break;
      case 'pdf':
        await this._convertToPdf(inputPath, outputPath, inputExt);
        break;
      default:
        throw new Error(`Formato de saída não suportado: ${format}`);
    }

    return outputPath;
  },

  /**
   * Converte para HTML.
   */
  async _convertToHtml(inputPath, outputPath, inputExt) {
    if (inputExt === '.docx') {
      const result = await mammoth.convertToHtml({ path: inputPath });
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documento Convertido</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
  </style>
</head>
<body>
${result.value}
</body>
</html>`;
      await fs.promises.writeFile(outputPath, htmlContent, 'utf-8');
    } else if (inputExt === '.txt') {
      const text = await fs.promises.readFile(inputPath, 'utf-8');
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documento Convertido</title>
  <style>
    body { font-family: monospace; max-width: 800px; margin: 0 auto; padding: 20px; white-space: pre-wrap; }
  </style>
</head>
<body>
${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
</body>
</html>`;
      await fs.promises.writeFile(outputPath, htmlContent, 'utf-8');
    } else {
      throw new Error(`Conversão de ${inputExt} para HTML não é suportada.`);
    }
  },

  /**
   * Converte para TXT.
   */
  async _convertToTxt(inputPath, outputPath, inputExt) {
    if (inputExt === '.docx') {
      const result = await mammoth.extractRawText({ path: inputPath });
      await fs.promises.writeFile(outputPath, result.value, 'utf-8');
    } else if (inputExt === '.html' || inputExt === '.htm') {
      const html = await fs.promises.readFile(inputPath, 'utf-8');
      // Remoção simples de tags HTML
      const text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      await fs.promises.writeFile(outputPath, text, 'utf-8');
    } else {
      throw new Error(`Conversão de ${inputExt} para TXT não é suportada.`);
    }
  },

  /**
   * Converte para PDF usando pdf-lib.
   */
  async _convertToPdf(inputPath, outputPath, inputExt) {
    let text = '';

    if (inputExt === '.docx') {
      const result = await mammoth.extractRawText({ path: inputPath });
      text = result.value;
    } else if (inputExt === '.txt') {
      text = await fs.promises.readFile(inputPath, 'utf-8');
    } else if (inputExt === '.html' || inputExt === '.htm') {
      const html = await fs.promises.readFile(inputPath, 'utf-8');
      text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else {
      throw new Error(`Conversão de ${inputExt} para PDF não é suportada.`);
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const margin = 50;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const maxTextWidth = pageWidth - margin * 2;
    const lineHeight = fontSize * 1.4;
    const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);

    // Quebra o texto em linhas respeitando ~80 caracteres por linha
    const wrappedLines = this._wrapText(text, font, fontSize, maxTextWidth);

    let currentLine = 0;

    while (currentLine < wrappedLines.length) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      for (let i = 0; i < maxLinesPerPage && currentLine < wrappedLines.length; i++) {
        const line = wrappedLines[currentLine];

        // Filtra caracteres não suportados pela fonte padrão
        const safeLine = this._sanitizeForPdf(line);

        try {
          page.drawText(safeLine, {
            x: margin,
            y: y - fontSize,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        } catch {
          // Se falhar ao desenhar, tenta com texto limpo
          page.drawText(safeLine.replace(/[^\x20-\x7E]/g, '?'), {
            x: margin,
            y: y - fontSize,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }

        y -= lineHeight;
        currentLine++;
      }
    }

    // Se o texto estiver vazio, adiciona pelo menos uma página
    if (wrappedLines.length === 0) {
      pdfDoc.addPage([pageWidth, pageHeight]);
    }

    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(outputPath, pdfBytes);
  },

  /**
   * Quebra o texto em linhas respeitando a largura máxima.
   */
  _wrapText(text, font, fontSize, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        let testWidth;

        try {
          testWidth = font.widthOfTextAtSize(this._sanitizeForPdf(testLine), fontSize);
        } catch {
          testWidth = testLine.length * fontSize * 0.5;
        }

        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  },

  /**
   * Remove caracteres não suportados pela fonte Helvetica padrão do PDF.
   */
  _sanitizeForPdf(text) {
    // Substitui caracteres fora do Latin-1 por equivalentes ou '?'
    return text.replace(/[^\x00-\xFF]/g, (char) => {
      const replacements = {
        '\u2018': "'",
        '\u2019': "'",
        '\u201C': '"',
        '\u201D': '"',
        '\u2013': '-',
        '\u2014': '--',
        '\u2026': '...',
        '\u2022': '-',
        '\u00A0': ' ',
      };
      return replacements[char] || '?';
    });
  },

  /**
   * Retorna os formatos suportados pelo serviço de documento.
   * @returns {string[]}
   */
  getSupportedFormats() {
    return [...SUPPORTED_FORMATS];
  },
};

module.exports = documentService;
