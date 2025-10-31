# ruff: noqa: E501
"""Comprehensive Helm chart testing with async concurrency and composable validators"""

import asyncio
import asyncio.subprocess
import atexit
import shlex
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Optional, Protocol

import yaml

# ANSI colors
RED = "\033[31m"
GREEN = "\033[32m"
BLUE = "\033[34m"
YELLOW = "\033[33m"
NC = "\033[0m"

# Concurrency limit for parallel test execution
MAX_CONCURRENT_TESTS = 8


# ============================================================================
# Type Definitions & Protocols
# ============================================================================


@dataclass
class TestResult:
    """Result of a single Helm test execution."""

    name: str
    passed: bool
    error: Optional[str] = None


@dataclass
class TestCase:
    """Definition of a Helm test case."""

    name: str
    flags: str
    validator: Optional["Validator"]


class Validator(Protocol):
    """Protocol for validator functions."""

    def __call__(self, resources: list[dict[str, Any]]) -> bool:
        """Validate rendered Helm output.

        Args:
            resources: Pre-parsed Kubernetes resources

        Returns:
            True if validation passes, False otherwise
        """
        ...


# ============================================================================
# Validator Combinators
# ============================================================================


def all_of(*validators: Validator) -> Validator:
    """Combine validators with AND logic.

    Example:
        all_of(has_deployment, has_service, has_ingress)
    """

    def combined(resources: list[dict[str, Any]]) -> bool:
        return all(v(resources) for v in validators)

    return combined


def any_of(*validators: Validator) -> Validator:
    """Combine validators with OR logic."""

    def combined(resources: list[dict[str, Any]]) -> bool:
        return any(v(resources) for v in validators)

    return combined


def not_(validator: Validator) -> Validator:
    """Negate a validator."""

    def negated(resources: list[dict[str, Any]]) -> bool:
        return not validator(resources)

    return negated


# ============================================================================
# YAML Parsing Utilities
# ============================================================================


def load_k8s_resources(content: str) -> list[dict[str, Any]]:
    """Load all Kubernetes resources from YAML content."""
    return [doc for doc in yaml.safe_load_all(content) if doc]


def iter_resources_by_kind(resources: list[dict[str, Any]], kind: str) -> Iterator[dict[str, Any]]:
    """Iterate over resources of a specific kind."""
    return (r for r in resources if r.get("kind") == kind)


def find_resource(
    resources: list[dict[str, Any]], kind: str, name_contains: str = ""
) -> Optional[dict[str, Any]]:
    """Find a single resource by kind and optional name filter."""
    for resource in iter_resources_by_kind(resources, kind):
        if not name_contains or name_contains in resource.get("metadata", {}).get("name", ""):
            return resource
    return None


# ============================================================================
# Base Validators
# ============================================================================


class ResourceValidators:
    """Factory for resource existence validators."""

    @staticmethod
    def has_kind(kind: str, name_contains: str = "") -> Validator:
        """Create a validator that checks if a resource kind exists."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            return find_resource(resources, kind, name_contains) is not None

        validator.__name__ = f"has_{kind.lower()}_resource"
        return validator

    @staticmethod
    def count_kind(kind: str, expected_count: int) -> Validator:
        """Create a validator that checks resource count."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            actual = len(list(iter_resources_by_kind(resources, kind)))
            return actual == expected_count

        validator.__name__ = f"has_{expected_count}_{kind.lower()}_resources"
        return validator


# Convenience validators
has_deployment = ResourceValidators.has_kind("Deployment")
has_service = ResourceValidators.has_kind("Service")
has_ingress = ResourceValidators.has_kind("Ingress")
has_pvc = ResourceValidators.has_kind("PersistentVolumeClaim")
has_hpa = ResourceValidators.has_kind("HorizontalPodAutoscaler")
has_service_account = ResourceValidators.has_kind("ServiceAccount")
has_statefulset = ResourceValidators.has_kind("StatefulSet")

# Negative validators
no_ingress = not_(has_ingress)
no_postgresql = not_(ResourceValidators.has_kind("StatefulSet", "postgresql"))

# Composite validators
minimum_resources = all_of(has_deployment, has_service)


# ============================================================================
# Helper Functions for Validators
# ============================================================================


def get_deployment_containers(resources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract containers from Deployment spec, or empty list if not found."""
    deployment = find_resource(resources, "Deployment")
    if not deployment:
        return []
    return deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])


def find_env_in_containers(
    containers: list[dict[str, Any]], env_name: str
) -> Optional[dict[str, Any]]:
    """Find an environment variable by name across all containers."""
    for container in containers:
        for env in container.get("env", []):
            if env.get("name") == env_name:
                return env
    return None


def check_resource_spec(
    containers: list[dict[str, Any]], spec_type: str, cpu: str, memory: str
) -> bool:
    """Check if any container has the specified resource limits or requests."""
    for container in containers:
        spec = container.get("resources", {}).get(spec_type, {})
        cpu_match = str(spec.get("cpu", "")) == cpu
        memory_match = spec.get("memory") == memory
        if cpu_match and memory_match:
            return True
    return False


# ============================================================================
# Specific Field Validators
# ============================================================================


class DeploymentValidators:
    """Validators specific to Deployment resources."""

    @staticmethod
    def replicas(count: int) -> Validator:
        """Validate replica count in Deployment."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False
            return deployment.get("spec", {}).get("replicas") == count

        return validator

    @staticmethod
    def resource_limits(cpu: str, memory: str) -> Validator:
        """Validate container resource limits."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)
            return check_resource_spec(containers, "limits", cpu, memory)

        return validator

    @staticmethod
    def resource_requests(cpu: str, memory: str) -> Validator:
        """Validate container resource requests."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)
            return check_resource_spec(containers, "requests", cpu, memory)

        return validator

    @staticmethod
    def env_var(name: str, value: str) -> Validator:
        """Validate environment variable value."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)
            env = find_env_in_containers(containers, name)
            return env is not None and env.get("value") == value

        return validator

    @staticmethod
    def env_from_secret(env_name: str, secret_name: str) -> Validator:
        """Validate environment variable from secret."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)
            env = find_env_in_containers(containers, env_name)
            if env is None or "valueFrom" not in env:
                return False
            return env["valueFrom"].get("secretKeyRef", {}).get("name") == secret_name

        return validator

    @staticmethod
    def env_from_configmap(env_name: str, configmap_name: str) -> Validator:
        """Validate environment variable from configmap."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)
            env = find_env_in_containers(containers, env_name)
            if env is None or "valueFrom" not in env:
                return False
            return env["valueFrom"].get("configMapKeyRef", {}).get("name") == configmap_name

        return validator

    @staticmethod
    def security_context_user(user_id: int) -> Validator:
        """Validate security context runAsUser."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            security_context = (
                deployment.get("spec", {})
                .get("template", {})
                .get("spec", {})
                .get("securityContext", {})
            )
            return security_context.get("runAsUser") == user_id

        return validator

    @staticmethod
    def prometheus_annotations() -> Validator:
        """Validate Prometheus scraping annotations."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            annotations = (
                deployment.get("spec", {})
                .get("template", {})
                .get("metadata", {})
                .get("annotations", {})
            )
            return (
                annotations.get("prometheus.io/scrape") == "true"
                and "prometheus.io/port" in annotations
            )

        return validator

    @staticmethod
    def working_dir(expected_dir: str) -> Validator:
        """Validate PHOENIX_WORKING_DIR environment variable."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            # First check direct env vars in containers
            containers = get_deployment_containers(resources)
            env = find_env_in_containers(containers, "PHOENIX_WORKING_DIR")
            if env is not None and env.get("value") == expected_dir:
                return True

            # Check ConfigMaps referenced in envFrom
            for container in containers:
                for env_from in container.get("envFrom", []):
                    config_map_ref = env_from.get("configMapRef", {})
                    config_map_name = config_map_ref.get("name")
                    if config_map_name:
                        # Find the ConfigMap resource
                        config_map = find_resource(resources, "ConfigMap", config_map_name)
                        if config_map:
                            data = config_map.get("data", {})
                            if data.get("PHOENIX_WORKING_DIR") == expected_dir:
                                return True

            return False

        return validator


