# PostgreSQL with TLS Setup

This vignette demonstrates how to set up PostgreSQL with TLS encryption. Follow these steps to get started:

## Prerequisites

- Docker and Docker Compose installed
- Python 3.x installed
- OpenSSL (for certificate generation)

## Setup Steps

1. Generate the necessary certificates:
   ```bash
   python generate_pg_certs.py
   ```
   This will create the required certificates in the `certs` directory.

2. Start the PostgreSQL container:
   ```bash
   docker compose up -d
   ```
   This will start a PostgreSQL instance with TLS enabled, using the generated certificates.

3. Test the connection:
   ```bash
   python test_connection.py
   ```
   This will verify that the TLS connection to PostgreSQL is working correctly.

## Configuration Details

The setup includes:
- PostgreSQL server with TLS encryption
- Server certificates for secure communication
- Custom PostgreSQL configuration files
- Persistent data storage using Docker volumes

## Troubleshooting

If you encounter any issues:
1. Check that the certificates were generated successfully
2. Verify that the PostgreSQL container is running
3. Ensure the certificates have the correct permissions
4. Check the container logs for any error messages
