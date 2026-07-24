/**
 * Realistic span fixtures for the span details stories, captured from live
 * Phoenix demo data (llama-index RAG, LangGraph agents, Claude Code traces).
 *
 * Each fixture is structurally compatible with `SpanInfoData` so it can be
 * passed straight to `SpanInfo` and the components under
 * `@phoenix/pages/trace/span`.
 */
import type { SpanInfoData } from "@phoenix/pages/trace/span";

export type SpanInfoFixture = SpanInfoData & {
  /** The name of the span, shown in story descriptions */
  name: string;
};

/**
 * An LLM chat span (llama-index RAG demo): system + user input messages,
 * an assistant output message, and invocation parameters.
 */
export const llmChatSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTMy",
  name: "OpenAI.chat",
  spanKind: "llm",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "LLM",
      },
    },
    input: {
      mime_type: "application/json",
      value:
        '{"messages": [{"role": "system", "content": "You are an expert Q&A system that is trusted around the world.\\nAlways answer the query using the provided context information, and not prior knowledge.\\nSome rules to follow:\\n1. Never directly reference the given context in your answer.\\n2. Avoid statements like \'Based on the context, ...\' or \'The context information ...\' or anything along those lines.", "additional_kwargs": {}}, {"role": "user", "content": "Context information is below.\\n---------------------\\nsource: https://docs.arize.com/phoenix/reference/frequently-asked-questions\\ntitle: Frequently Asked Questions\\n\\nos\\n.\\nenviron\\n[\\n\\"PHOENIX_NOTEBOOK_ENV\\"\\n]\\n \\n=\\n \\n\\"sagemaker\\"\\nCan I persistdata in the notbook?\\nYou can persist data in the notebook by either setting the \\nuse_temp_dir\\n flag to false in \\npx.launch_app\\n which will persit your data in SQLite on your disk at the \\nPHOENIX_WORKING_DIR\\n. Alternatively you can deploy a phoenix instance and point to it via \\nPHOENIX_COLLECTOR_ENDPOINT\\n.\\nCan I use gRPC for trace collection?\\nPhoenix does natively support gRPC for trace collection post 4.0 release. See \\nHow to configure phoenix\\n for details.\\nPrevious\\nRagas\\nNext\\nOpenInference\\nLast updated \\n3 months ago\\n\\nsource: https://docs.arize.com/phoenix/deployment/persistence\\ntitle: Persistence\\n\\nPersistence\\nPhoenix is backed by a SQL database. By default, if you run phoenix with no configuration, it uses SQLite. However you can also configure Phoenix to use PostgreSQL as the backend database as well.\\nPersistence is only available for \'arize-phoenix>=4.0.0\'\\nPersistence for notebooks (a.k.a. \\nlaunch_app\\n) is disabled by default. To enable persistence in notebooks, set the \\nuse_temp_dir\\n to false.\\nSQLite\\nBy default Phoenix uses SQLite so that it runs with no external dependancies. This SQLite instance is by default mounted in the directory specified by the \\nPHOENIX_WORKING_DIR\\n environment variable (default value in your home directory, e.x. \\n~/.phoenix/\\n). The easiest way to make Phoenix to persist data is to back this working directory to a mounted volume. Attach the mounted volume to the phoenix pod and point \\nPHOENIX_WORKING_DIR\\n to that volume (e.x. \\n/mnt/volume\\n)\\\\\\nPostgreSQL\\nPhoenix also can natively be backed by PostgreSQL. To make Phoenix talk to PostgreSQL instead of SQLite, you will have to set the \\nPHOENIX_SQL_DATABASE_URL\\n to your PostgreSQL instance.\\nPrevious\\nQuickstart: Deployment\\nNext\\nKubernetes\\nLast updated \\n20 days ago\\n---------------------\\nGiven the context information and not prior knowledge, answer the query.\\nQuery: Can I persist data in the notebook?\\nAnswer: ", "additional_kwargs": {}}]}',
    },
    llm: {
      output_messages: [
        {
          message: {
            role: "assistant",
            content:
              "You can persist data in the notebook by either setting the use_temp_dir flag to false in px.launch_app which will persist your data in SQLite on your disk at the PHOENIX_WORKING_DIR. Alternatively, you can deploy a phoenix instance and point to it via PHOENIX_COLLECTOR_ENDPOINT.",
          },
        },
      ],
      model_name: "gpt-3.5-turbo",
      provider: "openai",
      token_count: {
        completion: 63,
        total: 649,
        prompt: 586,
      },
      input_messages: [
        {
          message: {
            role: "system",
            content:
              "You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.",
          },
        },
        {
          message: {
            role: "user",
            content:
              'Context information is below.\n---------------------\nsource: https://docs.arize.com/phoenix/reference/frequently-asked-questions\ntitle: Frequently Asked Questions\n\nos\n.\nenviron\n[\n"PHOENIX_NOTEBOOK_ENV"\n]\n \n=\n \n"sagemaker"\nCan I persistdata in the notbook?\nYou can persist data in the notebook by either setting the \nuse_temp_dir\n flag to false in \npx.launch_app\n which will persit your data in SQLite on your disk at the \nPHOENIX_WORKING_DIR\n. Alternatively you can deploy a phoenix instance and point to it via \nPHOENIX_COLLECTOR_ENDPOINT\n.\nCan I use gRPC for trace collection?\nPhoenix does natively support gRPC for trace collection post 4.0 release. See \nHow to configure phoenix\n for details.\nPrevious\nRagas\nNext\nOpenInference\nLast updated \n3 months ago\n\nsource: https://docs.arize.com/phoenix/deployment/persistence\ntitle: Persistence\n\nPersistence\nPhoenix is backed by a SQL database. By default, if you run phoenix with no configuration, it uses SQLite. However you can also configure Phoenix to use PostgreSQL as the backend database as well.\nPersistence is only available for \'arize-phoenix>=4.0.0\'\nPersistence for notebooks (a.k.a. \nlaunch_app\n) is disabled by default. To enable persistence in notebooks, set the \nuse_temp_dir\n to false.\nSQLite\nBy default Phoenix uses SQLite so that it runs with no external dependancies. This SQLite instance is by default mounted in the directory specified by the \nPHOENIX_WORKING_DIR\n environment variable (default value in your home directory, e.x. \n~/.phoenix/\n). The easiest way to make Phoenix to persist data is to back this working directory to a mounted volume. Attach the mounted volume to the phoenix pod and point \nPHOENIX_WORKING_DIR\n to that volume (e.x. \n/mnt/volume\n)\\\nPostgreSQL\nPhoenix also can natively be backed by PostgreSQL. To make Phoenix talk to PostgreSQL instead of SQLite, you will have to set the \nPHOENIX_SQL_DATABASE_URL\n to your PostgreSQL instance.\nPrevious\nQuickstart: Deployment\nNext\nKubernetes\nLast updated \n20 days ago\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: Can I persist data in the notebook?\nAnswer: ',
          },
        },
      ],
      invocation_parameters:
        '{"context_window": 16384, "num_output": -1, "is_chat_model": true, "is_function_calling_model": true, "model_name": "gpt-3.5-turbo"}',
    },
    output: {
      value:
        "assistant: You can persist data in the notebook by either setting the use_temp_dir flag to false in px.launch_app which will persist your data in SQLite on your disk at the PHOENIX_WORKING_DIR. Alternatively, you can deploy a phoenix instance and point to it via PHOENIX_COLLECTOR_ENDPOINT.",
    },
  }),
  input: {
    value:
      '{"messages": [{"role": "system", "content": "You are an expert Q&A system that is trusted around the world.\\nAlways answer the query using the provided context information, and not prior knowledge.\\nSome rules to follow:\\n1. Never directly reference the given context in your answer.\\n2. Avoid statements like \'Based on the context, ...\' or \'The context information ...\' or anything along those lines.", "additional_kwargs": {}}, {"role": "user", "content": "Context information is below.\\n---------------------\\nsource: https://docs.arize.com/phoenix/reference/frequently-asked-questions\\ntitle: Frequently Asked Questions\\n\\nos\\n.\\nenviron\\n[\\n\\"PHOENIX_NOTEBOOK_ENV\\"\\n]\\n \\n=\\n \\n\\"sagemaker\\"\\nCan I persistdata in the notbook?\\nYou can persist data in the notebook by either setting the \\nuse_temp_dir\\n flag to false in \\npx.launch_app\\n which will persit your data in SQLite on your disk at the \\nPHOENIX_WORKING_DIR\\n. Alternatively you can deploy a phoenix instance and point to it via \\nPHOENIX_COLLECTOR_ENDPOINT\\n.\\nCan I use gRPC for trace collection?\\nPhoenix does natively support gRPC for trace collection post 4.0 release. See \\nHow to configure phoenix\\n for details.\\nPrevious\\nRagas\\nNext\\nOpenInference\\nLast updated \\n3 months ago\\n\\nsource: https://docs.arize.com/phoenix/deployment/persistence\\ntitle: Persistence\\n\\nPersistence\\nPhoenix is backed by a SQL database. By default, if you run phoenix with no configuration, it uses SQLite. However you can also configure Phoenix to use PostgreSQL as the backend database as well.\\nPersistence is only available for \'arize-phoenix>=4.0.0\'\\nPersistence for notebooks (a.k.a. \\nlaunch_app\\n) is disabled by default. To enable persistence in notebooks, set the \\nuse_temp_dir\\n to false.\\nSQLite\\nBy default Phoenix uses SQLite so that it runs with no external dependancies. This SQLite instance is by default mounted in the directory specified by the \\nPHOENIX_WORKING_DIR\\n environment variable (default value in your home directory, e.x. \\n~/.phoenix/\\n). The easiest way to make Phoenix to persist data is to back this working directory to a mounted volume. Attach the mounted volume to the phoenix pod and point \\nPHOENIX_WORKING_DIR\\n to that volume (e.x. \\n/mnt/volume\\n)\\\\\\nPostgreSQL\\nPhoenix also can natively be backed by PostgreSQL. To make Phoenix talk to PostgreSQL instead of SQLite, you will have to set the \\nPHOENIX_SQL_DATABASE_URL\\n to your PostgreSQL instance.\\nPrevious\\nQuickstart: Deployment\\nNext\\nKubernetes\\nLast updated \\n20 days ago\\n---------------------\\nGiven the context information and not prior knowledge, answer the query.\\nQuery: Can I persist data in the notebook?\\nAnswer: ", "additional_kwargs": {}}]}',
    mimeType: "json",
  },
  output: {
    value:
      "assistant: You can persist data in the notebook by either setting the use_temp_dir flag to false in px.launch_app which will persist your data in SQLite on your disk at the PHOENIX_WORKING_DIR. Alternatively, you can deploy a phoenix instance and point to it via PHOENIX_COLLECTOR_ENDPOINT.",
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * An LLM span with a provider, tool (function) definitions, and tool-call
 * output messages.
 */
export const llmToolDefinitionsSpan: SpanInfoFixture = {
  id: "U3BhbjozMjc=",
  name: "InteractionsResource.create",
  spanKind: "llm",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "LLM",
      },
    },
    output: {
      value:
        "[\"ThoughtStep(type='thought', signature='EqECCp4CAQw51sdudz/go+TJicUqSyELGjx+Vi05GfFP0PRSEh/J9tN0SjrDF2F5hpOqiN7pKUL8QGqDZw0BU0f3w/Jvm1RPMG50hEnC79hpG0dftbftALbDOfrkS9tlaRvgyHJ1zYO/Jun33XChrAhPvEKESVEmqYvzfSnZQogm2bmUW2gc1mNTZO5olTCbcWnko2n8hH/DZwWmoaa8Uox0aV1h+4+jwGB27G9Rr9BSRlkDwWcGCVFbJ2sOPsgca/Dole0KL5G2wxwq3skBU01WqTIMioG8nkXDpyUdlsCLkGgWYBNBoc7n/XGjya112P1S0gWKzDgzOmbOJNnGIJMz5UgNOItF04E7HiJRF7VPYyOaW7QhxsIFvUX0JcZcp0X2LQ==', summary=None)\", \"FunctionCallStep(id='8zdbd925', arguments={'location': 'Paris'}, name='get_weather', type='function_call', signature=None)\", \"FunctionCallStep(id='ejh0h30g', arguments={'location': 'New Delhi'}, name='get_weather', type='function_call', signature=None)\"]",
      mime_type: "text/plain",
    },
    llm: {
      output_messages: [
        {
          message: {
            role: "model",
            tool_calls: [
              {
                tool_call: {
                  function: {
                    name: "get_weather",
                    arguments: '{"location": "Paris"}',
                  },
                  id: "8zdbd925",
                },
              },
              {
                tool_call: {
                  function: {
                    name: "get_weather",
                    arguments: '{"location": "New Delhi"}',
                  },
                  id: "ejh0h30g",
                },
              },
            ],
          },
        },
      ],
      token_count: {
        prompt: 74,
        total: 171,
        completion: 97,
      },
      input_messages: [
        {
          message: {
            role: "user",
            content: "What is the weather in Paris & New Delhi?",
          },
        },
      ],
      tools: [
        {
          tool: {
            json_schema:
              '{"type": "function", "name": "get_weather", "description": "Gets the weather for a given location.", "parameters": {"type": "object", "properties": {"location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"}}, "required": ["location"]}}',
          },
        },
      ],
      invocation_parameters: "{}",
      model_name: "gemini-3-flash-preview",
      provider: "google",
    },
    input: {
      value: "What is the weather in Paris & New Delhi?",
      mime_type: "text/plain",
    },
  }),
  input: {
    value: "What is the weather in Paris & New Delhi?",
    mimeType: "text",
  },
  output: {
    value:
      "[\"ThoughtStep(type='thought', signature='EqECCp4CAQw51sdudz/go+TJicUqSyELGjx+Vi05GfFP0PRSEh/J9tN0SjrDF2F5hpOqiN7pKUL8QGqDZw0BU0f3w/Jvm1RPMG50hEnC79hpG0dftbftALbDOfrkS9tlaRvgyHJ1zYO/Jun33XChrAhPvEKESVEmqYvzfSnZQogm2bmUW2gc1mNTZO5olTCbcWnko2n8hH/DZwWmoaa8Uox0aV1h+4+jwGB27G9Rr9BSRlkDwWcGCVFbJ2sOPsgca/Dole0KL5G2wxwq3skBU01WqTIMioG8nkXDpyUdlsCLkGgWYBNBoc7n/XGjya112P1S0gWKzDgzOmbOJNnGIJMz5UgNOItF04E7HiJRF7VPYyOaW7QhxsIFvUX0JcZcp0X2LQ==', summary=None)\", \"FunctionCallStep(id='8zdbd925', arguments={'location': 'Paris'}, name='get_weather', type='function_call', signature=None)\", \"FunctionCallStep(id='ejh0h30g', arguments={'location': 'New Delhi'}, name='get_weather', type='function_call', signature=None)\"]",
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * An agent LLM span: input messages spanning system / user / assistant /
 * tool roles and an output message containing tool calls.
 */
export const llmToolCallsSpan: SpanInfoFixture = {
  id: "U3Bhbjo1NDQ3",
  name: "OpenAI.achat",
  spanKind: "llm",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "LLM",
      },
    },
    input: {
      value:
        "{\"messages\": [\"ChatMessage(role=<MessageRole.SYSTEM: 'system'>, content=\\\"\\\\nYou are a helpful assistant that choses a tool to call based on the user's request.\\\\n\\\\nAll of your responses should be a tool call or text.\\\\n\\\\nOnce you receive the results from all of your skills, generate a response to the\\\\nuser that incorporates all of the results.\\\\n\\\", additional_kwargs={})\", \"ChatMessage(role=<MessageRole.USER: 'user'>, content='What trends do you see in my trace latency?', additional_kwargs={})\", \"ChatMessage(role=<MessageRole.ASSISTANT: 'assistant'>, content=None, additional_kwargs={'tool_calls': [ChatCompletionMessageToolCall(id='call_9hXZKTGJaGjb51Yonv5Lh5Cp', function=Function(arguments='{\\\"prompt\\\":\\\"Get trace latency data\\\"}', name='generate_and_run_sql_query'), type='function')]})\", \"ChatMessage(role=<MessageRole.TOOL: 'tool'>, content=\\\"[('retrieve', '2024-08-07 23:32:27.604000+00:00', '2024-08-07 23:32:27.848063+00:00', 0.2439737319946289), ('embedding', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.829420+00:00', 0.22397786378860474), ('retrieve', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.844357+00:00', 0.2389848232269287), ('query', '2024-08-07 23:32:27.603000+00:00', '2024-08-07 23:32:28.903072+00:00', 1.2999728322029114), ('embedding', '2024-08-08 17:15:02.784000+00:00', '2024-08-08 17:15:02.981640+00:00', 0.19798725843429565), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.992214+00:00', 0.20901113748550415), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.989560+00:00', 0.20699948072433472), ('query', '2024-08-08 17:15:02.782000+00:00', '2024-08-08 17:15:04.105240+00:00', 1.3229861855506897), ('llm', '2024-08-08 17:15:03.005000+00:00', '2024-08-08 17:15:04.103099+00:00', 1.0980024933815002), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.304235+00:00', 0.24703145027160645), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.306487+00:00', 0.2490028738975525), ('embedding', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.297020+00:00', 0.24003088474273682), ('llm', '2024-08-08 17:16:34.319000+00:00', '2024-08-08 17:16:35.551296+00:00', 1.232019066810608), ('query', '2024-08-08 17:16:34.056000+00:00', '2024-08-08 17:16:35.553712+00:00', 1.4980003237724304), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.441706+00:00', 0.21496564149856567), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.439011+00:00', 0.2119883894920349), ('embedding', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.431817+00:00', 0.20498782396316528), ('query', '2024-08-08 17:18:01.225000+00:00', '2024-08-08 17:18:02.683177+00:00', 1.458008587360382), ('llm', '2024-08-08 17:18:01.456000+00:00', '2024-08-08 17:18:02.681236+00:00', 1.2250185012817383), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.228044+00:00', 0.14801770448684692), ('embedding', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.220893+00:00', 0.1410171389579773), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.230473+00:00', 0.14998912811279297), ('query', '2024-08-08 21:00:12.079000+00:00', '2024-08-08 21:00:14.147887+00:00', 2.0689889788627625), ('embedding', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.021851+00:00', 0.13200491666793823), ('retrieve', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.031930+00:00', 0.14198273420333862), ('retrieve', '2024-08-08 23:35:07.889000+00:00', '2024-08-08 23:35:08.034155+00:00', 0.14500021934509277), ('query', '2024-08-08 23:35:07.888000+00:00', '2024-08-08 23:35:09.267961+00:00', 1.3799965381622314), ('embedding', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:39.999287+00:00', 0.3029957413673401), ('retrieve', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:40.010193+00:00', 0.3139793872833252), ('retrieve', '2024-08-08 23:55:39.695000+00:00', '2024-08-08 23:55:40.012401+00:00', 0.31699687242507935), ('query', '2024-08-08 23:55:39.694000+00:00', '2024-08-08 23:55:41.246378+00:00', 1.551993191242218), ('embedding', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.421740+00:00', 0.21601170301437378), ('retrieve', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:21.431602+00:00', 0.2269953489303589), ('retrieve', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.430353+00:00', 0.22397786378860474), ('query', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:22.656935+00:00', 1.4520138502120972), ('llm', '2024-08-09 00:21:21.445000+00:00', '2024-08-09 00:21:22.654344+00:00', 1.2090057134628296), ('embedding', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.331678+00:00', 0.20201057195663452), ('retrieve', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.340648+00:00', 0.21102279424667358), ('retrieve', '2024-08-12 17:41:06.129000+00:00', '2024-08-12 17:41:06.342348+00:00', 0.21303445100784302), ('query', '2024-08-12 17:41:06.128000+00:00', '2024-08-12 17:41:07.851628+00:00', 1.7239898443222046), ('llm', '2024-08-12 17:41:06.356000+00:00', '2024-08-12 17:41:07.848066+00:00', 1.4919653534889221), ('llm', '2024-08-12 17:41:06.355000+00:00', '2024-08-12 17:41:07.849691+00:00', 1.4949828386306763), ('embedding', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.188718+00:00', 0.21400004625320435), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.196006+00:00', 0.22100061178207397), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.198113+00:00', 0.22297203540802002), ('llm', '2024-08-12 17:44:18.211000+00:00', '2024-08-12 17:44:19.854120+00:00', 1.6430005431175232), ('llm', '2024-08-12 17:44:18.210000+00:00', '2024-08-12 17:44:19.856227+00:00', 1.645977795124054), ('query', '2024-08-12 17:44:17.974000+00:00', '2024-08-12 17:44:19.858101+00:00', 1.8839970231056213), ('embedding', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.559297+00:00', 0.13699382543563843), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.566436+00:00', 0.14399439096450806), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.568568+00:00', 0.14697164297103882), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.077988+00:00', 1.4969944953918457), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.080501+00:00', 1.4999717473983765), ('query', '2024-08-12 17:44:53.421000+00:00', '2024-08-12 17:44:55.082638+00:00', 1.6619905829429626), ('retrieve', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:48.443986+00:00', 0.23999065160751343), ('retrieve', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.442186+00:00', 0.23701339960098267), ('embedding', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.435059+00:00', 0.23001283407211304), ('query', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:49.355868+00:00', 1.1519953608512878), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.353559+00:00', 0.8959919214248657), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.351132+00:00', 0.8929744362831116), ('embedding', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.396148+00:00', 0.2780109643936157), ('retrieve', '2024-08-12 19:37:27.117000+00:00', '2024-08-12 19:37:27.406373+00:00', 0.28899461030960083), ('retrieve', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.405205+00:00', 0.2870231866836548), ('query', '2024-08-12 19:37:27.116000+00:00', '2024-08-12 19:37:28.731961+00:00', 1.6160041093826294), ('llm', '2024-08-12 19:37:27.420000+00:00', '2024-08-12 19:37:28.729986+00:00', 1.3100311160087585)]\\\", additional_kwargs={'tool_call_id': 'call_9hXZKTGJaGjb51Yonv5Lh5Cp'})\"], \"kwargs\": {\"tools\": [{\"type\": \"function\", \"function\": {\"name\": \"data_analyzer\", \"description\": \"{'name': 'data_analyzer', 'description': 'Provides insights, trends, or analysis based on the data and prompt.', 'parameters': {'type': 'object', 'properties': {'data': {'type': 'string', 'description': 'The data to analyze.'}, 'prompt': {'type': 'string', 'description': 'The original user prompt that the data is based on.'}}, 'required': ['data', 'prompt']}}\", \"parameters\": {\"properties\": {\"input\": {\"title\": \"Input\", \"type\": \"string\"}}, \"required\": [\"input\"], \"type\": \"object\", \"additionalProperties\": false}, \"strict\": false}}, {\"type\": \"function\", \"function\": {\"name\": \"generate_and_run_sql_query\", \"description\": \"{'name': 'generate_and_run_sql_query', 'description': 'Generates SQL queries based on the prompt. This tool has access to the following table: traces.', 'parameters': {'type': 'object', 'properties': {'prompt': {'type': 'string', 'description': 'The prompt to generate an SQL query from. This prompt should never be an SQL query.'}, 'with_retries': {'type': 'boolean', 'description': 'Whether to retry the query generation if it fails. Defaults to True.'}}, 'required': ['prompt']}}\", \"parameters\": {\"properties\": {\"input\": {\"title\": \"Input\", \"type\": \"string\"}}, \"required\": [\"input\"], \"type\": \"object\", \"additionalProperties\": false}, \"strict\": false}}], \"tool_choice\": \"auto\", \"model\": \"gpt-4o\"}}",
      mime_type: "application/json",
    },
    llm: {
      token_count: {
        prompt: 3949,
        completion: 3612,
        total: 7561,
      },
      invocation_parameters:
        '{"context_window":128000,"num_output":-1,"is_chat_model":true,"is_function_calling_model":true,"model_name":"gpt-4o","system_role":"system"}',
      model_name: "gpt-4o",
      prompt_template: {
        template:
          "\nYou are a helpful assistant that choses a tool to call based on the user's request.\n\nAll of your responses should be a tool call or text.\n\nOnce you receive the results from all of your skills, generate a response to the\nuser that incorporates all of the results.\n",
        version: "v0.1",
      },
      input_messages: [
        {
          message: {
            role: "system",
            content:
              "\nYou are a helpful assistant that choses a tool to call based on the user's request.\n\nAll of your responses should be a tool call or text.\n\nOnce you receive the results from all of your skills, generate a response to the\nuser that incorporates all of the results.\n",
          },
        },
        {
          message: {
            role: "user",
            content: "What trends do you see in my trace latency?",
          },
        },
        {
          message: {
            tool_calls: [
              {
                tool_call: {
                  function: {
                    arguments: '{"prompt":"Get trace latency data"}',
                    name: "generate_and_run_sql_query",
                  },
                },
              },
            ],
            role: "assistant",
          },
        },
        {
          message: {
            role: "tool",
            content:
              "[('retrieve', '2024-08-07 23:32:27.604000+00:00', '2024-08-07 23:32:27.848063+00:00', 0.2439737319946289), ('embedding', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.829420+00:00', 0.22397786378860474), ('retrieve', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.844357+00:00', 0.2389848232269287), ('query', '2024-08-07 23:32:27.603000+00:00', '2024-08-07 23:32:28.903072+00:00', 1.2999728322029114), ('embedding', '2024-08-08 17:15:02.784000+00:00', '2024-08-08 17:15:02.981640+00:00', 0.19798725843429565), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.992214+00:00', 0.20901113748550415), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.989560+00:00', 0.20699948072433472), ('query', '2024-08-08 17:15:02.782000+00:00', '2024-08-08 17:15:04.105240+00:00', 1.3229861855506897), ('llm', '2024-08-08 17:15:03.005000+00:00', '2024-08-08 17:15:04.103099+00:00', 1.0980024933815002), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.304235+00:00', 0.24703145027160645), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.306487+00:00', 0.2490028738975525), ('embedding', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.297020+00:00', 0.24003088474273682), ('llm', '2024-08-08 17:16:34.319000+00:00', '2024-08-08 17:16:35.551296+00:00', 1.232019066810608), ('query', '2024-08-08 17:16:34.056000+00:00', '2024-08-08 17:16:35.553712+00:00', 1.4980003237724304), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.441706+00:00', 0.21496564149856567), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.439011+00:00', 0.2119883894920349), ('embedding', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.431817+00:00', 0.20498782396316528), ('query', '2024-08-08 17:18:01.225000+00:00', '2024-08-08 17:18:02.683177+00:00', 1.458008587360382), ('llm', '2024-08-08 17:18:01.456000+00:00', '2024-08-08 17:18:02.681236+00:00', 1.2250185012817383), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.228044+00:00', 0.14801770448684692), ('embedding', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.220893+00:00', 0.1410171389579773), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.230473+00:00', 0.14998912811279297), ('query', '2024-08-08 21:00:12.079000+00:00', '2024-08-08 21:00:14.147887+00:00', 2.0689889788627625), ('embedding', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.021851+00:00', 0.13200491666793823), ('retrieve', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.031930+00:00', 0.14198273420333862), ('retrieve', '2024-08-08 23:35:07.889000+00:00', '2024-08-08 23:35:08.034155+00:00', 0.14500021934509277), ('query', '2024-08-08 23:35:07.888000+00:00', '2024-08-08 23:35:09.267961+00:00', 1.3799965381622314), ('embedding', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:39.999287+00:00', 0.3029957413673401), ('retrieve', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:40.010193+00:00', 0.3139793872833252), ('retrieve', '2024-08-08 23:55:39.695000+00:00', '2024-08-08 23:55:40.012401+00:00', 0.31699687242507935), ('query', '2024-08-08 23:55:39.694000+00:00', '2024-08-08 23:55:41.246378+00:00', 1.551993191242218), ('embedding', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.421740+00:00', 0.21601170301437378), ('retrieve', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:21.431602+00:00', 0.2269953489303589), ('retrieve', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.430353+00:00', 0.22397786378860474), ('query', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:22.656935+00:00', 1.4520138502120972), ('llm', '2024-08-09 00:21:21.445000+00:00', '2024-08-09 00:21:22.654344+00:00', 1.2090057134628296), ('embedding', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.331678+00:00', 0.20201057195663452), ('retrieve', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.340648+00:00', 0.21102279424667358), ('retrieve', '2024-08-12 17:41:06.129000+00:00', '2024-08-12 17:41:06.342348+00:00', 0.21303445100784302), ('query', '2024-08-12 17:41:06.128000+00:00', '2024-08-12 17:41:07.851628+00:00', 1.7239898443222046), ('llm', '2024-08-12 17:41:06.356000+00:00', '2024-08-12 17:41:07.848066+00:00', 1.4919653534889221), ('llm', '2024-08-12 17:41:06.355000+00:00', '2024-08-12 17:41:07.849691+00:00', 1.4949828386306763), ('embedding', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.188718+00:00', 0.21400004625320435), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.196006+00:00', 0.22100061178207397), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.198113+00:00', 0.22297203540802002), ('llm', '2024-08-12 17:44:18.211000+00:00', '2024-08-12 17:44:19.854120+00:00', 1.6430005431175232), ('llm', '2024-08-12 17:44:18.210000+00:00', '2024-08-12 17:44:19.856227+00:00', 1.645977795124054), ('query', '2024-08-12 17:44:17.974000+00:00', '2024-08-12 17:44:19.858101+00:00', 1.8839970231056213), ('embedding', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.559297+00:00', 0.13699382543563843), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.566436+00:00', 0.14399439096450806), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.568568+00:00', 0.14697164297103882), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.077988+00:00', 1.4969944953918457), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.080501+00:00', 1.4999717473983765), ('query', '2024-08-12 17:44:53.421000+00:00', '2024-08-12 17:44:55.082638+00:00', 1.6619905829429626), ('retrieve', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:48.443986+00:00', 0.23999065160751343), ('retrieve', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.442186+00:00', 0.23701339960098267), ('embedding', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.435059+00:00', 0.23001283407211304), ('query', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:49.355868+00:00', 1.1519953608512878), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.353559+00:00', 0.8959919214248657), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.351132+00:00', 0.8929744362831116), ('embedding', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.396148+00:00', 0.2780109643936157), ('retrieve', '2024-08-12 19:37:27.117000+00:00', '2024-08-12 19:37:27.406373+00:00', 0.28899461030960083), ('retrieve', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.405205+00:00', 0.2870231866836548), ('query', '2024-08-12 19:37:27.116000+00:00', '2024-08-12 19:37:28.731961+00:00', 1.6160041093826294), ('llm', '2024-08-12 19:37:27.420000+00:00', '2024-08-12 19:37:28.729986+00:00', 1.3100311160087585)]",
          },
        },
      ],
      output_messages: [
        {
          message: {
            tool_calls: [
              {
                tool_call: {
                  function: {
                    arguments:
                      "{\"data\":\"[('retrieve', '2024-08-07 23:32:27.604000+00:00', '2024-08-07 23:32:27.848063+00:00', 0.2439737319946289), ('embedding', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.829420+00:00', 0.22397786378860474), ('retrieve', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.844357+00:00', 0.2389848232269287), ('query', '2024-08-07 23:32:27.603000+00:00', '2024-08-07 23:32:28.903072+00:00', 1.2999728322029114), ('embedding', '2024-08-08 17:15:02.784000+00:00', '2024-08-08 17:15:02.981640+00:00', 0.19798725843429565), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.992214+00:00', 0.20901113748550415), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.989560+00:00', 0.20699948072433472), ('query', '2024-08-08 17:15:02.782000+00:00', '2024-08-08 17:15:04.105240+00:00', 1.3229861855506897), ('llm', '2024-08-08 17:15:03.005000+00:00', '2024-08-08 17:15:04.103099+00:00', 1.0980024933815002), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.304235+00:00', 0.24703145027160645), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.306487+00:00', 0.2490028738975525), ('embedding', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.297020+00:00', 0.24003088474273682), ('llm', '2024-08-08 17:16:34.319000+00:00', '2024-08-08 17:16:35.551296+00:00', 1.232019066810608), ('query', '2024-08-08 17:16:34.056000+00:00', '2024-08-08 17:16:35.553712+00:00', 1.4980003237724304), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.441706+00:00', 0.21496564149856567), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.439011+00:00', 0.2119883894920349), ('embedding', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.431817+00:00', 0.20498782396316528), ('query', '2024-08-08 17:18:01.225000+00:00', '2024-08-08 17:18:02.683177+00:00', 1.458008587360382), ('llm', '2024-08-08 17:18:01.456000+00:00', '2024-08-08 17:18:02.681236+00:00', 1.2250185012817383), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.228044+00:00', 0.14801770448684692), ('embedding', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.220893+00:00', 0.1410171389579773), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.230473+00:00', 0.14998912811279297), ('query', '2024-08-08 21:00:12.079000+00:00', '2024-08-08 21:00:14.147887+00:00', 2.0689889788627625), ('embedding', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.021851+00:00', 0.13200491666793823), ('retrieve', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.031930+00:00', 0.14198273420333862), ('retrieve', '2024-08-08 23:35:07.889000+00:00', '2024-08-08 23:35:08.034155+00:00', 0.14500021934509277), ('query', '2024-08-08 23:35:07.888000+00:00', '2024-08-08 23:35:09.267961+00:00', 1.3799965381622314), ('embedding', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:39.999287+00:00', 0.3029957413673401), ('retrieve', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:40.010193+00:00', 0.3139793872833252), ('retrieve', '2024-08-08 23:55:39.695000+00:00', '2024-08-08 23:55:40.012401+00:00', 0.31699687242507935), ('query', '2024-08-08 23:55:39.694000+00:00', '2024-08-08 23:55:41.246378+00:00', 1.551993191242218), ('embedding', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.421740+00:00', 0.21601170301437378), ('retrieve', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:21.431602+00:00', 0.2269953489303589), ('retrieve', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.430353+00:00', 0.22397786378860474), ('query', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:22.656935+00:00', 1.4520138502120972), ('llm', '2024-08-09 00:21:21.445000+00:00', '2024-08-09 00:21:22.654344+00:00', 1.2090057134628296), ('embedding', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.331678+00:00', 0.20201057195663452), ('retrieve', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.340648+00:00', 0.21102279424667358), ('retrieve', '2024-08-12 17:41:06.129000+00:00', '2024-08-12 17:41:06.342348+00:00', 0.21303445100784302), ('query', '2024-08-12 17:41:06.128000+00:00', '2024-08-12 17:41:07.851628+00:00', 1.7239898443222046), ('llm', '2024-08-12 17:41:06.356000+00:00', '2024-08-12 17:41:07.848066+00:00', 1.4919653534889221), ('llm', '2024-08-12 17:41:06.355000+00:00', '2024-08-12 17:41:07.849691+00:00', 1.4949828386306763), ('embedding', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.188718+00:00', 0.21400004625320435), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.196006+00:00', 0.22100061178207397), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.198113+00:00', 0.22297203540802002), ('llm', '2024-08-12 17:44:18.211000+00:00', '2024-08-12 17:44:19.854120+00:00', 1.6430005431175232), ('llm', '2024-08-12 17:44:18.210000+00:00', '2024-08-12 17:44:19.856227+00:00', 1.645977795124054), ('query', '2024-08-12 17:44:17.974000+00:00', '2024-08-12 17:44:19.858101+00:00', 1.8839970231056213), ('embedding', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.559297+00:00', 0.13699382543563843), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.566436+00:00', 0.14399439096450806), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.568568+00:00', 0.14697164297103882), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.077988+00:00', 1.4969944953918457), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.080501+00:00', 1.4999717473983765), ('query', '2024-08-12 17:44:53.421000+00:00', '2024-08-12 17:44:55.082638+00:00', 1.6619905829429626), ('retrieve', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:48.443986+00:00', 0.23999065160751343), ('retrieve', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.442186+00:00', 0.23701339960098267), ('embedding', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.435059+00:00', 0.23001283407211304), ('query', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:49.355868+00:00', 1.1519953608512878), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.353559+00:00', 0.8959919214248657), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.351132+00:00', 0.8929744362831116), ('embedding', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.396148+00:00', 0.2780109643936157), ('retrieve', '2024-08-12 19:37:27.117000+00:00', '2024-08-12 19:37:27.406373+00:00', 0.28899461030960083), ('retrieve', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.405205+00:00', 0.2870231866836548), ('query', '2024-08-12 19:37:27.116000+00:00', '2024-08-12 19:37:28.731961+00:00', 1.6160041093826294), ('llm', '2024-08-12 19:37:27.420000+00:00', '2024-08-12 19:37:28.729986+00:00', 1.3100311160087585)]\",\"prompt\":\"What trends do you see in my trace latency?\"}",
                    name: "data_analyzer",
                  },
                },
              },
            ],
            role: "assistant",
          },
        },
      ],
    },
    output: {
      value: "assistant: None",
    },
  }),
  input: {
    value:
      "{\"messages\": [\"ChatMessage(role=<MessageRole.SYSTEM: 'system'>, content=\\\"\\\\nYou are a helpful assistant that choses a tool to call based on the user's request.\\\\n\\\\nAll of your responses should be a tool call or text.\\\\n\\\\nOnce you receive the results from all of your skills, generate a response to the\\\\nuser that incorporates all of the results.\\\\n\\\", additional_kwargs={})\", \"ChatMessage(role=<MessageRole.USER: 'user'>, content='What trends do you see in my trace latency?', additional_kwargs={})\", \"ChatMessage(role=<MessageRole.ASSISTANT: 'assistant'>, content=None, additional_kwargs={'tool_calls': [ChatCompletionMessageToolCall(id='call_9hXZKTGJaGjb51Yonv5Lh5Cp', function=Function(arguments='{\\\"prompt\\\":\\\"Get trace latency data\\\"}', name='generate_and_run_sql_query'), type='function')]})\", \"ChatMessage(role=<MessageRole.TOOL: 'tool'>, content=\\\"[('retrieve', '2024-08-07 23:32:27.604000+00:00', '2024-08-07 23:32:27.848063+00:00', 0.2439737319946289), ('embedding', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.829420+00:00', 0.22397786378860474), ('retrieve', '2024-08-07 23:32:27.605000+00:00', '2024-08-07 23:32:27.844357+00:00', 0.2389848232269287), ('query', '2024-08-07 23:32:27.603000+00:00', '2024-08-07 23:32:28.903072+00:00', 1.2999728322029114), ('embedding', '2024-08-08 17:15:02.784000+00:00', '2024-08-08 17:15:02.981640+00:00', 0.19798725843429565), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.992214+00:00', 0.20901113748550415), ('retrieve', '2024-08-08 17:15:02.783000+00:00', '2024-08-08 17:15:02.989560+00:00', 0.20699948072433472), ('query', '2024-08-08 17:15:02.782000+00:00', '2024-08-08 17:15:04.105240+00:00', 1.3229861855506897), ('llm', '2024-08-08 17:15:03.005000+00:00', '2024-08-08 17:15:04.103099+00:00', 1.0980024933815002), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.304235+00:00', 0.24703145027160645), ('retrieve', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.306487+00:00', 0.2490028738975525), ('embedding', '2024-08-08 17:16:34.057000+00:00', '2024-08-08 17:16:34.297020+00:00', 0.24003088474273682), ('llm', '2024-08-08 17:16:34.319000+00:00', '2024-08-08 17:16:35.551296+00:00', 1.232019066810608), ('query', '2024-08-08 17:16:34.056000+00:00', '2024-08-08 17:16:35.553712+00:00', 1.4980003237724304), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.441706+00:00', 0.21496564149856567), ('retrieve', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.439011+00:00', 0.2119883894920349), ('embedding', '2024-08-08 17:18:01.227000+00:00', '2024-08-08 17:18:01.431817+00:00', 0.20498782396316528), ('query', '2024-08-08 17:18:01.225000+00:00', '2024-08-08 17:18:02.683177+00:00', 1.458008587360382), ('llm', '2024-08-08 17:18:01.456000+00:00', '2024-08-08 17:18:02.681236+00:00', 1.2250185012817383), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.228044+00:00', 0.14801770448684692), ('embedding', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.220893+00:00', 0.1410171389579773), ('retrieve', '2024-08-08 21:00:12.080000+00:00', '2024-08-08 21:00:12.230473+00:00', 0.14998912811279297), ('query', '2024-08-08 21:00:12.079000+00:00', '2024-08-08 21:00:14.147887+00:00', 2.0689889788627625), ('embedding', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.021851+00:00', 0.13200491666793823), ('retrieve', '2024-08-08 23:35:07.890000+00:00', '2024-08-08 23:35:08.031930+00:00', 0.14198273420333862), ('retrieve', '2024-08-08 23:35:07.889000+00:00', '2024-08-08 23:35:08.034155+00:00', 0.14500021934509277), ('query', '2024-08-08 23:35:07.888000+00:00', '2024-08-08 23:35:09.267961+00:00', 1.3799965381622314), ('embedding', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:39.999287+00:00', 0.3029957413673401), ('retrieve', '2024-08-08 23:55:39.696000+00:00', '2024-08-08 23:55:40.010193+00:00', 0.3139793872833252), ('retrieve', '2024-08-08 23:55:39.695000+00:00', '2024-08-08 23:55:40.012401+00:00', 0.31699687242507935), ('query', '2024-08-08 23:55:39.694000+00:00', '2024-08-08 23:55:41.246378+00:00', 1.551993191242218), ('embedding', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.421740+00:00', 0.21601170301437378), ('retrieve', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:21.431602+00:00', 0.2269953489303589), ('retrieve', '2024-08-09 00:21:21.206000+00:00', '2024-08-09 00:21:21.430353+00:00', 0.22397786378860474), ('query', '2024-08-09 00:21:21.205000+00:00', '2024-08-09 00:21:22.656935+00:00', 1.4520138502120972), ('llm', '2024-08-09 00:21:21.445000+00:00', '2024-08-09 00:21:22.654344+00:00', 1.2090057134628296), ('embedding', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.331678+00:00', 0.20201057195663452), ('retrieve', '2024-08-12 17:41:06.130000+00:00', '2024-08-12 17:41:06.340648+00:00', 0.21102279424667358), ('retrieve', '2024-08-12 17:41:06.129000+00:00', '2024-08-12 17:41:06.342348+00:00', 0.21303445100784302), ('query', '2024-08-12 17:41:06.128000+00:00', '2024-08-12 17:41:07.851628+00:00', 1.7239898443222046), ('llm', '2024-08-12 17:41:06.356000+00:00', '2024-08-12 17:41:07.848066+00:00', 1.4919653534889221), ('llm', '2024-08-12 17:41:06.355000+00:00', '2024-08-12 17:41:07.849691+00:00', 1.4949828386306763), ('embedding', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.188718+00:00', 0.21400004625320435), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.196006+00:00', 0.22100061178207397), ('retrieve', '2024-08-12 17:44:17.975000+00:00', '2024-08-12 17:44:18.198113+00:00', 0.22297203540802002), ('llm', '2024-08-12 17:44:18.211000+00:00', '2024-08-12 17:44:19.854120+00:00', 1.6430005431175232), ('llm', '2024-08-12 17:44:18.210000+00:00', '2024-08-12 17:44:19.856227+00:00', 1.645977795124054), ('query', '2024-08-12 17:44:17.974000+00:00', '2024-08-12 17:44:19.858101+00:00', 1.8839970231056213), ('embedding', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.559297+00:00', 0.13699382543563843), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.566436+00:00', 0.14399439096450806), ('retrieve', '2024-08-12 17:44:53.422000+00:00', '2024-08-12 17:44:53.568568+00:00', 0.14697164297103882), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.077988+00:00', 1.4969944953918457), ('llm', '2024-08-12 17:44:53.581000+00:00', '2024-08-12 17:44:55.080501+00:00', 1.4999717473983765), ('query', '2024-08-12 17:44:53.421000+00:00', '2024-08-12 17:44:55.082638+00:00', 1.6619905829429626), ('retrieve', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:48.443986+00:00', 0.23999065160751343), ('retrieve', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.442186+00:00', 0.23701339960098267), ('embedding', '2024-08-12 17:45:48.205000+00:00', '2024-08-12 17:45:48.435059+00:00', 0.23001283407211304), ('query', '2024-08-12 17:45:48.204000+00:00', '2024-08-12 17:45:49.355868+00:00', 1.1519953608512878), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.353559+00:00', 0.8959919214248657), ('llm', '2024-08-12 17:45:48.458000+00:00', '2024-08-12 17:45:49.351132+00:00', 0.8929744362831116), ('embedding', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.396148+00:00', 0.2780109643936157), ('retrieve', '2024-08-12 19:37:27.117000+00:00', '2024-08-12 19:37:27.406373+00:00', 0.28899461030960083), ('retrieve', '2024-08-12 19:37:27.118000+00:00', '2024-08-12 19:37:27.405205+00:00', 0.2870231866836548), ('query', '2024-08-12 19:37:27.116000+00:00', '2024-08-12 19:37:28.731961+00:00', 1.6160041093826294), ('llm', '2024-08-12 19:37:27.420000+00:00', '2024-08-12 19:37:28.729986+00:00', 1.3100311160087585)]\\\", additional_kwargs={'tool_call_id': 'call_9hXZKTGJaGjb51Yonv5Lh5Cp'})\"], \"kwargs\": {\"tools\": [{\"type\": \"function\", \"function\": {\"name\": \"data_analyzer\", \"description\": \"{'name': 'data_analyzer', 'description': 'Provides insights, trends, or analysis based on the data and prompt.', 'parameters': {'type': 'object', 'properties': {'data': {'type': 'string', 'description': 'The data to analyze.'}, 'prompt': {'type': 'string', 'description': 'The original user prompt that the data is based on.'}}, 'required': ['data', 'prompt']}}\", \"parameters\": {\"properties\": {\"input\": {\"title\": \"Input\", \"type\": \"string\"}}, \"required\": [\"input\"], \"type\": \"object\", \"additionalProperties\": false}, \"strict\": false}}, {\"type\": \"function\", \"function\": {\"name\": \"generate_and_run_sql_query\", \"description\": \"{'name': 'generate_and_run_sql_query', 'description': 'Generates SQL queries based on the prompt. This tool has access to the following table: traces.', 'parameters': {'type': 'object', 'properties': {'prompt': {'type': 'string', 'description': 'The prompt to generate an SQL query from. This prompt should never be an SQL query.'}, 'with_retries': {'type': 'boolean', 'description': 'Whether to retry the query generation if it fails. Defaults to True.'}}, 'required': ['prompt']}}\", \"parameters\": {\"properties\": {\"input\": {\"title\": \"Input\", \"type\": \"string\"}}, \"required\": [\"input\"], \"type\": \"object\", \"additionalProperties\": false}, \"strict\": false}}], \"tool_choice\": \"auto\", \"model\": \"gpt-4o\"}}",
    mimeType: "json",
  },
  output: {
    value: "assistant: None",
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * An LLM span traced with a prompt template and template variables instead
 * of chat messages.
 */
export const llmPromptTemplateSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTQ4",
  name: "LLM.predict",
  spanKind: "llm",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "LLM",
      },
    },
    input: {
      mime_type: "application/json",
      value:
        '{"prompt": {"metadata": {"prompt_type": "text_qa"}, "template_vars": ["context_str", "query_str"], "kwargs": {"query_str": "Can I use gRPC for trace collection?"}, "output_parser": null, "template_var_mappings": {}, "function_mappings": {}, "default_template": {"metadata": {"prompt_type": "text_qa"}, "template_vars": ["context_str", "query_str"], "kwargs": {"query_str": "Can I use gRPC for trace collection?"}, "output_parser": null, "template_var_mappings": null, "function_mappings": null, "template": "Context information is below.\\n---------------------\\n{context_str}\\n---------------------\\nGiven the context information and not prior knowledge, answer the query.\\nQuery: {query_str}\\nAnswer: "}, "conditionals": [["<is_chat_model(llm: llama_index.core.base.llms.base.BaseLLM) -> bool>", {"metadata": {"prompt_type": "custom"}, "template_vars": ["context_str", "query_str"], "kwargs": {"query_str": "Can I use gRPC for trace collection?"}, "output_parser": null, "template_var_mappings": null, "function_mappings": null, "message_templates": [{"role": "system", "content": "You are an expert Q&A system that is trusted around the world.\\nAlways answer the query using the provided context information, and not prior knowledge.\\nSome rules to follow:\\n1. Never directly reference the given context in your answer.\\n2. Avoid statements like \'Based on the context, ...\' or \'The context information ...\' or anything along those lines.", "additional_kwargs": {}}, {"role": "user", "content": "Context information is below.\\n---------------------\\n{context_str}\\n---------------------\\nGiven the context information and not prior knowledge, answer the query.\\nQuery: {query_str}\\nAnswer: ", "additional_kwargs": {}}]}]]}, "prompt_args": {"context_str": "source: https://docs.arize.com/phoenix/tracing/concepts-tracing/what-are-traces\\ntitle: Traces\\n\\nNot more than 4-1/4 inches high, or more than 6 inches long, or greater than \\\\n0.016 inch thick.\\\\nd. Not more than 3.5 ounces (Charge flat-size prices for First-Class Mail \\\\ncard-type pieces over 3.5 ounces.)\\\\n\\\\n  Instruction: Based on the above documents, provide a detailed answer for the user question below.\\\\n  Answer \\\\\\"don\'t know\\\\\\" if not present in the document.\\\\n  \\",\\n\\n\\n       \\n\\"llm.input_messages.1.message.role\\"\\n:\\n \\n\\"user\\"\\n,\\n\\n\\n       \\n\\"llm.input_messages.1.message.content\\"\\n:\\n \\n\\"Hello\\"\\n,\\n\\n\\n       \\n\\"llm.model_name\\"\\n:\\n \\n\\"gpt-4-turbo-preview\\"\\n,\\n\\n\\n       \\n\\"llm.invocation_parameters\\"\\n:\\n \\n\\"{\\\\\\"temperature\\\\\\": 0.1, \\\\\\"model\\\\\\": \\\\\\"gpt-4-turbo-preview\\\\\\"}\\"\\n,\\n\\n\\n       \\n\\"output.value\\"\\n:\\n \\n\\"How are you?\\"\\n }\\n,\\n\\n\\n   \\n\\"events\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"links\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"resource\\"\\n:\\n {\\n\\n\\n       \\n\\"attributes\\"\\n:\\n {}\\n,\\n\\n\\n       \\n\\"schema_url\\"\\n:\\n \\n\\"\\"\\n\\n\\n   }\\n\\n\\n}\\nSpans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.\\nTraces\\nA trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.\\nWithout tracing, it is challenging to pinpoint the cause of performance problems in a system.\\nIt improves the visibility of our application or system\\u2019s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.\\nTracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.\\nA trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).\\nProjects\\nA \\nproject\\n is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the \\nhow-to guide.\\nSpan Kind\\nWhen a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool. \\nCHAIN\\nA Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.\\nRETRIEVER\\nA Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.\\nRERANKER\\nA Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents\' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.\\nLLM\\nAn LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.\\nEMBEDDING\\nAn Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.\\nTOOL\\nA Tool is a span that represents a call to an external tool such as a calculator or a weather API.\\nAGENT\\nA span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\\n\\nSpan Attributes\\nAttributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.\\nFor example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.\\nAttributes have the following rules:\\nKeys must be non-null string values\\nValues must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It\'s helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See \\nsemantic conventions\\n for more information.\\n\\nsource: https://docs.arize.com/phoenix/tracing/llm-traces\\ntitle: Overview: Tracing\\n\\nOverview: Tracing\\nTracing the execution of LLM applications using Telemetry\\nLLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request\'s execution.\\nTracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( \\nLlamaIndex\\n, \\nLangChain\\n,\\n DSPy\\n),  SDKs (\\nOpenAI\\n, \\nBedrock\\n, \\nMistral\\n, \\nVertex\\n), and Languages. (Python, Javascript, etc.)\\nUsing Phoenix\'s tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.\\nApplication Latency\\n: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.\\nToken Usage\\n: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.\\nRuntime Exceptions\\n: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.\\nRetrieved Documents\\n: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.\\nEmbeddings\\n: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.\\nLLM Parameters\\n: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.\\nPrompt Templates\\n: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.\\nTool Descriptions\\n: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM\\u2019s capabilities.\\nLLM Function Calls\\n: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.\\nBy using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.\\nView the inner workings for your LLM Application\\nTo get started, check out the \\nQuickstart guide\\nAfter that, read through the \\nConcepts Section\\n to get and understanding of the different components.\\nIf you want to learn how to accomplish a particular task, check out the \\nHow-To Guides.\\n\\n\\nPrevious\\nFAQs: Deployment\\nNext\\nQuickstart: Tracing\\nLast updated \\n6 hours ago"}}',
    },
    llm: {
      prompt_template: {
        variables: {
          query_str: "Can I use gRPC for trace collection?",
          context_str:
            'source: https://docs.arize.com/phoenix/tracing/concepts-tracing/what-are-traces\ntitle: Traces\n\nNot more than 4-1/4 inches high, or more than 6 inches long, or greater than \\n0.016 inch thick.\\nd. Not more than 3.5 ounces (Charge flat-size prices for First-Class Mail \\ncard-type pieces over 3.5 ounces.)\\n\\n  Instruction: Based on the above documents, provide a detailed answer for the user question below.\\n  Answer \\"don\'t know\\" if not present in the document.\\n  ",\n\n\n       \n"llm.input_messages.1.message.role"\n:\n \n"user"\n,\n\n\n       \n"llm.input_messages.1.message.content"\n:\n \n"Hello"\n,\n\n\n       \n"llm.model_name"\n:\n \n"gpt-4-turbo-preview"\n,\n\n\n       \n"llm.invocation_parameters"\n:\n \n"{\\"temperature\\": 0.1, \\"model\\": \\"gpt-4-turbo-preview\\"}"\n,\n\n\n       \n"output.value"\n:\n \n"How are you?"\n }\n,\n\n\n   \n"events"\n:\n []\n,\n\n\n   \n"links"\n:\n []\n,\n\n\n   \n"resource"\n:\n {\n\n\n       \n"attributes"\n:\n {}\n,\n\n\n       \n"schema_url"\n:\n \n""\n\n\n   }\n\n\n}\nSpans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.\nTraces\nA trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.\nWithout tracing, it is challenging to pinpoint the cause of performance problems in a system.\nIt improves the visibility of our application or system’s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.\nTracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.\nA trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).\nProjects\nA \nproject\n is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the \nhow-to guide.\nSpan Kind\nWhen a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool. \nCHAIN\nA Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.\nRETRIEVER\nA Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.\nRERANKER\nA Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents\' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.\nLLM\nAn LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.\nEMBEDDING\nAn Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.\nTOOL\nA Tool is a span that represents a call to an external tool such as a calculator or a weather API.\nAGENT\nA span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\n\nSpan Attributes\nAttributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.\nFor example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.\nAttributes have the following rules:\nKeys must be non-null string values\nValues must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It\'s helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See \nsemantic conventions\n for more information.\n\nsource: https://docs.arize.com/phoenix/tracing/llm-traces\ntitle: Overview: Tracing\n\nOverview: Tracing\nTracing the execution of LLM applications using Telemetry\nLLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request\'s execution.\nTracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( \nLlamaIndex\n, \nLangChain\n,\n DSPy\n),  SDKs (\nOpenAI\n, \nBedrock\n, \nMistral\n, \nVertex\n), and Languages. (Python, Javascript, etc.)\nUsing Phoenix\'s tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.\nApplication Latency\n: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.\nToken Usage\n: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.\nRuntime Exceptions\n: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.\nRetrieved Documents\n: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.\nEmbeddings\n: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.\nLLM Parameters\n: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.\nPrompt Templates\n: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.\nTool Descriptions\n: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM’s capabilities.\nLLM Function Calls\n: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.\nBy using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.\nView the inner workings for your LLM Application\nTo get started, check out the \nQuickstart guide\nAfter that, read through the \nConcepts Section\n to get and understanding of the different components.\nIf you want to learn how to accomplish a particular task, check out the \nHow-To Guides.\n\n\nPrevious\nFAQs: Deployment\nNext\nQuickstart: Tracing\nLast updated \n6 hours ago',
        },
        template:
          "Context information is below.\n---------------------\n{context_str}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: {query_str}\nAnswer: ",
      },
      model_name: "gpt-3.5-turbo",
      invocation_parameters:
        '{"context_window": 16384, "num_output": -1, "is_chat_model": true, "is_function_calling_model": true, "model_name": "gpt-3.5-turbo"}',
    },
    output: {
      value: "You can use gRPC for trace collection.",
    },
  }),
  input: {
    value:
      '{"prompt": {"metadata": {"prompt_type": "text_qa"}, "template_vars": ["context_str", "query_str"], "kwargs": {"query_str": "Can I use gRPC for trace collection?"}, "output_parser": null, "template_var_mappings": {}, "function_mappings": {}, "default_template": {"metadata": {"prompt_type": "text_qa"}, "template_vars": ["context_str", "query_str"], "kwargs": {"query_str": "Can I use gRPC for trace collection?"}, "output_parser": null, "template_var_mappings": null, "function_mappings": null, "template": "Context information is below.\\n---------------------\\n{context_str}\\n---------------------\\nGiven the context information and not prior knowledge, answer the query.\\nQuery: {query_str}\\nAnswer: "}, "conditionals": [["<is_chat_model(llm: llama_index.core.base.llms.base.BaseLLM) -> bool>", {"metadata": {"prompt_type": "custom"}, "template_vars": ["context_str", "query_str"], "kwargs": {"query_str": "Can I use gRPC for trace collection?"}, "output_parser": null, "template_var_mappings": null, "function_mappings": null, "message_templates": [{"role": "system", "content": "You are an expert Q&A system that is trusted around the world.\\nAlways answer the query using the provided context information, and not prior knowledge.\\nSome rules to follow:\\n1. Never directly reference the given context in your answer.\\n2. Avoid statements like \'Based on the context, ...\' or \'The context information ...\' or anything along those lines.", "additional_kwargs": {}}, {"role": "user", "content": "Context information is below.\\n---------------------\\n{context_str}\\n---------------------\\nGiven the context information and not prior knowledge, answer the query.\\nQuery: {query_str}\\nAnswer: ", "additional_kwargs": {}}]}]]}, "prompt_args": {"context_str": "source: https://docs.arize.com/phoenix/tracing/concepts-tracing/what-are-traces\\ntitle: Traces\\n\\nNot more than 4-1/4 inches high, or more than 6 inches long, or greater than \\\\n0.016 inch thick.\\\\nd. Not more than 3.5 ounces (Charge flat-size prices for First-Class Mail \\\\ncard-type pieces over 3.5 ounces.)\\\\n\\\\n  Instruction: Based on the above documents, provide a detailed answer for the user question below.\\\\n  Answer \\\\\\"don\'t know\\\\\\" if not present in the document.\\\\n  \\",\\n\\n\\n       \\n\\"llm.input_messages.1.message.role\\"\\n:\\n \\n\\"user\\"\\n,\\n\\n\\n       \\n\\"llm.input_messages.1.message.content\\"\\n:\\n \\n\\"Hello\\"\\n,\\n\\n\\n       \\n\\"llm.model_name\\"\\n:\\n \\n\\"gpt-4-turbo-preview\\"\\n,\\n\\n\\n       \\n\\"llm.invocation_parameters\\"\\n:\\n \\n\\"{\\\\\\"temperature\\\\\\": 0.1, \\\\\\"model\\\\\\": \\\\\\"gpt-4-turbo-preview\\\\\\"}\\"\\n,\\n\\n\\n       \\n\\"output.value\\"\\n:\\n \\n\\"How are you?\\"\\n }\\n,\\n\\n\\n   \\n\\"events\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"links\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"resource\\"\\n:\\n {\\n\\n\\n       \\n\\"attributes\\"\\n:\\n {}\\n,\\n\\n\\n       \\n\\"schema_url\\"\\n:\\n \\n\\"\\"\\n\\n\\n   }\\n\\n\\n}\\nSpans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.\\nTraces\\nA trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.\\nWithout tracing, it is challenging to pinpoint the cause of performance problems in a system.\\nIt improves the visibility of our application or system\\u2019s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.\\nTracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.\\nA trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).\\nProjects\\nA \\nproject\\n is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the \\nhow-to guide.\\nSpan Kind\\nWhen a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool. \\nCHAIN\\nA Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.\\nRETRIEVER\\nA Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.\\nRERANKER\\nA Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents\' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.\\nLLM\\nAn LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.\\nEMBEDDING\\nAn Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.\\nTOOL\\nA Tool is a span that represents a call to an external tool such as a calculator or a weather API.\\nAGENT\\nA span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\\n\\nSpan Attributes\\nAttributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.\\nFor example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.\\nAttributes have the following rules:\\nKeys must be non-null string values\\nValues must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It\'s helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See \\nsemantic conventions\\n for more information.\\n\\nsource: https://docs.arize.com/phoenix/tracing/llm-traces\\ntitle: Overview: Tracing\\n\\nOverview: Tracing\\nTracing the execution of LLM applications using Telemetry\\nLLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request\'s execution.\\nTracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( \\nLlamaIndex\\n, \\nLangChain\\n,\\n DSPy\\n),  SDKs (\\nOpenAI\\n, \\nBedrock\\n, \\nMistral\\n, \\nVertex\\n), and Languages. (Python, Javascript, etc.)\\nUsing Phoenix\'s tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.\\nApplication Latency\\n: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.\\nToken Usage\\n: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.\\nRuntime Exceptions\\n: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.\\nRetrieved Documents\\n: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.\\nEmbeddings\\n: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.\\nLLM Parameters\\n: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.\\nPrompt Templates\\n: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.\\nTool Descriptions\\n: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM\\u2019s capabilities.\\nLLM Function Calls\\n: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.\\nBy using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.\\nView the inner workings for your LLM Application\\nTo get started, check out the \\nQuickstart guide\\nAfter that, read through the \\nConcepts Section\\n to get and understanding of the different components.\\nIf you want to learn how to accomplish a particular task, check out the \\nHow-To Guides.\\n\\n\\nPrevious\\nFAQs: Deployment\\nNext\\nQuickstart: Tracing\\nLast updated \\n6 hours ago"}}',
    mimeType: "json",
  },
  output: {
    value: "You can use gRPC for trace collection.",
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * An LLM span that errored: has a status message, an exception event, input
 * messages, and no output.
 */
export const llmErrorSpan: SpanInfoFixture = {
  id: "U3BhbjozMTc=",
  name: "gpt-5.4",
  spanKind: "llm",
  statusMessage:
    "ModelHTTPError: status_code: 400, model_name: gpt-5.4, body: {'message': 'No tool output found for function call call_tpvJI04c1251XbFqSTdTtqbF.', 'type': 'invalid_request_error', 'param': 'input', 'code': None}",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "LLM",
      },
    },
    session: {
      id: "c589daed-03c4-441c-8489-a00ca04593b0",
    },
    llm: {
      system: "openai",
      model_name: "gpt-5.4",
      input_messages: [
        {
          message: {
            role: "user",
            content: "how do I run evals",
          },
        },
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                tool_call: {
                  function: {
                    name: "ask_user",
                    arguments:
                      '{"questions": [{"id": "q-area", "prompt": "I can help with evals in a few different Phoenix workflows. Which do you want to run?", "type": "single", "options": [{"id": "ui", "label": "In the Phoenix UI", "description": "Run evals on traces, spans, or experiment results from the app"}, {"id": "python", "label": "With the Python SDK", "description": "Run evals programmatically in code or notebooks"}, {"id": "prompt", "label": "In the Playground", "description": "Evaluate prompt variants or model outputs"}], "allow_freeform": true}]}',
                  },
                  id: "call_tpvJI04c1251XbFqSTdTtqbF",
                },
              },
            ],
          },
        },
        {
          message: {
            role: "user",
            content: "Summarize this conversation.",
          },
        },
      ],
      provider: "openai",
    },
    input: {
      value:
        '{"messages": [{"parts": [{"content": "how do I run evals", "timestamp": "2026-05-14T01:09:55.734672+00:00", "part_kind": "user-prompt"}], "timestamp": null, "instructions": null, "kind": "request", "run_id": null, "conversation_id": null, "metadata": null}, {"parts": [{"tool_name": "ask_user", "args": {"questions": [{"id": "q-area", "prompt": "I can help with evals in a few different Phoenix workflows. Which do you want to run?", "type": "single", "options": [{"id": "ui", "label": "In the Phoenix UI", "description": "Run evals on traces, spans, or experiment results from the app"}, {"id": "python", "label": "With the Python SDK", "description": "Run evals programmatically in code or notebooks"}, {"id": "prompt", "label": "In the Playground", "description": "Evaluate prompt variants or model outputs"}], "allow_freeform": true}]}, "tool_call_id": "call_tpvJI04c1251XbFqSTdTtqbF", "id": "fc_0aaaa4d81d846ef7006a0520e119448190bddcb2362f4b4a37", "provider_name": "openai", "provider_details": null, "part_kind": "tool-call"}], "usage": {"input_tokens": 0, "cache_write_tokens": 0, "cache_read_tokens": 0, "output_tokens": 0, "input_audio_tokens": 0, "cache_audio_read_tokens": 0, "output_audio_tokens": 0, "details": {}}, "model_name": null, "timestamp": "2026-05-14T01:09:55.734781+00:00", "kind": "response", "provider_name": null, "provider_url": null, "provider_details": null, "provider_response_id": null, "finish_reason": null, "run_id": null, "conversation_id": null, "metadata": null, "state": "complete"}, {"parts": [{"content": "Summarize this conversation.", "timestamp": "2026-05-14T01:09:55.734899+00:00", "part_kind": "user-prompt"}], "timestamp": null, "instructions": null, "kind": "request", "run_id": null, "conversation_id": null, "metadata": null}], "model_settings": null, "model_request_parameters": {"function_tools": [], "builtin_tools": [], "output_mode": "tool", "output_object": null, "output_tools": [{"name": "summary", "parameters_json_schema": {"properties": {"summary": {"title": "Summary", "type": "string"}}, "required": ["summary"], "title": "Summary", "type": "object"}, "description": "Provide the conversation title.", "outer_typed_dict_key": null, "strict": null, "sequential": false, "kind": "function", "metadata": null, "timeout": null, "defer_loading": false, "prefer_builtin": null, "return_schema": null, "include_return_schema": null}], "prompted_output_template": null, "allow_text_output": false, "allow_image_output": false, "instruction_parts": [{"content": "<role>\\n  You generate a short title for a Phoenix chat session. The title\\n  appears as a sidebar label in a list of conversations - like a tab\\n  name, not a description of what was said. Call the `summary` tool\\n  with the title.\\n</role>\\n\\n<rules>\\n  - 2-6 words. Shorter is better.\\n  - Either a short noun phrase or a short imperative naming the user\'s\\n    task is acceptable.\\n  - Use sentence case: only the first letter of the title is\\n    capitalized. Proper nouns and acronyms keep their natural casing.\\n    Do NOT use Title Case where every major word is capitalized.\\n  - Do NOT start with a gerund (-ing form). Use the bare imperative\\n    instead.\\n  - Phoenix is the implied subject of every conversation, so prefer to\\n    omit the word \\"Phoenix\\" when the title still reads cleanly without\\n    it. Use it only when the title would be ambiguous or grammatically\\n    broken otherwise.\\n  - No quotes, no trailing punctuation.\\n</rules>", "dynamic": false, "part_kind": "instruction"}], "thinking": null}}',
      mime_type: "application/json",
    },
  }),
  input: {
    value:
      '{"messages": [{"parts": [{"content": "how do I run evals", "timestamp": "2026-05-14T01:09:55.734672+00:00", "part_kind": "user-prompt"}], "timestamp": null, "instructions": null, "kind": "request", "run_id": null, "conversation_id": null, "metadata": null}, {"parts": [{"tool_name": "ask_user", "args": {"questions": [{"id": "q-area", "prompt": "I can help with evals in a few different Phoenix workflows. Which do you want to run?", "type": "single", "options": [{"id": "ui", "label": "In the Phoenix UI", "description": "Run evals on traces, spans, or experiment results from the app"}, {"id": "python", "label": "With the Python SDK", "description": "Run evals programmatically in code or notebooks"}, {"id": "prompt", "label": "In the Playground", "description": "Evaluate prompt variants or model outputs"}], "allow_freeform": true}]}, "tool_call_id": "call_tpvJI04c1251XbFqSTdTtqbF", "id": "fc_0aaaa4d81d846ef7006a0520e119448190bddcb2362f4b4a37", "provider_name": "openai", "provider_details": null, "part_kind": "tool-call"}], "usage": {"input_tokens": 0, "cache_write_tokens": 0, "cache_read_tokens": 0, "output_tokens": 0, "input_audio_tokens": 0, "cache_audio_read_tokens": 0, "output_audio_tokens": 0, "details": {}}, "model_name": null, "timestamp": "2026-05-14T01:09:55.734781+00:00", "kind": "response", "provider_name": null, "provider_url": null, "provider_details": null, "provider_response_id": null, "finish_reason": null, "run_id": null, "conversation_id": null, "metadata": null, "state": "complete"}, {"parts": [{"content": "Summarize this conversation.", "timestamp": "2026-05-14T01:09:55.734899+00:00", "part_kind": "user-prompt"}], "timestamp": null, "instructions": null, "kind": "request", "run_id": null, "conversation_id": null, "metadata": null}], "model_settings": null, "model_request_parameters": {"function_tools": [], "builtin_tools": [], "output_mode": "tool", "output_object": null, "output_tools": [{"name": "summary", "parameters_json_schema": {"properties": {"summary": {"title": "Summary", "type": "string"}}, "required": ["summary"], "title": "Summary", "type": "object"}, "description": "Provide the conversation title.", "outer_typed_dict_key": null, "strict": null, "sequential": false, "kind": "function", "metadata": null, "timeout": null, "defer_loading": false, "prefer_builtin": null, "return_schema": null, "include_return_schema": null}], "prompted_output_template": null, "allow_text_output": false, "allow_image_output": false, "instruction_parts": [{"content": "<role>\\n  You generate a short title for a Phoenix chat session. The title\\n  appears as a sidebar label in a list of conversations - like a tab\\n  name, not a description of what was said. Call the `summary` tool\\n  with the title.\\n</role>\\n\\n<rules>\\n  - 2-6 words. Shorter is better.\\n  - Either a short noun phrase or a short imperative naming the user\'s\\n    task is acceptable.\\n  - Use sentence case: only the first letter of the title is\\n    capitalized. Proper nouns and acronyms keep their natural casing.\\n    Do NOT use Title Case where every major word is capitalized.\\n  - Do NOT start with a gerund (-ing form). Use the bare imperative\\n    instead.\\n  - Phoenix is the implied subject of every conversation, so prefer to\\n    omit the word \\"Phoenix\\" when the title still reads cleanly without\\n    it. Use it only when the title would be ambiguous or grammatically\\n    broken otherwise.\\n  - No quotes, no trailing punctuation.\\n</rules>", "dynamic": false, "part_kind": "instruction"}], "thinking": null}}',
    mimeType: "json",
  },
  output: null,
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A retriever span with retrieved documents, document retrieval metrics,
 * and LLM document evaluations (annotations).
 */
