#!/bin/bash

# DollarZing Engine Development Shell
# This script starts a development container and gives you a shell inside it

set -e

echo "🚀 Starting DollarZing Engine Development Environment..."
echo ""

# Check if container is already running
if docker ps --format "table {{.Names}}" | grep -q "dollarzing-engine-dev"; then
    echo "✅ Engine container is already running"
    echo "📝 Entering existing container..."
    docker exec -it dollarzing-engine-dev sh
else
    echo "🔨 Building and starting engine container..."
    
    # Build the container
    docker-compose build engine
    
    # Start the container in detached mode
    docker-compose up -d engine
    
    # Wait a moment for container to be ready
    sleep 2
    
    echo "✅ Container started successfully!"
    echo "📝 Entering development environment..."
    echo ""
    echo "💡 Development tips:"
    echo "   • Your engine code is mounted at /app"
    echo "   • Run 'npm run build' to rebuild after changes"
    echo "   • Run 'npm run cli simple-test' to test CLI"
    echo "   • Run 'npm run cli test-game' to test game simulation"
    echo "   • Type 'exit' to leave the container"
    echo ""
    
    # Enter the container
    docker exec -it dollarzing-engine-dev sh
fi





