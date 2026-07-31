<p align="center">
  <h1 align="center">🔄 Convert — Conversor de Arquivos Local & Privado</h1>
  <p align="center">
    Plataforma web multifuncional de conversão, manipulação de PDFs, OCR e otimização de mídias sem limites de arquivo e 100% offline.
    <br/>
    Construído com <strong>Node.js</strong> · <strong>Express</strong> · <strong>Sharp</strong> · <strong>PDF-Lib</strong> · <strong>Tesseract.js</strong> · <strong>FFmpeg</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-v4-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/PDF_Lib-PDF-red?logo=adobe-acrobat-reader&logoColor=white" alt="PDF-Lib">
  <img src="https://img.shields.io/badge/Tesseract.js-OCR-blue?logo=tesseract&logoColor=white" alt="Tesseract.js">
  <img src="https://img.shields.io/badge/FFmpeg-Media-FF6600?logo=ffmpeg&logoColor=white" alt="FFmpeg">
  <img src="https://img.shields.io/badge/Privacidade-100%25_Offline-brightgreen" alt="Privacidade">
</p>

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura do Sistema](#-arquitetura-do-sistema)
- [Funcionalidades](#-funcionalidades)
- [Tech Stack](#-tech-stack)
- [Pré-Requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Execução](#-execução)
- [Endpoints da API](#-endpoints-da-api)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Privacidade & Limpeza Automática](#-privacidade--limpeza-automática)
- [Licença](#-licença)

---

## 🎯 Visão Geral

O **Convert** é uma solução completa e local desenvolvida para eliminar a dependência de conversores online de terceiros (que impõem limites rígidos de tamanho, cobram assinaturas ou violam a privacidade de documentos confidenciais).

Projetado com uma interface moderna (Dark Mode / Glassmorphism), o sistema é capaz de converter documentos office, planilhas, arquivos de imagem de alta resolução (incluindo HEIC de iPhones), unificar/dividir PDFs, aplicar **OCR para extração de texto**, comprimir arquivos de vídeo/áudio e **otimizar PDFs para o PJe (Processo Judicial Eletrônico)** — tudo rodando diretamente no computador do usuário.

---

## 🏗 Arquitetura do Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Navegador Web)                       │
│  Interface Glassmorphism (HTML5 / CSS3 / ES6 Modules / Web Workers)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (Porta 2102)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVIDORE EXPRESS (Node.js)                     │
│                                                                        │
│  ┌──────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │ Multer Storage   │  │ Middleware CORS    │  │ Auto-Cleanup Engine│  │
│  │ (Uploads ≤500MB) │  │ & Global Errors    │  │ (TTL 2h / Exp 30m) │  │
│  └────────┬─────────┘  └────────────────────┘  └────────────────────┘  │
│           │                                                            │
│  ┌────────▼─────────────────────────────────────────────────────────┐  │
│  │                         ROTEAMENTO (API)                         │  │
│  │   /convert  │  /merge  │  /ocr  │  /pje  │  /media  │  /history    │  │
│  └────────┬─────────────────────────────────────────────────────────┘  │
└───────────┼────────────────────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────────────────────┐
│                        CAMADA DE SERVIÇOS & MOTORES                    │
│                                                                        │
│  ┌─────────────────┐ ┌───────────────────┐ ┌────────────────────────┐  │
│  │   pdfService    │ │    imageService   │ │     ocrRoutes          │  │
│  │  (PDF-Lib /     │ │  (Sharp / Canvas /│ │ (Tesseract.js offline  │  │
│  │  pdfjs-dist)    │ │   heic-convert)   │ │  por/eng traineddata)  │  │
│  └─────────────────┘ └───────────────────┘ └────────────────────────┘  │
│  ┌─────────────────┐ ┌───────────────────┐ ┌────────────────────────┐  │
│  │ documentService │ │spreadsheetService │ │     mediaRoutes        │  │
│  │ (Mammoth/Word)  │ │   (XLSX/SheetJS)  │ │ (FFmpeg Transcoding)   │  │
│  └─────────────────┘ └───────────────────┘ └────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Funcionalidades

### 📄 Conversão & Documentos
| Recurso | Descrição |
|---|---|
| **Documentos Word** | Conversão de arquivos `.docx` para `.pdf`, `.txt`, `.html` e `.md` preservando a estrutura de texto. |
| **Planilhas Eletrônicas** | Conversão entre `.xlsx`, `.xls`, `.csv`, `.json` e tabelas `.html`. |
| **Imagens de Alta Resolução** | Suporte total para `.png`, `.jpg`, `.webp`, `.heic` (fotos de iPhone), `.tiff`, `.bmp`, entre outros. |

### 🛠️ PDF & Utilitários de Imprensa / Jurídico
| Recurso | Descrição |
|---|---|
| **Otimização para PJe** | Módulo exclusivo focado em advogados para compressão rigorosa de PDFs dentro das métricas de tamanho exigidas pelos tribunais. |
| **Juntar PDFs (Merge)** | Reordene e unifique dezenas de documentos PDF em um arquivo final unificado. |
| **Dividir PDF (Split)** | Separe páginas individuais ou intervalos específicos de PDFs extensos. |
| **Imagens para PDF** | Ajuste margens, alinhamento, orientação de página (retrato/paisagem) e gere PDFs compilados a partir de imagens. |
| **PDF para Imagens** | Renderize páginas de documentos PDF diretamente em imagens PNG ou JPG de alta resolução. |

### 🔍 OCR & Mídias
| Recurso | Descrição |
|---|---|
| **OCR 100% Offline** | Motor Tesseract.js com pacotes de idioma locais (`por.traineddata` e `eng.traineddata`) sem necessidade de conexão com a internet. |
| **Compressão de Mídias** | Redução do tamanho de arquivos de vídeo e áudio utilizando binários integrados do FFmpeg. |
| **Histórico Local** | Controle visual dos últimos arquivos convertidos com download simplificado. |

---

## 🛠 Tech Stack

| Camada | Tecnologia | Função |
|---|---|---|
| **Runtime** | Node.js (v18+) | Motor de execução |
| **Servidor HTTP** | Express.js (v4) | Roteamento e API REST |
| **Upload Handler** | Multer | Gerenciamento de uploads em disco de até 500MB |
| **Processamento de Imagens** | Sharp & heic-convert | Redimensionamento, conversão de formatos e decode de HEIC |
| **PDF Processing** | PDF-Lib & pdfjs-dist | Criação, mescla, divisão e renderização de PDFs |
| **Documentos & Planilhas** | Mammoth.js & XLSX (SheetJS) | Parse e renderização de DOCX, XLSX e CSV |
| **Reconhecimento Óptico** | Tesseract.js | OCR em documentos escaneados e imagens |
| **Motor de Vídeo/Áudio** | FFmpeg Installer | Transcodificação e compactação de mídia |
| **Interface Frontend** | HTML5, CSS3 & JavaScript (ES6) | UI com Glassmorphism, notificações e controle interativo |

---

## 📦 Pré-Requisitos

- **Node.js** v18.0.0 ou superior
- **npm** v9.0.0 ou superior
- Navegador web moderno (Chrome, Edge, Firefox, Brave, Safari)

---

## ⚡ Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/murilowilbert/convert.git

# 2. Acesse a pasta do projeto
cd convert

# 3. Instale as dependências
npm install
```

---

## 💻 Execução

### Modo Padrão (Node.js)

```bash
npm start
```
O servidor iniciará na porta `2102` e abrirá automaticamente o seu navegador em `http://localhost:2102`.

### Atalho Rápido no Windows

Você também pode iniciar o projeto dando um duplo clique no arquivo:
- **`iniciar.bat`**: Verifica dependências, inicializa o servidor Express e abre a aplicação no navegador de forma automatizada.

---

## 📡 Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/upload` | Envia arquivos para o diretório de staging temporário |
| `POST` | `/api/convert` | Executa a conversão entre formatos suportados |
| `POST` | `/api/merge` | Combina múltiplos PDFs em um único arquivo |
| `POST` | `/api/split` | Separa páginas de um arquivo PDF |
| `POST` | `/api/ocr` | Executa o OCR em uma imagem/PDF e retorna o texto extraído |
| `POST` | `/api/pje/optimize` | Compacta o PDF para os padrões do PJe |
| `POST` | `/api/media/compress` | Comprime arquivos de áudio ou vídeo |
| `GET` | `/api/history` | Retorna o histórico de conversões recentes |
| `DELETE` | `/api/history` | Limpa o histórico de conversões |

---

## 📁 Estrutura do Projeto

```
convert/
├── public/                       # Frontend da Aplicação (Estáticos)
│   ├── css/
│   │   └── style.css             # Estilos em CSS Vanila (Glassmorphism / Dark Mode)
│   ├── images/
│   │   └── logo.png              # Identidade visual da aplicação
│   ├── js/                       # Módulos JS do cliente
│   │   ├── app.js                # Orquestrador da UI
│   │   ├── converter.js          # Lógica de conversão
│   │   ├── fileManager.js        # Gerenciamento da fila de upload
│   │   ├── history.js            # Controle de histórico
│   │   ├── ocr.js                # Chamadas do módulo OCR
│   │   ├── pdfTools.js           # Ferramentas de manipulação de PDF
│   │   ├── pjeOptimize.js        # Módulo de otimização PJe
│   │   └── mediaCompress.js      # Módulo de compressão de mídias
│   └── index.html                # Single Page Interface
├── src/                          # Backend Express
│   ├── routes/                   # Controladores de Rota
│   │   ├── convertRoutes.js
│   │   ├── historyRoutes.js
│   │   ├── mediaRoutes.js
│   │   ├── mergeRoutes.js
│   │   ├── ocrRoutes.js
│   │   ├── pjeRoutes.js
│   │   └── uploadRoutes.js
│   ├── services/                 # Regras de Negócio e Serviços
│   │   ├── documentService.js
│   │   ├── imageService.js
│   │   ├── pdfService.js
│   │   ├── pdfToImageService.js
│   │   ├── spreadsheetService.js
│   │   └── zipService.js
│   └── utils/                    # Utilitários de arquivos e limpezas
│       └── fileUtils.js
├── eng.traineddata               # Arquivo de treinamento OCR (Inglês)
├── por.traineddata               # Arquivo de treinamento OCR (Português)
├── iniciar.bat                   # Launcher para Windows
├── package.json                  # Manifesto do projeto
├── server.js                     # Ponto de entrada do servidor Express
└── README.md                     # Documentação oficial do projeto
```

---

## 🔒 Privacidade & Limpeza Automática

1. **Privacidade Absoluta**: Nenhum dado ou arquivo enviado para o **Convert** sai da sua máquina local. Todos os dados permanecem nos diretórios do próprio servidor interno (`http://localhost:2102`).
2. **Sistema de Auto-Clean**: O servidor possui uma rotina em segundo plano que é executada a cada **30 minutos**, removendo automaticamente todos os arquivos temporários criados há mais de **2 horas**, garantindo que seu disco não acumule lixo eletrônico.

---

## 📄 Licença

Este projeto é desenvolvido para uso pessoal e profissional. Livre para modificação e aprimoramentos.

---

<p align="center">
  Desenvolvido por <strong>Murilo Wilbert</strong>
</p>
