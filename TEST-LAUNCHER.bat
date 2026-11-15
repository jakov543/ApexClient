@echo off
rem Runs the launcher without building an installer (for testing). Run BUILD-ALL.bat once first.
pushd ApexLauncher
if not exist node_modules call npm install
call npm start
popd
