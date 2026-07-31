const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { generateId, getExtension, getFileCategory, ensureDir } = require('../utils/fileUtils');

const UPLOADS_DIR = path.join(process.cwd(), 'temp', 'uploads');

const zipService = {
  /**
   * Extrai o conteúdo de um arquivo ZIP.
   * @param {string} zipPath - Caminho do arquivo ZIP.
   * @returns {Promise<Array<{name: string, path: string, size: number, extension: string, category: string}>>}
   */
  async extract(zipPath) {
    const extractDir = path.join(UPLOADS_DIR, `zip_${generateId()}`);
    ensureDir(extractDir);

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const extractedFiles = [];

    for (const entry of entries) {
      // Ignora diretórios
      if (entry.isDirectory) continue;

      const entryName = entry.entryName;
      const fileName = path.basename(entryName);

      // Ignora arquivos ocultos e de sistema
      if (fileName.startsWith('.') || fileName.startsWith('__MACOSX')) continue;

      const extension = getExtension(fileName);
      const category = getFileCategory(extension);

      // Preserva a estrutura de diretórios dentro do ZIP
      const outputPath = path.join(extractDir, entryName);
      const outputDir = path.dirname(outputPath);
      ensureDir(outputDir);

      // Extrai o arquivo
      fs.writeFileSync(outputPath, entry.getData());

      const stats = fs.statSync(outputPath);

      extractedFiles.push({
        name: fileName,
        path: outputPath,
        size: stats.size,
        extension,
        category,
      });
    }

    return extractedFiles;
  },

  /**
   * Retorna os formatos suportados pelo serviço de ZIP.
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['zip'];
  },
};

module.exports = zipService;
