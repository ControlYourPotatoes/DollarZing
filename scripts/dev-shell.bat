@echo off
REM DollarZing Engine Development Shell (Windows)
REM This script starts a development container and gives you a shell inside it

echo 🚀 Starting DollarZing Engine Development Environment...
echo.

REM Check if container is already running
docker ps --format "table {{.Names}}" | findstr "dollarzing-engine-dev" >nul
if %errorlevel% equ 0 (
    echo ✅ Engine container is already running
    echo 📝 Entering existing container...
    docker exec -it dollarzing-engine-dev sh
) else (
    echo 🔨 Building and starting engine container...
    
    REM Build the container
    docker-compose build engine
    
    REM Start the container in detached mode
    docker-compose up -d engine
    
    REM Wait a moment for container to be ready
    timeout /t 2 /nobreak >nul
    
    echo ✅ Container started successfully!
    echo 📝 Entering development environment...
    echo.
    echo 💡 Development tips:
    echo    • Your engine code is mounted at /app
    echo    • Run 'npm run build' to rebuild after changes
    echo    • Run 'npm run cli simple-test' to test CLI
    echo    • Run 'npm run cli test-game' to test game simulation
    echo    • Type 'exit' to leave the container
    echo.
    
    REM Enter the container
    docker exec -it dollarzing-engine-dev sh
)





