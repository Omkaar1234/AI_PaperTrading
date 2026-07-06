@echo off
chcp 65001 >nul

REM AI Trading Simulation Platform Startup Script for Windows

echo ====================================
echo   AI Trading Simulation Platform
echo ====================================
echo.

REM Check prerequisites
echo Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed
    exit /b 1
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed
    exit /b 1
)

where g++ >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: g++ is not installed
    exit /b 1
)

echo All prerequisites found!
echo.

REM Stop any existing project listeners before starting fresh
echo Cleaning up existing project processes...
for %%P in (3000 3001 5000 9000) do (
    for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
        taskkill /F /PID %%I >nul 2>&1
    )
)
taskkill /F /IM "matching_engine.exe" >nul 2>&1
echo Cleanup complete!
echo.

REM Install dependencies
echo Installing dependencies...

if not exist "node_modules" (
    call npm install
)

if not exist "backend\node_modules" (
    cd backend
    call npm install
    cd ..
)

if not exist "frontend\node_modules" (
    cd frontend
    call npm install
    cd ..
)

echo Dependencies installed!
echo.

REM Setup Python environment
echo Setting up Python environment...
cd ml-service
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
cd ..
echo Python environment ready!
echo.

REM Build C++ Matching Engine
echo Building matching engine...
cd matching-engine
if not exist "build" mkdir build
cd build

cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    cmake .. -DCMAKE_BUILD_TYPE=Release
)

cmake --build . --config Release
if %errorlevel% neq 0 (
    mingw32-make -j4
    if %errorlevel% neq 0 (
        echo Failed to build matching engine
        cd ..\..
        exit /b 1
    )
)
cd ..\..
echo Matching engine built successfully!
echo.

REM Create logs directory
if not exist "logs" mkdir logs

REM Start services
echo Starting Matching Engine...
start /B "Matching Engine" "matching-engine\build\matching_engine.exe" > logs\engine.log 2>&1
timeout /t 2 >nul
echo Matching Engine started!
echo.

echo Starting ML Service...
cd ml-service
call venv\Scripts\activate.bat
start /B "ML Service" python app.py > ..\logs\ml.log 2>&1
cd ..
timeout /t 3 >nul
echo ML Service started!
echo.

echo Starting Backend API...
cd backend
start /B "Backend" node server.js > ..\logs\backend.log 2>&1
cd ..
timeout /t 2 >nul
echo Backend API started!
echo.

echo Starting Frontend...
cd frontend
set PORT=3000
start /B "Frontend" npm start > ..\logs\frontend.log 2>&1
cd ..
timeout /t 3 >nul
echo Frontend started!
echo.

echo ====================================
echo   All services are running!
echo ====================================
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:3001
echo ML:        http://localhost:5000
echo Engine:    localhost:9000
echo.
echo Press any key to stop all services...
pause >nul

REM Cleanup
taskkill /F /IM "matching_engine.exe" 2>nul
taskkill /F /IM "node.exe" 2>nul
taskkill /F /IM "python.exe" 2>nul

echo All services stopped!
