#!/bin/bash
echo "========================================="
echo "   Execution Coach - Startup Script"
echo "========================================="

# 1. Start the API Proxy Backend in the background
echo "[1/2] Starting Python C++ API Bridge..."
cd backend
/Users/vishaljha/anaconda3/bin/uvicorn main:app --port 8000 &
BACKEND_PID=$!
echo "Backend running on PID $BACKEND_PID"

# Give the backend a second to boot
sleep 2

# 2. Start the Vite Frontend in the foreground
echo "[2/2] Starting React Dashboard..."
cd ../frontend
npx -p node@22 -- npm run dev

# Cleanup background backend if Vite is exited
kill $BACKEND_PID
