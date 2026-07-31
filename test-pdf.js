const pdfToImageService = require('./src/services/pdfToImageService');
const path = require('path');
const fs = require('fs');

async function test() {
  try {
    console.log('Testando contagem de páginas...');
    // Procuramos um PDF no diretório temp/uploads/
    const uploadsDir = path.join(__dirname, 'temp', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      console.log('Pasta uploads não existe.');
      return;
    }
    const files = fs.readdirSync(uploadsDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      console.log('Nenhum PDF encontrado na pasta temp/uploads/');
      return;
    }
    const pdfPath = path.join(uploadsDir, pdfFiles[0]);
    console.log('PDF encontrado:', pdfPath);
    const count = await pdfToImageService.getPageCount(pdfPath);
    console.log('Número de páginas:', count);

    console.log('Renderizando página 1...');
    const buffer = await pdfToImageService.renderPage(pdfPath, 1, 0.4);
    console.log('Renderizado com sucesso! Tamanho do buffer:', buffer.length);
  } catch (err) {
    console.error('ERRO NO TESTE:', err);
  }
}

test();
