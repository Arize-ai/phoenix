# Frequently Asked Questions

### Configure default Phoenix port
You can set the default port for phoenix each time you launch the application from jupyter notebook with an optional argument ``port`` in [launch_app()](https://github.com/Arize-ai/phoenix/blob/d21bbc8db4fc62989d127f8d2f7d5e7306bbb357/src/phoenix/session/session.py#L187). 

## Using Phoenix locally from a remote Jupyter instance
(This assumes you have already setup ssh on both the local machine and the remote server for remote jupyter access.)

If you are accessing a remote jupyter notebook from a local machine, you can also access the phoenix app by forwarding a local port to the remote server via ssh. In this particular case of a remote server, it is recommended that you use a default port for launching phoenix, say ``DEFAULT_PHOENIX_PORT``.

- Launch the phoenix app from jupyter notebook. 
- In a new terminal or command prompt, forward a local port of your choice from 49152 to 65535 (say ``52362``) using the command below. Remote user of the remote host must have sufficient port-forwarding/admin privileges.
  
  ```bash
  ssh -L 52362:localhost:<DEFAULT_PHOENIX_PORT> <REMOTE_USER>@<REMOTE_HOST>
  ```
- If successful, visit [localhost:52362](http://localhost:52362) to access phoenix locally.

If you are unable to access phoenix abruptly, check whether the ssh connection is still alive by inspecting the terminal. You can also try increasing the ssh timeout as mentioned [here](https://stackoverflow.com/questions/4936807/how-to-set-ssh-timeout).

### Closing ssh tunnel: 
Simply run ``exit`` in the terminal/command prompt where you ran the port forwarding command.
