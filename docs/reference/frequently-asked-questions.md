# Frequently Asked Questions

## Can I configure a default port for Phoenix?

You can set the default port for phoenix each time you launch the application from jupyter notebook with an optional argument `port` in [launch_app()](https://github.com/Arize-ai/phoenix/blob/d21bbc8db4fc62989d127f8d2f7d5e7306bbb357/src/phoenix/session/session.py#L187).

## Can I use Phoenix locally from a remote Jupyter instance?

Yes, you can use either of the two methods below.

### 1. Via ngrok (Preferred)

-   Install pyngrok on the remote machine using the command `pip install pyngrok`.
-   [Create a free account](https://ngrok.com/) on ngrok and verify your email. Find 'Your Authtoken' on the [dashboard](https://dashboard.ngrok.com/auth).
-   In jupyter notebook, after launching phoenix set its port number as the `port` parameter in the code below. **Preferably use a default port** for phoenix so that you won't have to set up ngrok tunnel every time for a new port, simply restarting phoenix will work on the same ngrok URL.

-   ```python
    import getpass
    from pyngrok import ngrok, conf
    print("Enter your authtoken, which can be copied from https://dashboard.ngrok.com/auth")
    conf.get_default().auth_token = getpass.getpass()
    port = 37689
    # Open a ngrok tunnel to the HTTP server
    public_url = ngrok.connect(port).public_url
    print(" * ngrok tunnel \"{}\" -> \"http://127.0.0.1:{}\"".format(public_url, port))
    ```
-   "Visit Site" using the newly printed `public_url` and ignore warnings, if any.

#### NOTE:

Ngrok free account does not allow more than 3 tunnels over a single ngrok agent session. Tackle this error by checking active URL tunnels using `ngrok.get_tunnels()` and close the required URL tunnel using `ngrok.disconnect(public_url)`.

### 2. Via SSH

This assumes you have already set up ssh on both the local machine and the remote server.

If you are accessing a remote jupyter notebook from a local machine, you can also access the phoenix app by forwarding a local port to the remote server via ssh. In this particular case of using phoenix on a remote server, it is recommended that you use a default port for launching phoenix, say `DEFAULT_PHOENIX_PORT`.

-   Launch the phoenix app from jupyter notebook.
-   In a new terminal or command prompt, forward a local port of your choice from 49152 to 65535 (say `52362`) using the command below. Remote user of the remote host must have sufficient port-forwarding/admin privileges.

    ```bash
    ssh -L 52362:localhost:<DEFAULT_PHOENIX_PORT> <REMOTE_USER>@<REMOTE_HOST>
    ```

-   If successful, visit [localhost:52362](http://localhost:52362) to access phoenix locally.

If you are abruptly unable to access phoenix, check whether the ssh connection is still alive by inspecting the terminal. You can also try increasing the ssh timeout settings.

#### Closing ssh tunnel:

Simply run `exit` in the terminal/command prompt where you ran the port forwarding command.