class IngressValidators:
    """Validators specific to Ingress resources."""

    @staticmethod
    def host(expected_host: str) -> Validator:
        """Validate Ingress host."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            ingress = find_resource(resources, "Ingress")
            if not ingress:
                return False

            rules = ingress.get("spec", {}).get("rules", [])
            return any(rule.get("host") == expected_host for rule in rules)

        return validator

    @staticmethod
    def has_tls() -> Validator:
        """Validate Ingress has TLS configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            ingress = find_resource(resources, "Ingress")
            if not ingress:
                return False

            tls = ingress.get("spec", {}).get("tls")
            return tls is not None and len(tls) > 0

        return validator

    @staticmethod
    def ingress_class_name(expected_class: str) -> Validator:
        """Validate Ingress className."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            ingress = find_resource(resources, "Ingress")
            if not ingress:
                return False

            return ingress.get("spec", {}).get("ingressClassName") == expected_class

        return validator


class ServiceValidators:
    """Validators specific to Service resources."""

    @staticmethod
    def service_type(expected_type: str) -> Validator:
        """Validate Service type."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            # Find main service (not postgresql)
            for service in iter_resources_by_kind(resources, "Service"):
                if "postgresql" not in service.get("metadata", {}).get("name", ""):
                    return service.get("spec", {}).get("type") == expected_type
            return False

        return validator


class StorageValidators:
    """Validators specific to storage resources."""

    @staticmethod
    def pvc_size(expected_size: str) -> Validator:
        """Validate PVC storage size."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            pvc = find_resource(resources, "PersistentVolumeClaim")
            if not pvc:
                return False

            storage = pvc.get("spec", {}).get("resources", {}).get("requests", {}).get("storage")
            return storage == expected_size

        return validator

    @staticmethod
    def storage_class_name(expected_class: str) -> Validator:
        """Validate PVC storageClassName (use empty string for dynamic provisioning)."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            pvc = find_resource(resources, "PersistentVolumeClaim")
            if not pvc:
                return False

            storage_class = pvc.get("spec", {}).get("storageClassName")
            return storage_class == expected_class

        return validator


class HPAValidators:
    """Validators specific to HorizontalPodAutoscaler resources."""

    @staticmethod
    def replica_range(min_replicas: int, max_replicas: int) -> Validator:
        """Validate HPA min/max replicas."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            hpa = find_resource(resources, "HorizontalPodAutoscaler")
            if not hpa:
                return False

            spec = hpa.get("spec", {})
            return (
                spec.get("minReplicas") == min_replicas and spec.get("maxReplicas") == max_replicas
            )

        return validator


class PostgreSQLValidators:
    """Validators specific to PostgreSQL StatefulSet."""

    @staticmethod
    def is_enabled() -> Validator:
        """Validate PostgreSQL StatefulSet is present."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            statefulset = find_resource(resources, "StatefulSet", "postgresql")
            return statefulset is not None

        return validator

    @staticmethod
    def is_disabled() -> Validator:
        """Validate SQLite is configured (Deployment without PostgreSQL)."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            has_deployment = find_resource(resources, "Deployment") is not None
            has_postgresql = find_resource(resources, "StatefulSet", "postgresql") is not None
            return has_deployment and not has_postgresql

        return validator

    @staticmethod
    def external_config(host: str, port: str, user: str, db: str) -> Validator:
        """Validate external PostgreSQL configuration via explicit settings."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return (
                data.get("PHOENIX_POSTGRES_HOST") == host
                and data.get("PHOENIX_POSTGRES_PORT") == port
                and data.get("PHOENIX_POSTGRES_USER") == user
                and data.get("PHOENIX_POSTGRES_DB") == db
            )

        return validator


class ServiceAccountValidators:
    """Validators specific to ServiceAccount resources."""

    @staticmethod
    def name(expected_name: str) -> Validator:
        """Validate ServiceAccount name."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            sa = find_resource(resources, "ServiceAccount")
            if not sa:
                return False
            return sa.get("metadata", {}).get("name") == expected_name

        return validator

    @staticmethod
    def has_image_pull_secret(secret_name: str) -> Validator:
        """Validate ServiceAccount has imagePullSecret."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            sa = find_resource(resources, "ServiceAccount")
            if not sa:
                return False

            pull_secrets = sa.get("imagePullSecrets", [])
            return any(s.get("name") == secret_name for s in pull_secrets)

        return validator


class OAuth2Validators:
    """Validators specific to OAuth2/OIDC configuration."""

    @staticmethod
    def provider_optional_fields(
        provider: str,
        display_name: Optional[str] = None,
        allow_sign_up: Optional[bool] = None,
        auto_login: Optional[bool] = None,
    ) -> Validator:
        """Validate OAuth2 provider optional configuration fields."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            provider_upper = provider.upper()

            if display_name is not None:
                if data.get(f"PHOENIX_OAUTH2_{provider_upper}_DISPLAY_NAME") != display_name:
                    return False

            if allow_sign_up is not None:
                if (
                    data.get(f"PHOENIX_OAUTH2_{provider_upper}_ALLOW_SIGN_UP")
                    != str(allow_sign_up).lower()
                ):
                    return False

            if auto_login is not None:
                if (
                    data.get(f"PHOENIX_OAUTH2_{provider_upper}_AUTO_LOGIN")
                    != str(auto_login).lower()
                ):
                    return False

            return True

        return validator

    @staticmethod
    def provider_pkce(provider: str, use_pkce: bool) -> Validator:
        """Validate OAuth2 PKCE configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            provider_upper = provider.upper()
            env_key = f"PHOENIX_OAUTH2_{provider_upper}_USE_PKCE"

            return data.get(env_key) == str(use_pkce).lower()

        return validator

    @staticmethod
    def provider_token_endpoint_auth_method(provider: str, method: str) -> Validator:
        """Validate OAuth2 token endpoint authentication method."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            provider_upper = provider.upper()
            env_key = f"PHOENIX_OAUTH2_{provider_upper}_TOKEN_ENDPOINT_AUTH_METHOD"

            return data.get(env_key) == method

        return validator

    @staticmethod
    def provider_scopes(provider: str, scopes: str) -> Validator:
        """Validate OAuth2 additional scopes configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            provider_upper = provider.upper()
            env_key = f"PHOENIX_OAUTH2_{provider_upper}_SCOPES"

            return data.get(env_key) == scopes

        return validator

    @staticmethod
    def provider_groups_config(
        provider: str, groups_attribute_path: str, allowed_groups: list[str]
    ) -> Validator:
        """Validate OAuth2 group-based access control configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            provider_upper = provider.upper()

            path_key = f"PHOENIX_OAUTH2_{provider_upper}_GROUPS_ATTRIBUTE_PATH"
            groups_key = f"PHOENIX_OAUTH2_{provider_upper}_ALLOWED_GROUPS"

            path_match = data.get(path_key) == groups_attribute_path
            groups_match = data.get(groups_key) == ",".join(allowed_groups)

            return path_match and groups_match

        return validator

    @staticmethod
    def provider_comprehensive(
        provider: str,
        client_id: str,
        oidc_config_url: str,
        has_client_secret: bool = True,
        display_name: Optional[str] = None,
        allow_sign_up: Optional[bool] = None,
        auto_login: Optional[bool] = None,
        use_pkce: Optional[bool] = None,
        token_endpoint_auth_method: Optional[str] = None,
        scopes: Optional[str] = None,
        groups_attribute_path: Optional[str] = None,
        allowed_groups: Optional[list[str]] = None,
    ) -> Validator:
        """Comprehensive validator for all OAuth2 provider configuration fields."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            provider_upper = provider.upper()

            # Required fields in ConfigMap
            if data.get(f"PHOENIX_OAUTH2_{provider_upper}_CLIENT_ID") != client_id:
                return False
            if data.get(f"PHOENIX_OAUTH2_{provider_upper}_OIDC_CONFIG_URL") != oidc_config_url:
                return False

            # Check client secret in Secret (must be phoenix-secret, not postgresql secret)
            if has_client_secret:
                secret = find_resource(resources, "Secret", "phoenix-secret")
                if not secret:
                    return False
                secret_key = f"PHOENIX_OAUTH2_{provider_upper}_CLIENT_SECRET"
                if secret_key not in secret.get("data", {}):
                    return False

            # Optional fields - only check if explicitly set
            if display_name is not None:
                actual_display_name = data.get(f"PHOENIX_OAUTH2_{provider_upper}_DISPLAY_NAME")
                if actual_display_name != display_name:
                    return False

            if allow_sign_up is not None:
                actual_allow = data.get(f"PHOENIX_OAUTH2_{provider_upper}_ALLOW_SIGN_UP")
                if actual_allow != str(allow_sign_up).lower():
                    return False

            if auto_login is not None:
                actual_auto = data.get(f"PHOENIX_OAUTH2_{provider_upper}_AUTO_LOGIN")
                if actual_auto != str(auto_login).lower():
                    return False

            if use_pkce is not None:
                actual_pkce = data.get(f"PHOENIX_OAUTH2_{provider_upper}_USE_PKCE")
                if actual_pkce != str(use_pkce).lower():
                    return False

            if token_endpoint_auth_method is not None:
                actual_method = data.get(
                    f"PHOENIX_OAUTH2_{provider_upper}_TOKEN_ENDPOINT_AUTH_METHOD"
                )
                if actual_method != token_endpoint_auth_method:
                    return False

            if scopes is not None:
                actual_scopes = data.get(f"PHOENIX_OAUTH2_{provider_upper}_SCOPES")
                if actual_scopes != scopes:
                    return False

            if groups_attribute_path is not None:
                actual_path = data.get(f"PHOENIX_OAUTH2_{provider_upper}_GROUPS_ATTRIBUTE_PATH")
                if actual_path != groups_attribute_path:
                    return False

            if allowed_groups is not None:
                actual_groups = data.get(f"PHOENIX_OAUTH2_{provider_upper}_ALLOWED_GROUPS")
                if actual_groups != ",".join(allowed_groups):
                    return False

            return True

        return validator


