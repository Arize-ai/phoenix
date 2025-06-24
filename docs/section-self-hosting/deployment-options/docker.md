---
description: Deploy using docker compose for a local or cloud deployment
---

# Docker

{% embed url="https://hub.docker.com/r/arizephoenix/phoenix" %}

This guide provides instructions for installing and setting up your environment to run Phoenix locally using Docker.

## Prerequisites

1.  Ensure Docker is installed and running on your system. You can verify this by running:

    ```
    docker info
    ```

    If you don't see any server information in the output, make sure Docker is installed correctly and launch the Docker daemon.
2. Phoenix Version
   1. Our Docker Compose files are pegged to the latest release of Phoenix. If you want to use a different version, you can specify it in the `docker-compose.yml` file.
3. Persistent Disc (optional)
   1. You can configure external disc storage to store your data in a SQLite databse
4. External Postgres(optional).
   1. you will need to set the `PHOENIX_SQL_DATABASE_URL` environment variable to the connection string for your postgres instance.
   2. Note: We do only officially support Postgres versions >= 14.

## Docker

Run a local instance of Arize Phoenix in Docker with 2 commands

{% tabs %}
{% tab title="Docker" %}
Pull the image you would like to run

```
docker pull arizephoenix/phoenix
```

Pick an image you would like to run or simply run the latest:

{% hint style="danger" %}
Note, you should pin the phoenix version for production to the version of phoenix you plan on using. E.x. arizephoenix/phoenix:4.0.0
{% endhint %}

```
docker run -p 6006:6006 -p 4317:4317 -i -t arizephoenix/phoenix:latest
```

See  for details on the ports for the container.

Navigate to [http://localhost:6006](http://localhost:6006) and you should see your local Arize Phoenix
{% endtab %}
{% endtabs %}

Note that the above simply starts the phoenix server locally. A simple way to make sure your application always has a running phoenix server as a collector is to run the phoenix server as a side car.

Here is an example **compose.yaml**

```yaml
services:
  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"  # UI and OTLP HTTP collector
      - "4317:4317"  # OTLP gRPC collector
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - COLLECTOR_ENDPOINT=http://phoenix:6006/v1/traces
      - PROD_CORS_ORIGIN=http://localhost:3000
      # Set INSTRUMENT_LLAMA_INDEX=false to disable instrumentation
      - INSTRUMENT_LLAMA_INDEX=true
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://0.0.0.0:8000/api/chat/healthcheck"]
      interval: 5s
      timeout: 1s
      retries: 5
  frontend:
    build: frontend
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
```

This way you will always have a running Phoenix instance when you run

```
docker compose up
```

For the full details of on how to configure Phoenix, check out the Configuration section

## PostgreSQL

You can quickly launch Phoenix with a PostGreSQL backend using docker compose.

First, ensure that Docker Compose is installed on your machine [https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/).

Copy the following YAML file into a new file called `docker-compose.yml`

```yaml
# docker-compose.yml
services:
  phoenix:
    image: arizephoenix/phoenix:latest # Must be greater than 4.0 version to work
    depends_on:
      - db
    ports:
      - 6006:6006  # PHOENIX_PORT
      - 4317:4317  # PHOENIX_GRPC_PORT
      - 9090:9090  # [Optional] PROMETHEUS PORT IF ENABLED
    environment:
      - PHOENIX_SQL_DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres
  db:
    image: postgres
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=postgres
    ports:
      - 5432
    volumes:
      - database_data:/var/lib/postgresql/data
volumes:
  database_data:
    driver: local
```

Run docker compose to run phoenix with postgres

```
docker compose up --build
```

Note that the above setup is using your local disc as a volume mount to store the postgres data. For production deployments you will have to setup a persistent volume.

## SQLite

You can also run Phonix using SQLite with a persistent disc attached:

```yaml
# docker-compose.yml
services:
  phoenix:
    image: arizephoenix/phoenix:latest # Must be greater than 4.0 version to work
    ports:
      - 6006:6006  # PHOENIX_PORT
      - 4317:4317  # PHOENIX_GRPC_PORT
      - 9090:9090  # [Optional] PROMETHEUS PORT IF ENABLED
    environment:
      - PHOENIX_WORKING_DIR=/mnt/data
    volumes:
      - phoenix_data:/mnt/data   # PHOENIX_WORKING_DIR
volumes:
  phoenix_data:
    driver: local
```
