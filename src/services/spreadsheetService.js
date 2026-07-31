const XLSX = require('xlsx');
const path = require('path');
const { generateId } = require('../utils/fileUtils');

const SUPPORTED_FORMATS = ['xlsx', 'xls', 'csv', 'ods', 'tsv'];

const CONVERTED_DIR = path.join(process.cwd(), 'temp', 'converted');

const BOOK_TYPE_MAP = {
  xlsx: 'xlsx',
  xls: 'biff8',
  csv: 'csv',
  ods: 'ods',
  tsv: 'csv',
};

const spreadsheetService = {
  /**
   * Converte uma planilha para o formato de saída especificado.
   * @param {string} inputPath - Caminho do arquivo de entrada.
   * @param {string} outputFormat - Formato de saída desejado.
   * @param {string} originalName - Nome original do arquivo.
   * @returns {Promise<string>} outputPath
   */
  async convert(inputPath, outputFormat, originalName) {
    const format = outputFormat.toLowerCase();

    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Formato de planilha não suportado: ${format}`);
    }

    const workbook = XLSX.readFile(inputPath);

    const baseName = path.basename(originalName || 'planilha', path.extname(originalName || ''));
    const outputFilename = `${baseName}_${generateId()}.${format}`;
    const outputPath = path.join(CONVERTED_DIR, outputFilename);

    const writeOptions = {
      bookType: BOOK_TYPE_MAP[format],
    };

    if (format === 'tsv') {
      writeOptions.FS = '\t';
    }

    XLSX.writeFile(workbook, outputPath, writeOptions);

    return outputPath;
  },

  /**
   * Retorna uma pré-visualização da primeira planilha.
   * @param {string} inputPath - Caminho do arquivo.
   * @param {number} [maxRows=10] - Número máximo de linhas a retornar.
   * @returns {Promise<{sheetNames: string[], headers: string[], rows: any[][]}>}
   */
  async getPreview(inputPath, maxRows = 10) {
    const workbook = XLSX.readFile(inputPath);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      return { sheetNames: [], headers: [], rows: [] };
    }

    const firstSheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    const headers = data.length > 0 ? data[0].map(String) : [];
    const rows = data.slice(1, maxRows + 1);

    return {
      sheetNames,
      headers,
      rows,
    };
  },

  /**
   * Retorna os formatos suportados pelo serviço de planilha.
   * @returns {string[]}
   */
  getSupportedFormats() {
    return [...SUPPORTED_FORMATS];
  },
};

module.exports = spreadsheetService;
