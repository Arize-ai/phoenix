import { callRunLLMChat } from "./supportTools.js";

const result = await callRunLLMChat({ question: "What is Phoenix?" });
console.log(result);
