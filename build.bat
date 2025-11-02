@echo off
REM ============================================
REM ZQRadar - Build Helper pour Windows
REM ============================================
REM Alternative au Makefile pour ceux qui n'ont pas GNU Make
REM Usage: build.bat [commande]
REM ============================================

setlocal

if "%1"=="" goto help
if /i "%1"=="help" goto help
if /i "%1"=="check" goto check
if /i "%1"=="install" goto install
if /i "%1"=="build" goto build
if /i "%1"=="release" goto release
if /i "%1"=="clean" goto clean
if /i "%1"=="start" goto start
goto error

:help
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          ZQRadar - Build Helper pour Windows               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Usage: build.bat [commande]
echo.
echo Commandes disponibles:
echo.
echo   check       Vérifier les dépendances système
echo   install     Installer toutes les dépendances
echo   build       Builder l'exécutable Windows
echo   release     Créer un package de release complet
echo   clean       Nettoyer les fichiers temporaires
echo   start       Lancer ZQRadar en mode dev
echo   help        Afficher cette aide
echo.
echo ────────────────────────────────────────────────────────────
echo.
echo 💡 Conseil: Si vous avez WSL ou Git Bash, utilisez le Makefile:
echo    make help
echo.
goto end

:check
echo.
echo 🔍 Vérification des dépendances système...
echo.
call npm run check
goto end

:install
echo.
echo 📦 Installation des dépendances...
echo.
call npm install
if errorlevel 1 goto installerror
echo.
echo 🔧 Rebuild des modules natifs...
call npm rebuild cap node-sass
if errorlevel 1 goto installerror
echo.
echo ✅ Installation terminée !
goto end

:installerror
echo.
echo ❌ ERREUR lors de l'installation !
echo.
echo Vérifiez que vous avez:
echo   • Node.js v18.18.2
echo   • Python 3.10.2
echo   • Visual Studio Build Tools
echo.
pause
goto end

:build
echo.
echo 🏗️  Build de ZQRadar pour Windows...
echo.
echo [1/3] Vérification...
call npm run check
if errorlevel 1 (
    echo.
    echo ❌ Vérification échouée !
    pause
    goto end
)
echo.
echo [2/3] Installation de pkg...
call npm install -D pkg
echo.
echo [3/3] Compilation...
call npm run build:win
if errorlevel 1 (
    echo.
    echo ❌ Build échoué !
    pause
    goto end
)
echo.
echo ✅ Build terminé !
echo.
echo 📍 Exécutable créé: dist\ZQRadar.exe
echo.
goto end

:release
echo.
echo 📦 Création d'une release complète...
echo.
call npm run release
if errorlevel 1 (
    echo.
    echo ❌ Release échouée !
    pause
    goto end
)
echo.
echo ✅ Release créée avec succès !
echo.
echo Fichiers dans dist\:
dir /b dist\*.zip 2>nul
echo.
goto end

:clean
echo.
echo 🧹 Nettoyage...
echo.
if exist dist (
    rmdir /s /q dist
    echo ✓ dist\ supprimé
)
if exist build\temp (
    rmdir /s /q build\temp
    echo ✓ build\temp\ supprimé
)
del /q *.log 2>nul
echo.
echo ✅ Nettoyage terminé !
goto end

:start
echo.
echo 🚀 Démarrage de ZQRadar...
echo.
call npm start
goto end

:error
echo.
echo ❌ Commande inconnue: %1
echo.
echo Tapez "build.bat help" pour voir les commandes disponibles
echo.
goto end

:end
endlocal