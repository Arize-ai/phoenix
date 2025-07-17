# PostgreSQL with TLS Setup

This vignette demonstrates how to set up PostgreSQL with TLS encryption.

## Quick Start

1. Generate certificates:
   ```bash
   python generate_pg_certs.py
   ```

2. Start PostgreSQL:
   ```bash
   docker compose up -d
   ```

3. Check logs:
   ```bash
   docker compose logs postgres
   ```

4. Test connection:
   ```bash
   python test_connection.py
   ```

## Prerequisites

- Docker and Docker Compose installed
- Python 3.x installed
- OpenSSL (for certificate generation)

## Configuration Details

The setup includes:
- PostgreSQL server with TLS encryption
- Server certificates for secure communication
- Custom PostgreSQL configuration files
- Persistent data storage using Docker volumes

## Tips

- **Certificate Generation**: The `generate_pg_certs.py` script creates a self-signed CA and generates both server and client certificates. You can find the generated certificates in the `certs` directory.

- **Connection Testing**: The `test_connection.py` script tests connections using both `psycopg` and `asyncpg` drivers, as well as SQLAlchemy. This helps verify that your TLS setup works with different PostgreSQL clients.

- **Security Configuration**: 
  - The `pg_hba.conf` file is configured to require SSL for remote connections
  - Local connections (127.0.0.1) use MD5 authentication
  - Local Unix socket connections use trust authentication

- **Certificate Files**: 
  - `server.crt` and `server.key`: Server's certificate and private key
  - `client.crt` and `client.key`: Client's certificate and private key
  - `root.crt`: Root CA certificate for verifying server certificates

- **Docker Volumes**: 
  - The PostgreSQL data is persisted in a Docker volume named `postgres-data`
  - This means your data will survive container restarts
  - To start fresh, you can remove the volume with `docker compose down -v`

- **Connection String**: When connecting to the database, you'll need to specify:
  - The server's hostname (localhost)
  - The port (5432)
  - The database name (postgres)
  - The username (postgres)
  - The password (phoenix)
  - SSL parameters (certificates and verification mode)

## Troubleshooting

If you encounter any issues:
1. Check that the certificates were generated successfully
2. Verify that the PostgreSQL container is running
3. Ensure the certificates have the correct permissions
4. Check the container logs for any error messages
