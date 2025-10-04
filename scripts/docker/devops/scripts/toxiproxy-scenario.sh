#!/bin/bash

# Toxiproxy Network Scenario Manager for Docker Compose
# Usage: ./scripts/toxiproxy-scenario.sh [scenario]

TOXIPROXY_API="http://localhost:8474"

remove_all_toxics() {
    echo "🧹 Removing existing toxics..."
    curl -s -X GET "$TOXIPROXY_API/proxies/postgres/toxics" | \
    jq -r '.[] | .name' 2>/dev/null | \
    while read toxic; do
        curl -s -X DELETE "$TOXIPROXY_API/proxies/postgres/toxics/$toxic"
    done
}

scenario_localhost() {
    echo "🏠 Setting up: LOCALHOST (current baseline)"
    remove_all_toxics
    echo "✅ No latency simulation - direct connection"
}

scenario_same_region() {
    echo "🌍 Setting up: AWS SAME REGION (us-west-2 → us-west-2)"
    remove_all_toxics
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "latency",
            "type": "latency",
            "attributes": {
                "latency": 2,
                "jitter": 1
            }
        }'
    echo "✅ Added 2ms ±1ms latency"
}

scenario_cross_region() {
    echo "🌎 Setting up: AWS CROSS REGION (us-west-2 → us-east-1)"
    remove_all_toxics
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "latency",
            "type": "latency", 
            "attributes": {
                "latency": 75,
                "jitter": 15
            }
        }'
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "bandwidth",
            "type": "bandwidth",
            "attributes": {
                "rate": 10000
            }
        }'
    echo "✅ Added 75ms ±15ms latency + 10MB/s bandwidth limit"
}

scenario_bad_network() {
    echo "📱 Setting up: BAD NETWORK (mobile/unstable connection)"
    remove_all_toxics
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "latency",
            "type": "latency",
            "attributes": {
                "latency": 200,
                "jitter": 100
            }
        }'
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "bandwidth",
            "type": "bandwidth", 
            "attributes": {
                "rate": 1000
            }
        }'
    echo "✅ Added 200ms ±100ms latency + 1MB/s bandwidth limit"
}

scenario_aurora() {
    echo "🌟 Setting up: AWS AURORA (same-AZ with connection pooling)"
    remove_all_toxics
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "latency",
            "type": "latency",
            "attributes": {
                "latency": 3,
                "jitter": 2
            }
        }'
    curl -s -X POST "$TOXIPROXY_API/proxies/postgres/toxics" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "slow_close",
            "type": "slow_close",
            "attributes": {
                "delay": 100
            }
        }'
    echo "✅ Added 3ms ±2ms latency + connection pooling simulation"
}

show_status() {
    echo "📊 Current proxy status:"
    curl -s "$TOXIPROXY_API/proxies/postgres" | jq '.' 2>/dev/null || echo "❌ Proxy not configured"
    echo ""
    echo "🧪 Active toxics:"
    curl -s "$TOXIPROXY_API/proxies/postgres/toxics" | jq '.[] | {name: .name, type: .type, attributes: .attributes}' 2>/dev/null || echo "No toxics active"
}

case "${1:-help}" in
    "localhost"|"local")
        scenario_localhost
        ;;
    "same-region"|"same")
        scenario_same_region
        ;;
    "cross-region"|"cross")
        scenario_cross_region
        ;;
    "bad-network"|"bad")
        scenario_bad_network
        ;;
    "aurora")
        scenario_aurora
        ;;
    "status")
        show_status
        ;;
    *)
        echo "🚀 Toxiproxy Network Scenario Manager"
        echo ""
        echo "Usage: $0 [scenario]"
        echo ""
        echo "Scenarios:"
        echo "  localhost    - No latency (baseline measurement)"
        echo "  same-region  - AWS same region (2ms ±1ms)"
        echo "  cross-region - AWS cross region (75ms ±15ms + bandwidth limit)"
        echo "  aurora       - AWS Aurora (3ms ±2ms + connection pooling)"
        echo "  bad-network  - Mobile/unstable (200ms ±100ms + 1MB/s limit)"
        echo "  status       - Show current configuration"
        echo ""
        echo "Example:"
        echo "  $0 same-region    # Test AWS same region latency"
        echo "  $0 aurora         # Test AWS Aurora characteristics"
        echo "  $0 cross-region   # Test cross-region performance"
        echo "  $0 status         # Check current settings"
        ;;
esac
