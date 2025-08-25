#!/bin/bash

echo "🔍 Finding all Node.js processes for stock-manager..."

# Find all node processes related to this project
PIDS=$(ps aux | grep -E "(nodemon|node.*server\.js|stock-manager)" | grep -v grep | awk '{print $2}')

if [ -z "$PIDS" ]; then
    echo "✅ No stock-manager server processes found running"
    exit 0
fi

echo "📋 Found processes:"
ps aux | grep -E "(nodemon|node.*server\.js|stock-manager)" | grep -v grep

echo ""
echo "🛑 Attempting graceful shutdown..."

# Try graceful shutdown first
for PID in $PIDS; do
    if kill -0 $PID 2>/dev/null; then
        echo "   Sending SIGTERM to PID $PID"
        kill -15 $PID 2>/dev/null
    fi
done

# Wait a few seconds
echo "⏳ Waiting 3 seconds for graceful shutdown..."
sleep 3

# Check what's still running and force kill if necessary
REMAINING=$(ps aux | grep -E "(nodemon|node.*server\.js|stock-manager)" | grep -v grep | awk '{print $2}')

if [ ! -z "$REMAINING" ]; then
    echo "💀 Force killing remaining processes..."
    for PID in $REMAINING; do
        if kill -0 $PID 2>/dev/null; then
            echo "   Force killing PID $PID"
            kill -9 $PID 2>/dev/null
        fi
    done
    
    # Final check
    sleep 1
    STILL_RUNNING=$(ps aux | grep -E "(nodemon|node.*server\.js|stock-manager)" | grep -v grep | awk '{print $2}')
    
    if [ ! -z "$STILL_RUNNING" ]; then
        echo "⚠️  Some processes may still be running as zombies:"
        ps aux | grep -E "(nodemon|node.*server\.js|stock-manager)" | grep -v grep
        echo "   These will be cleaned up automatically by the system"
    else
        echo "✅ All processes terminated successfully"
    fi
else
    echo "✅ All processes shut down gracefully"
fi

# Also kill any processes listening on port 5000
PORT_PROCESS=$(lsof -ti:5000 2>/dev/null)
if [ ! -z "$PORT_PROCESS" ]; then
    echo "🔌 Killing process on port 5000: $PORT_PROCESS"
    kill -9 $PORT_PROCESS 2>/dev/null
fi

echo "🏁 Server shutdown complete"
