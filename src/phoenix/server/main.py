import atexit
import codecs
import os
import sys
from argparse import ArgumentParser, RawDescriptionHelpFormatter
from pathlib import Path
from ssl import CERT_REQUIRED
from threading import Thread
from time import sleep, time
from typing import Optional
from urllib.parse import urljoin

from jinja2 import BaseLoader, Environment
from uvicorn import Config, Server

import phoenix.trace.v1 as pb
from phoenix.config import (
    EXPORT_DIR,
    TLSConfigVerifyClient,
    get_env_access_token_expiry,
    get_env_allowed_origins,
    get_env_auth_settings,
    get_env_database_connection_str,
    get_env_database_schema,
    get_env_db_logging_level,
    get_env_disable_migrations,
    get_env_enable_prometheus,
    get_env_fullstory_org,
    get_env_grpc_port,
    get_env_host,
    get_env_host_root_path,
    get_env_log_migrations,
    get_env_logging_level,
    get_env_logging_mode,
    get_env_management_url,
    get_env_oauth2_settings,
    get_env_password_reset_token_expiry,
    get_env_port,
    get_env_refresh_token_expiry,
    get_env_smtp_hostname,
    get_env_smtp_mail_from,
    get_env_smtp_password,
    get_env_smtp_port,
    get_env_smtp_username,
    get_env_smtp_validate_certs,
    get_env_tls_config,
    get_env_tls_enabled_for_grpc,
    get_env_tls_enabled_for_http,
    get_pids_path,
)
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.db import get_printable_db_url
from phoenix.inferences.fixtures import FIXTURES, get_inferences
from phoenix.inferences.inferences import EMPTY_INFERENCES, Inferences
from phoenix.logging import setup_logging
from phoenix.pointcloud.umap_parameters import (
    DEFAULT_MIN_DIST,
    DEFAULT_N_NEIGHBORS,
    DEFAULT_N_SAMPLES,
    UMAPParameters,
)
from phoenix.server.app import (
    ScaffolderConfig,
    _db,
    create_app,
    create_engine_and_run_migrations,
    instrument_engine_if_enabled,
)
from phoenix.server.email.sender import SimpleEmailSender
from phoenix.server.email.types import EmailSender
from phoenix.server.types import DbSessionFactory
from phoenix.settings import Settings
from phoenix.trace.fixtures import (
    TRACES_FIXTURES,
    get_dataset_fixtures,
    get_evals_from_fixture,
    get_trace_fixtures_by_project_name,
    load_example_traces,
    reset_fixture_span_ids_and_timestamps,
    send_dataset_fixtures,
)
from phoenix.trace.otel import decode_otlp_span, encode_span_to_otlp
from phoenix.trace.schemas import Span
from phoenix.version import __version__ as phoenix_version

_WELCOME_MESSAGE = Environment(loader=BaseLoader()).from_string("""

██████╗ ██╗  ██╗ ██████╗ ███████╗███╗   ██╗██╗██╗  ██╗
██╔══██╗██║  ██║██╔═══██╗██╔════╝████╗  ██║██║╚██╗██╔╝
██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║██║ ╚███╔╝
██╔═══╝ ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║██║ ██╔██╗
██║     ██║  ██║╚██████╔╝███████╗██║ ╚████║██║██╔╝ ██╗
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ v{{ version }}

|  ⭐️⭐️⭐️ Support Open Source ⭐️⭐️⭐️
|  ⭐️⭐️⭐️ Star on GitHub! ⭐️⭐️⭐️
|  https://github.com/Arize-ai/phoenix
|
|  🌎 Join our Community 🌎
|  https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email
|
|  📚 Documentation 📚
|  https://arize.com/docs/phoenix
|
|  🚀 Phoenix Server 🚀
|  Phoenix UI: {{ ui_path }}
|
|  Authentication: {{ auth_enabled }}
{%- if basic_auth_disabled %}
|  Basic Auth: Disabled
{%- endif %}
{%- if auth_enabled_for_http or auth_enabled_for_grpc %}
{%- if tls_enabled_for_http %}
|  TLS: Enabled for HTTP
{%- endif %}
{%- if tls_enabled_for_grpc %}
|  TLS: Enabled for gRPC
{%- endif %}
{%- if tls_verify_client %}
|  TLS Client Verification: Enabled
{%- endif %}
{%- endif %}
{%- if allowed_origins %}
|  Allowed Origins: {{ allowed_origins }}
{%- endif %}
|  Log traces:
|    - gRPC: {{ grpc_path }}
|    - HTTP: {{ http_path }}
|  Storage: {{ storage }}
{%- if schema %}
|    - Schema: {{ schema }}
{%- endif %}
""")


