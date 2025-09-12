# 🌦️ Mastra Weather Activity Planner Demo

A Mastra agent GUI demo showcasing an orchestrator/worker pattern with weather-based AI agents.

## 🚀 Quick Start

1. **Clone and setup**:
   ```bash
   cd supervisor_agent
   npm install
   ```

2. **Set environment variables:**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"  # Your Phoenix instance
   export PHOENIX_API_KEY="your-phoenix-api-key"  # Optional, for Phoenix Cloud
   ```

3. **Start the Mastra agent GUI**:
   ```bash
   npm start
   ```
   
   This will open the Mastra development interface where you can interact with the agents directly.

## 🏗️ How It Works

This demo uses an **orchestrator/worker pattern** where a main orchestrator agent coordinates three specialized worker agents:

```
📍 User Request → 🎯 Orchestrator Agent
    ↓
📊 Weather Data Agent (fetch weather)
    ↓
🔍 Weather Analysis Agent (analyze data)  
    ↓
📋 Activity Planning Agent (recommend activities)
    ↓
✅ Final Activity Plan
```

### The Agents:
- **🎯 Weather Orchestrator**: Coordinates the entire workflow
- **📊 Weather Data Agent**: Fetches current weather data
- **🔍 Weather Analysis Agent**: Interprets weather conditions
- **📋 Activity Planning Agent**: Creates activity recommendations

## 🛠️ Available Commands

```bash

# Manual commands  
npm start          # Start Mastra agent GUI
npm run verify     # Check setup and dependencies
npm run setup      # Install + verify setup
npm run dev        # Start Mastra dev server
```

## 📚 Learn More

- [Mastra Documentation](https://mastra.ai)
- [Arize Phoenix](https://phoenix.arizeai.com)
- [OpenInference Tracing](https://github.com/Arize-ai/openinference)
