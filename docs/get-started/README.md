# Get Started

To begin using Phoenix, you can either run it locally or launch a Phoenix Cloud instance.

For most first time users, we **recommend** setting up a Phoenix cloud account.&#x20;

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/Phoenix%20decision%20tree.png" alt=""><figcaption></figcaption></figure>

## Choose your Path:&#x20;

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td><strong>Phoenix Cloud</strong></td><td>Connect to a pre-configured, managed Phoenix instance</td><td><a href="./#setup-and-run-phoenix-cloud">#setup-and-run-phoenix-cloud</a></td><td><a href="../.gitbook/assets/Screenshot 2024-10-09 at 6.32.50 PM.png">Screenshot 2024-10-09 at 6.32.50 PM.png</a></td></tr><tr><td><strong>As a Container</strong></td><td>Self-host your own Phoenix</td><td><a href="./#run-phoenix-using-docker">#run-phoenix-using-docker</a></td><td><a href="../.gitbook/assets/docker.png">docker.png</a></td></tr><tr><td><strong>From the Terminal</strong></td><td>Run Phoenix via the CLI on your local machine</td><td><a href="./#run-phoenix-through-your-terminal">#run-phoenix-through-your-terminal</a></td><td><a href="../.gitbook/assets/terminal.png">terminal.png</a></td></tr></tbody></table>

{% hint style="info" %}
If you’d prefer to self-host using alternative deployment services, see [this guide](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/) for more details.&#x20;
{% endhint %}

## Setup & Run Phoenix Cloud

{% stepper %}
{% step %}
### Log In & Create a Phoenix Space

