@echo off
setlocal
cd /d "c:\Users\otwo\workspace\LMStudio\lmstudio-mcp-bridge"

if "%1"=="stop" (
    echo [BRIDGE] Stopping LM Studio Bridge processes...
    taskkill /F /IM node.exe /T >nul 2>&1
    echo [BRIDGE] Stopped.
    goto :eof
)

if "%1"=="restart" (
    echo [BRIDGE] Restarting LM Studio Bridge...
    taskkill /F /IM node.exe /T >nul 2>&1
    timeout /t 2 > nul
    goto start
)

:start
for /f "tokens=2 delims=:," %%a in ('findstr "version" package.json') do set VERSION=%%a
set VERSION=%VERSION:"=%
set VERSION=%VERSION: =%
echo [BRIDGE] LM Studio Bridge (v%VERSION%) starting...
echo [BRIDGE] Mode: Absolute Path (Conda Env: mcp-bridge)
"C:\Users\otwo\.conda\envs\mcp-bridge\node.exe" src/index.js %*
endlocal
