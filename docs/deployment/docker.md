# Docker

[![](https://camo.githubusercontent.com/63d36979ad4d1307931b2e7388f90bf5c14024b3d43baccfea1dabf890444d54/68747470733a2f2f696d672e736869656c64732e696f2f646f636b65722f762f6172697a6570686f656e69782f70686f656e69783f736f72743d73656d766572266c6f676f3d646f636b6572266c6162656c3d696d61676526636f6c6f723d626c7565)](https://hub.docker.com/r/arizephoenix/phoenix/tags)

This guide provides instructions for installing and setting up your environment to run Phoenix locally using Docker.&#x20;

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

## PostGreSQL

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

You can also run Phonix using SQLite with a persistent disc attached.

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

\