class SMTPValidators:
    """Validators specific to SMTP configuration."""

    @staticmethod
    def smtp_config(hostname: str, port: str, username: str) -> Validator:
        """Validate SMTP configuration in ConfigMap."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return (
                data.get("PHOENIX_SMTP_HOSTNAME") == hostname
                and data.get("PHOENIX_SMTP_PORT") == port
                and data.get("PHOENIX_SMTP_USERNAME") == username
            )

        return validator

    @staticmethod
    def smtp_mail_from(mail_from: str) -> Validator:
        """Validate SMTP mail from address."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return data.get("PHOENIX_SMTP_MAIL_FROM") == mail_from

        return validator


class TLSValidators:
    """Validators specific to TLS/SSL configuration."""

    @staticmethod
    def tls_enabled(http: bool = True, grpc: bool = False) -> Validator:
        """Validate TLS enabled settings."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            http_match = data.get("PHOENIX_TLS_ENABLED_FOR_HTTP") == str(http).lower()
            grpc_match = data.get("PHOENIX_TLS_ENABLED_FOR_GRPC") == str(grpc).lower()
            return http_match and grpc_match

        return validator

    @staticmethod
    def tls_files_configured() -> Validator:
        """Validate TLS certificate and key files are set."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return (
                "PHOENIX_TLS_CERT_FILE" in data
                and "PHOENIX_TLS_KEY_FILE" in data
                and data["PHOENIX_TLS_CERT_FILE"] != ""
                and data["PHOENIX_TLS_KEY_FILE"] != ""
            )

        return validator


class LoggingValidators:
    """Validators specific to logging configuration."""

    @staticmethod
    def logging_config(mode: str, level: str, db_level: str) -> Validator:
        """Validate logging configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return (
                data.get("PHOENIX_LOGGING_MODE") == mode
                and data.get("PHOENIX_LOGGING_LEVEL") == level
                and data.get("PHOENIX_DB_LOGGING_LEVEL") == db_level
            )

        return validator

    @staticmethod
    def log_migrations(enabled: bool) -> Validator:
        """Validate migration logging setting."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return data.get("PHOENIX_LOG_MIGRATIONS") == str(enabled).lower()

        return validator


class InstrumentationValidators:
    """Validators specific to instrumentation/OTLP configuration."""

    @staticmethod
    def otlp_endpoint(grpc_endpoint: str = "", http_endpoint: str = "") -> Validator:
        """Validate OTLP collector endpoints."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            grpc_match = True
            http_match = True

            if grpc_endpoint:
                grpc_match = (
                    data.get("PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT")
                    == grpc_endpoint
                )

            if http_endpoint:
                http_match = (
                    data.get("PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT")
                    == http_endpoint
                )

            return grpc_match and http_match

        return validator


class ImageValidators:
    """Validators specific to container image configuration."""

    @staticmethod
    def image_config(registry: str, repository: str, tag: str) -> Validator:
        """Validate container image configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            containers = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            )
            if not containers:
                return False

            image = containers[0].get("image", "")
            expected = f"{registry}/{repository}:{tag}"
            return image == expected

        return validator

    @staticmethod
    def pull_policy(policy: str) -> Validator:
        """Validate image pull policy."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            containers = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            )
            if not containers:
                return False

            return containers[0].get("imagePullPolicy") == policy

        return validator


class HealthCheckValidators:
    """Validators specific to health check probes."""

    @staticmethod
    def startup_probe_enabled(enabled: bool) -> Validator:
        """Validate startup probe is enabled/disabled."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            containers = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            )
            if not containers:
                return False

            has_probe = "startupProbe" in containers[0]
            return has_probe == enabled

        return validator

    @staticmethod
    def probe_timing(probe_type: str, initial_delay: int, period: int) -> Validator:
        """Validate probe timing configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            containers = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            )
            if not containers:
                return False

            probe = containers[0].get(f"{probe_type}Probe")
            if not probe:
                return False

            return (
                probe.get("initialDelaySeconds") == initial_delay
                and probe.get("periodSeconds") == period
            )

        return validator


class DeploymentStrategyValidators:
    """Validators specific to deployment strategy."""

    @staticmethod
    def rolling_update(max_unavailable: str, max_surge: str) -> Validator:
        """Validate RollingUpdate strategy parameters."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            strategy = deployment.get("spec", {}).get("strategy", {})
            if strategy.get("type") != "RollingUpdate":
                return False

            rolling_update = strategy.get("rollingUpdate", {})
            actual_unavailable = str(rolling_update.get("maxUnavailable", ""))
            actual_surge = str(rolling_update.get("maxSurge", ""))
            return actual_unavailable == max_unavailable and actual_surge == max_surge

        return validator

    @staticmethod
    def strategy_type(strategy_type: str) -> Validator:
        """Validate deployment strategy type."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            return deployment.get("spec", {}).get("strategy", {}).get("type") == strategy_type

        return validator


class ServerConfigValidators:
    """Validators specific to server configuration."""

    @staticmethod
    def server_paths(host_root_path: str = "", root_url: str = "") -> Validator:
        """Validate server path configuration."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return (
                data.get("PHOENIX_HOST_ROOT_PATH") == host_root_path
                and data.get("PHOENIX_ROOT_URL") == root_url
            )

        return validator

    @staticmethod
    def allow_external_resources(allowed: bool) -> Validator:
        """Validate allowExternalResources setting."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            return data.get("PHOENIX_ALLOW_EXTERNAL_RESOURCES") == str(allowed).lower()

        return validator


class VolumeValidators:
    """Validators for extra volumes and volume mounts."""

    @staticmethod
    def has_extra_volume(volume_name: str) -> Validator:
        """Validate extra volume exists."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            volumes = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("volumes", [])
            )
            return any(v.get("name") == volume_name for v in volumes)

        return validator

    @staticmethod
    def has_volume_mount(mount_name: str, mount_path: str) -> Validator:
        """Validate volume mount exists."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            containers = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            )
            if not containers:
                return False

            mounts = containers[0].get("volumeMounts", [])
            for mount in mounts:
                if mount.get("name") == mount_name and mount.get("mountPath") == mount_path:
                    return True
            return False

        return validator

    @staticmethod
    def readonly_filesystem_volumes() -> Validator:
        """Validate readOnlyRootFilesystem has required emptyDir volumes."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            deployment = find_resource(resources, "Deployment")
            if not deployment:
                return False

            volumes = (
                deployment.get("spec", {}).get("template", {}).get("spec", {}).get("volumes", [])
            )
            volume_names = {v.get("name") for v in volumes}
            required = {"tmp-volume", "var-tmp-volume", "var-log-volume", "home-volume"}
            return required.issubset(volume_names)

        return validator


