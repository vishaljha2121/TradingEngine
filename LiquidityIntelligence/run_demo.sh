#!/bin/bash
echo "================================================="
echo " Liquidity Intelligence Console - Startup Script"
echo "================================================="

# 1. Start the C++ Backend Server
echo "[1/2] Starting Native C++ Liquidity Engine..."
cd backend/build
./liquidity_console &
BACKEND_PID=$!
echo "Backend running on PID $BACKEND_PID"

# Give the backend a second to bind port 9001
sleep 2

# Cleanup background C++ process if script is killed or Vite exits
trap "echo 'Shutting down...'; kill -9 $BACKEND_PID 2>/dev/null; exit 0" EXIT INT TERM

# 2. Start the Vite Frontend in the foreground
echo "[2/2] Starting React Trade Dashboard..."
cd ../../frontend
npx -p node@22 -- npm run dev
