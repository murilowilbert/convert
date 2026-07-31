const express = require('express');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const pdfService = require('../services/pdfService');
const pdfToImageService = require('../services/pdfToImageService');
const { generateId } = require('../utils/fileUtils');

const router = express.Router();

// Diretório de arquivos convertidos
const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

/**
 * POST /api/pdf/pje-split
 * Divide um PDF em partes respeitando um tamanho limite (ex: 5MB).
 */
router.post('/pdf/pje-split', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId, maxMb } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar o ID do arquivo PDF.',
      });
    }

    const file = fileStore.get(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo PDF não encontrado.',
      });
    }

    if (file.category !== 'pdf') {
      return res.status(400).json({
        success: false,
        message: 'O arquivo informado não é um PDF.',
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo PDF não encontrado no disco.',
      });
    }

    const maxSizeBytes = parseFloat(maxMb) * 1024 * 1024;
    if (isNaN(maxSizeBytes) || maxSizeBytes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Tamanho máximo inválido.',
      });
    }

    const pdfBytes = await fs.promises.readFile(file.path);
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const totalPages = sourcePdf.getPageCount();

    const outputFiles = [];
    let currentDoc = await PDFDocument.create();
    let currentPageIndices = [];
    const baseName = path.basename(file.originalName, path.extname(file.originalName));

    for (let i = 0; i < totalPages; i++) {
      // Cria documento temporário contendo apenas a página corrente
      const tempDoc = await PDFDocument.create();
      const [copiedPage] = await tempDoc.copyPages(sourcePdf, [i]);
      tempDoc.addPage(copiedPage);
      const tempBytes = await tempDoc.save();
      const pageSizeBytes = tempBytes.length;

      // Se a página individual exceder o limite sozinha, emitimos ela como um arquivo único
      if (pageSizeBytes >= maxSizeBytes) {
        // Se houver páginas acumuladas no lote atual, fecha esse lote primeiro
        if (currentPageIndices.length > 0) {
          const finalBytes = await currentDoc.save();
          const chunkId = generateId();
          const chunkFilename = `${baseName}_Parte${outputFiles.length + 1}.pdf`;
          const chunkPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
          await fs.promises.writeFile(chunkPath, finalBytes);

          const chunkStats = await fs.promises.stat(chunkPath);
          const chunkInfo = {
            id: chunkId,
            originalName: chunkFilename,
            filename: path.basename(chunkPath),
            path: chunkPath,
            size: chunkStats.size,
            type: 'application/pdf',
            category: 'pdf',
            uploadedAt: new Date().toISOString(),
          };

          fileStore.set(chunkId, chunkInfo);
          outputFiles.push(chunkInfo);

          // Reinicializa o lote
          currentDoc = await PDFDocument.create();
          currentPageIndices = [];
        }

        // Grava a página pesada como parte isolada
        const chunkId = generateId();
        const chunkFilename = `${baseName}_Parte${outputFiles.length + 1}.pdf`;
        const chunkPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
        await fs.promises.writeFile(chunkPath, tempBytes);

        const chunkStats = await fs.promises.stat(chunkPath);
        const chunkInfo = {
          id: chunkId,
          originalName: chunkFilename,
          filename: path.basename(chunkPath),
          path: chunkPath,
          size: chunkStats.size,
          type: 'application/pdf',
          category: 'pdf',
          uploadedAt: new Date().toISOString(),
        };

        fileStore.set(chunkId, chunkInfo);
        outputFiles.push(chunkInfo);
        continue;
      }

      // Tenta testar o tamanho acumulado adicionando a página corrente
      const testDoc = await PDFDocument.create();
      const pagesToCopy = [...currentPageIndices, i];
      const copiedPages = await testDoc.copyPages(sourcePdf, pagesToCopy);
      copiedPages.forEach(p => testDoc.addPage(p));
      const testBytes = await testDoc.save();

      if (testBytes.length > maxSizeBytes) {
        // Ultrapassa o limite! Fecha o documento acumulado atual e inicia um novo lote
        const finalBytes = await currentDoc.save();
        const chunkId = generateId();
        const chunkFilename = `${baseName}_Parte${outputFiles.length + 1}.pdf`;
        const chunkPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
        await fs.promises.writeFile(chunkPath, finalBytes);

        const chunkStats = await fs.promises.stat(chunkPath);
        const chunkInfo = {
          id: chunkId,
          originalName: chunkFilename,
          filename: path.basename(chunkPath),
          path: chunkPath,
          size: chunkStats.size,
          type: 'application/pdf',
          category: 'pdf',
          uploadedAt: new Date().toISOString(),
        };

        fileStore.set(chunkId, chunkInfo);
        outputFiles.push(chunkInfo);

        // Começa novo lote com a página corrente
        currentDoc = await PDFDocument.create();
        const [newPage] = await currentDoc.copyPages(sourcePdf, [i]);
        currentDoc.addPage(newPage);
        currentPageIndices = [i];
      } else {
        // Cabe no limite! Adiciona a página ao lote atual
        const [newPage] = await currentDoc.copyPages(sourcePdf, [i]);
        currentDoc.addPage(newPage);
        currentPageIndices.push(i);
      }
    }

    // Salva qualquer página remanescente
    if (currentPageIndices.length > 0) {
      const finalBytes = await currentDoc.save();
      const chunkId = generateId();
      const chunkFilename = `${baseName}_Parte${outputFiles.length + 1}.pdf`;
      const chunkPath = path.join(CONVERTED_DIR, `${generateId()}.pdf`);
      await fs.promises.writeFile(chunkPath, finalBytes);

      const chunkStats = await fs.promises.stat(chunkPath);
      const chunkInfo = {
        id: chunkId,
        originalName: chunkFilename,
        filename: path.basename(chunkPath),
        path: chunkPath,
        size: chunkStats.size,
        type: 'application/pdf',
        category: 'pdf',
        uploadedAt: new Date().toISOString(),
      };

      fileStore.set(chunkId, chunkInfo);
      outputFiles.push(chunkInfo);
    }

    return res.json({
      success: true,
      files: outputFiles,
    });
  } catch (error) {
    console.error('Erro ao dividir PDF por tamanho:', error);
    return res.status(500).json({
      success: false,
      message: `Erro ao dividir PDF: ${error.message}`,
    });
  }
});

