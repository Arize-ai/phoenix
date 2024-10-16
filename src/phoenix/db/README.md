# Database

This module is responsible for the database connection and the migrations.


## Migrations

All migrations are managed by Alembic. Migrations are applied to the database automatically when the application starts.


### Manually Applying Migrations

Sometimes, it's necessary to manually apply migrations, e.g., to recover from a failed migration. To manually apply migrations, you must first clone the Phoenix repository.

```bash
git clone https://github.com/Arize-ai/phoenix.git
```

Then navigate to the current directory.

```bash
cd phoenix/src/phoenix/db
```

If you are using a non-default SQL database URL (e.g., for running PostgreSQL), ensure your `PHOENIX_SQL_DATABASE_URL` is set. This is not needed if you are running Phoenix with the default SQLite URL.

```bash
export PHOENIX_SQL_DATABASE_URL=<sql-database-url>
```


To manually run up-migrations, run the following command:

```bash
alembic upgrade head
```

If the above command fails, it may be necessary to undo partially applied changes from a failed migration by first running down-migrations. This can be accomplished by identifying the ID of the migration revision you wish to return to. Revisions are defined [here](./migrations/versions/).

⚠️ Running down-migrations can result in lost data. Only run down-migrations if you know what you are doing and consider backing up your database first. If you have any questions or doubts, contact the Phoenix team in the `#phoenix-support` channel of the [Arize AI Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q) or via GitHub.

```bash
alembic downgrade <revision-id>
```

### Creating a Migration

All migrations are stored in the `migrations` folder. To create a new migration, run the following command:

```bash
alembic revision -m "your_revision_name"
```

Then fill the migration file with the necessary changes.