export const retrieverSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTQz",
  name: "BaseRetriever.retrieve",
  spanKind: "retriever",
  statusMessage: "",
  attributes: JSON.stringify({
    retrieval: {
      documents: [
        {
          document: {
            score: 0.7758796006766829,
            id: "7af0e529-2531-42d9-bf3a-d5074a73c184",
            content:
              "How Tracing Works\nThe components behind tracing\nThe phoenix server is collector of traces over OTLP\nInstrumentation\nIn order for an application to emit traces for analysis, the application must be \ninstrumented\n.  Your application can be \nmanually\n instrumented or be \nautomatically\n instrumented.\n\nWith phoenix, there a set of plugins (\ninstrumentors\n) that can be added to your application's startup process that perform auto-instrumentation. These plugins collect spans for your application and export them for collection and visualization. For phoenix, all the instrumentors are managed via a single repository called \nOpenInference\n. The comprehensive list of instrumentors can be found in the \nhow-to guide.\nExporter\nAn exporter takes the spans created via \ninstrumentation \nand exports them to a \ncollector\n. In simple terms, it just sends the data to the Phoenix. When using Phoenix, most of this is completely done under the hood when you call instrument on an instrumentor.\nCollector\nThe Phoenix server is a collector and a UI that helps you troubleshoot your application in real time. When you run or run phoenix (e.x. \npx.launch_app()\n, container), Phoenix starts receiving spans form any application(s) that is exporting spans to it.\nOpenTelememetry Protocol\nOpenTelemetetry Protocol (or OTLP for short) is the means by which traces arrive from your application to the Phoenix collector. Phoenix currently supports OTLP over HTTP.\nPrevious\nTraces\nNext\nAnnotating Traces\nLast updated \n3 months ago",
            metadata: {
              source:
                "https://docs.arize.com/phoenix/tracing/concepts-tracing/how-does-tracing-work",
              title: "How Tracing Works",
            },
          },
        },
        {
          document: {
            score: 0.7733052433242642,
            id: "0ba6dfa9-cc24-41d0-b962-342a9c126437",
            content:
              "Use Cases: Tracing\nThe following. guides serve a examples for how you can use Phoenix tracing to optimize your application.\nEvaluate RAG\nHow to use traces to evaluate a rag pipeline\nStructured Data Extraction\nUsing LLMs to extract structured data from unstructured text\nTracing Notebooks\nTitle\nTopics\nLinks\nRetrieval Example with Evaluations\nEvaluations\nRetrieval\nTracing and Evaluating a LlamaIndex + OpenAI RAG Application\nLlamaIndex\nOpenAI\nretrieval-augmented generation\nTracing and Evaluating a LlamaIndex OpenAI Agent\nLlamaIndex\nOpenAI\nagents\nfunction calling\nTracing and Evaluating a Structured Data Extraction Application with OpenAI Function Calling\nOpenAI\nstructured data extraction\nfunction calling\nTracing and Evaluating a LangChain + OpenAI RAG Application\nLangChain\nOpenAI\nretrieval-augmented generation\nTracing and Evaluating a LangChain Agent\nLangChain\nOpenAI\nagents\nfunction calling\nTracing and Evaluating a LangChain + Vertex AI RAG Application\nLangChain\nVertex AI\nretrieval-augmented generation\nTracing and Evaluating a LangChain + Google PaLM RAG Application\nLangChain\nGoogle PaLM\nretrieval-augmented generation\nTracing and Evaluation a DSPy Application\nLangChain\nGoogle PaLM\nretrieval-augmented generation\nPrevious\nConfigure Tracing\nNext\nEvaluate RAG\nLast updated \n3 months ago",
            metadata: {
              source:
                "https://docs.arize.com/phoenix/tracing/use-cases-tracing",
              title: "Use Cases: Tracing",
            },
          },
        },
        {
          document: {
            score: 0.7696201489045031,
            id: "b140132a-2927-4b86-a284-165445b9fd75",
            content:
              "Overview: Tracing\nTracing the execution of LLM applications using Telemetry\nLLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request's execution.\nTracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( \nLlamaIndex\n, \nLangChain\n,\n DSPy\n),  SDKs (\nOpenAI\n, \nBedrock\n, \nMistral\n, \nVertex\n), and Languages. (Python, Javascript, etc.)\nUsing Phoenix's tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.\nApplication Latency\n: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.\nToken Usage\n: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.\nRuntime Exceptions\n: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.\nRetrieved Documents\n: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.\nEmbeddings\n: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.\nLLM Parameters\n: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.\nPrompt Templates\n: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.\nTool Descriptions\n: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM’s capabilities.\nLLM Function Calls\n: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.\nBy using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.\nView the inner workings for your LLM Application\nTo get started, check out the \nQuickstart guide\nAfter that, read through the \nConcepts Section\n to get and understanding of the different components.\nIf you want to learn how to accomplish a particular task, check out the \nHow-To Guides.\n\n\nPrevious\nFAQs: Deployment\nNext\nQuickstart: Tracing\nLast updated \n6 hours ago",
            metadata: {
              source: "https://docs.arize.com/phoenix/tracing/llm-traces",
              title: "Overview: Tracing",
            },
          },
        },
        {
          document: {
            score: 0.7690525972356251,
            id: "4dd1b54b-9e08-47ee-90a5-a5d2a9758581",
            content:
              "Configure Tracing\nHow to customize OpenTelemetry and OpenInference for your setup\nSpan Processing\nThe tutorials and code snippets in these docs default  to the \nSimpleSpanProcessor.\n A \nSimpleSpanProcessor\n processes and exports spans as they are created. This means that if you create 5 spans, each will be processed and exported before the next span is created in code. This can be helpful in scenarios where you do not want to risk losing a batch, or if you’re experimenting with OpenTelemetry in development. However, it also comes with potentially significant overhead, especially if spans are being exported over a network - each time a call to create a span is made, it would be processed and sent over a network before your app’s execution could continue.\n The \nBatchSpanProcessor\n processes spans in batches before they are exported. This is usually the right processor to use for an application in production but it does mean spans may take some time to show up in Phoenix.\nIn production we recommend the \nBatchSpanProcessor\n over \nSimpleSpanProcessor\n\nwhen deployed and the \nSimpleSpanProcessor\n when developing.\nPrevious\nTrace a Deployed App\nNext\nUse Cases: Tracing\nLast updated \n9 hours ago",
            metadata: {
              source:
                "https://docs.arize.com/phoenix/tracing/how-to-tracing/configure-tracing",
              title: "Configure Tracing",
            },
          },
        },
        {
          document: {
            score: 0.7680862242896571,
            id: "f3e24655-a9e1-4060-b9a5-2a4bad90990f",
            content:
              'Not more than 4-1/4 inches high, or more than 6 inches long, or greater than \\n0.016 inch thick.\\nd. Not more than 3.5 ounces (Charge flat-size prices for First-Class Mail \\ncard-type pieces over 3.5 ounces.)\\n\\n  Instruction: Based on the above documents, provide a detailed answer for the user question below.\\n  Answer \\"don\'t know\\" if not present in the document.\\n  ",\n\n\n       \n"llm.input_messages.1.message.role"\n:\n \n"user"\n,\n\n\n       \n"llm.input_messages.1.message.content"\n:\n \n"Hello"\n,\n\n\n       \n"llm.model_name"\n:\n \n"gpt-4-turbo-preview"\n,\n\n\n       \n"llm.invocation_parameters"\n:\n \n"{\\"temperature\\": 0.1, \\"model\\": \\"gpt-4-turbo-preview\\"}"\n,\n\n\n       \n"output.value"\n:\n \n"How are you?"\n }\n,\n\n\n   \n"events"\n:\n []\n,\n\n\n   \n"links"\n:\n []\n,\n\n\n   \n"resource"\n:\n {\n\n\n       \n"attributes"\n:\n {}\n,\n\n\n       \n"schema_url"\n:\n \n""\n\n\n   }\n\n\n}\nSpans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.\nTraces\nA trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.\nWithout tracing, it is challenging to pinpoint the cause of performance problems in a system.\nIt improves the visibility of our application or system’s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.\nTracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.\nA trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).\nProjects\nA \nproject\n is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the \nhow-to guide.\nSpan Kind\nWhen a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool. \nCHAIN\nA Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.\nRETRIEVER\nA Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.\nRERANKER\nA Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents\' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.\nLLM\nAn LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.\nEMBEDDING\nAn Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.\nTOOL\nA Tool is a span that represents a call to an external tool such as a calculator or a weather API.\nAGENT\nA span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\n\nSpan Attributes\nAttributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.\nFor example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.\nAttributes have the following rules:\nKeys must be non-null string values\nValues must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It\'s helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See \nsemantic conventions\n for more information.',
            metadata: {
              source:
                "https://docs.arize.com/phoenix/tracing/concepts-tracing/what-are-traces",
              title: "Traces",
            },
          },
        },
      ],
    },
    openinference: {
      span: {
        kind: "RETRIEVER",
      },
    },
    input: {
      value: "Can I use gRPC for trace collection?",
    },
    output: {
      mime_type: "application/json",
      value:
        '["<NodeWithScore(node=TextNode(id_=7af0e529-2531-42d9-bf3a-d5074a73c184), score=0.7758796006766829)>", "<NodeWithScore(node=TextNode(id_=0ba6dfa9-cc24-41d0-b962-342a9c126437), score=0.7733052433242642)>", "<NodeWithScore(node=TextNode(id_=b140132a-2927-4b86-a284-165445b9fd75), score=0.7696201489045031)>", "<NodeWithScore(node=TextNode(id_=4dd1b54b-9e08-47ee-90a5-a5d2a9758581), score=0.7690525972356251)>", "<NodeWithScore(node=TextNode(id_=f3e24655-a9e1-4060-b9a5-2a4bad90990f), score=0.7680862242896571)>"]',
    },
  }),
  input: {
    value: "Can I use gRPC for trace collection?",
    mimeType: "text",
  },
  output: {
    value:
      '["<NodeWithScore(node=TextNode(id_=7af0e529-2531-42d9-bf3a-d5074a73c184), score=0.7758796006766829)>", "<NodeWithScore(node=TextNode(id_=0ba6dfa9-cc24-41d0-b962-342a9c126437), score=0.7733052433242642)>", "<NodeWithScore(node=TextNode(id_=b140132a-2927-4b86-a284-165445b9fd75), score=0.7696201489045031)>", "<NodeWithScore(node=TextNode(id_=4dd1b54b-9e08-47ee-90a5-a5d2a9758581), score=0.7690525972356251)>", "<NodeWithScore(node=TextNode(id_=f3e24655-a9e1-4060-b9a5-2a4bad90990f), score=0.7680862242896571)>"]',
    mimeType: "json",
  },
  documentRetrievalMetrics: [
    {
      evaluationName: "Relevance",
      ndcg: 0,
      precision: 0,
      hit: 0,
    },
  ],
  documentEvaluations: [
    {
      id: "RG9jdW1lbnRBbm5vdGF0aW9uOjk5Ng==",
      annotatorKind: "LLM",
      documentPosition: 0,
      name: "Relevance",
      label: "unrelated",
      score: 0,
      explanation:
        "The question asks if gRPC can be used for trace collection. The reference text discusses how tracing works, including the use of a collector, instrumentation, and the OpenTelemetry Protocol (OTLP). However, it does not mention gRPC at all. Therefore, the reference text does not contain information that can help answer the question.",
      createdAt: "2026-07-23T16:23:00+00:00",
      updatedAt: "2026-07-23T16:22:48.570376+00:00",
      user: null,
    },
    {
      id: "RG9jdW1lbnRBbm5vdGF0aW9uOjk5Nw==",
      annotatorKind: "LLM",
      documentPosition: 1,
      name: "Relevance",
      label: "unrelated",
      score: 0,
      explanation:
        "The question asks about the possibility of using gRPC for trace collection. The reference text, however, does not mention gRPC at all. It talks about tracing in general and provides examples of how to use Phoenix tracing, but it does not provide any information about gRPC. Therefore, the reference text does not contain information that can help answer the question.",
      createdAt: "2026-07-23T16:23:00+00:00",
      updatedAt: "2026-07-23T16:22:48.570376+00:00",
      user: null,
    },
    {
      id: "RG9jdW1lbnRBbm5vdGF0aW9uOjk5OA==",
      annotatorKind: "LLM",
      documentPosition: 2,
      name: "Relevance",
      label: "unrelated",
      score: 0,
      explanation:
        "The question asks if gRPC can be used for trace collection. The reference text provides a detailed explanation of tracing in the context of LLM applications and the Phoenix framework, mentioning that Phoenix accepts traces over the OpenTelemetry protocol (OTLP). However, there is no mention of gRPC in the reference text. Therefore, the reference text does not contain information that can help answer the question.",
      createdAt: "2026-07-23T16:23:00+00:00",
      updatedAt: "2026-07-23T16:22:48.570376+00:00",
      user: null,
    },
    {
      id: "RG9jdW1lbnRBbm5vdGF0aW9uOjk5OQ==",
      annotatorKind: "LLM",
      documentPosition: 3,
      name: "Relevance",
      label: "unrelated",
      score: 0,
      explanation:
        "The question is asking about the possibility of using gRPC for trace collection. However, the reference text is about configuring tracing, specifically using OpenTelemetry and OpenInference, and it discusses the difference between SimpleSpanProcessor and BatchSpanProcessor. It does not mention or imply anything about gRPC. Therefore, the reference text does not contain information that can help answer the question.",
      createdAt: "2026-07-23T16:23:00+00:00",
      updatedAt: "2026-07-23T16:22:48.570376+00:00",
      user: null,
    },
    {
      id: "RG9jdW1lbnRBbm5vdGF0aW9uOjEwMDA=",
      annotatorKind: "LLM",
      documentPosition: 4,
      name: "Relevance",
      label: "unrelated",
      score: 0,
      explanation:
        "The question asks if gRPC can be used for trace collection. The reference text provides a detailed explanation of trace collection, spans, and their types, but it does not mention gRPC at all. Therefore, the reference text does not contain information that can help answer the question.",
      createdAt: "2026-07-23T16:23:00+00:00",
      updatedAt: "2026-07-23T16:22:48.570376+00:00",
      user: null,
    },
  ],
};

