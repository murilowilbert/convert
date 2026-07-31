const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { generateId, ensureDir } = require('../utils/fileUtils');

const router = express.Router();
const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

/**
 * Obtém a duração de um arquivo de mídia em segundos executando o FFmpeg.
 * @param {string} filePath - Caminho do arquivo.
 * @returns {Promise<number>} - Duração em segundos.
 */
function getMediaDuration(filePath) {
  return new Promise((resolve, reject) => {
    // Executa "ffmpeg -i filePath" para coletar os metadados no stderr
    execFile(ffmpeg.path, ['-i', filePath], (error, stdout, stderr) => {
      // ffmpeg sem arquivo de saída sempre retorna código de erro, ignoramos
      const output = stderr || stdout || '';
      
      // Procura a string "Duration: hh:mm:ss.xx"
      const match = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/.exec(output);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const duration = hours * 3600 + minutes * 60 + seconds;
        resolve(duration || 1); // Garante pelo menos 1s
      } else {
        console.warn(`[FFmpeg] Não foi possível ler a duração do arquivo: ${filePath}`);
        // Retorna um fallback padrão de 10 segundos ou rejeita se crítico
        resolve(0);
      }
    });
  });
}

/**
 * GET /api/media/info
 * Obtém informações de metadados da mídia (duração).
 */
