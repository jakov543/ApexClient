@echo off
setlocal
cd /d "%~dp0"
title Apex Client - Upload to GitHub
echo ============================================
echo   Upload Apex Client to GitHub
echo ============================================
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [X] Git is not installed. Install it from https://git-scm.com/download/win then run this again.
  start https://git-scm.com/download/win
  pause & exit /b 1
)
echo 1. Make an EMPTY repo first: https://github.com/new
echo    Name: ApexClient   (do NOT add README, .gitignore or license)
echo.
set /p REPO="2. Paste the repo link (e.g. https://github.com/jakov543/ApexClient): "
if "%REPO%"=="" ( echo No link given. & pause & exit /b 1 )

if not exist ".git" (
  git init -b main
)
git add -A
git commit -m "Apex Client" >nul 2>nul
git remote remove origin >nul 2>nul
git remote add origin %REPO%.git
git push -u origin main
if errorlevel 1 ( echo. & echo [X] Push failed. A GitHub login window should appear - sign in and run again. & pause & exit /b 1 )

echo.
echo DONE! GitHub is now building your client (about 6 minutes).
echo Watch it here, then download the installer from Releases:
start %REPO%/actions
pause
