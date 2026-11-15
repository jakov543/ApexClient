@echo off
setlocal
title Apex Client - Build
cd /d "%~dp0"
echo ============================================
echo   Building Apex Client (mod + launcher)
echo   Works on Windows 10 and Windows 11
echo ============================================
echo.

where java >nul 2>nul
if errorlevel 1 (
  echo [X] Java is not installed.
  echo     Install "Temurin 21 JDK" from https://adoptium.net  ^(tick "Set JAVA_HOME"^), then run this again.
  start https://adoptium.net/temurin/releases/?version=21^&os=windows
  pause & exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed.
  echo     Install the LTS version from https://nodejs.org, then run this again.
  start https://nodejs.org
  pause & exit /b 1
)

echo [1/3] Building the in-game mod (first time downloads Minecraft, takes a few minutes)...
pushd ApexClient
call gradlew.bat build --no-daemon
if errorlevel 1 ( popd & echo. & echo [X] MOD BUILD FAILED - copy the error above and send it. & pause & exit /b 1 )
popd
if not exist "ApexLauncher\resources\mods" mkdir "ApexLauncher\resources\mods"
copy /Y "ApexClient\build\libs\ApexClient-1.4.0.jar" "ApexLauncher\resources\mods\ApexClient.jar" >nul

echo.
echo [2/3] Installing launcher packages...
pushd ApexLauncher
call npm install
if errorlevel 1 ( popd & echo [X] NPM INSTALL FAILED & pause & exit /b 1 )

echo.
echo [3/3] Building the installer...
call npm run dist
if errorlevel 1 ( popd & echo [X] INSTALLER BUILD FAILED & pause & exit /b 1 )
popd

echo.
echo DONE!  Installer: ApexLauncher\dist\ApexClient-Setup-1.0.0.exe
explorer "ApexLauncher\dist"
pause
