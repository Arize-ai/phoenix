#!/usr/bin/env node
/* eslint-disable no-console */

import { agent } from "./agents/index.js";
// Import instrumentation first (Phoenix must be initialized early)
/* prettier-ignore */
import { flush } from "./instrumentation.js";
import { agent } from "./agents/index.js";
import { conversationLoop } from "./ui/interaction.js";
import { printWelcome } from "./ui/welcome.js";

// ANSI color codes
const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;102m"; // darker gray for secondary text

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
  "\x1b[38;5;86m", // bright aqua
  "\x1b[38;5;50m", // turquoise
  "\x1b[38;5;44m", // ocean teal
  "\x1b[38;5;37m", // deep sea
  "\x1b[38;5;30m", // abyss
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

  // Start conversation loop (uses pre-configured agent from src/agents)
  await conversationLoop({ agent });

  // Conversation ended - flush traces before exit
  console.log("Flushing traces...");
  await flush();
}

main()
  .then(() => {
    // Clean exit after conversation loop completes
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Fatal error:", error);
    await flush();
    process.exit(1);
  });
