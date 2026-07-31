const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { cleanOldFiles, ensureDir, getExtension } = require('./src/utils/fileUtils');

// ============================================================================
// Configuração do servidor
// ============================================================================

const PORT = 2102;
const app = express();

// Diretórios temporários
const UPLOADS_DIR = path.join(__dirname, 'temp', 'uploads');
const CONVERTED_DIR = path.join(__dirname, 'temp', 'converted');
const TEMP_DIR = path.join(__dirname, 'temp');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Cria diretórios necessários na inicialização
ensureDir(UPLOADS_DIR);
ensureDir(CONVERTED_DIR);
ensureDir(OUTPUT_DIR);

// ============================================================================
// Armazém de arquivos em memória
// ============================================================================

const fileStore = new Map();
app.set('fileStore', fileStore);
app.set('outputDir', OUTPUT_DIR);

// ============================================================================
// Middlewares
// ============================================================================

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser com limite de 500MB
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Servir arquivos estáticos da pasta public/
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// Configuração do Multer para uploads
// ============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = getExtension(file.originalname);
    const uniqueName = ext ? `${uuidv4()}.${ext}` : uuidv4();
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

// Disponibiliza o multer para as rotas
app.set('upload', upload);

// ============================================================================
// Rotas
// ============================================================================

const uploadRoutes = require('./src/routes/uploadRoutes');
const convertRoutes = require('./src/routes/convertRoutes');
const mergeRoutes = require('./src/routes/mergeRoutes');
const historyRoutes = require('./src/routes/historyRoutes');
const pjeRoutes = require('./src/routes/pjeRoutes');
const ocrRoutes = require('./src/routes/ocrRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');

app.use('/api', uploadRoutes);
app.use('/api', convertRoutes);
app.use('/api', mergeRoutes);
app.use('/api', historyRoutes);
app.use('/api', pjeRoutes);
app.use('/api', ocrRoutes);
app.use('/api', mediaRoutes);

// ============================================================================
// Tratamento global de erros
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);

  // Erro do multer
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'O arquivo excede o tamanho máximo permitido de 500MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Erro no upload: ${err.message}`,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
  });
});

// ============================================================================
// Limpeza automática de arquivos temporários
// ============================================================================

const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const MAX_FILE_AGE_MS = 2 * 60 * 60 * 1000; // 2 horas

setInterval(async () => {
  console.log('[Limpeza] Iniciando limpeza de arquivos temporários...');

  try {
    await cleanOldFiles(TEMP_DIR, MAX_FILE_AGE_MS);

    // Remove entradas do fileStore cujos arquivos não existem mais
    for (const [id, file] of fileStore.entries()) {
      if (!fs.existsSync(file.path)) {
        fileStore.delete(id);
      }
    }

    console.log('[Limpeza] Limpeza concluída com sucesso.');
  } catch (err) {
    console.error('[Limpeza] Erro durante a limpeza:', err.message);
  }
}, CLEANUP_INTERVAL_MS);

// ============================================================================
// Inicialização do servidor
// ============================================================================

app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log(`  🔄 Convert - Conversor de Arquivos Local`);
  console.log(`  📡 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`  📁 Uploads em: ${UPLOADS_DIR}`);
  console.log(`  📂 Convertidos em: ${CONVERTED_DIR}`);
  console.log(`  🧹 Limpeza automática a cada 30 minutos`);
  console.log('='.repeat(60));

  // Abre o navegador automaticamente
  try {
    const open = await import('open');
    await open.default(`http://localhost:${PORT}`);
    console.log('  🌐 Navegador aberto automaticamente.');
  } catch {
    console.log('  ⚠️  Não foi possível abrir o navegador automaticamente.');
    console.log(`  Acesse manualmente: http://localhost:${PORT}`);
  }
});

module.exports = { fileStore };
