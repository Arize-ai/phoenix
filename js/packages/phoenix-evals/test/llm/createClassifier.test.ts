import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import nock from "nock";
import { createClassifier } from "../../src/llm/createClassifier";
import { openai } from "@ai-sdk/openai";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createClassifier", () => {
  beforeEach(() => {
    // Mock the OpenAI API key environment variable
    vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key-12345");
  });

  afterEach(() => {
    // Clean up any pending mocks
    nock.cleanAll();
    nock.restore();
    vi.unstubAllEnvs();
  });

  const model = openai("gpt-4o-mini");

  const hallucinationPromptTemplate = `
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters. "hallucinated" indicates that the answer
provides factually inaccurate information to the query based on the reference text. "factual"
indicates that the answer to the question is correct relative to the reference text, and does not
contain made up information. Please read the query and reference text carefully before determining
your response.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Reference text]: {{reference}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Is the answer above factual or hallucinated based on the query and reference text?
`;

  it("should create a llm classifier", async () => {
    nock("https://api.openai.com:443", { encodedQueryParams: true })
      .post("/v1/chat/completions", {
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "user",
            content:
              '\nIn this task, you will be presented with a query, a reference text and an answer. The answer is\ngenerated to the question based on the reference text. The answer may contain false information. You\nmust use the reference text to determine if the answer to the question contains false information,\nif the answer is a hallucination of facts. Your objective is to determine whether the answer text\ncontains factual information and is not a hallucination. A \'hallucination\' refers to\nan answer that is not based on the reference text or assumes information that is not available in\nthe reference text. Your response should be a single word: either "factual" or "hallucinated", and\nit should not include any other text or characters. "hallucinated" indicates that the answer\nprovides factually inaccurate information to the query based on the reference text. "factual"\nindicates that the answer to the question is correct relative to the reference text, and does not\ncontain made up information. Please read the query and reference text carefully before determining\nyour response.\n\n    [BEGIN DATA]\n    ************\n    [Query]: Is Arize Phoenix Open Source?\n    ************\n    [Reference text]: Arize Phoenix is a platform for building and deploying AI applications. It is open source.\n    ************\n    [Answer]: Arize is not open source.\n    ************\n    [END DATA]\n\nIs the answer above factual or hallucinated based on the query and reference text?\n',
          },
        ],
        tool_choice: { type: "function", function: { name: "json" } },
        tools: [
          {
            type: "function",
            function: {
              name: "json",
              description: "Respond with a JSON object.",
              parameters: {
                type: "object",
                properties: {
                  explanation: { type: "string" },
                  label: { type: "string", enum: ["factual", "hallucinated"] },
                },
                required: ["explanation", "label"],
                additionalProperties: false,
                $schema: "http://json-schema.org/draft-07/schema#",
              },
            },
          },
        ],
      })
      .reply(
        200,
        [
          "1b1d05009c0539596e6924f1dfae05f54e68a2284f8fd0ce914634f572b199df984b657bd12594cfb8710a04cda243d5b7157458bafafddfb7936d62451acbccbcfbde6f5f0456daa776fc15b703a56161a229f558aead9f97d02a8b7e7751604320297f6625794ccdbf5bffdac2fb3edb44e19b13161f91d0cadb99edbff76bb0c8464ba9ee20c1a04010f51f3845e2594554381e284a3269af97d794985139384915568f428c519c0a8802347efb011790f551082bffc2161a1911004e2196e352df0743b0e5ac98bcae819c4f5298c1201cb5e65ec3618cfc0fd85efef6f1decd2c39ac970e1bf4fcee2e5def7740c6d98b479b888b701ccc99a2e19cc44cbf1f56b4185d3a537f0dd329fb0cfe42a7bdb7a5a4a746b88dfc2187082a22cdea39427391c80567c2c533b3d5eaea8e3693c445641108c01b6c7baf7ee6a441ffd2ac7db48d1250cb966899795e741848d2d8b6d86eacc02e8fee83a41c88890ae1a963ffc273d1d1f17bf749763cbee11123ce0faa204a9f799f9bbcf7529c797999991579ba789bc6e0104842f8a800358c02fb35d936d3fdceb7f21a831a336d0bb2d2ed54b4144645623b89050af648e4149267064bbace5ea96259ce7ee92225714c038df28b355a95bfb1fee420f55e0e68435f06a78490b3101597a48acb793a32886fd358074e0981298620980898c16b1549609532da91a3201ad2c790a3091618",
        ],
        {
          "access-control-expose-headers": "X-Request-ID",
          "alt-svc": 'h3=":443"; ma=86400',
          "cf-cache-status": "DYNAMIC",
          "cf-ray": "95c8d5272f327c2b-DEN",
          connection: "keep-alive",
          "content-encoding": "br",
          "content-type": "application/json",
          date: "Wed, 09 Jul 2025 15:25:13 GMT",
          "openai-organization": "arize-ai-ewa7w1",
          "openai-processing-ms": "1443",
          "openai-version": "2020-10-01",
          server: "cloudflare",
          "set-cookie":
            "_cfuvid=_nqdpbjupInB1GVAClBFILazeItjs5ucE2.3g2tPYJU-1752074713733-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None",
          "strict-transport-security":
            "max-age=31536000; includeSubDomains; preload",
          "transfer-encoding": "chunked",
          "x-content-type-options": "nosniff",
          "x-envoy-upstream-service-time": "1448",
          "x-ratelimit-limit-requests": "30000",
          "x-ratelimit-limit-tokens": "150000000",
          "x-ratelimit-remaining-requests": "29999",
          "x-ratelimit-remaining-tokens": "149999633",
          "x-ratelimit-reset-requests": "2ms",
          "x-ratelimit-reset-tokens": "0s",
          "x-request-id": "req_2d1c3deae1ea0de213372f16e01fe6c1",
        }
      );
    const classifier = createClassifier({
      model,
      choices: { factual: 1, hallucinated: 0 },
      promptTemplate: hallucinationPromptTemplate,
    });

    const result = await classifier({
      output: "Arize is not open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    expect(result.label).toBe("hallucinated");
    expect(result.score).toBe(0);
  });

  it("should have telemetry enabled by default", async () => {
    // Mock the generateClassification function to spy on telemetry configuration
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "factual",
        explanation: "This is a test explanation",
      });

    const classifier = createClassifier({
      model,
      choices: { factual: 1, hallucinated: 0 },
      promptTemplate: hallucinationPromptTemplate,
      // Note: we're not explicitly setting telemetry options here
    });

    await classifier({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify that generateClassification was called without telemetry property (defaults to enabled in generateClassification)
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.not.objectContaining({
        telemetry: expect.anything(),
      })
    );

    vi.restoreAllMocks();
  });

  it("should respect explicitly disabled telemetry", async () => {
    // Mock the generateClassification function to spy on telemetry configuration
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "factual",
        explanation: "This is a test explanation",
      });

    const classifier = createClassifier({
      model,
      choices: { factual: 1, hallucinated: 0 },
      promptTemplate: hallucinationPromptTemplate,
      telemetry: { isEnabled: false }, // Explicitly disable telemetry
    });

    await classifier({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify that generateClassification was called with telemetry disabled
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: { isEnabled: false },
      })
    );

    vi.restoreAllMocks();
  });
});
