const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const pdfToImageService = require('./src/services/pdfToImageService');

async function run() {
  try {
    console.log('Criando PDF de teste...');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([200, 200]);
    page.drawText('Olá Mundo!');
    const pdfBytes = await pdfDoc.save();

    const tempDir = path.join(__dirname, 'temp', 'uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const pdfPath = path.join(tempDir, 'test.pdf');
    fs.writeFileSync(pdfPath, pdfBytes);
    console.log('PDF de teste criado em:', pdfPath);

    console.log('Testando renderização...');
    const buffer = await pdfToImageService.renderPage(pdfPath, 1, 0.4);
    console.log('OK! Buffer size:', buffer.length);
  } catch (err) {
    console.error('ERRO DETECTADO:', err);
  }
}

run();