/**
 * POST /api/pdf/pje-compress
 * Comprime e achata um PDF por meio de rasterização em imagens JPEG de alta eficiência.
 */
router.post('/pdf/pje-compress', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId, dpi = 150 } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar o ID do arquivo PDF.',
      });
    }

    const file = fileStore.get(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo PDF não encontrado.',
      });
    }

    if (file.category !== 'pdf') {
      return res.status(400).json({
        success: false,
        message: 'O arquivo informado não é um PDF.',
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo PDF não encontrado no disco.',
      });
    }

    // Calcula escala com base no DPI selecionado
    // 72 DPI base de pdf.js: scale = DPI / 72
    const targetDpi = parseInt(dpi) || 150;
    const scale = targetDpi / 72;

    const totalPages = await pdfToImageService.getPageCount(file.path);
    const compressedPdf = await PDFDocument.create();

    // Renderiza e comprime cada página sequencialmente
    for (let p = 1; p <= totalPages; p++) {
      const pngBuffer = await pdfToImageService.renderPage(file.path, p, scale);
      
      // Converte PNG para JPEG super otimizado e leve via sharp
      const jpgBuffer = await sharp(pngBuffer)
        .jpeg({ quality: 75, progressive: true })
        .toBuffer();

      const embedded = await compressedPdf.embedJpg(jpgBuffer);
      const pageWidth = embedded.width;
      const pageHeight = embedded.height;

      const page = compressedPdf.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }

    const baseName = path.basename(file.originalName, path.extname(file.originalName));
    const outputFilename = `${generateId()}.pdf`;
    const outputPath = path.join(CONVERTED_DIR, outputFilename);
    const compressedBytes = await compressedPdf.save();
    
    await fs.promises.writeFile(outputPath, compressedBytes);
    const stats = await fs.promises.stat(outputPath);
    const compressId = generateId();

    const compressInfo = {
      id: compressId,
      originalName: `${baseName}_comprimido.pdf`,
      filename: outputFilename,
      path: outputPath,
      size: stats.size,
      type: 'application/pdf',
      category: 'pdf',
      uploadedAt: new Date().toISOString(),
    };

    fileStore.set(compressId, compressInfo);

    return res.json({
      success: true,
      file: compressInfo,
    });
  } catch (error) {
    console.error('Erro ao comprimir/rasterizar PDF:', error);
    return res.status(500).json({
      success: false,
      message: `Erro ao comprimir PDF: ${error.message}`,
    });
  }
});

module.exports = router;
