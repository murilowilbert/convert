const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const imageService = require('../services/imageService');
const zipService = require('../services/zipService');
const { generateId, getExtension, getFileCategory, getMimeType } = require('../utils/fileUtils');

const router = express.Router();

/**
 * POST /api/upload
 * Upload de múltiplos arquivos.
 */
router.post('/upload', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const upload = req.app.get('upload');

    upload.array('files')(req, res, async (err) => {
      try {
        if (err) {
          console.error('Erro no upload:', err);
          return res.status(400).json({
            success: false,
            message: `Erro ao fazer upload dos arquivos: ${err.message}`,
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Nenhum arquivo foi enviado.',
          });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
          // Corrige encoding do nome do arquivo vindo do Multer
          const utf8Name = Buffer.from(file.originalname, 'latin1').toString('utf-8');
          let extension = getExtension(utf8Name);
          let category = getFileCategory(extension);
          let filePath = file.path;
          let filename = file.filename;
          let fileSize = file.size;
          let fileType = getMimeType(extension);

          // Se for imagem HEIC/HEIF, converte para JPEG
          if (extension.toLowerCase() === 'heic' || extension.toLowerCase() === 'heif') {
            try {
              const heicConvert = require('heic-convert');
              const inputBuffer = await fs.promises.readFile(file.path);
              const outputBuffer = await heicConvert({
                buffer: inputBuffer,
                format: 'JPEG',
                quality: 0.9
              });

              // Define novo nome de arquivo .jpg
              const baseName = path.basename(file.filename, path.extname(file.filename));
              const jpegFilename = baseName + '.jpg';
              const jpegPath = path.join(path.dirname(file.path), jpegFilename);

              // Escreve o JPEG no disco
              await fs.promises.writeFile(jpegPath, outputBuffer);

              // Apaga o arquivo original HEIC
              try {
                if (fs.existsSync(file.path)) {
                  await fs.promises.unlink(file.path);
                }
              } catch (unlinkErr) {
                console.error('Erro ao deletar arquivo HEIC original:', unlinkErr);
              }

              // Atualiza as variáveis locais para registrar como JPEG
              filePath = jpegPath;
              filename = jpegFilename;
              fileSize = outputBuffer.length;
              extension = 'jpg';
              category = 'image';
              fileType = 'image/jpeg';
            } catch (convErr) {
              console.error('Erro na conversão do arquivo HEIC:', convErr);
              // Mantém as informações originais se falhar
            }
          }

          const fileId = generateId();

          const fileInfo = {
            id: fileId,
            originalName: (extension === 'jpg' && (utf8Name.toLowerCase().endsWith('.heic') || utf8Name.toLowerCase().endsWith('.heif')))
              ? utf8Name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
              : utf8Name,
            filename: filename,
            path: filePath,
            size: fileSize,
            type: fileType,
            category,
            uploadedAt: new Date().toISOString(),
          };

          fileStore.set(fileId, fileInfo);
          uploadedFiles.push(fileInfo);

          // Se for ZIP, extrai e adiciona os arquivos extraídos
          if (category === 'archive') {
            try {
              const extractedFiles = await zipService.extract(file.path);

              for (const extracted of extractedFiles) {
                let ext = extracted.extension;
                let cat = extracted.category;
                let extPath = extracted.path;
                let extFilename = path.basename(extracted.path);
                let extSize = extracted.size;
                let extType = getMimeType(extracted.extension);

                // Se houver arquivo HEIC dentro do ZIP, converte também
                if (ext.toLowerCase() === 'heic' || ext.toLowerCase() === 'heif') {
                  try {
                    const heicConvert = require('heic-convert');
                    const inputBuffer = await fs.promises.readFile(extracted.path);
                    const outputBuffer = await heicConvert({
                      buffer: inputBuffer,
                      format: 'JPEG',
                      quality: 0.9
                    });

                    const baseName = path.basename(extracted.path, path.extname(extracted.path));
                    const jpegFilename = baseName + '.jpg';
                    const jpegPath = path.join(path.dirname(extracted.path), jpegFilename);

                    await fs.promises.writeFile(jpegPath, outputBuffer);

                    try {
                      if (fs.existsSync(extracted.path)) {
                        await fs.promises.unlink(extracted.path);
                      }
                    } catch (unlinkErr) {
                      console.error('Erro ao deletar arquivo HEIC extraído original:', unlinkErr);
                    }

                    extPath = jpegPath;
                    extFilename = jpegFilename;
                    extSize = outputBuffer.length;
                    ext = 'jpg';
                    cat = 'image';
                    extType = 'image/jpeg';
                  } catch (convErr) {
                    console.error('Erro na conversão do arquivo HEIC extraído:', convErr);
                  }
                }

                const extractedId = generateId();
                const extractedInfo = {
                  id: extractedId,
                  originalName: (ext === 'jpg' && (extracted.name.toLowerCase().endsWith('.heic') || extracted.name.toLowerCase().endsWith('.heif')))
                    ? extracted.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
                    : extracted.name,
                  filename: extFilename,
                  path: extPath,
                  size: extSize,
                  type: extType,
                  category: cat,
                  uploadedAt: new Date().toISOString(),
                };

                fileStore.set(extractedId, extractedInfo);
                uploadedFiles.push(extractedInfo);
              }
            } catch (zipErr) {
              console.error('Erro ao extrair ZIP:', zipErr);
              // Continua mesmo se falhar a extração do ZIP
            }
          }
        }

        return res.json({
          success: true,
          files: uploadedFiles,
        });
      } catch (innerErr) {
        console.error('Erro ao processar upload:', innerErr);
        return res.status(500).json({
          success: false,
          message: 'Erro interno ao processar o upload dos arquivos.',
        });
      }
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar o upload.',
    });
  }
});

