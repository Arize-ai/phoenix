#!/bin/bash

# Phoenix Development Startup Script
# This script sets up port forwarding to Traefik and SMTP and starts Phoenix

echo "🚀 Starting Phoenix Development Environment"
echo "==========================================="

# Function to wait for Traefik to be ready
wait_for_traefik() {
    echo "⏳ Waiting for Traefik at traefik:80..."
    for i in {1..30}; do
        if nc -z traefik 80 2>/dev/null; then
            echo "✅ Traefik is ready"
            return 0
        fi
        echo "   Attempt $i/30: Traefik not ready, waiting..."
        sleep 2
    done
    echo "❌ Traefik not available after 60 seconds"
    return 1
}

# Function to wait for SMTP server to be ready
wait_for_smtp() {
    echo "⏳ Waiting for SMTP server at smtp-dev:1025..."
    for i in {1..30}; do
        if nc -z smtp-dev 1025 2>/dev/null; then
            echo "✅ SMTP server is ready"
            return 0
        fi
        echo "   Attempt $i/30: SMTP server not ready, waiting..."
        sleep 2
    done
    echo "❌ SMTP server not available after 60 seconds"
    return 1
}

# Wait for Traefik to be available
wait_for_traefik

# Wait for SMTP server to be available
wait_for_smtp

# Set up port forwarding from localhost:18273 to traefik:80
if ! nc -z localhost 18273 2>/dev/null; then
    echo "🔗 Setting up Traefik port forwarding: localhost:18273 → traefik:80"
    socat TCP-LISTEN:18273,fork,reuseaddr TCP:traefik:80 &
    TRAEFIK_SOCAT_PID=$!
else
    echo "✅ Traefik port forwarding already active: localhost:18273"
    TRAEFIK_SOCAT_PID=""
fi

# Set up port forwarding from localhost:1025 to smtp-dev:1025
if ! nc -z localhost 1025 2>/dev/null; then
    echo "🔗 Setting up SMTP port forwarding: localhost:1025 → smtp-dev:1025"
    socat TCP-LISTEN:1025,fork,reuseaddr TCP:smtp-dev:1025 &
    SMTP_SOCAT_PID=$!
else
    echo "✅ SMTP port forwarding already active: localhost:1025"
    SMTP_SOCAT_PID=""
fi

# Give socat a moment to start
sleep 2

# Test the port forwarding
echo "🧪 Testing port forwarding..."
if nc -z localhost 18273 2>/dev/null; then
    echo "✅ Traefik port forwarding established successfully"
else
    echo "❌ Traefik port forwarding failed to establish"
    exit 1
fi

if nc -z localhost 1025 2>/dev/null; then
    echo "✅ SMTP port forwarding established successfully"
else
    echo "❌ SMTP port forwarding failed to establish"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up port forwarding..."
    [ -n "$TRAEFIK_SOCAT_PID" ] && kill $TRAEFIK_SOCAT_PID 2>/dev/null
    [ -n "$SMTP_SOCAT_PID" ] && kill $SMTP_SOCAT_PID 2>/dev/null
    exit
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

echo "🌟 Starting Phoenix Server..."
echo "   🚀 Phoenix: http://localhost:18273/phoenix"
echo "   📧 SMTP Web UI: http://localhost:18273/mail"
echo ""

# Start Phoenix with debugger always enabled
echo "🐛 Starting Phoenix with debugger on port 5678"
echo "📍 Connect your debugger to localhost:5678"
# Pass through any command line arguments (--dev must come before serve)
exec python -m debugpy --listen 0.0.0.0:5678 -m phoenix.server.main "$@" serve
