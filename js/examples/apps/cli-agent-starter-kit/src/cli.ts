#!/usr/bin/env node
/* eslint-disable no-console */

// Import instrumentation first (Phoenix must be initialized early)
import { flush } from "./instrumentation.js";
import { createAgent, type ConversationHistory } from "./agent/index.js";
import { calculatorTool, getDateTimeTool } from "./agent/tools.js";
import { printWelcome } from "./ui/welcome.js";
import { conversationLoop } from "./ui/interaction.js";

// ANSI color codes
const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;102m"; // darker gray for secondary text
const TEXT = "\x1b[38;5;145m"; // lighter gray for primary text

const LOGO_LINES = [
  " █████╗  ██████╗ ███████╗███╗   ██╗████████╗     ██████╗██╗     ██╗",
  "██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝    ██╔════╝██║     ██║",
  "███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║       ██║     ██║     ██║",
  "██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║       ██║     ██║     ██║",
  "██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║       ╚██████╗███████╗██║",
  "╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝        ╚═════╝╚══════╝╚═╝",
];

// 256-color turquoise gradient (sky to ocean)
const GRADIENT = [
  "\x1b[38;5;122m", // sky cyan
  "\x1b[38;5;86m",  // bright aqua
  "\x1b[38;5;50m",  // turquoise
  "\x1b[38;5;44m",  // ocean teal
  "\x1b[38;5;37m",  // deep sea
  "\x1b[38;5;30m",  // abyss
];

function showBanner(): void {
  console.log();
  LOGO_LINES.forEach((line, i) => {
    console.log(`${GRADIENT[i]}${line}${RESET}`);
  });
  console.log();
  console.log(`${DIM}CLI Agent with AI SDK and Phoenix Tracing${RESET}`);
  console.log();
}

async function main() {
  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set");
    await flush();
    process.exit(1);
  }

  // Display banner
  showBanner();

  // Display welcome
  printWelcome();

  // Create agent with tools and configuration
  // Note: You can override instructions via environment variable
  const agent = createAgent({
    tools: {
      calculator: calculatorTool,
      getDateTime: getDateTimeTool,
    },
    // Uses AGENT_INSTRUCTIONS by default
    // Uncomment to use environment variable override:
    // instructions: process.env.AGENT_INSTRUCTIONS,
  });

  // Start conversation loop
  const conversationHistory: ConversationHistory = [];
  await conversationLoop(agent, conversationHistory);
}

main()
  .then(() => {
    // Allow time for spans to be flushed before exit
    // The beforeExit handler will ensure proper shutdown
  })
  .catch(async (error) => {
    console.error("Fatal error:", error);
    await flush();
    process.exit(1);
  });
