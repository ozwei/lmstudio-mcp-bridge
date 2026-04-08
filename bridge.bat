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
echo [BRIDGE] LM Studio Bridge (v1.6.4) starting...
echo [BRIDGE] Mode: Absolute Path (Conda Env: mcp-bridge)
"C:\Users\otwo\.conda\envs\mcp-bridge\node.exe" src/index.js %*
endlocal
