#!/bin/bash

# AI Trading Simulation Platform Startup Script
# This script compiles and starts all services

echo "===================================="
echo "  AI Trading Simulation Platform"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists python; then
    echo -e "${RED}Error: Python is not installed${NC}"
    exit 1
fi

if ! command_exists g++; then
    echo -e "${RED}Error: g++ is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}All prerequisites found!${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"

# Root dependencies
if [ ! -d "node_modules" ]; then
    npm install
fi

# Backend dependencies
if [ ! -d "backend/node_modules" ]; then
    cd backend && npm install && cd ..
fi

# Frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    cd frontend && npm install && cd ..
fi

echo -e "${GREEN}Dependencies installed!${NC}"
echo ""

# Setup Python virtual environment
echo -e "${YELLOW}Setting up Python environment...${NC}"
cd ml-service
if [ ! -d "venv" ]; then
    python -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
cd ..
echo -e "${GREEN}Python environment ready!${NC}"
echo ""

# Build C++ Matching Engine
echo -e "${YELLOW}Building matching engine...${NC}"
cd matching-engine
if [ ! -d "build" ]; then
    mkdir build
fi
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j4
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build matching engine${NC}"
    exit 1
fi
cd ../..
echo -e "${GREEN}Matching engine built successfully!${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID $ML_PID $ENGINE_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $ML_PID $ENGINE_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Matching Engine
echo -e "${YELLOW}Starting Matching Engine...${NC}"
./matching-engine/build/matching_engine > logs/engine.log 2>&1 &
ENGINE_PID=$!
sleep 1
if ! kill -0 $ENGINE_PID 2>/dev/null; then
    echo -e "${RED}Failed to start matching engine${NC}"
    exit 1
fi
echo -e "${GREEN}Matching Engine started (PID: $ENGINE_PID)${NC}"
echo ""

# Start ML Service
echo -e "${YELLOW}Starting ML Service...${NC}"
cd ml-service
source venv/bin/activate
python app.py > ../logs/ml.log 2>&1 &
ML_PID=$!
cd ..
sleep 3
if ! kill -0 $ML_PID 2>/dev/null; then
    echo -e "${RED}Failed to start ML service${NC}"
    cleanup
fi
echo -e "${GREEN}ML Service started (PID: $ML_PID)${NC}"
echo ""

# Start Backend API
echo -e "${YELLOW}Starting Backend API...${NC}"
cd backend
node server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Failed to start backend${NC}"
    cleanup
fi
echo -e "${GREEN}Backend API started (PID: $BACKEND_PID)${NC}"
echo ""

# Start Frontend
echo -e "${YELLOW}Starting Frontend...${NC}"
cd frontend
PORT=3000 npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Failed to start frontend${NC}"
    cleanup
fi
echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"
echo ""

echo "===================================="
echo -e "${GREEN}All services are running!${NC}"
echo "===================================="
echo ""
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:3001"
echo "ML:        http://localhost:5000"
echo "Engine:    localhost:9000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
