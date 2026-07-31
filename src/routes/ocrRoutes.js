const express = require('express');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');
const { generateId, ensureDir } = require('../utils/fileUtils');
const pdfToImageService = require('../services/pdfToImageService');

const router = express.Router();
const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

/**
 * POST /api/ocr
 * Executa OCR em um arquivo de imagem ou PDF e gera um PDF pesquisável ou arquivo TXT.
 */
router.post('/ocr', async (req, res) => {
  let worker = null;
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId, language = 'por', outputFormat = 'pdf' } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar o ID do arquivo para OCR.',
      });
    }

    const file = fileStore.get(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado.',
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo físico não encontrado no disco.',
      });
    }

    ensureDir(CONVERTED_DIR);
    const baseName = path.basename(file.originalName, path.extname(file.originalName));
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;

    console.log(`[OCR] Iniciando OCR para arquivo: ${file.originalName} (${file.category}), formato de saída: ${outputFormat}`);

    // Inicializa o Tesseract Worker
    worker = await Tesseract.createWorker(language, 1, {
      cachePath: process.cwd(),
    });

    if (file.category === 'image') {
      // OCR em Imagem Individual
      const { data: { text, pdf } } = await worker.recognize(
        file.path,
        { pdfTitle: baseName },
        { pdf: outputFormat === 'pdf' }
      );

      const ocrFileId = generateId();
      let outputFilename = '';
      let outputPath = '';
      let mimeType = '';
      let category = '';

      if (outputFormat === 'pdf') {
        outputFilename = `${baseName}_OCR_${dateStr}.pdf`;
        outputPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
        await fs.promises.writeFile(outputPath, Buffer.from(pdf));
        mimeType = 'application/pdf';
        category = 'pdf';
      } else {
        outputFilename = `${baseName}_OCR_${dateStr}.txt`;
        outputPath = path.join(CONVERTED_DIR, `${generateId()}.txt`);
        await fs.promises.writeFile(outputPath, text || '', 'utf-8');
        mimeType = 'text/plain';
        category = 'document';
      }

      const stats = await fs.promises.stat(outputPath);
      const ocrFileInfo = {
        id: ocrFileId,
        originalName: outputFilename,
        filename: path.basename(outputPath),
        path: outputPath,
        size: stats.size,
        type: mimeType,
        category,
        uploadedAt: new Date().toISOString(),
      };

      fileStore.set(ocrFileId, ocrFileInfo);
      await worker.terminate();

      return res.json({
        success: true,
        file: ocrFileInfo,
      });

    } else if (file.category === 'pdf') {
      // OCR em PDF Multipáginas (processamento em lote por página)
      const pageCount = await pdfToImageService.getPageCount(file.path);
      console.log(`[OCR] PDF possui ${pageCount} página(s). Renderizando páginas e executando OCR...`);

      let mergedPdf = null;
      if (outputFormat === 'pdf') {
        mergedPdf = await PDFDocument.create();
      }

      let allText = '';

      for (let p = 1; p <= pageCount; p++) {
        console.log(`[OCR] Processando página ${p}/${pageCount}...`);
        
        // Renderiza página do PDF para imagem em alta resolução (escala 2.0 ideal para OCR)
        const pngBuffer = await pdfToImageService.renderPage(file.path, p, 2.0);

        // Executa OCR na imagem da página
        const { data: { text, pdf } } = await worker.recognize(
          pngBuffer,
          { pdfTitle: `Página ${p}` },
          { pdf: outputFormat === 'pdf' }
        );

        if (outputFormat === 'pdf') {
          // Carrega o PDF pesquisável de 1 página gerado pelo Tesseract
          const pageDoc = await PDFDocument.load(Buffer.from(pdf));
          const [copiedPage] = await mergedPdf.copyPages(pageDoc, [0]);
          mergedPdf.addPage(copiedPage);
        } else {
          allText += `--- PÁGINA ${p} ---\n\n${text}\n\n`;
        }
      }

      const ocrFileId = generateId();
      let outputFilename = '';
      let outputPath = '';
      let mimeType = '';
      let category = '';

      if (outputFormat === 'pdf') {
        outputFilename = `${baseName}_OCR_${dateStr}.pdf`;
        outputPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
        const mergedBytes = await mergedPdf.save();
        await fs.promises.writeFile(outputPath, mergedBytes);
        mimeType = 'application/pdf';
        category = 'pdf';
      } else {
        outputFilename = `${baseName}_OCR_${dateStr}.txt`;
        outputPath = path.join(CONVERTED_DIR, `${generateId()}.txt`);
        await fs.promises.writeFile(outputPath, allText, 'utf-8');
        mimeType = 'text/plain';
        category = 'document';
      }

      const stats = await fs.promises.stat(outputPath);
      const ocrFileInfo = {
        id: ocrFileId,
        originalName: outputFilename,
        filename: path.basename(outputPath),
        path: outputPath,
        size: stats.size,
        type: mimeType,
        category,
        uploadedAt: new Date().toISOString(),
      };

      fileStore.set(ocrFileId, ocrFileInfo);
      await worker.terminate();

      return res.json({
        success: true,
        file: ocrFileInfo,
      });

    } else {
      await worker.terminate();
      return res.status(400).json({
        success: false,
        message: 'O formato de arquivo selecionado não é elegível para OCR (use apenas PDF ou Imagens).',
      });
    }

  } catch (error) {
    console.error('[OCR] Erro durante o processamento de OCR:', error);
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {}
    }
    return res.status(500).json({
      success: false,
      message: `Erro ao executar OCR: ${error.message}`,
    });
  }
});

module.exports = router;
