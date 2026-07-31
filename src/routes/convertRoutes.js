const express = require('express');
const path = require('path');
const fs = require('fs');
const imageService = require('../services/imageService');
const spreadsheetService = require('../services/spreadsheetService');
const documentService = require('../services/documentService');
const pdfToImageService = require('../services/pdfToImageService');
const { generateId, getExtension, getFileCategory, getMimeType } = require('../utils/fileUtils');

const router = express.Router();

/**
 * POST /api/convert
 * Converte um ou mais arquivos para o formato especificado.
 */
router.post('/convert', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileIds, outputFormat, options = {} } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar os IDs dos arquivos para conversão.',
      });
    }

    if (!outputFormat) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar o formato de saída.',
      });
    }

    const convertedFiles = [];

    for (const fileId of fileIds) {
      const file = fileStore.get(fileId);

      if (!file) {
        return res.status(404).json({
          success: false,
          message: `Arquivo com ID "${fileId}" não encontrado.`,
        });
      }

      if (!fs.existsSync(file.path)) {
        return res.status(404).json({
          success: false,
          message: `Arquivo "${file.originalName}" não encontrado no disco.`,
        });
      }

      let outputPath;
      const format = outputFormat.toLowerCase();

      try {
        switch (file.category) {
          case 'image': {
            const result = await imageService.convert(file.path, format, options);
            outputPath = result.outputPath;
            break;
          }

          case 'spreadsheet': {
            outputPath = await spreadsheetService.convert(file.path, format, file.originalName);
            break;
          }

          case 'document': {
            outputPath = await documentService.convert(file.path, format, file.originalName);
            break;
          }

          default:
            return res.status(400).json({
              success: false,
              message: `Conversão não suportada para a categoria "${file.category}".`,
            });
        }

        const stats = await fs.promises.stat(outputPath);
        const outputExt = getExtension(outputPath);
        const convertedId = generateId();

        const baseName = path.basename(file.originalName, path.extname(file.originalName));
        const convertedOriginalName = `${baseName}.${format}`;

        const convertedInfo = {
          id: convertedId,
          originalName: convertedOriginalName,
          filename: path.basename(outputPath),
          path: outputPath,
          size: stats.size,
          type: getMimeType(outputExt),
          category: getFileCategory(outputExt),
          uploadedAt: new Date().toISOString(),
        };

        fileStore.set(convertedId, convertedInfo);
        convertedFiles.push(convertedInfo);
      } catch (convErr) {
        console.error(`Erro ao converter arquivo "${file.originalName}":`, convErr);
        return res.status(500).json({
          success: false,
          message: `Erro ao converter o arquivo "${file.originalName}": ${convErr.message}`,
        });
      }
    }

    return res.json({
      success: true,
      files: convertedFiles,
    });
  } catch (error) {
    console.error('Erro na conversão:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao converter os arquivos.',
    });
  }
});

/**
 * POST /api/convert/pdf-to-images
 * Converte páginas de um PDF em imagens.
 */
router.post('/convert/pdf-to-images', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId, format = 'png', scale = 2.0, pages = 'all' } = req.body;

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

    const results = await pdfToImageService.convert(file.path, {
      format: format.toLowerCase(),
      scale,
      pages,
    });

    const convertedFiles = [];

    for (const result of results) {
      const stats = await fs.promises.stat(result.outputPath);
      const outputExt = getExtension(result.outputPath);
      const convertedId = generateId();

      const baseName = path.basename(file.originalName, path.extname(file.originalName));
      const convertedOriginalName = `${baseName}_pagina_${result.page}.${format.toLowerCase()}`;

      const convertedInfo = {
        id: convertedId,
        originalName: convertedOriginalName,
        filename: path.basename(result.outputPath),
        path: result.outputPath,
        size: stats.size,
        type: getMimeType(outputExt),
        category: 'image',
        uploadedAt: new Date().toISOString(),
      };

      fileStore.set(convertedId, convertedInfo);
      convertedFiles.push(convertedInfo);
    }

    return res.json({
      success: true,
      files: convertedFiles,
    });
  } catch (error) {
    console.error('Erro ao converter PDF para imagens:', error);
    return res.status(500).json({
      success: false,
      message: `Erro interno ao converter o PDF para imagens: ${error.message}`,
    });
  }
});

/**
 * GET /api/formats/:category
 * Retorna os formatos de saída suportados para uma categoria.
 */
router.get('/formats/:category', (req, res) => {
  try {
    const { category } = req.params;

    const formatsMap = {
      image: ['png', 'jpg', 'webp', 'tiff', 'bmp', 'gif', 'avif'],
      pdf: ['png', 'jpg'],
      spreadsheet: ['xlsx', 'csv', 'ods', 'tsv'],
      document: ['pdf', 'html', 'txt'],
    };

    const formats = formatsMap[category.toLowerCase()];

    if (!formats) {
      return res.status(404).json({
        success: false,
        message: `Categoria "${category}" não encontrada. Categorias válidas: ${Object.keys(formatsMap).join(', ')}.`,
      });
    }

    return res.json({
      success: true,
      category,
      formats,
    });
  } catch (error) {
    console.error('Erro ao obter formatos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao obter os formatos suportados.',
    });
  }
});

module.exports = router;
