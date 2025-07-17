#!/usr/bin/env python3
"""
PostgreSQL TLS Certificate Generator

This script generates the necessary TLS certificates for securing PostgreSQL connections.
It creates a self-signed Certificate Authority (CA) and generates server and client certificates
that are signed by this CA.

The generated certificates are placed in a 'certs' directory and include:
- Root CA certificate and key
- Server certificate and key
- Client certificate and key

Usage:
    python generate_pg_certs.py

The script will:
1. Create a 'certs' directory if it doesn't exist
2. Generate all necessary certificates and keys
3. Set appropriate file permissions
4. Clean up temporary files
"""

import subprocess
from pathlib import Path


def run_command(command: str, cwd: str = None) -> bool:
    """
    Execute a shell command and handle any errors that occur.

    Args:
        command: The shell command to execute
        cwd: Working directory to execute the command in

    Returns:
        bool: True if the command executed successfully, False otherwise
    """
    try:
        subprocess.run(command, check=True, shell=True, cwd=cwd)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Warning: Command failed: {command}")
        print(f"Return code: {e.returncode}")
        return False


def write_file(filename: str, content: str) -> None:
    """
    Write content to a file, overwriting if it exists.

    Args:
        filename: Path to the file to write
        content: Content to write to the file
    """
    try:
        with open(filename, "w") as f:
            f.write(content)
    except IOError as e:
        print(f"Error writing to file {filename}: {e}")
        raise


def generate_ca_config() -> str:
    """
    Generate the configuration for the Certificate Authority.

    Returns:
        str: The CA configuration file content
    """
    return """
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[req_distinguished_name]
CN = root-ca

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer:always
basicConstraints = CA:true
"""


def generate_server_config() -> str:
    """
    Generate the configuration for the server certificate.

    Returns:
        str: The server configuration file content
    """
    return """
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = postgres

[v3_req]
subjectAltName = DNS:localhost,DNS:postgres,IP:127.0.0.1
"""


def generate_certs() -> None:
    """
    Main function to generate all required certificates.

    This function:
    1. Creates a certs directory in the same folder as the script
    2. Generates CA, server, and client certificates
    3. Sets appropriate permissions
    4. Cleans up temporary files
    5. Prints a summary of the generated certificates
    """
    # Get the directory where this script is located
    script_dir = Path(__file__).parent.absolute()
    certs_dir = script_dir / "certs"

    print(f"Script directory: {script_dir}")
    print(f"Certificates will be generated in: {certs_dir}")

    # Create certs directory if it doesn't exist
    if certs_dir.exists():
        print("Removing existing certs directory...")
        import shutil

        shutil.rmtree(certs_dir)
    certs_dir.mkdir(exist_ok=True)

    print(f"Generating certificates in {certs_dir} directory...")

    # Write configuration files
    ca_config_path = certs_dir / "ca.cnf"
    server_config_path = certs_dir / "server.cnf"
    write_file(str(ca_config_path), generate_ca_config())
    write_file(str(server_config_path), generate_server_config())

    # Generate certificates
    if not all(
        [
            run_command("openssl genrsa -out root.key 2048", str(certs_dir)),
            run_command(
                "openssl req -x509 -new -nodes -key root.key -sha256 -days 3650 "
                "-out root.crt -config ca.cnf",
                str(certs_dir),
            ),
            run_command("openssl genrsa -out server.key 2048", str(certs_dir)),
            run_command(
                "openssl req -new -key server.key -out server.csr -config server.cnf",
                str(certs_dir),
            ),
            run_command(
                "openssl x509 -req -in server.csr -CA root.crt -CAkey root.key "
                "-CAcreateserial -out server.crt -days 365 -extensions v3_req -extfile server.cnf",
                str(certs_dir),
            ),
            run_command("openssl genrsa -out client.key 2048", str(certs_dir)),
            run_command(
                "openssl req -new -key client.key -out client.csr -subj '/CN=postgres'",
                str(certs_dir),
            ),
            run_command(
                "openssl x509 -req -in client.csr -CA root.crt -CAkey root.key "
                "-CAcreateserial -out client.crt -days 365",
                str(certs_dir),
            ),
        ]
    ):
        print("Error: Failed to generate certificates")
        return

    # Set permissions and clean up
    run_command("chmod 600 *.key", str(certs_dir))

    # Clean up temporary files
    for file in certs_dir.glob("*.cnf"):
        file.unlink()
    for file in certs_dir.glob("*.csr"):
        file.unlink()
    for file in certs_dir.glob("*.srl"):
        file.unlink()

    # Print summary
    print("\n========== Certificate Generation Complete ==========")
    print(f"Generated files in {certs_dir} directory:")
    for file in sorted(certs_dir.glob("*")):
        if file.suffix in (".key", ".crt"):
            print(f"  {file.name} ({file.stat().st_size} bytes)")

    print("\n========== Next Steps ==========")
    print("1. Restart your PostgreSQL container:")
    print("   docker-compose down")
    print("   docker-compose up -d")
    print("\n2. Test the connection using your existing scripts")

    # Print connection string with absolute paths
    print("\n========== Connection String ==========")
    print("Use this connection string to connect with SSL/TLS:")
    print(
        f"postgresql://postgres:phoenix@localhost:5432/postgres?sslmode=verify-full"
        f"&sslcert={certs_dir / 'client.crt'}"
        f"&sslkey={certs_dir / 'client.key'}"
        f"&sslrootcert={certs_dir / 'root.crt'}"
    )
    print("\nOr in key-value format:")
    print(
        f"host=localhost port=5432 dbname=postgres user=postgres password=phoenix "
        f"sslmode=verify-full sslcert={certs_dir / 'client.crt'} "
        f"sslkey={certs_dir / 'client.key'} "
        f"sslrootcert={certs_dir / 'root.crt'}"
    )


if __name__ == "__main__":
    generate_certs()
