#!/bin/bash

echo "🧪 Starting MashLab Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if environment variables are set
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Creating with default Spotify credentials..."
    echo "SPOTIFY_CLIENT_ID=4eb490047d4b443d89fa324ccfa33f3b" > .env.local
    echo "SPOTIFY_CLIENT_SECRET=046e259deff44902abc30d8fd2095fff" >> .env.local
fi

echo "✅ Environment check passed"

# Kill any existing processes
echo "🔄 Cleaning up existing processes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true

# Start the backend server
echo "🚀 Starting Spotify API server on port ${NEXT_PUBLIC_API_URL:-http://localhost:3001}..."
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:3001} node server.js &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 3

# Start the frontend
echo "🌐 Starting React development server on port 3000..."
# Use a different port if 3000 is busy
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3000 is busy, using port 3002..."
    PORT=3002 NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:3001} npm run dev &
else
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:3001} npm run dev &
fi
FRONTEND_PID=$!

echo ""
echo "🎉 MashLab is starting up!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait

# Cleanup on exit
echo ""
echo "🛑 Stopping servers..."
kill $SERVER_PID 2>/dev/null || true
kill $FRONTEND_PID 2>/dev/null || true
echo "✅ Servers stopped"
