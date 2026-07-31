@echo off
cd /d "%~dp0."
chcp 65001 >nul 2>&1
title Convert - Conversor de Arquivos
color 0A

echo.
echo ===================================================
echo               CONVERT - CONVERSOR LOCAL
echo ===================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 goto :NO_NODE

:: Check if node_modules exists locally or in parent folder
if exist "node_modules" goto :START_APP
if exist "..\node_modules" goto :START_APP
goto :INSTALL_DEPS

:START_APP
echo [+] Iniciando o servidor local na porta 2102...
echo [+] Abrindo o navegador em: http://localhost:2102
echo.
echo ---------------------------------------------------
echo   Para fechar, pressione Ctrl+C ou feche esta janela.
echo ---------------------------------------------------
echo.

:: Abre o navegador diretamente do lote para garantia absoluta!
start http://localhost:2102

:: Inicia o servidor Node.js
node server.js

if %errorlevel% neq 0 goto :SERVER_ERROR
exit /b 0

:NO_NODE
echo [ERRO] O Node.js nao foi encontrado no sistema!
echo.
echo Para que este aplicativo funcione localmente,
echo e necessario ter o Node.js instalado.
echo.
echo [WEB] Abrindo o download oficial do Node.js automaticamente...
start https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi
echo.
echo Como proceder:
echo 1. Instale o arquivo baixado (clique em Next/Avancar ate o final).
echo 2. Assim que terminar, feche esta janela preta.
echo 3. De dois cliques em "iniciar.bat" novamente para rodar o Convert!
echo.
pause
exit /b 1

:INSTALL_DEPS
echo [INFO] Primeira vez? Instalando dependencias...
echo Isso pode demorar alguns minutos, aguarde...
echo.
call npm install
if %errorlevel% neq 0 goto :INSTALL_FAILED
echo.
echo [OK] Dependencias instaladas com sucesso!
echo.
goto :START_APP

:INSTALL_FAILED
echo.
echo [ERRO] Erro ao instalar dependencias!
echo Verifique sua conexao com a internet e tente novamente.
echo.
pause
exit /b 1

:SERVER_ERROR
echo.
echo [!] O servidor nao pode ser iniciado!
echo Isso geralmente acontece se o Convert ja estiver rodando em segundo plano.
echo Tente acessar diretamente no navegador: http://localhost:2102
echo.
pause
exit /b 1
