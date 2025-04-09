# Frequently Asked Questions

## What is the difference between Phoenix and Arize?

Arize is the company that makes Phoenix. Phoenix is an open source LLM observability tool offered by Arize. It can be access in its Cloud form online, or self-hosted and run on your own machine or server.

"Arize" can also refer to Arize's enterprise platform, often called Arize AX, available on arize.com. Arize AX is the enterprise SaaS version of Phoenix that comes with additional features like Copilot, ML and CV support, HIPAA compliance, Security Reviews, a customer success team, and more. See [here for a breakdown](https://phoenix.arize.com/pricing/) of the two tools.

## What is LlamaTrace vs Phoenix Cloud?

LlamaTrace and Phoenix Cloud are the same tool. They are the hosted version of Phoenix provided on app.phoenix.arize.com.

## Will Phoenix Cloud be on the latest version of Phoenix?

We update the Phoenix version used by Phoenix Cloud on a weekly basis.

## Sharing

Currently Phoenix Cloud accounts are setup to be used specifically for one developer. We will be adding ways to share your traces with other developers on your team shortly!

Self-hosted Phoenix supports multiple user with authentication, roles, and more.

## Pricing

Phoenix Cloud is free up to the following limits, then $50/month.

* 10gb storage

Self-hosting Phoenix is completely free.

## Can I use Azure OpenAI?

Yes, in fact this is probably the preferred way to interact with OpenAI if your enterprise requires data privacy. Getting the parameters right for Azure can be a bit tricky so check out the [models section for details.](../evaluation/how-to-evals/evaluation-models.md#azure-openai)

## Can I use Phoenix locally from a remote Jupyter instance?

Yes, you can use either of the two methods below.

### 1. Via ngrok (Preferred)

* Install pyngrok on the remote machine using the command `pip install pyngrok`.
* [Create a free account](https://ngrok.com/) on ngrok and verify your email. Find 'Your Authtoken' on the [dashboard](https://dashboard.ngrok.com/auth).
* In jupyter notebook, after launching phoenix set its port number as the `port` parameter in the code below. **Preferably use a default port** for phoenix so that you won't have to set up ngrok tunnel every time for a new port, simply restarting phoenix will work on the same ngrok URL.
* ```python
  import getpass
  from pyngrok import ngrok, conf
  print("Enter your authtoken, which can be copied from https://dashboard.ngrok.com/auth")
  conf.get_default().auth_token = getpass.getpass()
  port = 37689
  # Open a ngrok tunnel to the HTTP server
  public_url = ngrok.connect(port).public_url
  print(" * ngrok tunnel \"{}\" -> \"http://127.0.0.1:{}\"".format(public_url, port))
  ```
* "Visit Site" using the newly printed `public_url` and ignore warnings, if any.

#### NOTE:

Ngrok free account does not allow more than 3 tunnels over a single ngrok agent session. Tackle this error by checking active URL tunnels using `ngrok.get_tunnels()` and close the required URL tunnel using `ngrok.disconnect(public_url)`.

### 2. Via SSH

This assumes you have already set up ssh on both the local machine and the remote server.

If you are accessing a remote jupyter notebook from a local machine, you can also access the phoenix app by forwarding a local port to the remote server via ssh. In this particular case of using phoenix on a remote server, it is recommended that you use a default port for launching phoenix, say `DEFAULT_PHOENIX_PORT`.

* Launch the phoenix app from jupyter notebook.
*   In a new terminal or command prompt, forward a local port of your choice from 49152 to 65535 (say `52362`) using the command below. Remote user of the remote host must have sufficient port-forwarding/admin privileges.

    ```bash
    ssh -L 52362:localhost:<DEFAULT_PHOENIX_PORT> <REMOTE_USER>@<REMOTE_HOST>
    ```
* If successful, visit [localhost:52362](http://localhost:52362) to access phoenix locally.

If you are abruptly unable to access phoenix, check whether the ssh connection is still alive by inspecting the terminal. You can also try increasing the ssh timeout settings.

#### Closing ssh tunnel:

Simply run `exit` in the terminal/command prompt where you ran the port forwarding command.

## How can I configure the backend to send the data to the phoenix UI in another container?

_If you are working on an API whose endpoints perform RAG, but would like the phoenix server not to be launched as another thread._

You can do this by configuring the following the environment variable PHOENIX\_COLLECTOR\_ENDPOINT to point to the server running in a different process or container. https://docs.arize.com/phoenix/environments

## Can I use an older version of LlamaIndex?

Yes you can! You will have to be using `arize-phoenix>3.0.0` and downgrade `openinference-instrumentation-llama-index<1.0.0`

## Running on SageMaker

With SageMaker notebooks, phoenix leverages the [jupyter-server-proy](https://github.com/jupyterhub/jupyter-server-proxy) to host the server under `proxy/6006.`Note, that phoenix will automatically try to detect that you are running in SageMaker but you can declare the notebook runtime via a parameter to `launch_app` or an environment variable

```python
import os

os.environ["PHOENIX_NOTEBOOK_ENV"] = "sagemaker"
```

## Can I persistdata in the notbook?

You can persist data in the notebook by either setting the `use_temp_dir` flag to false in `px.launch_app` which will persit your data in SQLite on your disk at the **PHOENIX\_WORKING\_DIR**. Alternatively you can deploy a phoenix instance and point to it via **PHOENIX\_COLLECTOR\_ENDPOINT**.

## Can I use gRPC for trace collection?

Phoenix does natively support gRPC for trace collection post 4.0 release. See [Broken link](broken-reference "mention") for details.

## How do I resolve Phoenix Evals showing NOT\_PARSABLE?

`NOT_PARSABLE` errors often occur when LLM responses exceed the `max_tokens` limit or produce incomplete JSON. Here's how to fix it:

1.  Increase `max_tokens`: Update the model configuration as follows:

    ```python
    pythonCopy codellm_judge_model = OpenAIModel(
        api_key=getpass("Enter your OpenAI API key..."),
        model="gpt-4o-2024-08-06",
        temperature=0.2,
        max_tokens=1000,  # Increase token limit
    )
    ```
2. Update Phoenix: Use version ≥0.17.4, which removes token limits for OpenAI and increases defaults for other APIs.
3. Check Logs: Look for `finish_reason="length"` to confirm token limits caused the issue.&#x20;
4. If the above doesn't work, it's possible the llm-as-a-judge output might not fit into the defined rails for that particular custom Phoenix eval. Double check the prompt output matches the rail expectations.
