@echo off
REM ============================================
REM ZQRadar - Build Helper for Windows
REM ============================================
REM Alternative to Makefile for those who don't have GNU Make
REM Usage: build.bat [command]
REM ============================================

setlocal

if "%1"=="" goto help
if /i "%1"=="help" goto help
if /i "%1"=="check" goto check
if /i "%1"=="install" goto install
if /i "%1"=="build" goto build
if /i "%1"=="rebuild" goto rebuild
if /i "%1"=="release" goto release
if /i "%1"=="clean" goto clean
if /i "%1"=="start" goto start
goto error

:help
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          ZQRadar - Build Helper for Windows                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Usage: build.bat [command]
echo.
echo Available commands:
echo.
echo   check       Check system dependencies
echo   install     Install all dependencies
echo   build       Build Windows executable
echo   rebuild     Complete rebuild (clean + install + build)
echo   release     Create complete release package
echo   clean       Clean temporary files
echo   start       Launch ZQRadar in dev mode
echo   help        Display this help
echo.
echo ────────────────────────────────────────────────────────────
echo.
echo 💡 Tip: If you have WSL or Git Bash, use the Makefile:
echo    make help
echo.
goto end

:check
echo.
echo 🔍 Checking system dependencies...
echo.
call npm run check
goto end

:install
echo.
echo 📦 Installing dependencies...
echo.
call npm install
if errorlevel 1 goto installerror
echo.
echo 🔧 Rebuilding native modules...
call npm rebuild cap node-sass
if errorlevel 1 goto installerror
echo.
echo ✅ Installation completed!
goto end

:installerror
echo.
echo ❌ ERROR during installation!
echo.
echo Make sure you have:
echo   • Node.js v18.18.2
echo   • Python 3.10.2
echo   • Visual Studio Build Tools
echo.
pause
goto end

:build
echo.
echo 🏗️  Building ZQRadar for Windows...
echo.
echo [1/3] Checking...
call npm run check
if errorlevel 1 (
    echo.
    echo ❌ Check failed!
    pause
    goto end
)
echo.
echo [2/3] Installing pkg...
call npm install -D pkg archiver
echo.
echo [3/3] Compiling...
call npm run build:win
if errorlevel 1 (
    echo.
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo ✅ Build completed!
echo.
echo 📍 Executable created: dist\ZQRadar.exe
echo.
goto end

:rebuild
echo.
echo 🔄 Complete rebuild of ZQRadar...
echo.
echo [1/4] Cleaning...
if exist dist (
    rmdir /s /q dist
    echo ✓ dist\ deleted
)
if exist ip.txt (
    del /q ip.txt
    echo ✓ ip.txt deleted
)
echo.
echo [2/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo ❌ Installation failed!
    pause
    goto end
)
echo.
echo [3/4] Rebuilding native modules...
call npm rebuild cap node-sass
if errorlevel 1 (
    echo.
    echo ❌ Native modules rebuild failed!
    pause
    goto end
)
echo.
echo [4/4] Building executable...
call npm run build:win
if errorlevel 1 (
    echo.
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo [Post-build] Copying assets and creating archive...
call node build\post-build.js
if errorlevel 1 (
    echo.
    echo ❌ Post-build failed!
    pause
    goto end
)
echo.
echo ✅ Complete rebuild finished!
echo.
echo 📍 Executable created: dist\ZQRadar.exe
echo.
goto end

:release
echo.
echo 📦 Creating complete release...
echo.
call npm run release
if errorlevel 1 (
    echo.
    echo ❌ Release failed!
    pause
    goto end
)
echo.
echo ✅ Release created successfully!
echo.
echo Files in dist\:
dir /b dist\*.zip 2>nul
echo.
goto end

:clean
echo.
echo 🧹 Cleaning...
echo.
if exist dist (
    rmdir /s /q dist
    echo ✓ dist\ deleted
)
if exist build\temp (
    rmdir /s /q build\temp
    echo ✓ build\temp\ deleted
)
del /q *.log 2>nul
echo.
echo ✅ Cleaning completed!
goto end

:start
echo.
echo 🚀 Starting ZQRadar...
echo.
call npm start
goto end

:error
echo.
echo ❌ Unknown command: %1
echo.
echo Type "build.bat help" to see available commands
echo.
goto end

:end
endlocal