/**
 * GET /api/files
 * Lista todos os arquivos no fileStore.
 */
router.get('/files', (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const files = Array.from(fileStore.values()).map((file) => ({
      ...file,
      thumbnailUrl: (file.category === 'image' || file.category === 'video' || file.category === 'pdf') ? `/api/files/${file.id}/thumbnail` : null,
    }));

    return res.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao listar os arquivos.',
    });
  }
});

/**
 * GET /api/files/:id/thumbnail
 * Gera e retorna a miniatura de uma imagem.
 */
router.get('/files/:id/thumbnail', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const file = fileStore.get(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado.',
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado no disco.',
      });
    }

    if (file.category === 'image') {
      const thumbnailBuffer = await imageService.generateThumbnail(file.path);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(thumbnailBuffer);
    } else if (file.category === 'pdf') {
      const pdfToImageService = require('../services/pdfToImageService');
      const pageNum = parseInt(req.query.page, 10) || 1;
      const thumbnailBuffer = await pdfToImageService.renderPage(file.path, pageNum, 0.4); // 0.4 scale makes it lightweight!
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(thumbnailBuffer);
    } else if (file.category === 'video') {
      const ffmpeg = require('@ffmpeg-installer/ffmpeg');
      const { execFile } = require('child_process');
      
      // Extrai um quadro do vídeo no tempo 0.5s e escala para largura 300px
      execFile(
        ffmpeg.path,
        ['-y', '-ss', '0.5', '-i', file.path, '-vframes', '1', '-vf', 'scale=300:-1', '-f', 'image2', '-'],
        { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => {
          if (err) {
            console.error('[FFmpeg-Thumbnail] Erro ao extrair miniatura do vídeo:', err.message);
            return res.status(500).json({ success: false, message: 'Falha ao extrair miniatura.' });
          }
          res.set('Content-Type', 'image/png');
          res.set('Cache-Control', 'public, max-age=3600');
          return res.send(stdout);
        }
      );
      return;
    } else {
      return res.status(404).json({
        success: false,
        message: 'Miniatura disponível apenas para imagens, PDFs e vídeos.',
      });
    }
  } catch (error) {
    console.error('Erro ao gerar miniatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao gerar a miniatura.',
    });
  }
});

/**
 * DELETE /api/files/:id
 * Remove um arquivo específico do fileStore e do disco.
 */
router.delete('/files/:id', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const file = fileStore.get(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado.',
      });
    }

    // Remove do disco
    try {
      if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path);
      }
    } catch (fsErr) {
      console.error('Erro ao remover arquivo do disco:', fsErr);
    }

    fileStore.delete(req.params.id);

    return res.json({
      success: true,
      message: 'Arquivo removido com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao remover arquivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao remover o arquivo.',
    });
  }
});

/**
 * DELETE /api/files
 * Remove todos os arquivos do fileStore e do disco.
 */
router.delete('/files', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');

    for (const [id, file] of fileStore.entries()) {
      try {
        if (fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
        }
      } catch (fsErr) {
        console.error(`Erro ao remover arquivo ${file.originalName} do disco:`, fsErr);
      }
    }

    fileStore.clear();

    return res.json({
      success: true,
      message: 'Todos os arquivos foram removidos com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao remover todos os arquivos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao remover os arquivos.',
    });
  }
});

/**
 * GET /api/download/:id
 * Faz download de um arquivo específico.
 */
router.get('/download/:id', (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const file = fileStore.get(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado.',
      });
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado no disco.',
      });
    }

    const encodedFilename = encodeURIComponent(file.originalName);
    res.set('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.set('Content-Type', file.type || 'application/octet-stream');

    return res.sendFile(path.resolve(file.path));
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao fazer download do arquivo.',
    });
  }
});

/**
 * POST /api/download/zip
 * Cria um ZIP com os arquivos especificados e envia como download.
 */
router.post('/download/zip', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar os IDs dos arquivos para download.',
      });
    }

    // Verifica se todos os arquivos existem
    const files = [];
    for (const id of fileIds) {
      const file = fileStore.get(id);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: `Arquivo com ID "${id}" não encontrado.`,
        });
      }
      if (!fs.existsSync(file.path)) {
        return res.status(404).json({
          success: false,
          message: `Arquivo "${file.originalName}" não encontrado no disco.`,
        });
      }
      files.push(file);
    }

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="arquivos_convertidos.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (archiveErr) => {
      console.error('Erro ao criar ZIP:', archiveErr);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Erro ao criar o arquivo ZIP.',
        });
      }
    });

    archive.pipe(res);

    // Garante nomes únicos no ZIP
    const nameCount = {};
    for (const file of files) {
      let zipName = file.originalName;
      if (nameCount[zipName]) {
        nameCount[zipName]++;
        const ext = path.extname(zipName);
        const base = path.basename(zipName, ext);
        zipName = `${base} (${nameCount[zipName]})${ext}`;
      } else {
        nameCount[zipName] = 1;
      }

      archive.file(file.path, { name: zipName });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Erro ao criar ZIP para download:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao criar o arquivo ZIP.',
      });
    }
  }
});

module.exports = router;