* [ ] Make a free Phoenix Cloud [account](https://app.arize.com/auth/phoenix/login)&#x20;
* [ ] Click the **Create a Space** button in the upper-right corner of the dashboard.
* [ ] Enter a name for your new space.
* [ ] After creating your space, launch your Phoenix instance directly from the dashboard.

You can navigate back to [https://app.phoenix.arize.com/management/spaces](https://app.phoenix.arize.com/management/spaces) anytime to manage your spaces.&#x20;

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/observe_phoenix_cloud_launch.mp4" %}
{% endstep %}

{% step %}
### &#x20;Set Up Keys

To create a new API key, go to your **Settings** page & click down to the **API Keys** section. Click the **Add System Key** button, then provide a name for your API key. You may also include an optional description and set an expiration date if desired. All your API keys will be listed and manageable in this section.

#### System vs User API Keys

* &#x20;System API keys represent the actions taken by the system as a whole (not tied to specific user)&#x20;
* User API keys represent the actions of a particular user. They are tied to lifespan of the user that created them.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/api_key_hostname.mp4" %}
{% endstep %}

{% step %}
### (optional) Add Collaborators

Phoenix Cloud supports team collaboration by allowing you to invite members to your space. You can also assign roles and permissions to manage access levels securely. &#x20;

### Roles

* **Admins** have full control over the space, including managing members, settings, system and user API keys, and roles.
* **Members** can access their own profile and manage their own user API keys&#x20;

### Adding Collaborators&#x20;

On the Settings page, click the **Add User** button. Enter the user’s name, email address, and assign a role. The user will receive an email invitation to log in to the Phoenix instance.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/adding_users.mp4" %}

**Congratulations!** You now have Phoenix up and running. From here, you can start sending traces, create and upload datasets, run experiments, and explore everything else Phoenix has to offer.

Continue to the next guide to send your first trace and begin working with Phoenix in action.
{% endstep %}
{% endstepper %}

## Run Phoenix through your Terminal&#x20;

Running Phoenix through your terminal is the fastest way to get Phoenix up and running locally.&#x20;

{% stepper %}
{% step %}
### Install the Phoenix Library&#x20;

Run the following command in your terminal to install Phoenix:

&#x20;`pip install arize-phoenix`&#x20;
{% endstep %}

{% step %}
### Start Phoenix&#x20;

Once installed, start the Phoenix server with:

&#x20;`phoenix serve`&#x20;

This will launch Phoenix locally and make the application available in your browser. It should look something like this:&#x20;

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/local_phoenix_start.jpeg" %}
{% endstep %}

{% step %}
### Open Phoenix UI&#x20;

Once Phoenix is running, you can open the UI directly from the links displayed in your terminal. By default, the Phoenix UI will be available at:

👉 [http://localhost:6006](http://localhost:6006)&#x20;

This launches the Phoenix dashboard in your browser, where you can begin exploring logs, traces, and other features.

**Congratulations!** You now have Phoenix up and running. From here, you can start sending traces, create and upload datasets, run experiments, and explore everything else Phoenix has to offer.

Continue to the next guide to send your first trace and begin working with Phoenix in action.
{% endstep %}
{% endstepper %}

## Run Phoenix using Docker&#x20;

{% embed url="https://hub.docker.com/r/arizephoenix/phoenix" %}

{% stepper %}
{% step %}
### &#x20;Prerequisites

1.  Ensure Docker is installed and running on your system. You can verify this by running:

    <pre><code><strong>docker info
    </strong></code></pre>

    If you don't see any server information in the output, make sure Docker is installed correctly and launch the Docker daemon.
2.  Phoenix Version

    Our Docker Compose files are pegged to the latest release of Phoenix. If you want to use a different version, you can specify it in the `docker-compose.yml` file.

Some Optional Steps&#x20;

1.  Persistent Disc

    You can configure external disc storage to store your data in a SQLite databse
2.  External Postgres

    You will need to set the `PHOENIX_SQL_DATABASE_URL` environment variable to the connection string for your Postgres instance.
{% endstep %}

{% step %}
### Run Local Instance of Arize Phoenix&#x20;

{% tabs %}
{% tab title="Docker" %}
Pull the image you would like to run:

```
docker pull arizephoenix/phoenix
```

Pick an image you would like to run or simply run the latest:

{% hint style="warning" %}
Note, you should pin the phoenix version for production to the version of phoenix you plan on using. E.x. arizephoenix/phoenix:4.0.0
{% endhint %}

```
docker run -p 6006:6006 -p 4317:4317 -i -t arizephoenix/phoenix:latest
```

See for details on the ports for the container.

Navigate to [http://localhost:6006](http://localhost:6006) and you should see your local Arize Phoenix.&#x20;

Note that the above simply starts the phoenix server locally. A simple way to make sure your application always has a running phoenix server as a collector is to run the phoenix server as a side car. Look at the next tab for an example **compose.yaml** file. &#x20;
{% endtab %}

{% tab title="compose.yaml" %}
A simple way to make sure your application always has a running phoenix server as a collector is to run the phoenix server as a side car.

Here is an example **compose.yaml:**&#x20;

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
{% endtab %}

{% tab title="PostgreSQL" %}
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

Note that the above setup is using your local disc as a volume mount to store the postgres data. For production deployments you will have to setup a persistent volume.You can also run Phoenix using SQLite with a persistent disc attached:
{% endtab %}

{% tab title="SQLite" %}
You can also run Phoenix using SQLite with a persistent disc attached:

<pre class="language-yaml"><code class="lang-yaml"># docker-compose.yml
services:
  phoenix:
    image: arizephoenix/phoenix:latest # Must be greater than 4.0 version to work
<strong>    ports:
</strong>      - 6006:6006  # PHOENIX_PORT
      - 4317:4317  # PHOENIX_GRPC_PORT
      - 9090:9090  # [Optional] PROMETHEUS PORT IF ENABLED
    environment:
      - PHOENIX_WORKING_DIR=/mnt/data
    volumes:
      - phoenix_data:/mnt/data   # PHOENIX_WORKING_DIR
volumes:
  phoenix_data:
    driver: local
</code></pre>
{% endtab %}
{% endtabs %}

**Congratulations!** You now have Phoenix up and running. From here, you can start sending traces, create and upload datasets, run experiments, and explore everything else Phoenix has to offer.

Continue to the next guide to send your first trace and begin working with Phoenix in action.
{% endstep %}
{% endstepper %}