/**
 * A reranker span (Cohere) with a query, input documents, and reranked
 * output documents.
 */
export const rerankerSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTI5",
  name: "CohereRerank._postprocess_nodes",
  spanKind: "reranker",
  statusMessage: "",
  attributes: JSON.stringify({
    input: {
      value: "Can I persist data in the notebook?",
    },
    openinference: {
      span: {
        kind: "RERANKER",
      },
    },
    reranker: {
      input_documents: [
        {
          document: {
            score: 0.8423864464077443,
            id: "0a2238c5-9a1e-4eb8-9e7d-b4b94a237e42",
            content:
              'os\n.\nenviron\n[\n"PHOENIX_NOTEBOOK_ENV"\n]\n \n=\n \n"sagemaker"\nCan I persistdata in the notbook?\nYou can persist data in the notebook by either setting the \nuse_temp_dir\n flag to false in \npx.launch_app\n which will persit your data in SQLite on your disk at the \nPHOENIX_WORKING_DIR\n. Alternatively you can deploy a phoenix instance and point to it via \nPHOENIX_COLLECTOR_ENDPOINT\n.\nCan I use gRPC for trace collection?\nPhoenix does natively support gRPC for trace collection post 4.0 release. See \nHow to configure phoenix\n for details.\nPrevious\nRagas\nNext\nOpenInference\nLast updated \n3 months ago',
            metadata: {
              source:
                "https://docs.arize.com/phoenix/reference/frequently-asked-questions",
              title: "Frequently Asked Questions",
            },
          },
        },
        {
          document: {
            score: 0.7989392193506144,
            id: "636d9216-2e1b-4bb8-a5b2-b0067e16f701",
            content:
              "Persistence\nPhoenix is backed by a SQL database. By default, if you run phoenix with no configuration, it uses SQLite. However you can also configure Phoenix to use PostgreSQL as the backend database as well.\nPersistence is only available for 'arize-phoenix>=4.0.0'\nPersistence for notebooks (a.k.a. \nlaunch_app\n) is disabled by default. To enable persistence in notebooks, set the \nuse_temp_dir\n to false.\nSQLite\nBy default Phoenix uses SQLite so that it runs with no external dependancies. This SQLite instance is by default mounted in the directory specified by the \nPHOENIX_WORKING_DIR\n environment variable (default value in your home directory, e.x. \n~/.phoenix/\n). The easiest way to make Phoenix to persist data is to back this working directory to a mounted volume. Attach the mounted volume to the phoenix pod and point \nPHOENIX_WORKING_DIR\n to that volume (e.x. \n/mnt/volume\n)\\\nPostgreSQL\nPhoenix also can natively be backed by PostgreSQL. To make Phoenix talk to PostgreSQL instead of SQLite, you will have to set the \nPHOENIX_SQL_DATABASE_URL\n to your PostgreSQL instance.\nPrevious\nQuickstart: Deployment\nNext\nKubernetes\nLast updated \n20 days ago",
            metadata: {
              source: "https://docs.arize.com/phoenix/deployment/persistence",
              title: "Persistence",
            },
          },
        },
        {
          document: {
            score: 0.7696869156631215,
            id: "6937c39a-4f97-4156-af94-fbc352f69238",
            content:
              'Frequently Asked Questions\nCan I use Azure OpenAI?\nYes, in fact this is probably the preferred way to interact with OpenAI if your enterprise requires data privacy. Getting the parameters right for Azure can be a bit tricky so check out the \nmodels section for details.\nCan I use Phoenix locally from a remote Jupyter instance?\nYes, you can use either of the two methods below.\n1. Via ngrok (Preferred)\nInstall pyngrok on the remote machine using the command \npip install pyngrok\n.\nCreate a free account\n on ngrok and verify your email. Find \'Your Authtoken\' on the \ndashboard\n.\nIn jupyter notebook, after launching phoenix set its port number as the \nport\n parameter in the code below. \nPreferably use a default port\n for phoenix so that you won\'t have to set up ngrok tunnel every time for a new port, simply restarting phoenix will work on the same ngrok URL.\nCopy\nimport\n getpass\n\n\nfrom\n pyngrok \nimport\n ngrok\n,\n conf\n\n\nprint\n(\n"Enter your authtoken, which can be copied from https://dashboard.ngrok.com/auth"\n)\n\n\nconf\n.\nget_default\n().\nauth_token \n=\n getpass\n.\ngetpass\n()\n\n\nport \n=\n \n37689\n\n\n# Open a ngrok tunnel to the HTTP server\n\n\npublic_url \n=\n ngrok\n.\nconnect\n(port).\npublic_url\n\n\nprint\n(\n" * ngrok tunnel \\"\n{}\n\\" -> \\"http://127.0.0.1:\n{}\n\\""\n.\nformat\n(public_url, port))\n"Visit Site" using the newly printed \npublic_url\n and ignore warnings, if any.\nNOTE:\nNgrok free account does not allow more than 3 tunnels over a single ngrok agent session. Tackle this error by checking active URL tunnels using \nngrok.get_tunnels()\n and close the required URL tunnel using \nngrok.disconnect(public_url)\n.\n2. Via SSH\nThis assumes you have already set up ssh on both the local machine and the remote server.\nIf you are accessing a remote jupyter notebook from a local machine, you can also access the phoenix app by forwarding a local port to the remote server via ssh. In this particular case of using phoenix on a remote server, it is recommended that you use a default port for launching phoenix, say \nDEFAULT_PHOENIX_PORT\n.\nLaunch the phoenix app from jupyter notebook.\nIn a new terminal or command prompt, forward a local port of your choice from 49152 to 65535 (say \n52362\n) using the command below. Remote user of the remote host must have sufficient port-forwarding/admin privileges.\nCopy\nssh\n \n-L\n \n52362:localhost:\n<\nDEFAULT_PHOENIX_POR\nT\n>\n \n<\nREMOTE_USE\nR\n>\n@\n<\nREMOTE_HOS\nT\n>\nIf successful, visit \nlocalhost:52362\n to access phoenix locally.\nIf you are abruptly unable to access phoenix, check whether the ssh connection is still alive by inspecting the terminal. You can also try increasing the ssh timeout settings.\nClosing ssh tunnel:\nSimply run \nexit\n in the terminal/command prompt where you ran the port forwarding command.\nHow can I configure the backend to send the data to the phoenix UI in another container? \nIf you are working on an API whose endpoints perform RAG, but would like the phoenix server not to be launched as another thread. \nYou can do this by configuring the following the environment variable PHOENIX_COLLECTOR_ENDPOINT to point to the server running in a different process or container. https://docs.arize.com/phoenix/environments\nCan I use an older version of LlamaIndex?\nYes you can! You will have to be using \narize-phoenix>3.0.0\n and downgrade \nopeninference-instrumentation-llama-index<1.0.0\nRunning on SageMaker\nWith SageMaker notebooks, phoenix leverages the \njupyter-server-proy\n to host the server under \nproxy/6006.\nNote, that phoenix will automatically try to detect that you are running in SageMaker but you can declare the notebook runtime via a parameter to \nlaunch_app\n or an environment variable\nCopy\nimport\n os',
            metadata: {
              source:
                "https://docs.arize.com/phoenix/reference/frequently-asked-questions",
              title: "Frequently Asked Questions",
            },
          },
        },
        {
          document: {
            score: 0.7650776594342658,
            id: "133e55d2-3b6e-41b5-9d76-90ca08b7fa7b",
            content:
              'Environments\nThe Phoenix app can be run in various notebook environments such as colab and SageMaker as well as be served via the terminal or a docker container\nIn the notebook\nRun phoenix in the notebook as you run experiments\nAs a Container\nStart a long-running collector\nFrom the Terminal\nRun phoenix via the CLI\nNotebooks\nTo start phoenix in the notebook environment, run:\nCopy\nimport\n phoenix \nas\n px\n\n\n\n\nsession \n=\n px\n.\nlaunch_app\n()\nThis will start a local Phoenix server. You can initialize the phoenix server with various kinds of data (traces, inferences). Check out the \nAPI for details\nWhen running Phoenix in the notebook, by default it does not persist your data.\nContainer\nContainer images are still actively being worked on. If you are interested in hosted phoenix, please get in touch!\nPhoenix server images are available via \nDocker Hub\n. The hosted phoenix server runs as a trace collector and can be used if you want observability for LLM traces via docker compose or simply want a long-running phoenix instance. Below are examples of how to run phoenix va Docker for a specific version.\nFirst pull the image you want to run (note you can use the tag \nlatest\n if you would just like the latest version)\nCopy\ndocker\n \npull\n \narizephoenix/phoenix:latest\nNow you can run the image you pulled (note you must expose the port \n6006\n so you can view the UI).\nCopy\ndocker\n \nrun\n \n-p\n \n6006:6006\n \narizephoenix/phoenix:latest\nThe Phoenix UI will be available at \nlocalhost:6006\n.\nIf you deploy the Phoenix server (collector) to a remote machine, you will have to make sure to configure the remote endpoint as the collector endpoint.\nSet Endpoint Environment Variable\nCopy\nimport\n os\n\n\n\n\nos\n.\nenviron\n[\n"PHOENIX_COLLECTOR_ENDPOINT"\n]\n \n=\n \n"http://123.456.789:6006"\nNote that the above is only necessary if your application is running in a Jupyter notebook. If you are trying to deploy your application and have phoenix collect traces via a container, please consult the \ndeployment guide.\nTerminal\nIf you want to start a phoenix server to collect traces, you can also run phoenix directly from the command line\nCopy\npython3\n \n-m\n \nphoenix.server.main\n \nserve\nThis will start the phoenix server on port 6006. If you are running your instrumented notebook or application on the same machine, traces should automatically be exported to \nhttp://127.0.0.1:6006\n so no additional configuration is needed. However if the server is running remotely, you will have to modify the environment variable \nPHOENIX_COLLECTOR_ENDPOINT\n to point to that machine (e.g. \nhttp://<my-remote-machine>:<port>\n)\nNote that this command has various configuration options such as \n--host\n and \n--port\n. For example:\nCopy\npython3\n \n-m\n \nphoenix.server.main\n \n--port\n \n1234\n \n--host\n \n0.0.0.0\n \nserve\nPrevious\nSetup\nNext\nConfiguration\nLast updated \n3 months ago',
            metadata: {
              source: "https://docs.arize.com/phoenix/setup/environments",
              title: "Environments",
            },
          },
        },
        {
          document: {
            score: 0.763768356325267,
            id: "062eecb2-8288-4f25-843c-97590e57d763",
            content:
              "Export Data from Arize to Phoenix\nEasily share data when you discover interesting insights so your data science team can perform further investigation or kickoff retraining workflows.\nOftentimes, the team that notices an issue in their model, for example a prompt/response LLM model, may not be the same team that continues the investigations or kicks off retraining workflows.\nTo help connect teams and workflows, Phoenix enables continued analysis of production data from \nArize\n in a notebook environment for fine tuning workflows.\nFor example, a user may have noticed in \nArize\n that this prompt template is not performing well.\nWith a few lines of Python code, users can export this data into Phoenix for further analysis. This allows team members, such as data scientists, who may not have access to production data today, an easy way to access relevant product data for further analysis in an environment they are familiar with.\nThey can then easily augment and fine tune the data and verify improved performance, before deploying back to production.\nThere are two ways export data out of \nArize\n for further investigation:\nThe easiest way is to click the export button on the Embeddings and Inferences pages. This will produce a code snippet that you can copy into a Python environment and install Phoenix. This code snippet will include the date range you have selected in the \nArize\n platform, in addition to the inferences you have selected.\nUsers can also query \nArize\n for data directly using the Arize Python export client. We recommend doing this once you're more comfortable with the in-platform export functionality, as you will need to manually enter in the data ranges and data you want to export.\nCopy\nos\n.\nenviron\n[\n'ARIZE_API_KEY'\n]\n \n=\n ARIZE_API_KEY\n\n\n\n\nfrom\n datetime \nimport\n datetime\n\n\n\n\nfrom\n arize\n.\nexporter \nimport\n ArizeExportClient\n\n\nfrom\n arize\n.\nutils\n.\ntypes \nimport\n Environments\n\n\n\n\nclient \n=\n \nArizeExportClient\n()\n\n\n\n\nprimary_df \n=\n client\n.\nexport_model_to_df\n(\n\n\n    space_id\n=\n'U3BhY2U6NzU0'\n,\n\n\n    model_name\n=\n'test_home_prices_LLM'\n,\n\n\n    environment\n=\nEnvironments.PRODUCTION,\n\n\n    start_time\n=\ndatetime.\nfromisoformat\n(\n'2023-02-11T07:00:00.000+00:00'\n),\n\n\n    end_time\n=\ndatetime.\nfromisoformat\n(\n'2023-03-14T00:59:59.999+00:00'\n),\n\n\n)\nTest out this workflow by signing up for a \nfree Arize account\n.\nPrevious\nArize\nNext\nRagas\nLast updated \n3 months ago",
            metadata: {
              source:
                "https://docs.arize.com/phoenix/integrations/arize/bring-production-data-to-notebook-for-eda-or-retraining",
              title: "Export Data from Arize to Phoenix",
            },
          },
        },
      ],
      query: "Can I persist data in the notebook?",
      top_k: 2.0,
      model_name: "rerank-english-v2.0",
      output_documents: [
        {
          document: {
            score: 0.9972208,
            id: "0a2238c5-9a1e-4eb8-9e7d-b4b94a237e42",
            content:
              'os\n.\nenviron\n[\n"PHOENIX_NOTEBOOK_ENV"\n]\n \n=\n \n"sagemaker"\nCan I persistdata in the notbook?\nYou can persist data in the notebook by either setting the \nuse_temp_dir\n flag to false in \npx.launch_app\n which will persit your data in SQLite on your disk at the \nPHOENIX_WORKING_DIR\n. Alternatively you can deploy a phoenix instance and point to it via \nPHOENIX_COLLECTOR_ENDPOINT\n.\nCan I use gRPC for trace collection?\nPhoenix does natively support gRPC for trace collection post 4.0 release. See \nHow to configure phoenix\n for details.\nPrevious\nRagas\nNext\nOpenInference\nLast updated \n3 months ago',
            metadata: {
              source:
                "https://docs.arize.com/phoenix/reference/frequently-asked-questions",
              title: "Frequently Asked Questions",
            },
          },
        },
        {
          document: {
            score: 0.9887988,
            id: "636d9216-2e1b-4bb8-a5b2-b0067e16f701",
            content:
              "Persistence\nPhoenix is backed by a SQL database. By default, if you run phoenix with no configuration, it uses SQLite. However you can also configure Phoenix to use PostgreSQL as the backend database as well.\nPersistence is only available for 'arize-phoenix>=4.0.0'\nPersistence for notebooks (a.k.a. \nlaunch_app\n) is disabled by default. To enable persistence in notebooks, set the \nuse_temp_dir\n to false.\nSQLite\nBy default Phoenix uses SQLite so that it runs with no external dependancies. This SQLite instance is by default mounted in the directory specified by the \nPHOENIX_WORKING_DIR\n environment variable (default value in your home directory, e.x. \n~/.phoenix/\n). The easiest way to make Phoenix to persist data is to back this working directory to a mounted volume. Attach the mounted volume to the phoenix pod and point \nPHOENIX_WORKING_DIR\n to that volume (e.x. \n/mnt/volume\n)\\\nPostgreSQL\nPhoenix also can natively be backed by PostgreSQL. To make Phoenix talk to PostgreSQL instead of SQLite, you will have to set the \nPHOENIX_SQL_DATABASE_URL\n to your PostgreSQL instance.\nPrevious\nQuickstart: Deployment\nNext\nKubernetes\nLast updated \n20 days ago",
            metadata: {
              source: "https://docs.arize.com/phoenix/deployment/persistence",
              title: "Persistence",
            },
          },
        },
      ],
    },
    output: {
      mime_type: "application/json",
      value:
        '["<NodeWithScore(node=TextNode(id_=0a2238c5-9a1e-4eb8-9e7d-b4b94a237e42), score=0.9972208)>", "<NodeWithScore(node=TextNode(id_=636d9216-2e1b-4bb8-a5b2-b0067e16f701), score=0.9887988)>"]',
    },
  }),
  input: {
    value: "Can I persist data in the notebook?",
    mimeType: "text",
  },
  output: {
    value:
      '["<NodeWithScore(node=TextNode(id_=0a2238c5-9a1e-4eb8-9e7d-b4b94a237e42), score=0.9972208)>", "<NodeWithScore(node=TextNode(id_=636d9216-2e1b-4bb8-a5b2-b0067e16f701), score=0.9887988)>"]',
    mimeType: "json",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * An embedding span with embedded text and a model name.
 */
export const embeddingSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTQx",
  name: "BaseEmbedding.get_query_embedding",
  spanKind: "embedding",
  statusMessage: "",
  attributes: JSON.stringify({
    embedding: {
      embeddings: [
        {
          embedding: {
            vector: "<1536 dimensional vector>",
            text: "Can I use gRPC for trace collection?",
          },
        },
      ],
      model_name: "text-embedding-ada-002",
    },
    openinference: {
      span: {
        kind: "EMBEDDING",
      },
    },
    input: {
      mime_type: "application/json",
      value: '{"query": "Can I use gRPC for trace collection?"}',
    },
  }),
  input: {
    value: '{"query": "Can I use gRPC for trace collection?"}',
    mimeType: "json",
  },
  output: null,
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * An embedding span with no embeddings attribute — falls back to the
 * generic input / output view.
 */
export const embeddingWithoutEmbeddingsSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTQw",
  name: "OpenAIEmbedding._get_query_embedding",
  spanKind: "embedding",
  statusMessage: "",
  attributes: JSON.stringify({
    embedding: {
      model_name: "text-embedding-ada-002",
    },
    openinference: {
      span: {
        kind: "EMBEDDING",
      },
    },
    input: {
      mime_type: "application/json",
      value: '{"query": "Can I use gRPC for trace collection?"}',
    },
  }),
  input: {
    value: '{"query": "Can I use gRPC for trace collection?"}',
    mimeType: "json",
  },
  output: null,
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A tool span (LangGraph agent) with a tool name and description plus a
 * metadata attribute.
 */
export const toolSpan: SpanInfoFixture = {
  id: "U3BhbjozNTM0",
  name: "generate_and_run_sql_query",
  spanKind: "tool",
  statusMessage: "",
  attributes: JSON.stringify({
    input: {
      value:
        "{'original_prompt': \"How many of my traces ask about the author's employment?\"}",
    },
    output: {
      value:
        "{\"output\": \"content='[(0,)]' name='generate_and_run_sql_query' tool_call_id='call_hBOwBetmNpL88BIiqlDeypLs'\"}",
      mime_type: "application/json",
    },
    metadata:
      "{'checkpoint_ns': 'tools:5ca65e05-5106-937b-a6c3-7fabe5d3e94e', 'langgraph_node': 'tools', 'langgraph_path': ['__pregel_pull', 'tools'], 'langgraph_step': 2.0, 'langgraph_triggers': ['branch:agent:should_continue:tools'], 'ls_model_name': None, 'ls_model_type': None, 'ls_provider': None, 'ls_temperature': None, 'thread_id': 42}",
    session: {
      id: 42,
    },
    tool: {
      name: "generate_and_run_sql_query",
      description:
        "Generates and runs an SQL query based on the prompt.\n\n    Args:\n        original_prompt (str): A string containing the original user prompt.\n\n    Returns:\n        str: The result of the SQL query.",
    },
    openinference: {
      span: {
        kind: "TOOL",
      },
    },
  }),
  input: {
    value:
      "{'original_prompt': \"How many of my traces ask about the author's employment?\"}",
    mimeType: "text",
  },
  output: {
    value:
      "{\"output\": \"content='[(0,)]' name='generate_and_run_sql_query' tool_call_id='call_hBOwBetmNpL88BIiqlDeypLs'\"}",
    mimeType: "json",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A tool span from a Claude Code trace: a Bash tool invocation with text
 * input and output.
 */
export const toolBashSpan: SpanInfoFixture = {
  id: "U3Bhbjo3OTM1",
  name: "Bash",
  spanKind: "tool",
  statusMessage: "",
  attributes: JSON.stringify({
    turn: {
      id: "2",
    },
    output: {
      value:
        '{"gitOperation": {"push": {"branch": "mikeldking/refactor-span-details"}}, "interrupted": false, "isImage": false, "noOutputExpected": false, "stderr": "", "stdout": "To https://github.com/Arize-ai/phoenix.git\\n * [new branch]          mikeldking/refactor-span-details -> mikeldking/refactor-span-details\\nbranch \'mikeldking/refactor-span-details\' set up to track \'origin/mikeldking/refactor-span-details\'."}',
    },
    openinference: {
      span: {
        kind: "TOOL",
      },
    },
    session: {
      id: "27e755af-eed1-478b-ae6b-f332c89cd67c",
    },
    tool: {
      command:
        "git push -u origin mikeldking/refactor-span-details 2>&1 | tail -3",
      call: {
        id: "toolu_01U6PNu6oX54KEX3LZG6Sdbr",
      },
      description: "Push branch to origin",
      name: "Bash",
    },
    service: {
      name: "claude-code",
    },
    input: {
      value:
        '{"command": "git push -u origin mikeldking/refactor-span-details 2>&1 | tail -3", "description": "Push branch to origin"}',
    },
  }),
  input: {
    value:
      '{"command": "git push -u origin mikeldking/refactor-span-details 2>&1 | tail -3", "description": "Push branch to origin"}',
    mimeType: "text",
  },
  output: {
    value:
      '{"gitOperation": {"push": {"branch": "mikeldking/refactor-span-details"}}, "interrupted": false, "isImage": false, "noOutputExpected": false, "stderr": "", "stdout": "To https://github.com/Arize-ai/phoenix.git\\n * [new branch]          mikeldking/refactor-span-details -> mikeldking/refactor-span-details\\nbranch \'mikeldking/refactor-span-details\' set up to track \'origin/mikeldking/refactor-span-details\'."}',
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A chain span with plain-text input and output — the generic span view.
 */
export const chainTextIOSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTUw",
  name: "Refine.get_response",
  spanKind: "chain",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "CHAIN",
      },
    },
    input: {
      value: "Can I use gRPC for trace collection?",
    },
    output: {
      value: "You can use gRPC for trace collection.",
    },
  }),
  input: {
    value: "Can I use gRPC for trace collection?",
    mimeType: "text",
  },
  output: {
    value: "You can use gRPC for trace collection.",
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A chain span with JSON input and output — the generic span view with
 * JSON blocks.
 */
export const chainJsonIOSpan: SpanInfoFixture = {
  id: "U3Bhbjo2OTQ5",
  name: "DefaultRefineProgram.__call__",
  spanKind: "chain",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: {
      span: {
        kind: "CHAIN",
      },
    },
    input: {
      mime_type: "application/json",
      value:
        '{"kwds": {"context_str": "source: https://docs.arize.com/phoenix/tracing/concepts-tracing/what-are-traces\\ntitle: Traces\\n\\nNot more than 4-1/4 inches high, or more than 6 inches long, or greater than \\\\n0.016 inch thick.\\\\nd. Not more than 3.5 ounces (Charge flat-size prices for First-Class Mail \\\\ncard-type pieces over 3.5 ounces.)\\\\n\\\\n  Instruction: Based on the above documents, provide a detailed answer for the user question below.\\\\n  Answer \\\\\\"don\'t know\\\\\\" if not present in the document.\\\\n  \\",\\n\\n\\n       \\n\\"llm.input_messages.1.message.role\\"\\n:\\n \\n\\"user\\"\\n,\\n\\n\\n       \\n\\"llm.input_messages.1.message.content\\"\\n:\\n \\n\\"Hello\\"\\n,\\n\\n\\n       \\n\\"llm.model_name\\"\\n:\\n \\n\\"gpt-4-turbo-preview\\"\\n,\\n\\n\\n       \\n\\"llm.invocation_parameters\\"\\n:\\n \\n\\"{\\\\\\"temperature\\\\\\": 0.1, \\\\\\"model\\\\\\": \\\\\\"gpt-4-turbo-preview\\\\\\"}\\"\\n,\\n\\n\\n       \\n\\"output.value\\"\\n:\\n \\n\\"How are you?\\"\\n }\\n,\\n\\n\\n   \\n\\"events\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"links\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"resource\\"\\n:\\n {\\n\\n\\n       \\n\\"attributes\\"\\n:\\n {}\\n,\\n\\n\\n       \\n\\"schema_url\\"\\n:\\n \\n\\"\\"\\n\\n\\n   }\\n\\n\\n}\\nSpans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.\\nTraces\\nA trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.\\nWithout tracing, it is challenging to pinpoint the cause of performance problems in a system.\\nIt improves the visibility of our application or system\\u2019s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.\\nTracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.\\nA trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).\\nProjects\\nA \\nproject\\n is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the \\nhow-to guide.\\nSpan Kind\\nWhen a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool. \\nCHAIN\\nA Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.\\nRETRIEVER\\nA Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.\\nRERANKER\\nA Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents\' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.\\nLLM\\nAn LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.\\nEMBEDDING\\nAn Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.\\nTOOL\\nA Tool is a span that represents a call to an external tool such as a calculator or a weather API.\\nAGENT\\nA span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\\n\\nSpan Attributes\\nAttributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.\\nFor example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.\\nAttributes have the following rules:\\nKeys must be non-null string values\\nValues must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It\'s helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See \\nsemantic conventions\\n for more information.\\n\\nsource: https://docs.arize.com/phoenix/tracing/llm-traces\\ntitle: Overview: Tracing\\n\\nOverview: Tracing\\nTracing the execution of LLM applications using Telemetry\\nLLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request\'s execution.\\nTracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( \\nLlamaIndex\\n, \\nLangChain\\n,\\n DSPy\\n),  SDKs (\\nOpenAI\\n, \\nBedrock\\n, \\nMistral\\n, \\nVertex\\n), and Languages. (Python, Javascript, etc.)\\nUsing Phoenix\'s tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.\\nApplication Latency\\n: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.\\nToken Usage\\n: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.\\nRuntime Exceptions\\n: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.\\nRetrieved Documents\\n: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.\\nEmbeddings\\n: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.\\nLLM Parameters\\n: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.\\nPrompt Templates\\n: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.\\nTool Descriptions\\n: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM\\u2019s capabilities.\\nLLM Function Calls\\n: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.\\nBy using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.\\nView the inner workings for your LLM Application\\nTo get started, check out the \\nQuickstart guide\\nAfter that, read through the \\nConcepts Section\\n to get and understanding of the different components.\\nIf you want to learn how to accomplish a particular task, check out the \\nHow-To Guides.\\n\\n\\nPrevious\\nFAQs: Deployment\\nNext\\nQuickstart: Tracing\\nLast updated \\n6 hours ago"}}',
    },
    output: {
      mime_type: "application/json",
      value:
        '{"answer": "You can use gRPC for trace collection.", "query_satisfied": true}',
    },
  }),
  input: {
    value:
      '{"kwds": {"context_str": "source: https://docs.arize.com/phoenix/tracing/concepts-tracing/what-are-traces\\ntitle: Traces\\n\\nNot more than 4-1/4 inches high, or more than 6 inches long, or greater than \\\\n0.016 inch thick.\\\\nd. Not more than 3.5 ounces (Charge flat-size prices for First-Class Mail \\\\ncard-type pieces over 3.5 ounces.)\\\\n\\\\n  Instruction: Based on the above documents, provide a detailed answer for the user question below.\\\\n  Answer \\\\\\"don\'t know\\\\\\" if not present in the document.\\\\n  \\",\\n\\n\\n       \\n\\"llm.input_messages.1.message.role\\"\\n:\\n \\n\\"user\\"\\n,\\n\\n\\n       \\n\\"llm.input_messages.1.message.content\\"\\n:\\n \\n\\"Hello\\"\\n,\\n\\n\\n       \\n\\"llm.model_name\\"\\n:\\n \\n\\"gpt-4-turbo-preview\\"\\n,\\n\\n\\n       \\n\\"llm.invocation_parameters\\"\\n:\\n \\n\\"{\\\\\\"temperature\\\\\\": 0.1, \\\\\\"model\\\\\\": \\\\\\"gpt-4-turbo-preview\\\\\\"}\\"\\n,\\n\\n\\n       \\n\\"output.value\\"\\n:\\n \\n\\"How are you?\\"\\n }\\n,\\n\\n\\n   \\n\\"events\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"links\\"\\n:\\n []\\n,\\n\\n\\n   \\n\\"resource\\"\\n:\\n {\\n\\n\\n       \\n\\"attributes\\"\\n:\\n {}\\n,\\n\\n\\n       \\n\\"schema_url\\"\\n:\\n \\n\\"\\"\\n\\n\\n   }\\n\\n\\n}\\nSpans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.\\nTraces\\nA trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.\\nWithout tracing, it is challenging to pinpoint the cause of performance problems in a system.\\nIt improves the visibility of our application or system\\u2019s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.\\nTracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.\\nA trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).\\nProjects\\nA \\nproject\\n is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the \\nhow-to guide.\\nSpan Kind\\nWhen a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool. \\nCHAIN\\nA Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.\\nRETRIEVER\\nA Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.\\nRERANKER\\nA Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents\' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.\\nLLM\\nAn LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.\\nEMBEDDING\\nAn Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.\\nTOOL\\nA Tool is a span that represents a call to an external tool such as a calculator or a weather API.\\nAGENT\\nA span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\\n\\nSpan Attributes\\nAttributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.\\nFor example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.\\nAttributes have the following rules:\\nKeys must be non-null string values\\nValues must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It\'s helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See \\nsemantic conventions\\n for more information.\\n\\nsource: https://docs.arize.com/phoenix/tracing/llm-traces\\ntitle: Overview: Tracing\\n\\nOverview: Tracing\\nTracing the execution of LLM applications using Telemetry\\nLLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request\'s execution.\\nTracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( \\nLlamaIndex\\n, \\nLangChain\\n,\\n DSPy\\n),  SDKs (\\nOpenAI\\n, \\nBedrock\\n, \\nMistral\\n, \\nVertex\\n), and Languages. (Python, Javascript, etc.)\\nUsing Phoenix\'s tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.\\nApplication Latency\\n: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.\\nToken Usage\\n: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.\\nRuntime Exceptions\\n: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.\\nRetrieved Documents\\n: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.\\nEmbeddings\\n: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.\\nLLM Parameters\\n: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.\\nPrompt Templates\\n: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.\\nTool Descriptions\\n: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM\\u2019s capabilities.\\nLLM Function Calls\\n: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.\\nBy using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.\\nView the inner workings for your LLM Application\\nTo get started, check out the \\nQuickstart guide\\nAfter that, read through the \\nConcepts Section\\n to get and understanding of the different components.\\nIf you want to learn how to accomplish a particular task, check out the \\nHow-To Guides.\\n\\n\\nPrevious\\nFAQs: Deployment\\nNext\\nQuickstart: Tracing\\nLast updated \\n6 hours ago"}}',
    mimeType: "json",
  },
  output: {
    value:
      '{"answer": "You can use gRPC for trace collection.", "query_satisfied": true}',
    mimeType: "json",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A small inline SVG so the multi-modal story renders an image without any
 * network dependency. Traces commonly carry data URLs for images.
 */
const sampleImageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="240" fill="#7ec8e3"/><rect y="240" width="640" height="180" fill="#4a7c59"/><circle cx="520" cy="80" r="40" fill="#f9d71c"/><path d="M0 300 L320 240 L640 300 L640 420 L0 420 Z" fill="#8b5a2b"/></svg>`
)}`;

/**
 * An LLM span with multi-modal input message contents — text alongside an
 * image and a redacted image. Modeled on the OpenInference
 * message_contents convention.
 */
export const llmMultiModalSpan: SpanInfoFixture = {
  id: "U3BhbjptdWx0aW1vZGFs",
  name: "OpenAI.chat",
  spanKind: "llm",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: { span: { kind: "LLM" } },
    llm: {
      model_name: "gpt-4o",
      provider: "openai",
      invocation_parameters: '{"temperature": 0, "model": "gpt-4o"}',
      input_messages: [
        {
          message: {
            role: "user",
            contents: [
              {
                message_content: {
                  type: "text",
                  text: "What is in this image?",
                },
              },
              {
                message_content: {
                  type: "image",
                  image: {
                    image: {
                      url: sampleImageDataUrl,
                    },
                  },
                },
              },
              {
                message_content: {
                  type: "image",
                  image: { image: { url: "__REDACTED__" } },
                },
              },
            ],
          },
        },
      ],
      output_messages: [
        {
          message: {
            role: "assistant",
            content:
              "The image shows a wooden boardwalk cutting through a lush green marsh under a partly cloudy blue sky.",
          },
        },
      ],
    },
  }),
  input: {
    value: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image?" },
            { type: "image_url", image_url: { url: sampleImageDataUrl } },
          ],
        },
      ],
    }),
    mimeType: "json",
  },
  output: {
    value:
      "The image shows a wooden boardwalk cutting through a lush green marsh under a partly cloudy blue sky.",
    mimeType: "text",
  },
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A span with no input or output — the generic view falls back to showing
 * the span's attributes.
 */
export const spanWithoutIOSpan: SpanInfoFixture = {
  id: "U3Bhbjpuby1pbw==",
  name: "Workflow.step",
  spanKind: "chain",
  statusMessage: "",
  attributes: JSON.stringify({
    openinference: { span: { kind: "CHAIN" } },
    session: { id: "9f13fbd2-7f31-4b73-9b6f-6d1a2f6dcb61" },
    metadata: {
      workflow_run_id: "0b1a2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      step: "route_request",
    },
  }),
  input: null,
  output: null,
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

/**
 * A span whose attributes payload is not valid JSON — renders the
 * un-parsable attributes warning.
 */
export const unparsableAttributesSpan: SpanInfoFixture = {
  id: "U3BhbjpiYWQtYXR0cnM=",
  name: "custom_span",
  spanKind: "chain",
  statusMessage: "",
  attributes: '{"llm": {"model_name": NaN, "token_count": }',
  input: {
    value: "What is the weather in San Francisco?",
    mimeType: "text",
  },
  output: null,
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};
