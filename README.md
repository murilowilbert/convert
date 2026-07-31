# 🔄 Convert • Conversor de Arquivos Local

> **Conversor multifuncional, privado e ilimitado de arquivos.**
> Converta documentos, imagens, PDFs, planilhas, mídias e execute OCR diretamente na sua máquina, sem enviar dados para servidores externos.

---

## 🌟 Recursos Principais

- 📄 **Transformação & Conversão de Arquivos**:
  - **Documentos**: Conversão de DOCX, TXT, HTML, PDF e Markdown.
  - **Planilhas**: Suporte para XLSX, XLS, CSV, JSON e HTML.
  - **Imagens**: Suporte para PNG, JPG, WEBP, HEIC, TIFF, BMP, etc.

- 🖼️ **Imagens para PDF / PDF para Imagens**:
  - Reúna múltiplas fotos/imagens em um único documento PDF com controle de orientação, margens e tamanho de página.
  - Extraia páginas de documentos PDF diretamente para imagens em alta resolução.

- 🧩 **Ferramentas de PDF**:
  - **Juntar PDFs (Merge)**: Combine múltiplos arquivos PDF em um só.
  - **Dividir PDF (Split)**: Separe páginas específicas de um PDF com facilidade.

- ⚖️ **Otimização para PJe (Processo Judicial Eletrônico)**:
  - Ferramenta dedicada para advogados e operadores do direito reduzirem e compactarem arquivos PDF para adequação aos limites dos sistemas dos tribunais (PJe, e-SAJ, Projudi).

- 🔍 **Reconhecimento Óptico de Caracteres (OCR)**:
  - Extraia texto editável de imagens e documentos escaneados com motor Tesseract.js (suporte pré-instalado para Português e Inglês).

- 🎬 **Compressão e Conversão de Mídias**:
  - Compacte e converta vídeos e áudios localmente utilizando FFmpeg integrados.

- 🔒 **100% Privado & Ilimitado**:
  - Todo o processamento ocorre **offline** na sua própria máquina.
  - Limite de até **500 MB por arquivo** por padrão (sem cobranças, sem filas e sem limites de uso diário).

- 🕒 **Histórico Local & Limpeza Automática**:
  - Acompanhamento das últimas conversões realizadas.
  - Rotina automática de limpeza para remoção periódica de arquivos temporários e otimização de espaço em disco.

---

## 🚀 Tecnologias Utilizadas

- **Backend**: Node.js, Express, Multer
- **Manipulação de PDF**: `pdf-lib`, `pdfjs-dist`
- **Imagens & Documentos**: `sharp`, `heic-convert`, `mammoth`, `xlsx`, `@napi-rs/canvas`
- **OCR**: `tesseract.js`
- **Mídia**: `@ffmpeg-installer/ffmpeg`
- **Compactação & Utilitários**: `archiver`, `adm-zip`, `uuid`
- **Frontend**: HTML5, CSS3 moderno (Variáveis CSS, CSS Grid/Flexbox), JavaScript ES6+ (Vanilla JS)

---

## 💻 Instalação e Execução

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- Git instalado (opcional, para clonar o repositório)

### Passos para Instalação

1. **Clonar o repositório** (ou baixar o código fonte):
   ```bash
   git clone https://github.com/murilowilbert/convert.git
   cd convert
   ```

2. **Instalar as dependências**:
   ```bash
   npm install
   ```

3. **Iniciar a aplicação**:
   ```bash
   npm start
   ```

4. **Acesso no Navegador**:
   O servidor iniciará em `http://localhost:2102` e abrirá a interface automaticamente no seu navegador padrão.

---

## 🖥️ Execução Rápida no Windows

Se estiver utilizando Windows, você também pode executar o projeto clicando duas vezes no arquivo:
- **`iniciar.bat`**: Instala as dependências (se necessário), inicia o servidor e abre a aplicação no navegador.

---

## 📁 Estrutura do Projeto

```
convert/
├── public/                  # Interface web (HTML, CSS, JS estáticos, assets)
│   ├── css/                 # Estilos (style.css)
│   ├── images/              # Logos e ícones
│   ├── js/                  # Módulos JS do frontend (OCR, PDF, Mídias, PJe, etc.)
│   └── index.html           # Página principal da aplicação
├── src/                     # Código fonte do servidor Node.js
│   ├── routes/              # Rotas da API (upload, conversão, OCR, PJe, etc.)
│   ├── services/            # Serviços de conversão (PDF, Imagens, Documentos, etc.)
│   └── utils/               # Utilitários de arquivos e limpezas
├── eng.traineddata          # Modelo de idioma em Inglês para OCR
├── por.traineddata          # Modelo de idioma em Português para OCR
├── iniciar.bat              # Script de inicialização facilitada no Windows
├── package.json             # Dependências e scripts do projeto
└── server.js                # Servidor principal Express
```

---

## 📄 Licença

Este projeto é de uso livre para fins pessoais e comerciais. Sinta-se à vontade para contribuir, sugerir melhorias ou reportar problemas na aba de *Issues*.
