# Persistence

Phoenix is backed by a SQL database. By default, if you run phoenix with no configuration, it uses SQLite. However you can also configure Phoenix to use PostgreSQL as the backend database as well.

{% hint style="info" %}
Persistence is only available for 'arize-phoenix>=4.0.0'
{% endhint %}

## SQLite

By default Phoenix uses SQLite so that it runs with no external dependancies. This SQLite instance is by default mounted in the directory specified by the **PHOENIX\_WORKING\_DIR** environment variable (default value in your home directory, e.x. ` ~/.phoenix/`). The easiest way to make Phoenix to persist data is to back this working directory to a mounted volume. Attach the mounted volume to the phoenix pod and point **PHOENIX\_WORKING\_DIR** to that volume (e.x. `/mnt/volume`)\


## PostgreSQL

Phoenix also can natively be backed by PostgreSQL. To make Phoenix talk to PostgreSQL instead of SQLite, you will have to set the **PHOENIX\_SQL\_DATABASE\_URL** to your PostgreSQL instance.