def _write_pid_file_when_ready(
    server: Server,
    wait_up_to_seconds: float = 60,
) -> None:
    """Write PID file after server is started (or when time is up)."""
    time_limit = time() + wait_up_to_seconds
    while time() < time_limit and not server.should_exit and not server.started:
        sleep(1e-3)
    if time() >= time_limit and not server.started:
        server.should_exit = True
    _get_pid_file().touch()


def _remove_pid_file() -> None:
    _get_pid_file().unlink(missing_ok=True)


def _get_pid_file() -> Path:
    return get_pids_path() / str(os.getpid())


DEFAULT_UMAP_PARAMS_STR = f"{DEFAULT_MIN_DIST},{DEFAULT_N_NEIGHBORS},{DEFAULT_N_SAMPLES}"


def main() -> None:
    initialize_settings()
    setup_logging()

    primary_inferences_name: str
    reference_inferences_name: Optional[str]
    trace_dataset_name: Optional[str] = None

    primary_inferences: Inferences = EMPTY_INFERENCES
    reference_inferences: Optional[Inferences] = None
    corpus_inferences: Optional[Inferences] = None

    atexit.register(_remove_pid_file)

    # Get available fixture names for help text
    available_fixtures = [fixture.name for fixture in FIXTURES]
    available_trace_fixtures = [fixture.name for fixture in TRACES_FIXTURES]
    
    parser = ArgumentParser(
        description="Phoenix - AI Observability & Evaluation Platform",
        usage="phoenix <command> [options]",
        epilog="For more information, visit: https://arize.com/docs/phoenix"
    )
    
    # Global options
    parser.add_argument(
        "--database-url",
        help="Database connection string"
    )
    parser.add_argument(
        "--export_path",
        help="Path for exporting data and reports"
    )
    parser.add_argument(
        "--host",
        type=str,
        help="Host address to bind server to"
    )
    parser.add_argument(
        "--port",
        type=int,
        help="Port number to bind server to"
    )
    parser.add_argument(
        "--read-only",
        action="store_true",
        help="Run in read-only mode (no data ingestion)"
    )
    parser.add_argument(
        "--no-internet",
        action="store_true",
        help="Disable internet access for fixture downloads"
    )
    parser.add_argument(
        "--umap_params",
        type=str,
        default=DEFAULT_UMAP_PARAMS_STR,
        help=f"UMAP parameters: min_dist,n_neighbors,n_samples (default: {DEFAULT_UMAP_PARAMS_STR})"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug mode"
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Enable development mode"
    )
    parser.add_argument(
        "--no-ui",
        action="store_true",
        help="Disable web UI (API-only mode)"
    )
    parser.add_argument(
        "--enable-websockets",
        type=str,
        help="Enable WebSocket support (experimental)"
    )
    
    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
        title="Commands",
        description="Available Phoenix commands",
        help="Use 'phoenix <command> --help' for command details"
    )

    # Serve command
    serve_parser = subparsers.add_parser(
        "serve",
        help="Start the Phoenix server",
        description="Start Phoenix server with optional sample data",
        formatter_class=RawDescriptionHelpFormatter
    )
    serve_parser.add_argument(
        "--with-fixture",
        type=str,
        default="",
        choices=available_fixtures,
        help="Load sample inference data from fixture"
    )
    serve_parser.add_argument(
        "--with-trace-fixtures",
        type=str,
        default="",
        help="Load trace data from fixtures (comma-separated)"
    )
    serve_parser.add_argument(
        "--with-projects",
        type=str,
        default="",
        help="Load all fixtures for specific projects (comma-separated)"
    )
    serve_parser.add_argument(
        "--force-fixture-ingestion",
        action="store_true",
        help="Force fixture ingestion (default: only for new databases)"
    )
    serve_parser.add_argument(
        "--scaffold-datasets",
        action="store_true",
        help="Auto-create datasets from fixtures"
    )

    # Datasets command
    datasets_parser = subparsers.add_parser(
        "datasets",
        help="Load and configure datasets",
        description="Load primary, reference, and corpus datasets",
        formatter_class=RawDescriptionHelpFormatter
    )
    datasets_parser.add_argument(
        "--primary",
        type=str,
        required=True,
        choices=available_fixtures,
        help="Primary dataset fixture name"
    )
    datasets_parser.add_argument(
        "--reference",
        type=str,
        required=False,
        choices=available_fixtures,
        help="Reference dataset fixture name (optional)"
    )
    datasets_parser.add_argument(
        "--corpus",
        type=str,
        required=False,
        choices=available_fixtures,
        help="Corpus dataset fixture name (optional)"
    )
    datasets_parser.add_argument(
        "--trace",
        type=str,
        required=False,
        choices=available_trace_fixtures,
        help="Trace dataset fixture name (optional)"
    )

    # Fixture command
    fixture_parser = subparsers.add_parser(
        "fixture",
        help="Run a specific inference fixture",
        description="Load and run a specific inference fixture",
        formatter_class=RawDescriptionHelpFormatter
    )
    fixture_parser.add_argument(
        "fixture",
        type=str,
        choices=available_fixtures,
        help="Fixture name to run"
    )
    fixture_parser.add_argument(
        "--primary-only",
        action="store_true",
        help="Load only primary dataset"
    )

    # Trace fixture command
    trace_fixture_parser = subparsers.add_parser(
        "trace-fixture",
        help="Run a specific trace fixture",
        description="Load and run a specific trace fixture",
        formatter_class=RawDescriptionHelpFormatter
    )
    trace_fixture_parser.add_argument(
        "fixture",
        type=str,
        choices=available_trace_fixtures,
        help="Trace fixture name to run"
    )
    trace_fixture_parser.add_argument(
        "--simulate-streaming",
        action="store_true",
        help="Simulate streaming data ingestion"
    )

    # Demo command
    demo_parser = subparsers.add_parser(
        "demo",
        help="Run a complete demo with both inference and trace data",
        description="Load both inference and trace fixtures",
        formatter_class=RawDescriptionHelpFormatter
    )
    demo_parser.add_argument(
        "fixture",
        type=str,
        choices=available_fixtures,
        help="Inference fixture name"
    )
    demo_parser.add_argument(
        "trace_fixture",
        type=str,
        choices=available_trace_fixtures,
        help="Trace fixture name"
    )
    demo_parser.add_argument(
        "--simulate-streaming",
        action="store_true",
        help="Simulate streaming data ingestion"
    )

    args = parser.parse_args()
    db_connection_str = (
        args.database_url if args.database_url else get_env_database_connection_str()
    )
    export_path = Path(args.export_path) if args.export_path else Path(EXPORT_DIR)

    force_fixture_ingestion = False
    scaffold_datasets = False
    tracing_fixture_names = set()
    if args.command == "datasets":
        primary_inferences_name = args.primary
        reference_inferences_name = args.reference
        corpus_inferences_name = args.corpus
        primary_inferences = Inferences.from_name(primary_inferences_name)
        reference_inferences = (
            Inferences.from_name(reference_inferences_name)
            if reference_inferences_name is not None
            else None
        )
        corpus_inferences = (
            None if corpus_inferences_name is None else Inferences.from_name(corpus_inferences_name)
        )
    elif args.command == "fixture":
        fixture_name = args.fixture
        primary_only = args.primary_only
        primary_inferences, reference_inferences, corpus_inferences = get_inferences(
            fixture_name,
            args.no_internet,
        )
        if primary_only:
            reference_inferences_name = None
            reference_inferences = None
    elif args.command == "trace-fixture":
        trace_dataset_name = args.fixture
    elif args.command == "demo":
        fixture_name = args.fixture
        primary_inferences, reference_inferences, corpus_inferences = get_inferences(
            fixture_name,
            args.no_internet,
        )
        trace_dataset_name = args.trace_fixture
    elif args.command == "serve":
        if args.with_fixture:
            primary_inferences, reference_inferences, corpus_inferences = get_inferences(
                str(args.with_fixture),
                args.no_internet,
            )
        if args.with_trace_fixtures:
            tracing_fixture_names.update(
                [name.strip() for name in args.with_trace_fixtures.split(",")]
            )
        if args.with_projects:
            project_names = [name.strip() for name in args.with_projects.split(",")]
            tracing_fixture_names.update(
                fixture.name
                for name in project_names
                for fixture in get_trace_fixtures_by_project_name(name)
            )
        force_fixture_ingestion = args.force_fixture_ingestion
        scaffold_datasets = args.scaffold_datasets
    host: Optional[str] = args.host or get_env_host()
    if host == "::":
        host = None

    port = args.port or get_env_port()
    host_root_path = get_env_host_root_path()
    read_only = args.read_only

    model = create_model_from_inferences(
        primary_inferences,
        reference_inferences,
    )

    auth_settings = get_env_auth_settings()

    fixture_spans: list[Span] = []
    fixture_evals: list[pb.Evaluation] = []
    if trace_dataset_name is not None:
        fixture_spans, fixture_evals = reset_fixture_span_ids_and_timestamps(
            (
                # Apply `encode` here because legacy jsonl files contains UUIDs as strings.
                # `encode` removes the hyphens in the UUIDs.
                decode_otlp_span(encode_span_to_otlp(span))
                for span in load_example_traces(trace_dataset_name).to_spans()
            ),
            get_evals_from_fixture(trace_dataset_name),
        )
        dataset_fixtures = list(get_dataset_fixtures(trace_dataset_name))
        if not read_only:
            Thread(
                target=send_dataset_fixtures,
                args=(f"http://{host}:{port}", dataset_fixtures),
            ).start()
    umap_params_list = args.umap_params.split(",")
    umap_params = UMAPParameters(
        min_dist=float(umap_params_list[0]),
        n_neighbors=int(umap_params_list[1]),
        n_samples=int(umap_params_list[2]),
    )

    if enable_prometheus := get_env_enable_prometheus():
        from phoenix.server.prometheus import start_prometheus

        start_prometheus()

    engine = create_engine_and_run_migrations(db_connection_str)
    instrumentation_cleanups = instrument_engine_if_enabled(engine)
    factory = DbSessionFactory(db=_db(engine), dialect=engine.dialect.name)
    corpus_model = (
        None if corpus_inferences is None else create_model_from_inferences(corpus_inferences)
    )

    allowed_origins = get_env_allowed_origins()
    management_url = get_env_management_url()

    # Get TLS configuration
    tls_enabled_for_http = get_env_tls_enabled_for_http()
    tls_enabled_for_grpc = get_env_tls_enabled_for_grpc()
    tls_config = get_env_tls_config()
    tls_verify_client = tls_config is not None and isinstance(tls_config, TLSConfigVerifyClient)

    # Print information about the server
    http_scheme = "https" if tls_enabled_for_http else "http"
    grpc_scheme = "https" if tls_enabled_for_grpc else "http"
    # Use localhost for display when host is the loopback address to make URLs clickable
    display_host = "localhost" if host in ("0.0.0.0", "::") else host
    root_path = urljoin(f"{http_scheme}://{host}:{port}", host_root_path)
    display_root_path = urljoin(f"{http_scheme}://{display_host}:{port}", host_root_path)
    msg = _WELCOME_MESSAGE.render(
        version=phoenix_version,
        ui_path=display_root_path,
        grpc_path=f"{grpc_scheme}://{display_host}:{get_env_grpc_port()}",
        http_path=urljoin(display_root_path, "v1/traces"),
        storage=get_printable_db_url(db_connection_str),
        schema=get_env_database_schema(),
        auth_enabled=auth_settings.enable_auth,
        disable_basic_auth=auth_settings.disable_basic_auth,
        tls_enabled_for_http=tls_enabled_for_http,
        tls_enabled_for_grpc=tls_enabled_for_grpc,
        tls_verify_client=tls_verify_client,
        allowed_origins=allowed_origins,
    )

    if sys.platform.startswith("win"):
        msg = codecs.encode(msg, "ascii", errors="ignore").decode("ascii").strip()
    scaffolder_config = ScaffolderConfig(
        db=factory,
        tracing_fixture_names=tracing_fixture_names,
        force_fixture_ingestion=force_fixture_ingestion,
        scaffold_datasets=scaffold_datasets,
        phoenix_url=root_path,
    )
    email_sender: Optional[EmailSender] = None
    if mail_sever := get_env_smtp_hostname():
        assert (mail_username := get_env_smtp_username()), "SMTP username is required"
        assert (mail_password := get_env_smtp_password()), "SMTP password is required"
        assert (sender_email := get_env_smtp_mail_from()), "SMTP mail_from is required"
        email_sender = SimpleEmailSender(
            smtp_server=mail_sever,
            smtp_port=get_env_smtp_port(),
            username=mail_username,
            password=mail_password,
            sender_email=sender_email,
            connection_method="STARTTLS",
            validate_certs=get_env_smtp_validate_certs(),
        )

    app = create_app(
        db=factory,
        export_path=export_path,
        model=model,
        authentication_enabled=auth_settings.enable_auth,
        basic_auth_disabled=auth_settings.disable_basic_auth,
        umap_params=umap_params,
        corpus=corpus_model,
        debug=args.debug,
        dev=args.dev,
        serve_ui=not args.no_ui,
        read_only=read_only,
        enable_prometheus=enable_prometheus,
        initial_spans=fixture_spans,
        initial_evaluations=fixture_evals,
        startup_callbacks=[lambda: print(msg)],
        shutdown_callbacks=instrumentation_cleanups,
        secret=auth_settings.phoenix_secret,
        password_reset_token_expiry=get_env_password_reset_token_expiry(),
        access_token_expiry=get_env_access_token_expiry(),
        refresh_token_expiry=get_env_refresh_token_expiry(),
        scaffolder_config=scaffolder_config,
        email_sender=email_sender,
        oauth2_client_configs=get_env_oauth2_settings(),
        allowed_origins=allowed_origins,
        management_url=management_url,
    )

    # Configure server with TLS if enabled
    server_config = Config(
        app=app,
        host=host,  # type: ignore[arg-type]
        port=port,
        root_path=host_root_path,
        log_level=Settings.logging_level,
    )

    if tls_enabled_for_http:
        assert tls_config
        # Configure SSL context with certificate and key
        server_config.ssl_keyfile = str(tls_config.key_file)
        server_config.ssl_keyfile_password = tls_config.key_file_password
        server_config.ssl_certfile = str(tls_config.cert_file)

        # If CA file is provided and client verification is enabled
        if isinstance(tls_config, TLSConfigVerifyClient):
            server_config.ssl_ca_certs = str(tls_config.ca_file)
            server_config.ssl_cert_reqs = CERT_REQUIRED

    server = Server(config=server_config)
    Thread(target=_write_pid_file_when_ready, args=(server,), daemon=True).start()

    try:
        server.run()
    except KeyboardInterrupt:
        pass  # don't bother the user with a stack trace on Ctrl-C


def initialize_settings() -> None:
    """Initialize the settings from environment variables."""
    Settings.logging_mode = get_env_logging_mode()
    Settings.logging_level = get_env_logging_level()
    Settings.db_logging_level = get_env_db_logging_level()
    Settings.log_migrations = get_env_log_migrations()
    Settings.disable_migrations = get_env_disable_migrations()
    Settings.fullstory_org = get_env_fullstory_org()


if __name__ == "__main__":
    main()
