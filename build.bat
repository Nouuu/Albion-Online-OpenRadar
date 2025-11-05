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
if /i "%1"=="build:linux" goto buildlinux
if /i "%1"=="build:macos" goto buildmacos
if /i "%1"=="build:all" goto buildall
if /i "%1"=="all-in-one" goto allinone
if /i "%1"=="rebuild" goto rebuild
if /i "%1"=="release" goto release
if /i "%1"=="clean" goto clean
if /i "%1"=="clean:all" goto cleanall
if /i "%1"=="optimize" goto optimize
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
echo   build:linux Build Linux executable
echo   build:macos Build macOS executable
echo   all-in-one  Complete workflow (clean+install+build+optimize+test)
echo   build:all   Build for all platforms
echo   rebuild     Complete rebuild (clean + install + build)
echo   release     Create complete release package
echo   clean       Clean temporary files (preserves optimized images)
echo   clean:all   Clean everything (including optimized images)
echo   optimize    Optimize images in dist/ (after build)
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
echo [1/4] Checking...
call npm run check
if errorlevel 1 (
    echo.
    echo ❌ Check failed!
    pause
    goto end
)
echo.
echo [2/4] Installing pkg and archiver...
call npm install -D pkg archiver
echo.
echo [3/4] Compiling...
call npm run build:win
if errorlevel 1 (
    echo.
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo [4/4] Post-build (copying assets + creating archives)...
call node build\post-build.js
if errorlevel 1 (
    echo.
    echo ❌ Post-build failed!
    pause
    goto end
)
echo.
echo ✅ Build completed!
echo.
echo 📍 Executable created: dist\ZQRadar.exe
echo 📦 Archives created: dist\ZQRadar-*.zip, dist\ZQRadar-*.tar.gz
echo.
goto end

:buildlinux
echo.
echo 🏗️  Building ZQRadar for Linux...
echo.
echo [1/2] Installing pkg and archiver...
call npm install -D pkg archiver
echo.
echo [2/2] Compiling...
call npm run build:linux
if errorlevel 1 (
    echo.
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo [Post-build] Copying assets and creating archives...
call node build\post-build.js
echo.
echo ✅ Build completed!
echo.
echo 📍 Executable created: dist\ZQRadar-linux
echo.
goto end

:buildmacos
echo.
echo 🏗️  Building ZQRadar for macOS...
echo.
echo [1/2] Installing pkg and archiver...
call npm install -D pkg archiver
echo.
echo [2/2] Compiling...
call npm run build:macos
if errorlevel 1 (
    echo.
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo [Post-build] Copying assets and creating archives...
call node build\post-build.js
echo.
echo ✅ Build completed!
echo.
echo 📍 Executable created: dist\ZQRadar-macos
echo.
goto end

:buildall
echo.
echo 🏗️  Building ZQRadar for all platforms...
echo.
echo [1/2] Installing pkg and archiver...
call npm install -D pkg archiver
echo.
echo [2/2] Compiling for Windows, Linux, and macOS...
call npm run build:all
if errorlevel 1 (
    echo.
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo [Post-build] Copying assets and creating archives...
call node build\post-build.js
echo.
echo ✅ Build completed for all platforms!
echo.
echo 📍 Executables created:
echo   - dist\ZQRadar.exe (Windows)
echo   - dist\ZQRadar-linux (Linux)
echo   - dist\ZQRadar-macos (macOS)
echo.
:allinone
echo.
echo ════════════════════════════════════════════════════════════
echo          ZQRadar - Complete Build Workflow
echo ════════════════════════════════════════════════════════════
echo.
echo [1/6] Cleaning (preserving optimized images)...
call :clean >nul 2>&1
echo ✓ Cleaning completed
echo.
echo [2/6] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Installation failed!
    pause
    goto end
)
echo.
echo [3/6] Rebuilding native modules...
call npm rebuild cap node-sass
if errorlevel 1 (
    echo ❌ Rebuild failed!
    pause
    goto end
)
echo.
echo [4/6] Installing build tools...
call npm install -D pkg archiver sharp
echo.
echo [5/6] Building all platforms...
call npm run build:all
if errorlevel 1 (
    echo ❌ Build failed!
    pause
    goto end
)
echo.
echo [6/6] Post-build (assets + optimization + archives)...
call node build\post-build.js
if errorlevel 1 (
    echo ❌ Post-build failed!
    pause
    goto end
)
echo.
echo ════════════════════════════════════════════════════════════
echo ✅ All-in-one build completed successfully!
echo ════════════════════════════════════════════════════════════
echo.
echo 📦 Release packages created in dist\:
dir /b dist\*.zip 2>nul
echo.
echo 💡 Next steps:
echo   1. Test the executables on target platforms
echo   2. Upload archives to release page
echo   3. Update changelog
echo.
goto end

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
if exist dist\images\.optimized (
    echo 💡 Preserving optimized images (dist\images\)
    echo    To force re-optimization, use: build.bat clean:all
    echo.
    REM Delete everything in dist except images folder
    for /d %%d in (dist\*) do (
        if /i not "%%~nxd"=="images" (
            rmdir /s /q "%%d" 2>nul
            if not exist "%%d" echo ✓ %%~nxd\ deleted
        )
    )
    REM Delete only specific file types in dist root (avoid wildcards that could delete dist itself)
    for %%f in (dist\*.exe dist\*.zip dist\*.tar.gz dist\*.7z) do (
        if exist "%%f" del /q "%%f" 2>nul
    )
    REM Delete specific executables (both naming conventions)
    if exist dist\ZQRadar.exe del /q dist\ZQRadar.exe 2>nul
    if exist dist\ZQRadar-linux del /q dist\ZQRadar-linux 2>nul
    if exist dist\ZQRadar-macos del /q dist\ZQRadar-macos 2>nul
    if exist dist\albion-zqradar-win.exe del /q dist\albion-zqradar-win.exe 2>nul
    if exist dist\albion-zqradar-linux del /q dist\albion-zqradar-linux 2>nul
    if exist dist\albion-zqradar-macos del /q dist\albion-zqradar-macos 2>nul
    REM Delete README files
    for %%f in (dist\README*.txt) do (
        if exist "%%f" del /q "%%f" 2>nul
    )
    echo ✓ Executables and archives deleted
    goto clean_temp
)
REM If no marker, delete everything
if exist dist (
    rmdir /s /q dist
    echo ✓ dist\ deleted (no optimized images found)
)
:clean_temp
if exist build\temp (
    rmdir /s /q build\temp
    echo ✓ build\temp\ deleted
)
del /q *.log 2>nul
echo.
echo ✅ Cleaning completed!
goto end

:cleanall
echo.
echo 🧹 Complete cleaning (including optimized images)...
echo.
if exist dist (
    rmdir /s /q dist
    echo ✓ dist\ deleted (including optimized images)
)
if exist build\temp (
    rmdir /s /q build\temp
    echo ✓ build\temp\ deleted
)
del /q *.log 2>nul
echo.
echo ✅ Complete cleaning completed!
echo 💡 Next build will re-optimize images (2-3 min)
goto end

:optimize
echo.
echo 🖼️  Optimizing images in dist/ (source originals preserved)...
echo.
call npm run optimize:images
if errorlevel 1 (
    echo.
    echo ❌ Optimization failed!
    pause
    goto end
)
echo.
echo ✅ Image optimization completed!
echo 📝 Note: Source images/ folder unchanged
echo 💡 Tip: Run this after build to reduce archive size
echo.
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