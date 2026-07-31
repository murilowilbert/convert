const express = require('express');
const path = require('path');
const fs = require('fs');
const pdfService = require('../services/pdfService');
const pdfToImageService = require('../services/pdfToImageService');
const { generateId, getExtension, getFileCategory, getMimeType } = require('../utils/fileUtils');

const router = express.Router();

/**
 * POST /api/pdf/merge
 * Mescla múltiplos PDFs em um único arquivo.
 */
router.post('/pdf/merge', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar pelo menos 2 IDs de arquivos PDF para mesclagem.',
      });
    }

    const pdfPaths = [];

    for (const id of fileIds) {
      const file = fileStore.get(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          message: `Arquivo com ID "${id}" não encontrado.`,
        });
      }

      if (file.category !== 'pdf') {
        return res.status(400).json({
          success: false,
          message: `O arquivo "${file.originalName}" não é um PDF.`,
        });
      }

      if (!fs.existsSync(file.path)) {
        return res.status(404).json({
          success: false,
          message: `Arquivo "${file.originalName}" não encontrado no disco.`,
        });
      }

      pdfPaths.push(file.path);
    }

    const outputPath = await pdfService.mergePdfs(pdfPaths);
    const stats = await fs.promises.stat(outputPath);
    const mergedId = generateId();

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;

    const mergedInfo = {
      id: mergedId,
      originalName: `documentos_mesclados_${dateStr}.pdf`,
      filename: path.basename(outputPath),
      path: outputPath,
      size: stats.size,
      type: 'application/pdf',
      category: 'pdf',
      uploadedAt: new Date().toISOString(),
    };

    fileStore.set(mergedId, mergedInfo);

    return res.json({
      success: true,
      file: mergedInfo,
    });
  } catch (error) {
    console.error('Erro ao mesclar PDFs:', error);
    return res.status(500).json({
      success: false,
      message: `Erro interno ao mesclar os PDFs: ${error.message}`,
    });
  }
});

/**
 * POST /api/pdf/split
 * Divide um PDF em páginas individuais ou extrai páginas específicas.
 */
router.post('/pdf/split', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId, pages = 'all' } = req.body;

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

    const outputPaths = await pdfService.splitPdf(file.path, { pages });
    const splitFiles = [];

    const baseName = path.basename(file.originalName, path.extname(file.originalName));

    for (let i = 0; i < outputPaths.length; i++) {
      const outputPath = outputPaths[i];
      const stats = await fs.promises.stat(outputPath);
      const splitId = generateId();

      const pageNumber = path.basename(outputPath).match(/pagina_(\d+)/);
      const pageLabel = pageNumber ? pageNumber[1] : i + 1;

      const splitInfo = {
        id: splitId,
        originalName: `${baseName}_pagina_${pageLabel}.pdf`,
        filename: path.basename(outputPath),
        path: outputPath,
        size: stats.size,
        type: 'application/pdf',
        category: 'pdf',
        uploadedAt: new Date().toISOString(),
      };

      fileStore.set(splitId, splitInfo);
      splitFiles.push(splitInfo);
    }

    return res.json({
      success: true,
      files: splitFiles,
    });
  } catch (error) {
    console.error('Erro ao dividir PDF:', error);
    return res.status(500).json({
      success: false,
      message: `Erro interno ao dividir o PDF: ${error.message}`,
    });
  }
});

/**
 * POST /api/pdf/images-to-pdf
 * Cria PDFs a partir de grupos de imagens.
 */
router.post('/pdf/images-to-pdf', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { groups } = req.body;

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar pelo menos um grupo de imagens.',
      });
    }

    const createdFiles = [];

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];

      const filesList = group.files || (group.fileIds || []).map(id => typeof id === 'string' ? { id, rotation: 0 } : id);

      if (filesList.length === 0) {
        return res.status(400).json({
          success: false,
          message: `O grupo ${g + 1} não possui IDs de arquivos válidos.`,
        });
      }

      const imagePaths = [];

      for (const item of filesList) {
        const id = typeof item === 'string' ? item : item.id;
        const rotation = typeof item === 'string' ? 0 : (item.rotation || 0);

        const file = fileStore.get(id);

        if (!file) {
          return res.status(404).json({
            success: false,
            message: `Arquivo com ID "${id}" não encontrado.`,
          });
        }

        if (file.category !== 'image') {
          return res.status(400).json({
            success: false,
            message: `O arquivo "${file.originalName}" não é uma imagem.`,
          });
        }

        if (!fs.existsSync(file.path)) {
          return res.status(404).json({
            success: false,
            message: `Arquivo "${file.originalName}" não encontrado no disco.`,
          });
        }

        imagePaths.push({
          path: file.path,
          rotation: rotation
        });
      }

      const options = {
        margin: group.options?.margin || 0,
        pageSize: group.options?.pageSize || 'a4',
        imagesPerPage: group.options?.imagesPerPage || 1,
        quality: group.options?.quality || 90,
        fitMode: group.options?.fitMode || 'contain',
        resolution: group.options?.resolution || 'original',
        numberPages: group.options?.numberPages || false,
      };

      const outputPath = await pdfService.imagesToPdf(imagePaths, options);
      const stats = await fs.promises.stat(outputPath);
      const pdfId = generateId();

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;

      const pdfInfo = {
        id: pdfId,
        originalName: `imagens_para_pdf_${dateStr}.pdf`,
        filename: path.basename(outputPath),
        path: outputPath,
        size: stats.size,
        type: 'application/pdf',
        category: 'pdf',
        uploadedAt: new Date().toISOString(),
      };

      fileStore.set(pdfId, pdfInfo);
      createdFiles.push(pdfInfo);
    }

    return res.json({
      success: true,
      files: createdFiles,
    });
  } catch (error) {
    console.error('Erro ao criar PDF a partir de imagens:', error);
    return res.status(500).json({
      success: false,
      message: `Erro interno ao criar o PDF a partir das imagens: ${error.message}`,
    });
  }
});

/**
 * GET/POST /api/pdf/page-count
 * Retorna o número de páginas de um PDF.
 */
router.all('/pdf/page-count', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const fileId = req.query.fileId || req.body.fileId;

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

    const pageCount = await pdfService.getPageCount(file.path);

    return res.json({
      success: true,
      pageCount,
    });
  } catch (error) {
    console.error('Erro ao obter contagem de páginas:', error);
    return res.status(500).json({
      success: false,
      message: `Erro interno ao obter a contagem de páginas: ${error.message}`,
    });
  }
});

module.exports = router;
