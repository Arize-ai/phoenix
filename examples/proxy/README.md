# Deploying Phoenix with a Reverse Proxy

This example shows how to deploy Phoenix behind a reverse proxy with a custom root path for the application. While the example uses [`traefik`](https://doc.traefik.io/traefik/), the same result can be achieved with other reverse proxy servers (e.g., Nginx).

## Steps

Inspect the `traefik` configuration files in [traefik.toml](./traefik.toml) and [routes.toml](./routes.toml). These files configure a reverse proxy to run on port `9999` with application root path `/phoenix_root_path` that forwards traffic to an instance of Phoenix running locally on the default port.

Download and decompress the appropriate [`traefik` binary](https://github.com/traefik/traefik/releases) and place it in the current directory. Spin up the proxy with

```
./traefik --configFile=traefik.toml
```

Next, install Phoenix.

```
pip install arize-phoenix
```

Set the `PHOENIX_HOST_ROOT_PATH` environment variable to match the root path in the configuration files above.

```   
export PHOENIX_HOST_ROOT_PATH="/phoenix_root_path"
```

Run Phoenix with

```
python -m phoenix.server.main serve
```

You should now be able to access the Phoenix UI via the `traefik` proxy at http://127.0.0.1:9999/phoenix_root_path.


## References

This guide is adapted from the equivalent [FastAPI guide](https://fastapi.tiangolo.com/advanced/behind-a-proxy/#testing-locally-with-traefik).
