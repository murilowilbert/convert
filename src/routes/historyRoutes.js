const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Caminho do arquivo de histórico
const HISTORY_FILE = path.join(__dirname, '..', '..', 'historico.json');

// ============================================================================
// Funções auxiliares para leitura e escrita do histórico
// ============================================================================

/**
 * Lê e retorna o histórico do arquivo JSON.
 * Retorna um array vazio caso o arquivo não exista ou esteja corrompido.
 * @returns {Array}
 */
function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Histórico] Erro ao ler o arquivo de histórico:', err.message);
    return [];
  }
}

/**
 * Grava o array de histórico no arquivo JSON.
 * @param {Array} data - Array de entradas do histórico.
 */
function writeHistory(data) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Histórico] Erro ao gravar o arquivo de histórico:', err.message);
    throw err;
  }
}

// ============================================================================
// Rotas do Histórico
// ============================================================================

/**
 * GET /api/history
 * Retorna todo o histórico de operações.
 */
router.get('/history', (req, res) => {
  try {
    const history = readHistory();

    // Verifica se os arquivos de saída ainda existem no disco
    const historyWithStatus = history.map((entry) => {
      const outputFiles = (entry.outputFiles || []).map((file) => ({
        ...file,
        outputExists: file.path ? fs.existsSync(file.path) : false,
      }));

      return {
        ...entry,
        outputFiles,
      };
    });

    return res.json({
      success: true,
      history: historyWithStatus,
    });
  } catch (error) {
    console.error('[Histórico] Erro ao buscar histórico:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar o histórico.',
    });
  }
});

/**
 * POST /api/history
 * Adiciona uma nova entrada ao histórico.
 * Body: { operation, inputFiles, outputFiles }
 */
router.post('/history', async (req, res) => {
  try {
    const { operation, inputFiles, outputFiles } = req.body;

    if (!operation || typeof operation !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'O campo "operation" é obrigatório e deve ser uma string.',
      });
    }

    if (!inputFiles || !Array.isArray(inputFiles)) {
      return res.status(400).json({
        success: false,
        message: 'O campo "inputFiles" é obrigatório e deve ser um array.',
      });
    }

    if (!outputFiles || !Array.isArray(outputFiles)) {
      return res.status(400).json({
        success: false,
        message: 'O campo "outputFiles" é obrigatório e deve ser um array.',
      });
    }

    const inputFilesWithThumbnails = [];
    for (const file of inputFiles) {
      let thumbnailBase64 = null;
      const fileId = file.id;

      if (fileId) {
        const fileStore = req.app.get('fileStore');
        const storeFile = fileStore.get(fileId);

        if (storeFile && fs.existsSync(storeFile.path)) {
          try {
            if (storeFile.category === 'image') {
              const sharp = require('sharp');
              const thumbBuffer = await sharp(storeFile.path)
                .resize(300, 300, { fit: 'inside' })
                .jpeg({ quality: 70 })
                .toBuffer();
              thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
            } else if (storeFile.category === 'pdf') {
              const pdfToImageService = require('../services/pdfToImageService');
              const sharp = require('sharp');
              const pngBuffer = await pdfToImageService.renderPage(storeFile.path, 1, 0.4);
              const thumbBuffer = await sharp(pngBuffer)
                .resize(300, 300, { fit: 'inside' })
                .jpeg({ quality: 70 })
                .toBuffer();
              thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
            } else if (storeFile.category === 'video') {
              const ffmpeg = require('@ffmpeg-installer/ffmpeg');
              const { exec } = require('child_process');
              const sharp = require('sharp');
              
              // Extrai o quadro temporário do vídeo em buffer usando FFmpeg
              const pngBuffer = await new Promise((resolve, reject) => {
                const cmd = `"${ffmpeg.path}" -y -ss 0.5 -i "${storeFile.path}" -vframes 1 -f image2 -`;
                exec(cmd, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                  if (err) reject(err);
                  else resolve(stdout);
                });
              });
              
              const thumbBuffer = await sharp(pngBuffer)
                .resize(300, 300, { fit: 'inside' })
                .jpeg({ quality: 70 })
                .toBuffer();
              thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
            }
          } catch (err) {
            console.error(`[Histórico] Erro ao gerar miniatura de preview para ${storeFile.originalName}:`, err.message);
          }
        }
      }

      inputFilesWithThumbnails.push({
        id: file.id || uuidv4(),
        name: file.name || 'desconhecido',
        size: file.size || 0,
        thumbnail: thumbnailBase64,
      });
    }

    const newEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      operation,
      inputFiles: inputFilesWithThumbnails,
      outputFiles: outputFiles.map((file) => ({
        id: file.id || uuidv4(),
        name: file.name || 'desconhecido',
        size: file.size || 0,
        path: file.path || '',
        outputExists: file.path ? fs.existsSync(file.path) : false,
      })),
    };

    const history = readHistory();
    history.unshift(newEntry);
    writeHistory(history);

    return res.status(201).json({
      success: true,
      entry: newEntry,
    });
  } catch (error) {
    console.error('[Histórico] Erro ao adicionar entrada:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao adicionar entrada ao histórico.',
    });
  }
});

/**
 * DELETE /api/history
 * Remove todo o histórico.
 */
router.delete('/history', (req, res) => {
  try {
    writeHistory([]);

    return res.json({
      success: true,
      message: 'Histórico limpo com sucesso.',
    });
  } catch (error) {
    console.error('[Histórico] Erro ao limpar histórico:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao limpar o histórico.',
    });
  }
});

/**
 * DELETE /api/history/:id
 * Remove uma entrada específica do histórico pelo ID.
 */
router.delete('/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const history = readHistory();

    const index = history.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `Entrada com ID "${id}" não encontrada no histórico.`,
      });
    }

    const removed = history.splice(index, 1)[0];
    writeHistory(history);

    return res.json({
      success: true,
      message: 'Entrada removida do histórico com sucesso.',
      entry: removed,
    });
  } catch (error) {
    console.error('[Histórico] Erro ao remover entrada do histórico:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao remover a entrada do histórico.',
    });
  }
});

module.exports = router;