router.get('/media/info', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId } = req.query;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar o ID do arquivo de mídia.',
      });
    }

    const file = fileStore.get(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado.',
      });
    }

    const duration = await getMediaDuration(file.path);

    return res.json({
      success: true,
      duration: duration || 0
    });
  } catch (err) {
    console.error('[MediaCompress] Erro ao obter info da mídia:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/media/compress
 * Comprime e otimiza um arquivo de vídeo ou áudio.
 */
router.post('/media/compress', async (req, res) => {
  try {
    const fileStore = req.app.get('fileStore');
    const { fileId, mode = 'intelligent', limitMb = 10 } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'É necessário informar o ID do arquivo de mídia.',
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

    const ext = path.extname(file.originalName).toLowerCase().slice(1);
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', '3gp', 'webm'];
    const audioExts = ['mp3', 'ogg', 'wav', 'm4a', 'aac'];
    
    let isVideo = videoExts.includes(ext);
    let isAudio = audioExts.includes(ext);

    if (!isVideo && !isAudio) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de mídia não suportado para compressão.',
      });
    }

    ensureDir(CONVERTED_DIR);
    const baseName = path.basename(file.originalName, path.extname(file.originalName));
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;

    console.log(`[MediaCompress] Iniciando compressão do arquivo: ${file.originalName} (${isVideo ? 'Vídeo' : 'Áudio'}), modo: ${mode}`);

    const outputId = generateId();
    let outputFilename = '';
    let outputPath = '';
    let mimeType = '';
    let category = '';
    let ffmpegArgs = [];

    if (isAudio) {
      // --- COMPRESSÃO DE ÁUDIO ---
      outputFilename = `${baseName}_comprimido_${dateStr}.mp3`;
      outputPath = path.join(CONVERTED_DIR, `${outputId}.mp3`);
      mimeType = 'audio/mpeg';
      category = 'audio';

      // Converte para MP3 mono ultra-leve (64kbps, 22050Hz) ideal para vozes
      ffmpegArgs = [
        '-y',
        '-i', file.path,
        '-codec:a', 'libmp3lame',
        '-b:a', '64k',
        '-ac', '1',
        '-ar', '22050',
        outputPath
      ];
    } else {
      // --- COMPRESSÃO DE VÍDEO ---
      outputFilename = `${baseName}_comprimido_${dateStr}.mp4`;
      outputPath = path.join(CONVERTED_DIR, `${outputId}.mp4`);
      mimeType = 'video/mp4';
      category = 'video';

      if (mode === 'intelligent') {
        // Modo inteligente: CRF 28 H.264 + AAC 128k
        ffmpegArgs = [
          '-y',
          '-i', file.path,
          '-vcodec', 'libx264',
          '-crf', '28',
          '-preset', 'medium',
          '-acodec', 'aac',
          '-b:a', '128k',
          '-pix_fmt', 'yuv420p',
          outputPath
        ];
      } else {
        // Modo peso limite (ex: 10MB, 20MB)
        const duration = await getMediaDuration(file.path);
        
        if (duration === 0) {
          // Fallback se não conseguir ler duração
          console.warn('[MediaCompress] Duração desconhecida. Usando compressão CRF 30 padrão.');
          ffmpegArgs = [
            '-y',
            '-i', file.path,
            '-vcodec', 'libx264',
            '-crf', '30',
            '-preset', 'medium',
            '-acodec', 'aac',
            '-b:a', '64k',
            '-pix_fmt', 'yuv420p',
            outputPath
          ];
        } else {
          // Calcula bitrate ideal
          const targetSizeBytes = parseFloat(limitMb) * 1024 * 1024;
          // Aloca margem de segurança de 8%
          const safeSizeBytes = targetSizeBytes * 0.92;
          const totalBitrateBps = (safeSizeBytes * 8) / duration;

          const audioBitrateBps = 64 * 1024; // 64kbps
          let videoBitrateBps = totalBitrateBps - audioBitrateBps;

          // Clampa valores mínimos e máximos razoáveis
          if (videoBitrateBps < 100 * 1024) {
            videoBitrateBps = 100 * 1024; // Mínimo 100kbps para o vídeo não virar ruído puro
          }

          const videoBitrateK = Math.floor(videoBitrateBps / 1024);
          console.log(`[MediaCompress] Duração: ${duration}s, Alvo: ${limitMb}MB, Bitrate Calculado: ${videoBitrateK}k (Vídeo) + 64k (Áudio)`);

          ffmpegArgs = [
            '-y',
            '-i', file.path,
            '-vcodec', 'libx264',
            '-b:v', `${videoBitrateK}k`,
            '-maxrate', `${Math.floor(videoBitrateK * 1.2)}k`,
            '-bufsize', `${Math.floor(videoBitrateK * 2)}k`,
            '-preset', 'medium',
            '-acodec', 'aac',
            '-b:a', '64k',
            '-pix_fmt', 'yuv420p',
            outputPath
          ];
        }
      }
    }

    console.log(`[MediaCompress] Executando FFmpeg: ${ffmpeg.path} ${ffmpegArgs.join(' ')}`);

    execFile(ffmpeg.path, ffmpegArgs, async (error, stdout, stderr) => {
      if (error) {
        console.error('[MediaCompress] Erro no FFmpeg:', error);
        console.error('[MediaCompress] FFmpeg Stderr:', stderr);
        return res.status(500).json({
          success: false,
          message: 'Ocorreu um erro ao comprimir a mídia via FFmpeg.',
        });
      }

      try {
        if (!fs.existsSync(outputPath)) {
          return res.status(500).json({
            success: false,
            message: 'O arquivo de saída comprimido não foi gerado pelo FFmpeg.',
          });
        }

        const stats = await fs.promises.stat(outputPath);
        
        const compressedFileInfo = {
          id: outputId,
          originalName: outputFilename,
          filename: path.basename(outputPath),
          path: outputPath,
          size: stats.size,
          type: mimeType,
          category,
          uploadedAt: new Date().toISOString(),
        };

        fileStore.set(outputId, compressedFileInfo);

        console.log(`[MediaCompress] Sucesso! Mídia comprimida gerada: ${outputFilename} (${stats.size} bytes)`);

        return res.json({
          success: true,
          file: compressedFileInfo,
        });

      } catch (innerErr) {
        console.error('[MediaCompress] Erro ao registrar mídia comprimida:', innerErr);
        return res.status(500).json({
          success: false,
          message: 'Erro interno ao registrar o arquivo de saída.',
        });
      }
    });

  } catch (error) {
    console.error('[MediaCompress] Erro no processamento de mídia:', error);
    return res.status(500).json({
      success: false,
      message: `Erro interno no compressor: ${error.message}`,
    });
  }
});

module.exports = router;
