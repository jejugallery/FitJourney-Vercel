@echo off
title FitJourney App Deployment
echo ========================================
echo  Starting FitJourney App Deployment
echo ========================================

cd /d "%~dp0"

if not exist node_modules (
    echo 📦 node_modules not found, running npm install...
    call npm install
)

echo 🚀 Building and deploying...
call npm run deploy

echo ========================================
echo  Deployment completed!
echo ========================================
pause
