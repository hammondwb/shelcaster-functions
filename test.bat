@echo off
REM Windows batch file to run tests
REM Usage:
REM   test.bat              Run unit tests only
REM   test.bat integration  Run integration tests (uses shelcaster-admin AWS profile)

if "%1"=="integration" (
    echo Running integration tests with shelcaster-admin profile...
    node run-tests.js --integration
) else if "%1"=="--integration" (
    echo Running integration tests with shelcaster-admin profile...
    node run-tests.js --integration
) else if "%1"=="help" (
    node run-tests.js --help
) else if "%1"=="--help" (
    node run-tests.js --help
) else (
    echo Running unit tests...
    node run-tests.js
)

