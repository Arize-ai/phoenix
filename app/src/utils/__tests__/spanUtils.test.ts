import { llmSpanToInvocation } from "../spanUtils";

const chatCompletionLLMSpanAttributes = {
  llm: {
    output_messages: [
      {
        message: {
          content: "This is an AI Answer",
          role: "assistant",
        },
      },
    ],
    model_name: "gpt-3.5-turbo",
    token_count: { completion: 9.0, prompt: 1881.0, total: 1890.0 },
    input_messages: [
      {
        message: {
          content: "You are a chatbot",
          role: "system",
        },
      },
      {
        message: {
          content: "Anser me the following question. Are you sentient?",
          role: "user",
        },
      },
    ],
    invocation_parameters:
      '{"context_window": 16384, "num_output": -1, "is_chat_model": true, "is_function_calling_model": true, "model_name": "gpt-3.5-turbo"}',
  },
  openinference: { span: { kind: "LLM" } },
  //   output: { value: "assistant: You can use gRPC for trace collection." },
};

describe("spanUtils", () => {
  it("should convert a chat completion llm span to an invocation object type", () => {
    const result = llmSpanToInvocation(chatCompletionLLMSpanAttributes);
    expect(result).toEqual({});
  });
});
