#!/bin/sh

echo "🔄 Waiting for Toxiproxy to be ready..."
for i in $(seq 1 30); do
  if curl -f http://toxiproxy:8474/version 2>/dev/null; then
    echo "✅ Toxiproxy is ready!"
    break
  fi
  echo "⏳ Toxiproxy not ready, waiting ($i/30)..."
  sleep 2
done

echo "🔧 Setting up PostgreSQL proxy..."
curl -X POST "http://toxiproxy:8474/proxies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "postgres",
    "listen": "0.0.0.0:5432",
    "upstream": "db:5432",
    "enabled": true
  }'

if [ $? -eq 0 ]; then
  echo "✅ Toxiproxy configured successfully!"
else
  echo "⚠️ Proxy might already exist, checking..."
  curl -s http://toxiproxy:8474/proxies/postgres && echo "✅ Proxy exists and is configured!"
fi

echo "🌍 Applying default same-region network conditions..."
curl -X POST "http://toxiproxy:8474/proxies/postgres/toxics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "latency",
    "type": "latency",
    "attributes": {
      "latency": 2,
      "jitter": 1
    }
  }'

if [ $? -eq 0 ]; then
  echo "✅ Same-region latency applied (2ms ±1ms)"
else
  echo "⚠️ Latency toxic might already exist"
fi

echo "📊 Current proxy status:"
curl -s http://toxiproxy:8474/proxies | grep -q postgres
if [ $? -eq 0 ]; then
  echo "✅ Postgres proxy is active with same-region defaults"
  exit 0
else
  echo "❌ Postgres proxy not found"
  exit 1
fi