class SecretValidators:
    """Validators specific to Secret resources."""

    @staticmethod
    def has_key(key: str) -> Validator:
        """Validate that Secret contains a specific key in data."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            secret = find_resource(resources, "Secret", "phoenix-secret")
            if not secret:
                return False

            data = secret.get("data") or {}
            return key in data

        return validator

    @staticmethod
    def not_has_key(key: str) -> Validator:
        """Validate that Secret does NOT contain a specific key in data."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            secret = find_resource(resources, "Secret", "phoenix-secret")
            if not secret:
                return False

            data = secret.get("data") or {}
            return key not in data

        return validator


class ConfigMapValidators:
    """Validators specific to ConfigMap and envFrom behavior."""

    @staticmethod
    def has_env_from_configmap() -> Validator:
        """Validate that deployment uses envFrom to reference a ConfigMap."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)
            if not containers:
                return False

            for container in containers:
                env_from = container.get("envFrom", [])
                for ref in env_from:
                    if "configMapRef" in ref:
                        return True
            return False

        return validator

    @staticmethod
    def configmap_exists(name_contains: str = "") -> Validator:
        """Validate that a ConfigMap resource exists."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            return find_resource(resources, "ConfigMap", name_contains) is not None

        return validator

    @staticmethod
    def configmap_has_key(key: str, expected_value: Optional[str] = None) -> Validator:
        """Validate that ConfigMap contains a specific key with optional value check."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            config_map = find_resource(resources, "ConfigMap", "configmap")
            if not config_map:
                return False

            data = config_map.get("data", {})
            if key not in data:
                return False

            if expected_value is not None:
                return data[key] == expected_value

            return True

        return validator

    @staticmethod
    def env_from_references_configmap(configmap_name_contains: str) -> Validator:
        """Validate that envFrom references a ConfigMap with a specific name pattern."""

        def validator(resources: list[dict[str, Any]]) -> bool:
            containers = get_deployment_containers(resources)

            for container in containers:
                for env_from in container.get("envFrom", []):
                    config_map_ref = env_from.get("configMapRef", {})
                    ref_name = config_map_ref.get("name", "")
                    if configmap_name_contains in ref_name:
                        # Verify the ConfigMap actually exists
                        if find_resource(resources, "ConfigMap", configmap_name_contains):
                            return True
            return False

        return validator


# ============================================================================
# Test Runner
# ============================================================================


class HelmTester:
    """Manages Helm chart testing with parallel setup and validation."""

    def __init__(self, chart_dir: Path):
        self.chart_dir = chart_dir
        self.temp_dir: Optional[Path] = None
        self.results: list[TestResult] = []
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT_TESTS)

    def cleanup(self):
        """Clean up temporary directory"""
        if self.temp_dir and self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)

    async def check_prereqs(self) -> bool:
        """Check if required tools (helm) are installed."""
        if not shutil.which("helm"):
            print(f"{RED}✗{NC} helm not installed")
            return False
        return True

    async def _setup_repo(self) -> bool:
        """Add and update helm repositories (parallel operation)."""
        # Add helm repository (ignore errors if already exists)
        add_result = await asyncio.create_subprocess_exec(
            "helm",
            "repo",
            "add",
            "groundhog2k",
            "https://groundhog2k.github.io/helm-charts/",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await add_result.wait()

        # Update helm repositories
        update_result = await asyncio.create_subprocess_exec(
            "helm",
            "repo",
            "update",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await update_result.wait()
        return update_result.returncode == 0

    async def _build_dependencies(self) -> bool:
        """Build chart dependencies (parallel operation)."""
        result = await asyncio.create_subprocess_exec(
            "helm",
            "dependency",
            "build",
            str(self.chart_dir),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await result.wait()
        return result.returncode == 0

    async def setup(self) -> bool:
        """Set up testing environment (repo setup, then dependency build, then lint)."""
        self.temp_dir = Path(tempfile.mkdtemp())
        atexit.register(self.cleanup)

        # Run repo setup first, then dependency build (dependency build requires repo to be set up)
        repo_ok = await self._setup_repo()

        if not repo_ok:
            print(f"{RED}✗{NC} Helm repo update failed")
            return False

        dep_ok = await self._build_dependencies()

        if not dep_ok:
            print(f"{RED}✗{NC} Helm dependency build failed")
            return False

        # Lint the chart (must be after dependencies)
        result = await asyncio.create_subprocess_exec(
            "helm",
            "lint",
            str(self.chart_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await result.communicate()

        if result.returncode != 0:
            print(f"{RED}✗{NC} Helm lint failed")
            print(stdout.decode())
            return False

        return True

    async def _render_helm_template(self, flags: str) -> tuple[list[dict[str, Any]], Optional[str]]:
        """Render helm template.

        Returns:
            Tuple of (resources, error_message)
        """
        async with self.semaphore:
            cmd = ["helm", "template", "test-release", str(self.chart_dir)]
            if flags:
                cmd.extend(shlex.split(flags))

            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                return ([], stderr.decode())

            # Parse the resources
            resources = load_k8s_resources(stdout.decode())
            return (resources, None)

    async def run_test(self, test_case: TestCase) -> TestResult:
        """Run a single Helm template test."""
        if self.temp_dir is None:
            raise RuntimeError("setup() must be called before run_test()")

        # Render template
        resources, error = await self._render_helm_template(test_case.flags)

        if error:
            print(f"  {test_case.name}... {RED}✗{NC}")
            first_line = error.split("\n")[0][:100]
            print(f"    {first_line}")
            return TestResult(test_case.name, False, error)

        # Run validator if provided
        if test_case.validator:
            try:
                if not test_case.validator(resources):
                    print(f"  {test_case.name}... {RED}✗{NC}")
                    print("    Validation failed")
                    return TestResult(test_case.name, False, "Validation failed")
            except Exception as e:
                print(f"  {test_case.name}... {RED}✗{NC}")
                print(f"    {e}")
                return TestResult(test_case.name, False, str(e))

        return TestResult(test_case.name, True)

    async def run_all_tests(self, test_cases: list[TestCase]) -> list[TestResult]:
        """Run all Helm chart test scenarios in parallel."""
        tasks = [self.run_test(tc) for tc in test_cases]
        results = await asyncio.gather(*tasks)

        for result in results:
            if result.passed:
                print(f"  {result.name}... {GREEN}✓{NC}")

        self.results = results
        return results

    async def run(self, test_cases: list[TestCase]) -> int:
        """Main entry point for running all tests."""
        exit_code = 0

        try:
            if not await self.check_prereqs():
                return 1
            if not await self.setup():
                return 1

            await self.run_all_tests(test_cases)

            passed = [r for r in self.results if r.passed]
            failed = [r for r in self.results if not r.passed]

            # Results summary
            print(f"\n{GREEN}✓ {len(passed)}{NC}  {RED}✗ {len(failed)}{NC}")

            if failed:
                for r in failed:
                    print(f"  {RED}✗{NC} {r.name}")
                exit_code = 1

            self.cleanup()
            return exit_code
        except Exception as e:
            print(f"{RED}✗{NC} Unexpected error: {e}")
            self.cleanup()
            raise


# ============================================================================
# Test Suite Definition
# ============================================================================


def get_test_suite() -> list[TestCase]:
    """Define all test cases for the Helm chart."""
    return [
        # Database
        TestCase(
            "PostgreSQL enabled (default)",
            "--set postgresql.enabled=true",
            PostgreSQLValidators.is_enabled(),
        ),
        TestCase(
            "SQLite with persistence",
            "--set postgresql.enabled=false --set persistence.enabled=true",
            PostgreSQLValidators.is_disabled(),
        ),
        TestCase(
            "SQLite in-memory",
            "--set postgresql.enabled=false --set persistence.inMemory=true",
            all_of(no_postgresql, minimum_resources),
        ),
        TestCase(
            "External database (connection URL)",
            "--set postgresql.enabled=false --set database.url=postgresql://user:pass@external:5432/phoenix --set database.postgres.host=phoenix-postgresql",
            all_of(no_postgresql, minimum_resources),
        ),
        TestCase(
            "PostgreSQL with custom resources",
            "--set postgresql.enabled=true --set postgresql.primary.resources.limits.cpu=500m --set postgresql.primary.resources.limits.memory=1Gi",
            PostgreSQLValidators.is_enabled(),
        ),
        TestCase(
            "PostgreSQL with custom storage size",
            "--set postgresql.enabled=true --set postgresql.primary.persistence.size=20Gi",
            PostgreSQLValidators.is_enabled(),
        ),
        TestCase(
            "Database with retention policy",
            "--set postgresql.enabled=true --set database.dataRetentionDays=90",
            PostgreSQLValidators.is_enabled(),
        ),
        TestCase(
            "PostgreSQL with custom schema",
            "--set postgresql.enabled=true --set database.postgres.dbName=custom_phoenix --set database.postgres.user=custom_user",
            PostgreSQLValidators.is_enabled(),
        ),
        TestCase(
            "External PostgreSQL with explicit settings",
            "--set postgresql.enabled=false --set persistence.enabled=false --set database.postgres.host=external-pg.example.com --set database.postgres.port=5432 --set database.postgres.user=phoenix_user --set database.postgres.db=phoenix_db",
            all_of(
                no_postgresql,
                PostgreSQLValidators.external_config(
                    "external-pg.example.com", "5432", "phoenix_user", "phoenix_db"
                ),
            ),
        ),
        # Auth
        TestCase("Auth enabled (default)", "--set auth.enabled=true", minimum_resources),
        TestCase("Auth disabled", "--set auth.enabled=false", minimum_resources),
        TestCase(
            "OAuth2 with Google provider",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=test-id --set auth.oauth2.providers.google.client_secret=test-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration",
            minimum_resources,
        ),
        TestCase(
            "Multiple OAuth2 providers",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=google-id --set auth.oauth2.providers.google.client_secret=google-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration --set auth.oauth2.providers.github.client_id=github-id --set auth.oauth2.providers.github.client_secret=github-secret --set auth.oauth2.providers.github.oidc_config_url=https://token.actions.githubusercontent.com/.well-known/openid-configuration",
            minimum_resources,
        ),
        TestCase(
            "Custom token expiry settings",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=test-id --set auth.oauth2.providers.google.client_secret=test-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration --set auth.accessTokenExpireSeconds=7200 --set auth.refreshTokenExpireSeconds=604800",
            minimum_resources,
        ),
        TestCase(
            "OAuth2 with optional provider fields",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=test-id --set auth.oauth2.providers.google.client_secret=test-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration --set auth.oauth2.providers.google.display_name='Sign in with Google' --set auth.oauth2.providers.google.allow_sign_up=false --set auth.oauth2.providers.google.auto_login=true",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_GOOGLE_DISPLAY_NAME", "Sign in with Google"
                ),
                OAuth2Validators.provider_optional_fields(
                    "google",
                    display_name="Sign in with Google",
                    allow_sign_up=False,
                    auto_login=True,
                ),
            ),
        ),
        TestCase(
            "OAuth2 with PKCE enabled",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=test-id --set auth.oauth2.providers.google.client_secret=test-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration --set auth.oauth2.providers.google.use_pkce=true",
            all_of(
                ConfigMapValidators.configmap_has_key("PHOENIX_OAUTH2_GOOGLE_USE_PKCE", "true"),
                OAuth2Validators.provider_pkce("google", use_pkce=True),
            ),
        ),
        TestCase(
            "OAuth2 public client with PKCE (no client secret)",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.mobile.client_id=mobile-client-id --set auth.oauth2.providers.mobile.oidc_config_url=https://auth.example.com/.well-known/openid-configuration --set auth.oauth2.providers.mobile.token_endpoint_auth_method=none --set auth.oauth2.providers.mobile.use_pkce=true",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_MOBILE_CLIENT_ID", "mobile-client-id"
                ),
                OAuth2Validators.provider_token_endpoint_auth_method("mobile", "none"),
                OAuth2Validators.provider_pkce("mobile", use_pkce=True),
            ),
        ),
        TestCase(
            "OAuth2 with client_secret_post authentication",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.okta.client_id=okta-id --set auth.oauth2.providers.okta.client_secret=okta-secret --set auth.oauth2.providers.okta.oidc_config_url=https://okta.example.com/.well-known/openid-configuration --set auth.oauth2.providers.okta.token_endpoint_auth_method=client_secret_post",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_OKTA_TOKEN_ENDPOINT_AUTH_METHOD", "client_secret_post"
                ),
                OAuth2Validators.provider_token_endpoint_auth_method("okta", "client_secret_post"),
            ),
        ),
        TestCase(
            "OAuth2 with additional scopes",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.microsoft.client_id=ms-id --set auth.oauth2.providers.microsoft.client_secret=ms-secret --set auth.oauth2.providers.microsoft.oidc_config_url=https://login.microsoftonline.com/tenant/.well-known/openid-configuration --set auth.oauth2.providers.microsoft.scopes='offline_access User.Read'",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_MICROSOFT_SCOPES", "offline_access User.Read"
                ),
                OAuth2Validators.provider_scopes("microsoft", "offline_access User.Read"),
            ),
        ),
        TestCase(
            "OAuth2 with group-based access control",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.cognito.client_id=cognito-id --set auth.oauth2.providers.cognito.client_secret=cognito-secret --set auth.oauth2.providers.cognito.oidc_config_url=https://cognito-idp.us-east-1.amazonaws.com/.well-known/openid-configuration --set auth.oauth2.providers.cognito.groups_attribute_path='cognito:groups' --set auth.oauth2.providers.cognito.allowed_groups={Admins,PowerUsers}",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_COGNITO_GROUPS_ATTRIBUTE_PATH", "cognito:groups"
                ),
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_COGNITO_ALLOWED_GROUPS", "Admins,PowerUsers"
                ),
                OAuth2Validators.provider_groups_config(
                    "cognito", "cognito:groups", ["Admins", "PowerUsers"]
                ),
            ),
        ),
        TestCase(
            "OAuth2 with nested group path (Keycloak)",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.keycloak.client_id=keycloak-id --set auth.oauth2.providers.keycloak.client_secret=keycloak-secret --set auth.oauth2.providers.keycloak.oidc_config_url=https://keycloak.example.com/realms/phoenix/.well-known/openid-configuration --set auth.oauth2.providers.keycloak.groups_attribute_path='resource_access.phoenix.roles' --set auth.oauth2.providers.keycloak.allowed_groups={admin,developer,viewer}",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_KEYCLOAK_GROUPS_ATTRIBUTE_PATH", "resource_access.phoenix.roles"
                ),
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_KEYCLOAK_ALLOWED_GROUPS", "admin,developer,viewer"
                ),
                OAuth2Validators.provider_groups_config(
                    "keycloak", "resource_access.phoenix.roles", ["admin", "developer", "viewer"]
                ),
            ),
        ),
        TestCase(
            "OAuth2 comprehensive configuration",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.enterprise.client_id=enterprise-id --set auth.oauth2.providers.enterprise.client_secret=enterprise-secret --set auth.oauth2.providers.enterprise.oidc_config_url=https://sso.example.com/.well-known/openid-configuration --set auth.oauth2.providers.enterprise.display_name='Enterprise SSO' --set auth.oauth2.providers.enterprise.allow_sign_up=false --set auth.oauth2.providers.enterprise.auto_login=true --set auth.oauth2.providers.enterprise.use_pkce=true --set auth.oauth2.providers.enterprise.token_endpoint_auth_method=client_secret_post --set auth.oauth2.providers.enterprise.scopes='custom_scope' --set auth.oauth2.providers.enterprise.groups_attribute_path='groups' --set auth.oauth2.providers.enterprise.allowed_groups={engineering,ops}",
            OAuth2Validators.provider_comprehensive(
                provider="enterprise",
                client_id="enterprise-id",
                oidc_config_url="https://sso.example.com/.well-known/openid-configuration",
                has_client_secret=True,
                display_name="Enterprise SSO",
                allow_sign_up=False,
                auto_login=True,
                use_pkce=True,
                token_endpoint_auth_method="client_secret_post",
                scopes="custom_scope",
                groups_attribute_path="groups",
                allowed_groups=["engineering", "ops"],
            ),
        ),
        TestCase(
            "Auth secrets with valueFrom (secretKeyRef)",
            "--set auth.secret[0].key=PHOENIX_SECRET --set auth.secret[0].valueFrom.secretKeyRef.name=ext-secret --set auth.secret[0].valueFrom.secretKeyRef.key=secret-key",
            DeploymentValidators.env_from_secret("PHOENIX_SECRET", "ext-secret"),
        ),
        TestCase(
            "Auth secrets with valueFrom (configMapKeyRef)",
            "--set auth.secret[0].key=PHOENIX_CONFIG --set auth.secret[0].valueFrom.configMapKeyRef.name=ext-config --set auth.secret[0].valueFrom.configMapKeyRef.key=config-key",
            DeploymentValidators.env_from_configmap("PHOENIX_CONFIG", "ext-config"),
        ),
        TestCase(
            "Multiple secrets with valueFrom",
            "--set auth.secret[0].key=PHOENIX_SECRET --set auth.secret[0].valueFrom.secretKeyRef.name=ext-secret --set auth.secret[0].valueFrom.secretKeyRef.key=secret-key --set auth.secret[1].key=PHOENIX_ADMIN_SECRET --set auth.secret[1].valueFrom.secretKeyRef.name=ext-secret --set auth.secret[1].valueFrom.secretKeyRef.key=admin-key",
            minimum_resources,
        ),
        TestCase(
            "Mix of direct value and valueFrom secrets",
            "--set auth.secret[0].key=PHOENIX_SECRET --set auth.secret[0].value=direct-secret-value --set auth.secret[1].key=PHOENIX_ADMIN_SECRET --set auth.secret[1].valueFrom.secretKeyRef.name=ext-secret --set auth.secret[1].valueFrom.secretKeyRef.key=admin-key",
            minimum_resources,
        ),
        TestCase(
            "Secret excludes valueFrom entries (only direct values in Secret.data)",
            "--set auth.secret[0].key=DIRECT_SECRET --set auth.secret[0].value=direct123 --set auth.secret[1].key=REF_SECRET --set auth.secret[1].valueFrom.secretKeyRef.name=ext-secret --set auth.secret[1].valueFrom.secretKeyRef.key=ext-key",
            all_of(
                # Secret.data should only have DIRECT_SECRET (not REF_SECRET)
                SecretValidators.has_key("DIRECT_SECRET"),
                SecretValidators.not_has_key("REF_SECRET"),
                # Deployment should have REF_SECRET env var with valueFrom
                DeploymentValidators.env_from_secret("REF_SECRET", "ext-secret"),
            ),
        ),
        TestCase(
            "Admin password with valueFrom (external reference)",
            "--set auth.secret[0].key=PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD --set auth.secret[0].valueFrom.secretKeyRef.name=admin-secret --set auth.secret[0].valueFrom.secretKeyRef.key=admin-pass",
            all_of(
                # Secret.data should NOT have admin password (uses external reference)
                SecretValidators.not_has_key("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD"),
                # Deployment should reference external admin-secret
                DeploymentValidators.env_from_secret(
                    "PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", "admin-secret"
                ),
            ),
        ),
        TestCase(
            "CORS and CSRF configuration",
            "--set 'auth.allowedOrigins={https://example.com,https://app.example.com}' --set 'auth.csrfTrustedOrigins={https://example.com}'",
            minimum_resources,
        ),
        # Ingress
        TestCase(
            "Ingress enabled (default)",
            "--set ingress.enabled=true --set ingress.host=phoenix.example.com",
            all_of(has_ingress, IngressValidators.host("phoenix.example.com")),
        ),
        TestCase("Ingress disabled", "--set ingress.enabled=false", no_ingress),
        TestCase(
            "Ingress with TLS enabled",
            "--set ingress.enabled=true --set ingress.host=phoenix.example.com --set ingress.tls.enabled=true --set ingress.tls.secretName=phoenix-tls",
            all_of(has_ingress, IngressValidators.has_tls()),
        ),
        TestCase(
            "Ingress with custom API path",
            "--set ingress.enabled=true --set ingress.host=phoenix.example.com --set ingress.apiPath=/custom-api",
            has_ingress,
        ),
        TestCase(
            "Ingress with custom annotations",
            "--set ingress.enabled=true --set ingress.host=phoenix.example.com --set 'ingress.annotations.nginx\\.ingress\\.kubernetes\\.io/ssl-redirect=\"true\"'",
            has_ingress,
        ),
        TestCase(
            "Ingress with exact path type",
            "--set ingress.enabled=true --set ingress.host=phoenix.example.com --set ingress.pathType=Exact",
            has_ingress,
        ),
        TestCase(
            "Ingress with custom className",
            "--set ingress.enabled=true --set ingress.host=phoenix.example.com --set ingress.className=nginx",
            all_of(has_ingress, IngressValidators.ingress_class_name("nginx")),
        ),
        # Resources
        TestCase(
            "Custom replica count (3 replicas)",
            "--set replicaCount=3",
            DeploymentValidators.replicas(3),
        ),
        TestCase(
            "Custom CPU and memory limits",
            "--set resources.limits.cpu=1 --set resources.limits.memory=2Gi --set resources.requests.cpu=500m --set resources.requests.memory=1Gi",
            all_of(
                DeploymentValidators.resource_limits("1", "2Gi"),
                DeploymentValidators.resource_requests("500m", "1Gi"),
            ),
        ),
        # TODO: HPA is not currently implemented in the helm chart
        TestCase(
            "HPA configuration",
            "--set autoscaling.enabled=true --set autoscaling.minReplicas=2 --set autoscaling.maxReplicas=10 --set autoscaling.targetCPUUtilizationPercentage=80",
            minimum_resources,  # Chart doesn't create HPA yet
        ),
        TestCase(
            "Node selector configuration",
            "--set nodeSelector.disktype=ssd",
            minimum_resources,
        ),
        TestCase(
            "Tolerations configuration",
            "--set tolerations[0].key=dedicated --set tolerations[0].operator=Equal --set tolerations[0].value=phoenix --set tolerations[0].effect=NoSchedule",
            minimum_resources,
        ),
        TestCase(
            "Affinity rules",
            "--set affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key=kubernetes.io/hostname --set affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].operator=In --set affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].values[0]=node-1",
            minimum_resources,
        ),
        # Service
        TestCase(
            "Service type NodePort (default)",
            "",
            ServiceValidators.service_type("NodePort"),
        ),
        TestCase(
            "Service type ClusterIP",
            "--set service.type=ClusterIP",
            ServiceValidators.service_type("ClusterIP"),
        ),
        TestCase(
            "Service type LoadBalancer",
            "--set service.type=LoadBalancer",
            ServiceValidators.service_type("LoadBalancer"),
        ),
        TestCase(
            "Custom server ports", "--set server.port=8080 --set service.port=80", has_service
        ),
        TestCase(
            "Service with custom annotations",
            "--set 'service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type=nlb'",
            has_service,
        ),
        # TODO: Prometheus annotations are not currently implemented in the helm chart
        TestCase(
            "Prometheus metrics enabled",
            "--set server.enablePrometheus=true",
            minimum_resources,  # Chart doesn't add prometheus annotations yet
        ),
        # Security
        # TODO: Pod security context settings are not currently respected by the helm chart
        TestCase(
            "Pod security context",
            "--set podSecurityContext.runAsUser=1000 --set podSecurityContext.runAsGroup=1000 --set podSecurityContext.fsGroup=1000",
            minimum_resources,  # Chart doesn't support custom security context yet
        ),
        TestCase(
            "Container security context",
            "--set securityContext.runAsNonRoot=true --set securityContext.runAsUser=1000",
            minimum_resources,
        ),
        TestCase(
            "Read-only root filesystem with emptyDir volumes",
            "--set securityContext.container.enabled=true --set securityContext.container.readOnlyRootFilesystem=true",
            all_of(minimum_resources, VolumeValidators.readonly_filesystem_volumes()),
        ),
        TestCase(
            "Drop all capabilities",
            "--set securityContext.capabilities.drop[0]=ALL",
            minimum_resources,
        ),
        TestCase(
            "Custom service account",
            "--set serviceAccount.create=true --set serviceAccount.name=phoenix-sa",
            ServiceAccountValidators.name("phoenix-sa"),
        ),
        TestCase(
            "ServiceAccount with imagePullSecrets",
            "--set serviceAccount.create=true --set serviceAccount.name=phoenix-sa --set 'serviceAccount.imagePullSecrets[0]=regcred'",
            all_of(
                ServiceAccountValidators.name("phoenix-sa"),
                ServiceAccountValidators.has_image_pull_secret("regcred"),
            ),
        ),
        # ConfigMap and envFrom
        TestCase(
            "ConfigMap exists and is referenced via envFrom",
            "",
            all_of(
                ConfigMapValidators.configmap_exists("configmap"),
                ConfigMapValidators.has_env_from_configmap(),
                ConfigMapValidators.env_from_references_configmap("configmap"),
            ),
        ),
        TestCase(
            "ConfigMap contains required auth keys",
            "--set auth.enabled=true",
            all_of(
                ConfigMapValidators.configmap_has_key("PHOENIX_ENABLE_AUTH", "true"),
                ConfigMapValidators.configmap_has_key("PHOENIX_ALLOWED_ORIGINS"),
            ),
        ),
        TestCase(
            "ConfigMap contains required server keys",
            "--set server.port=8080 --set server.grpcPort=4318",
            all_of(
                ConfigMapValidators.configmap_has_key("PHOENIX_PORT", "8080"),
                ConfigMapValidators.configmap_has_key("PHOENIX_GRPC_PORT", "4318"),
                ConfigMapValidators.configmap_has_key("PHOENIX_WORKING_DIR"),
            ),
        ),
        TestCase(
            "ConfigMap with OAuth2 provider configuration",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=test-client --set auth.oauth2.providers.google.client_secret=test-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration",
            ConfigMapValidators.configmap_has_key("PHOENIX_OAUTH2_GOOGLE_CLIENT_ID", "test-client"),
        ),
        TestCase(
            "ConfigMap with database retention policy",
            "--set database.defaultRetentionPolicyDays=90",
            ConfigMapValidators.configmap_has_key("PHOENIX_DEFAULT_RETENTION_POLICY_DAYS", "90"),
        ),
        # SMTP Configuration
        TestCase(
            "SMTP with full configuration",
            "--set smtp.hostname=smtp.example.com --set smtp.port=587 --set smtp.username=phoenix --set smtp.mailFrom=noreply@example.com",
            all_of(
                SMTPValidators.smtp_config("smtp.example.com", "587", "phoenix"),
                SMTPValidators.smtp_mail_from("noreply@example.com"),
            ),
        ),
        TestCase(
            "SMTP with TLS validation disabled",
            "--set smtp.hostname=smtp.internal.local --set smtp.validateCerts=false",
            ConfigMapValidators.configmap_has_key("PHOENIX_SMTP_VALIDATE_CERTS", "false"),
        ),
        # TLS Configuration
        TestCase(
            "TLS enabled for HTTP only",
            "--set tls.enabled=true --set tls.enabledForHttp=true --set tls.certFile=/certs/tls.crt --set tls.keyFile=/certs/tls.key",
            all_of(
                TLSValidators.tls_enabled(http=True, grpc=False),
                TLSValidators.tls_files_configured(),
            ),
        ),
        TestCase(
            "TLS enabled for both HTTP and gRPC",
            "--set tls.enabled=true --set tls.enabledForHttp=true --set tls.enabledForGrpc=true --set tls.certFile=/certs/tls.crt --set tls.keyFile=/certs/tls.key",
            TLSValidators.tls_enabled(http=True, grpc=True),
        ),
        TestCase(
            "TLS with mutual TLS (mTLS)",
            "--set tls.enabled=true --set tls.enabledForHttp=true --set tls.certFile=/certs/tls.crt --set tls.keyFile=/certs/tls.key --set tls.caFile=/certs/ca.crt --set tls.verifyClient=true",
            all_of(
                TLSValidators.tls_enabled(http=True, grpc=False),
                ConfigMapValidators.configmap_has_key("PHOENIX_TLS_VERIFY_CLIENT", "true"),
            ),
        ),
        # Logging Configuration
        TestCase(
            "Structured logging with debug level",
            "--set logging.mode=structured --set logging.level=debug --set logging.dbLevel=info",
            LoggingValidators.logging_config("structured", "debug", "info"),
        ),
        TestCase(
            "Production logging configuration",
            "--set logging.mode=default --set logging.level=warning --set logging.dbLevel=error --set logging.logMigrations=false",
            all_of(
                LoggingValidators.logging_config("default", "warning", "error"),
                LoggingValidators.log_migrations(False),
            ),
        ),
        # Instrumentation/OTLP
        TestCase(
            "OTLP gRPC collector endpoint",
            "--set instrumentation.otlpTraceCollectorGrpcEndpoint=http://otel-collector:4317",
            InstrumentationValidators.otlp_endpoint(grpc_endpoint="http://otel-collector:4317"),
        ),
        TestCase(
            "OTLP HTTP collector endpoint",
            "--set instrumentation.otlpTraceCollectorHttpEndpoint=http://otel-collector:4318/v1/traces",
            InstrumentationValidators.otlp_endpoint(
                http_endpoint="http://otel-collector:4318/v1/traces"
            ),
        ),
        TestCase(
            "OTLP dual collectors (gRPC + HTTP)",
            "--set instrumentation.otlpTraceCollectorGrpcEndpoint=http://otel-collector:4317 --set instrumentation.otlpTraceCollectorHttpEndpoint=http://otel-collector:4318/v1/traces",
            InstrumentationValidators.otlp_endpoint(
                grpc_endpoint="http://otel-collector:4317",
                http_endpoint="http://otel-collector:4318/v1/traces",
            ),
        ),
        # Image Configuration
        TestCase(
            "Custom image registry and tag",
            "--set image.registry=gcr.io --set image.repository=myproject/phoenix --set image.tag=v1.2.3",
            ImageValidators.image_config("gcr.io", "myproject/phoenix", "v1.2.3"),
        ),
        TestCase(
            "Image pull policy Always",
            "--set image.pullPolicy=Always",
            ImageValidators.pull_policy("Always"),
        ),
        TestCase(
            "Private registry configuration",
            "--set image.registry=registry.example.com --set image.repository=phoenix/phoenix --set image.tag=latest --set image.pullPolicy=IfNotPresent",
            all_of(
                ImageValidators.image_config("registry.example.com", "phoenix/phoenix", "latest"),
                ImageValidators.pull_policy("IfNotPresent"),
            ),
        ),
        # Health Checks
        TestCase(
            "Startup probe disabled",
            "--set healthChecks.startupProbe.enabled=false",
            HealthCheckValidators.startup_probe_enabled(False),
        ),
        TestCase(
            "Custom liveness probe timing",
            "--set healthChecks.livenessProbe.initialDelaySeconds=30 --set healthChecks.livenessProbe.periodSeconds=20",
            HealthCheckValidators.probe_timing("liveness", 30, 20),
        ),
        TestCase(
            "Custom readiness probe timing",
            "--set healthChecks.readinessProbe.initialDelaySeconds=15 --set healthChecks.readinessProbe.periodSeconds=10",
            HealthCheckValidators.probe_timing("readiness", 15, 10),
        ),
        TestCase(
            "Aggressive startup probe",
            "--set healthChecks.startupProbe.initialDelaySeconds=1 --set healthChecks.startupProbe.periodSeconds=2 --set healthChecks.startupProbe.failureThreshold=60",
            HealthCheckValidators.probe_timing("startup", 1, 2),
        ),
        # Deployment Strategy
        TestCase(
            "Conservative rolling update",
            "--set deployment.strategy.rollingUpdate.maxUnavailable=1 --set deployment.strategy.rollingUpdate.maxSurge=1",
            DeploymentStrategyValidators.rolling_update("1", "1"),
        ),
        TestCase(
            "Aggressive rolling update",
            "--set deployment.strategy.rollingUpdate.maxUnavailable=50% --set deployment.strategy.rollingUpdate.maxSurge=100%",
            DeploymentStrategyValidators.rolling_update("50%", "100%"),
        ),
        TestCase(
            "Default rolling update strategy",
            "",
            DeploymentStrategyValidators.strategy_type("RollingUpdate"),
        ),
        # Server Configuration
        TestCase(
            "Server with reverse proxy paths",
            "--set server.hostRootPath=/phoenix --set server.rootUrl=https://example.com/phoenix",
            ServerConfigValidators.server_paths("/phoenix", "https://example.com/phoenix"),
        ),
        TestCase(
            "Air-gapped deployment (no external resources)",
            "--set server.allowExternalResources=false",
            ServerConfigValidators.allow_external_resources(False),
        ),
        TestCase(
            "Server with custom host binding",
            "--set server.host=0.0.0.0",
            ConfigMapValidators.configmap_has_key("PHOENIX_HOST", "0.0.0.0"),
        ),
        # Extra Volumes and Mounts
        TestCase(
            "Extra ConfigMap volume",
            "--set 'extraVolumes[0].name=custom-config' --set 'extraVolumes[0].configMap.name=my-config' --set 'extraVolumeMounts[0].name=custom-config' --set 'extraVolumeMounts[0].mountPath=/etc/custom'",
            all_of(
                VolumeValidators.has_extra_volume("custom-config"),
                VolumeValidators.has_volume_mount("custom-config", "/etc/custom"),
            ),
        ),
        TestCase(
            "Extra emptyDir volume for cache",
            "--set 'extraVolumes[0].name=cache-volume' --set 'extraVolumes[0].emptyDir={}' --set 'extraVolumeMounts[0].name=cache-volume' --set 'extraVolumeMounts[0].mountPath=/app/cache'",
            all_of(
                VolumeValidators.has_extra_volume("cache-volume"),
                VolumeValidators.has_volume_mount("cache-volume", "/app/cache"),
            ),
        ),
        # Storage
        TestCase(
            "Persistence enabled with PVC",
            "--set postgresql.enabled=false --set persistence.enabled=true --set persistence.size=10Gi",
            all_of(has_pvc, StorageValidators.pvc_size("10Gi")),
        ),
        TestCase(
            "Custom storage class",
            "--set postgresql.enabled=false --set persistence.enabled=true --set persistence.storageClass=fast-ssd",
            all_of(has_pvc, StorageValidators.storage_class_name("fast-ssd")),
        ),
        TestCase(
            "PVC with dynamic provisioning (storageClass: -)",
            "--set postgresql.enabled=false --set persistence.enabled=true --set 'persistence.storageClass=-'",
            all_of(has_pvc, StorageValidators.storage_class_name("")),
        ),
        TestCase(
            "Custom working directory",
            "--set persistence.mountPath=/data/phoenix --set server.workingDir=/data/phoenix",
            DeploymentValidators.working_dir("/data/phoenix"),
        ),
        TestCase(
            "ReadWriteMany access mode",
            "--set postgresql.enabled=false --set persistence.enabled=true --set persistence.accessMode=ReadWriteMany",
            has_pvc,
        ),
        # Scenarios
        TestCase(
            "Dev environment: minimal setup",
            "--set postgresql.enabled=false --set persistence.inMemory=true --set ingress.enabled=false --set replicaCount=1",
            all_of(minimum_resources, no_ingress, DeploymentValidators.replicas(1)),
        ),
        TestCase(
            "Staging: PostgreSQL + Ingress",
            "--set postgresql.enabled=true --set replicaCount=1 --set resources.limits.cpu=500m --set resources.limits.memory=1Gi --set ingress.enabled=true --set ingress.host=staging.phoenix.example.com",
            all_of(
                PostgreSQLValidators.is_enabled(),
                has_ingress,
                DeploymentValidators.resource_limits("500m", "1Gi"),
            ),
        ),
        TestCase(
            "Production (AWS): External RDS + LoadBalancer",
            "--set postgresql.enabled=false --set database.url=postgresql://user:pass@rds.aws.com:5432/phoenix --set service.type=LoadBalancer --set replicaCount=3 --set autoscaling.enabled=true --set ingress.enabled=true --set ingress.tls.enabled=true --set server.enablePrometheus=true --set database.postgres.host=phoenix-postgresql",
            all_of(
                no_postgresql,
                ServiceValidators.service_type("LoadBalancer"),
                DeploymentValidators.replicas(3),
                has_ingress,
                IngressValidators.has_tls(),
            ),
        ),
        TestCase(
            "Production (GCP): Comprehensive secure setup",
            "--set postgresql.enabled=false --set database.url=postgresql://user:pass@cloudsql:5432/phoenix --set ingress.enabled=true --set ingress.host=phoenix.prod.example.com --set ingress.tls.enabled=true --set tls.enabled=true --set tls.enabledForHttp=true --set tls.enabledForGrpc=true --set tls.certFile=/certs/tls.crt --set tls.keyFile=/certs/tls.key --set logging.mode=structured --set logging.level=info --set instrumentation.otlpTraceCollectorGrpcEndpoint=http://otel:4317 --set smtp.hostname=smtp.sendgrid.net --set smtp.port=587 --set replicaCount=5 --set database.postgres.host=phoenix-postgresql",
            all_of(
                no_postgresql,
                has_ingress,
                IngressValidators.has_tls(),
                TLSValidators.tls_enabled(http=True, grpc=True),
                LoggingValidators.logging_config("structured", "info", "warning"),
                DeploymentValidators.replicas(5),
            ),
        ),
        TestCase(
            "Enterprise: OAuth2 + SMTP + OTLP + Custom Resources",
            "--set auth.oauth2.enabled=true --set auth.oauth2.providers.google.client_id=google-id --set auth.oauth2.providers.google.client_secret=google-secret --set auth.oauth2.providers.google.oidc_config_url=https://accounts.google.com/.well-known/openid-configuration --set smtp.hostname=smtp.office365.com --set smtp.port=587 --set smtp.username=phoenix@company.com --set instrumentation.otlpTraceCollectorGrpcEndpoint=http://jaeger:4317 --set resources.limits.cpu=2000m --set resources.limits.memory=4Gi --set server.hostRootPath=/observability/phoenix --set server.rootUrl=https://tools.company.com/observability/phoenix",
            all_of(
                ConfigMapValidators.configmap_has_key(
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_ID", "google-id"
                ),
                SMTPValidators.smtp_config("smtp.office365.com", "587", "phoenix@company.com"),
                InstrumentationValidators.otlp_endpoint(grpc_endpoint="http://jaeger:4317"),
                DeploymentValidators.resource_limits("2000m", "4Gi"),
                ServerConfigValidators.server_paths(
                    "/observability/phoenix", "https://tools.company.com/observability/phoenix"
                ),
            ),
        ),
        TestCase(
            "Air-gapped secure deployment",
            "--set server.allowExternalResources=false --set ingress.enabled=false --set service.type=ClusterIP --set image.registry=internal-registry.company.local --set image.repository=phoenix/phoenix --set image.tag=v12.6.0 --set logging.mode=structured --set logging.level=warning",
            all_of(
                ServerConfigValidators.allow_external_resources(False),
                no_ingress,
                ServiceValidators.service_type("ClusterIP"),
                ImageValidators.image_config(
                    "internal-registry.company.local", "phoenix/phoenix", "v12.6.0"
                ),
                LoggingValidators.logging_config("structured", "warning", "warning"),
            ),
        ),
    ]


# ============================================================================
# Main Entry Point
# ============================================================================


async def main():
    """Create and run the Helm tester."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    chart_dir = project_root / "helm"

    test_cases = get_test_suite()
    tester = HelmTester(chart_dir)
    return await tester.run(test_cases)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
