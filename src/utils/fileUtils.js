const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const CATEGORY_MAP = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  tiff: 'image',
  tif: 'image',
  bmp: 'image',
  gif: 'image',
  avif: 'image',
  pdf: 'pdf',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  tsv: 'spreadsheet',
  docx: 'document',
  doc: 'document',
  txt: 'document',
  html: 'document',
  htm: 'document',
  zip: 'archive',
  // Video
  mp4: 'video',
  avi: 'video',
  mov: 'video',
  webm: 'video',
  '3gp': 'video',
  mkv: 'video',
  // Audio
  mp3: 'audio',
  ogg: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
};

const MIME_MAP = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  bmp: 'image/bmp',
  gif: 'image/gif',
  avif: 'image/avif',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  tsv: 'text/tab-separated-values',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  zip: 'application/zip',
  // Video
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  mkv: 'video/x-matroska',
  // Audio
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
};

/**
 * Retorna a categoria do arquivo com base na extensão.
 * @param {string} extension - Extensão do arquivo (sem ponto).
 * @returns {'image'|'pdf'|'spreadsheet'|'document'|'archive'|'other'}
 */
function getFileCategory(extension) {
  if (!extension) return 'other';
  return CATEGORY_MAP[extension.toLowerCase()] || 'other';
}

/**
 * Retorna a extensão do arquivo em minúsculas, sem ponto.
 * @param {string} filename
 * @returns {string}
 */
function getExtension(filename) {
  if (!filename) return '';
  const ext = path.extname(filename);
  return ext ? ext.slice(1).toLowerCase() : '';
}

/**
 * Retorna o MIME type adequado para a extensão.
 * @param {string} extension - Extensão sem ponto.
 * @returns {string}
 */
function getMimeType(extension) {
  if (!extension) return 'application/octet-stream';
  return MIME_MAP[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Gera um UUID v4.
 * @returns {string}
 */
function generateId() {
  return uuidv4();
}

/**
 * Remove arquivos mais antigos que maxAgeMs do diretório informado.
 * @param {string} directory - Caminho do diretório.
 * @param {number} maxAgeMs - Idade máxima em milissegundos.
 */
async function cleanOldFiles(directory, maxAgeMs) {
  try {
    if (!fs.existsSync(directory)) return;

    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await cleanOldFiles(fullPath, maxAgeMs);
        // Remove diretório vazio após limpeza
        try {
          const remaining = await fs.promises.readdir(fullPath);
          if (remaining.length === 0) {
            await fs.promises.rmdir(fullPath);
          }
        } catch {
          // Ignora erros ao remover diretórios
        }
      } else {
        try {
          const stats = await fs.promises.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(fullPath);
          }
        } catch {
          // Ignora erros ao remover arquivos individuais
        }
      }
    }
  } catch (err) {
    console.error(`Erro ao limpar arquivos antigos em ${directory}:`, err.message);
  }
}

/**
 * Cria o diretório caso não exista (recursivo).
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Formata o tamanho do arquivo para leitura humana em português.
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 1024) return `${bytes} Bytes`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

module.exports = {
  getFileCategory,
  getExtension,
  getMimeType,
  generateId,
  cleanOldFiles,
  ensureDir,
  formatFileSize,
};
