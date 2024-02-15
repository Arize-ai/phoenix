# Frequently Asked Questions

## Can I use Azure OpenAI?

Yes, in fact this is probably the preferred way to interact with OpenAI if your enterprise requires data privacy. Getting the parameters right for Azure can be a bit tricky so check out the [models section for details.](../api/evaluation-models.md#azure-openai)

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

## How can I configure the backend to send the data to the phoenix UI in another container?&#x20;

_If you are working on an API whose endpoints perform RAG, but would like the phoenix server not to be launched as another thread._&#x20;

You can do this by configuring the following the environment variable PHOENIX\_COLLECTOR\_ENDPOINT to point to the server running in a different process or container. https://docs.arize.com/phoenix/environments



## Can I use an older version of LlamaIndex?

Yes you can! You will have to be using `arize-phoenix>3.0.0` and downgrade `openinference-instrumentation-llama-index<1.0.0`
