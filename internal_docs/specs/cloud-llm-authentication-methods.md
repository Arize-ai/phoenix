# Cloud LLM Authentication Methods

A comprehensive technical reference for authentication patterns when integrating with cloud-hosted Large Language Models (LLMs), specifically Azure OpenAI and AWS Bedrock.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Azure OpenAI Authentication](#azure-openai-authentication)
   - [Authentication Methods Overview](#azure-authentication-methods-overview)
   - [API Key Authentication](#azure-api-key-authentication)
   - [Azure AD Token Provider (Service Principal)](#azure-ad-token-provider-service-principal)
   - [DefaultAzureCredential (Default Credentials)](#defaultazurecredential-default-credentials)
   - [SDK Implementation Details](#azure-sdk-implementation-details)
3. [AWS Bedrock Authentication](#aws-bedrock-authentication)
   - [Authentication Methods Overview](#aws-authentication-methods-overview)
   - [Access Keys Authentication](#access-keys-authentication)
   - [Default Credential Chain](#aws-default-credential-chain)
   - [SDK Implementation Details](#aws-sdk-implementation-details)
4. [Phoenix Implementation](#phoenix-implementation)
   - [Data Model](#data-model)
   - [Client Factory Pattern](#client-factory-pattern)
5. [Production Readiness Assessment](#production-readiness-assessment)
6. [Future Considerations](#future-considerations)
7. [References](#references)

---

## Executive Summary

Phoenix supports three authentication methods for Azure OpenAI and two for AWS Bedrock:

| Provider | Auth Method | Use Case | Production Ready |
|----------|-------------|----------|------------------|
| **Azure OpenAI** | `api_key` | Simple deployments with API keys | ✅ |
| **Azure OpenAI** | `ad_token_provider` | Service principal with client secret | ✅ |
| **Azure OpenAI** | `default_credentials` | Managed Identity, Azure CLI, env vars | ✅ |
| **AWS Bedrock** | `access_keys` | Explicit IAM credentials | ✅ |
| **AWS Bedrock** | `default_credentials` | IAM roles, env vars, config files | ✅ |

These methods cover 80%+ of real-world deployment scenarios. Advanced patterns (user-assigned managed identity, cross-account assume-role) can be added based on customer demand.

---

## Azure OpenAI Authentication

### Azure Authentication Methods Overview

Azure OpenAI supports three primary authentication mechanisms, each suited for different deployment scenarios:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AZURE OPENAI AUTHENTICATION FLOW                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────────┐    │
│  │   API Key    │    │  Service         │    │  DefaultAzureCredential │    │
│  │              │    │  Principal       │    │                         │    │
│  └──────┬───────┘    └────────┬─────────┘    └────────────┬────────────┘    │
│         │                     │                           │                 │
│         ▼                     ▼                           ▼                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────────┐    │
│  │ api-key      │    │ Bearer token     │    │ Chained credential      │    │
│  │ header       │    │ from AAD         │    │ providers               │    │
│  └──────┬───────┘    └────────┬─────────┘    └────────────┬────────────┘    │
│         │                     │                           │                 │
│         └─────────────────────┴───────────────────────────┘                 │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │  Azure OpenAI       │                                  │
│                    │  Endpoint           │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Azure API Key Authentication

The simplest authentication method. Azure OpenAI resources can generate API keys from the Azure Portal.

**When to use:**
- Quick prototyping and development
- Simple deployments without Azure AD integration
- Scenarios where key rotation is manageable

**Environment Variables:**
- `AZURE_OPENAI_API_KEY` - The API key
- `AZURE_OPENAI_ENDPOINT` - The resource endpoint (e.g., `https://my-resource.openai.azure.com`)

**SDK Behavior:**

The OpenAI Python SDK's `AzureOpenAI` client checks for credentials in this order:

```python
# From openai-python src/openai/lib/azure.py lines 192-201
if api_key is None:
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")

if azure_ad_token is None:
    azure_ad_token = os.environ.get("AZURE_OPENAI_AD_TOKEN")

if api_key is None and azure_ad_token is None and azure_ad_token_provider is None:
    raise OpenAIError(
        "Missing credentials. Please pass one of `api_key`, `azure_ad_token`, "
        "`azure_ad_token_provider`, or the `AZURE_OPENAI_API_KEY` or "
        "`AZURE_OPENAI_AD_TOKEN` environment variables."
    )
```

> **Source:** [openai/openai-python `azure.py` L192-201](https://github.com/openai/openai-python/blob/722d3fffb82e9150a16da01e432b70d126ca5254/src/openai/lib/azure.py#L192-L201)

### Azure AD Token Provider (Service Principal)

For production workloads requiring Azure AD authentication with explicit service principal credentials.

**When to use:**
- Production deployments with service-to-service authentication
- CI/CD pipelines
- Scenarios requiring explicit credential management
- Multi-tenant applications

**Required Credentials:**
- `tenant_id` - Azure AD tenant ID
- `client_id` - Application (client) ID
- `client_secret` - Client secret value
- `scope` - OAuth scope (default: `https://cognitiveservices.azure.com/.default`)

**How it works:**

The `ClientSecretCredential` from `azure-identity` authenticates with Azure AD and returns tokens:

```python
# From azure-sdk-for-python azure/identity/_credentials/client_secret.py line 9
class ClientSecretCredential(ClientCredentialBase):
    """Authenticates as a service principal using a client secret."""
```

> **Source:** [Azure/azure-sdk-for-python `client_secret.py` L9](https://github.com/Azure/azure-sdk-for-python/blob/f7ef11846bd79d4cb36349b2d917a7b92f1fc03a/sdk/identity/azure-identity/azure/identity/_credentials/client_secret.py#L9)

The `get_bearer_token_provider` function wraps the credential to provide a callable that returns bearer tokens:

```python
# From azure-sdk-for-python azure/identity/_bearer_token_provider.py lines 17-46
def get_bearer_token_provider(credential: TokenProvider, *scopes: str) -> Callable[[], str]:
    """Returns a callable that provides a bearer token.

    It can be used for instance to write code like:

        from azure.identity import DefaultAzureCredential, get_bearer_token_provider

        credential = DefaultAzureCredential()
        bearer_token_provider = get_bearer_token_provider(
            credential, "https://cognitiveservices.azure.com/.default"
        )

        # Usage
        request.headers["Authorization"] = "Bearer " + bearer_token_provider()
    """
    policy = BearerTokenCredentialPolicy(credential, *scopes)

    def wrapper() -> str:
        request = _make_request()
        policy.on_request(request)
        return request.http_request.headers["Authorization"][len("Bearer ") :]

    return wrapper
```

> **Source:** [Azure/azure-sdk-for-python `_bearer_token_provider.py` L17-46](https://github.com/Azure/azure-sdk-for-python/blob/f7ef11846bd79d4cb36349b2d917a7b92f1fc03a/sdk/identity/azure-identity/azure/identity/_bearer_token_provider.py#L17-L46)

### DefaultAzureCredential (Default Credentials)

The recommended approach for production workloads that need to work across multiple environments without code changes.

**When to use:**
- Production deployments on Azure (VMs, App Service, AKS, Functions)
- Local development with Azure CLI authentication
- Kubernetes with Azure Workload Identity
- Scenarios requiring environment-agnostic code

**Credential Chain Order:**

`DefaultAzureCredential` tries these credential sources in order, stopping at the first successful one:

```python
# From azure-sdk-for-python azure/identity/_credentials/default.py lines 60-82
class DefaultAzureCredential(ChainedTokenCredential):
    """A credential capable of handling most Azure SDK authentication scenarios.

    The identity it uses depends on the environment. When an access token is needed,
    it requests one using these identities in turn, stopping when one provides a token:

    1. A service principal configured by environment variables.
       See EnvironmentCredential for more details.
    2. WorkloadIdentityCredential if environment variable configuration is set
       by the Azure workload identity webhook.
    3. An Azure managed identity. See ManagedIdentityCredential for more details.
    4. On Windows only: a user who has signed in with a Microsoft application,
       such as Visual Studio.
    5. The identity logged in to Visual Studio Code with the Azure Resources extension.
    6. The identity currently logged in to the Azure CLI.
    7. The identity currently logged in to Azure PowerShell.
    8. The identity currently logged in to the Azure Developer CLI.
    9. Brokered authentication (Windows WAM) if azure-identity-broker is installed.
    """
```

> **Source:** [Azure/azure-sdk-for-python `default.py` L60-82](https://github.com/Azure/azure-sdk-for-python/blob/f7ef11846bd79d4cb36349b2d917a7b92f1fc03a/sdk/identity/azure-identity/azure/identity/_credentials/default.py#L60-L82)

**Environment Variables for EnvironmentCredential:**

The first provider in the chain, `EnvironmentCredential`, checks for service principal credentials:

```python
# From azure-sdk-for-python azure/identity/_credentials/environment.py lines 24-48
class EnvironmentCredential:
    """A credential configured by environment variables.

    This credential is capable of authenticating as a service principal using
    a client secret or a certificate. Configuration is attempted in this order:

    Service principal with secret:
      - AZURE_TENANT_ID: ID of the service principal's tenant
      - AZURE_CLIENT_ID: the service principal's client ID
      - AZURE_CLIENT_SECRET: one of the service principal's client secrets
      - AZURE_AUTHORITY_HOST: authority of a Microsoft Entra endpoint

    Service principal with certificate:
      - AZURE_TENANT_ID: ID of the service principal's tenant
      - AZURE_CLIENT_ID: the service principal's client ID
      - AZURE_CLIENT_CERTIFICATE_PATH: path to a PEM or PKCS12 certificate file
      - AZURE_CLIENT_CERTIFICATE_PASSWORD: (optional) password of the certificate
      - AZURE_CLIENT_SEND_CERTIFICATE_CHAIN: (optional) send public certificate chain
    """
```

> **Source:** [Azure/azure-sdk-for-python `environment.py` L24-48](https://github.com/Azure/azure-sdk-for-python/blob/f7ef11846bd79d4cb36349b2d917a7b92f1fc03a/sdk/identity/azure-identity/azure/identity/_credentials/environment.py#L24-L48)

**Managed Identity:**

When running on Azure infrastructure, `ManagedIdentityCredential` automatically detects the hosting environment:

```python
# From azure-sdk-for-python azure/identity/_credentials/managed_identity.py lines 48-71
class ManagedIdentityCredential:
    """Authenticates with an Azure managed identity in any hosting environment
    which supports managed identities.

    This credential defaults to using a system-assigned identity. To configure
    a user-assigned identity, use one of the keyword arguments.

    :keyword str client_id: a user-assigned identity's client ID or, when using
        Pod Identity, the client ID of a Microsoft Entra app registration.
    :keyword identity_config: a mapping {parameter_name: value} specifying a
        user-assigned identity by its object or resource ID.
    """
```

> **Source:** [Azure/azure-sdk-for-python `managed_identity.py` L48-71](https://github.com/Azure/azure-sdk-for-python/blob/f7ef11846bd79d4cb36349b2d917a7b92f1fc03a/sdk/identity/azure-identity/azure/identity/_credentials/managed_identity.py#L48-L71)

### Azure SDK Implementation Details

**OpenAI Python SDK Azure Client:**

The `AzureOpenAI` client accepts three mutually exclusive authentication options:

```python
# From openai-python src/openai/lib/azure.py lines 151-171
def __init__(
    self,
    *,
    api_version: str | None = None,
    azure_endpoint: str | None = None,
    azure_deployment: str | None = None,
    api_key: str | Callable[[], str] | None = None,
    azure_ad_token: str | None = None,
    azure_ad_token_provider: AzureADTokenProvider | None = None,
    # ... other parameters
) -> None:
    """Construct a new synchronous azure openai client instance.

    This automatically infers the following arguments from their corresponding
    environment variables if they are not provided:
    - `api_key` from `AZURE_OPENAI_API_KEY`
    - `azure_ad_token` from `AZURE_OPENAI_AD_TOKEN`
    - `api_version` from `OPENAI_API_VERSION`
    - `azure_endpoint` from `AZURE_OPENAI_ENDPOINT`
    """
```

> **Source:** [openai/openai-python `azure.py` L151-171](https://github.com/openai/openai-python/blob/722d3fffb82e9150a16da01e432b70d126ca5254/src/openai/lib/azure.py#L151-L171)

**Key insight:** The `api_key` parameter accepts `Callable[[], str]`, which allows passing a token provider function. This is how Phoenix integrates `get_bearer_token_provider` with the OpenAI client.

---

## AWS Bedrock Authentication

### AWS Authentication Methods Overview

AWS uses a standardized credential provider chain across all SDKs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AWS CREDENTIAL PROVIDER CHAIN                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Priority Order (first match wins):                                         │
│                                                                             │
│  1. Explicit credentials passed to client/session                           │
│     └── aws_access_key_id, aws_secret_access_key, aws_session_token         │
│                                                                             │
│  2. Environment variables                                                   │
│     └── AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN         │
│                                                                             │
│  3. Shared credentials file (~/.aws/credentials)                            │
│     └── [default] or [profile_name] sections                                │
│                                                                             │
│  4. AWS config file (~/.aws/config)                                         │
│     └── [profile profile_name] sections                                     │
│                                                                             │
│  5. AssumeRole provider (if role_arn configured in profile)                 │
│     └── Cross-account access, federated identity                            │
│                                                                             │
│  6. Container credentials (ECS, EKS)                                        │
│     └── AWS_CONTAINER_CREDENTIALS_RELATIVE_URI                              │
│                                                                             │
│  7. Instance metadata service (EC2, Lambda)                                 │
│     └── IAM role attached to instance/function                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Access Keys Authentication

Explicit IAM credentials for scenarios requiring direct credential management.

**When to use:**
- CI/CD pipelines with IAM user credentials
- Cross-account access with STS temporary credentials
- Scenarios where IAM roles are not available
- Testing and development

**Required Credentials:**
- `aws_access_key_id` - IAM access key ID
- `aws_secret_access_key` - IAM secret access key
- `aws_session_token` - (Optional) Session token for temporary credentials

**SDK Behavior:**

The `EnvProvider` in botocore reads credentials from environment variables:

```python
# From botocore/credentials.py lines 1185-1194
class EnvProvider(CredentialProvider):
    METHOD = 'env'
    CANONICAL_NAME = 'Environment'
    ACCESS_KEY = 'AWS_ACCESS_KEY_ID'
    SECRET_KEY = 'AWS_SECRET_ACCESS_KEY'
    # The token can come from either of these env var.
    # AWS_SESSION_TOKEN is what other AWS SDKs have standardized on.
    TOKENS = ['AWS_SECURITY_TOKEN', 'AWS_SESSION_TOKEN']
    EXPIRY_TIME = 'AWS_CREDENTIAL_EXPIRATION'
    ACCOUNT_ID = 'AWS_ACCOUNT_ID'
```

> **Source:** [boto/botocore `credentials.py` L1185-1194](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/credentials.py#L1185-L1194)

### AWS Default Credential Chain

The recommended approach for production workloads that automatically discovers credentials from the environment.

**When to use:**
- EC2 instances with IAM roles
- Lambda functions
- ECS tasks with task roles
- EKS pods with IRSA (IAM Roles for Service Accounts)
- Local development with AWS CLI profiles

**Credential Chain Implementation:**

```python
# From botocore/credentials.py lines 113-152
env_provider = EnvProvider()
container_provider = ContainerProvider()
instance_metadata_provider = InstanceMetadataProvider(
    iam_role_fetcher=InstanceMetadataFetcher(
        timeout=metadata_timeout,
        num_attempts=num_attempts,
        user_agent=session.user_agent(),
        config=imds_config,
    )
)

profile_provider_builder = ProfileProviderBuilder(
    session, cache=cache, region_name=region_name
)
assume_role_provider = AssumeRoleProvider(
    load_config=lambda: session.full_config,
    client_creator=_get_client_creator(session, region_name),
    cache=cache,
    profile_name=profile_name,
    credential_sourcer=CanonicalNameCredentialSourcer(
        [env_provider, container_provider, instance_metadata_provider]
    ),
    profile_provider_builder=profile_provider_builder,
)

pre_profile = [
    env_provider,
    assume_role_provider,
]
profile_providers = profile_provider_builder.providers(
    profile_name=profile_name,
    disable_env_vars=disable_env_vars,
)
post_profile = [
    OriginalEC2Provider(),
    BotoProvider(),
    container_provider,
    instance_metadata_provider,
]
providers = pre_profile + profile_providers + post_profile
```

> **Source:** [boto/botocore `credentials.py` L113-152](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/credentials.py#L113-L152)

**AssumeRole Provider:**

For cross-account access or role chaining:

```python
# From botocore/credentials.py lines 1535-1548
class AssumeRoleProvider(CredentialProvider):
    METHOD = 'assume-role'
    ROLE_CONFIG_VAR = 'role_arn'
    WEB_IDENTITY_TOKE_FILE_VAR = 'web_identity_token_file'
    # Credentials are considered expired (and will be refreshed) once the total
    # remaining time left until the credentials expires is less than the
    # EXPIRY_WINDOW.
    EXPIRY_WINDOW_SECONDS = 60 * 15
```

> **Source:** [boto/botocore `credentials.py` L1535-1548](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/credentials.py#L1535-L1548)

### AWS SDK Implementation Details

Phoenix uses `aioboto3` for async Bedrock client creation:

```python
# Explicit credentials
session = aioboto3.Session(
    aws_access_key_id=aws_access_key_id,
    aws_secret_access_key=aws_secret_access_key,
    aws_session_token=aws_session_token,
    region_name=region_name,
)

# Default credential chain
session = aioboto3.Session(region_name=region_name)
```

> **Source:** [aio-libs/aioboto3](https://github.com/aio-libs/aioboto3/blob/37216db0083e28511c4d82931855f8af2b1b102b/aioboto3/session.py)

### AWS Bearer Token Authentication (Unsupported)

AWS Bedrock supports bearer token authentication via the `AWS_BEARER_TOKEN_BEDROCK` environment variable. However, **explicit bearer token passthrough is not currently supported** due to architectural limitations in botocore's token resolution system.

#### The Problem

Unlike credentials (`aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`) which can be passed explicitly to `Session()`, bearer tokens have no equivalent parameter:

```python
# ✅ Credentials CAN be passed explicitly
session = aioboto3.Session(
    aws_access_key_id="AKIA...",
    aws_secret_access_key="secret",
    aws_session_token="token",  # Optional
)

# ❌ Bearer tokens CANNOT be passed explicitly
session = aioboto3.Session(
    bearer_token="my-bearer-token",  # No such parameter exists!
)
```

#### Root Cause: Hardwired Token Resolution

The bearer token is resolved internally by botocore during `create_client()`, with no injection point for explicit tokens:

```python
# From botocore/session.py lines 847-1042
@with_current_context()
def create_client(
    self,
    service_name,
    region_name=None,
    # ... many parameters, but NO bearer_token parameter
):
    # ...
    auth_token = self.get_auth_token()  # <-- Hardwired call
    # ...
    client = client_creator.create_client(
        # ...
        auth_token=auth_token,  # <-- Passed internally, not configurable
    )
```

> **Source:** [boto/botocore `session.py` L847-1042](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/session.py#L847-L1042)

The `get_auth_token()` method uses a token provider chain with only two providers:

```python
# From botocore/tokens.py lines 46-51
def create_token_resolver(session):
    providers = [
        ScopedEnvTokenProvider(session),  # Reads AWS_BEARER_TOKEN_BEDROCK
        SSOTokenProvider(session),         # Reads from SSO cache files
    ]
    return TokenProviderChain(providers=providers)
```

> **Source:** [boto/botocore `tokens.py` L46-51](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/tokens.py#L46-L51)

The `ScopedEnvTokenProvider` specifically looks for environment variables named `AWS_BEARER_TOKEN_{SERVICE}`:

```python
# From botocore/utils.py lines 3616-3628
def get_token_from_environment(signing_name, environ=None):
    if not isinstance(signing_name, str) or not signing_name.strip():
        return None

    if environ is None:
        environ = os.environ
    env_var = _get_bearer_env_var_name(signing_name)
    return environ.get(env_var)


def _get_bearer_env_var_name(signing_name):
    bearer_name = signing_name.replace('-', '_').replace(' ', '_').upper()
    return f"AWS_BEARER_TOKEN_{bearer_name}"
```

> **Source:** [boto/botocore `utils.py` L3616-3628](https://github.com/boto/botocore/blob/52799594121c562b4e293bc10aef49b49b037864/botocore/utils.py#L3616-L3628)

#### Why This Matters

This limitation means:

1. **Cannot accept bearer tokens from frontend** - No way to pass user-provided tokens through the client creation pipeline
2. **Cannot store bearer tokens in custom provider config** - Even if stored in the database, there's no mechanism to inject them
3. **Environment-only support** - Bearer tokens only work if `AWS_BEARER_TOKEN_BEDROCK` is set in the server's environment

#### Potential Workarounds (Not Recommended)

| Workaround | Problem |
|------------|---------|
| Temporarily set env var | Race conditions in concurrent server |
| Custom token provider injection | Requires monkey-patching botocore internals |
| Fork botocore/aiobotocore | Maintenance burden |

#### Current Status

For now, AWS Bedrock bearer token authentication is only supported when `AWS_BEARER_TOKEN_BEDROCK` is already present in the server's environment. Explicit bearer token configuration via the UI or API is not feasible without upstream changes to botocore.

---

## Phoenix Implementation

### Data Model

Phoenix uses a discriminated union pattern for authentication methods:

```python
class AuthenticationMethodApiKey(BaseModel):
    model_config = ConfigDict(frozen=True, str_min_length=1, str_strip_whitespace=True)
    type: Literal["api_key"] = "api_key"
    api_key: str = Field(..., description="API key")


class AuthenticationMethodDefaultCredentials(BaseModel):
    """
    Authentication method that delegates to the SDK's default credential chain.

    For AWS: boto3 credential chain (IAM role, env vars, ~/.aws/credentials)
    For Azure: DefaultAzureCredential (Managed Identity, Azure CLI, env vars)
    """
    model_config = ConfigDict(frozen=True)
    type: Literal["default_credentials"] = "default_credentials"
```

**Azure Authentication Union:**

```python
# Discriminated union with Pydantic
AzureOpenAIAuthenticationMethod = Annotated[
    AuthenticationMethodApiKey
    | AuthenticationMethodAzureADTokenProvider
    | AuthenticationMethodDefaultCredentials,
    Field(discriminator="type"),
]
```

**AWS Authentication Union:**

```python
# Discriminated union with Pydantic
AWSBedrockAuthenticationMethod = Annotated[
    AWSBedrockAuthenticationMethodAccessKeys | AuthenticationMethodDefaultCredentials,
    Field(discriminator="type"),
]
```


### Client Factory Pattern

Phoenix uses a factory pattern to create fresh clients with proper credential handling:

**Azure OpenAI with DefaultAzureCredential:**

```python
elif method.type == "default_credentials":
    # Use DefaultAzureCredential for Managed Identity, Azure CLI, env vars, etc.
    try:
        from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
    except ImportError:
        raise ImportError(
            "Azure identity package not installed. Run: pip install azure-identity"
        )
    scope = "https://cognitiveservices.azure.com/.default"
    default_cred = DefaultAzureCredential()
    token_provider = get_bearer_token_provider(default_cred, scope)

    def create_client_with_default_cred() -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=token_provider,
            base_url=base_url,
            default_headers=merged_headers,
        )

    return create_client_with_default_cred
```


**AWS Bedrock with Default Credentials:**

```python
elif method.type == "default_credentials":
    # Use boto3 default credential chain (IAM role, env vars, ~/.aws/credentials)
    session = aioboto3.Session(region_name=region_name)

    def create_client_with_env() -> "AbstractAsyncContextManager[BedrockRuntimeClient]":
        client_context = session.client(
            service_name="bedrock-runtime",
            endpoint_url=endpoint_url,
        )
        return _bedrock_client_with_headers(client_context, headers)

    return create_client_with_env
```


---

## Production Readiness Assessment

### Coverage Analysis

| Scenario | Azure | AWS | Status |
|----------|-------|-----|--------|
| Local development with CLI auth | ✅ `default_credentials` | ✅ `default_credentials` | Covered |
| Simple API key deployment | ✅ `api_key` | N/A | Covered |
| Service principal (explicit) | ✅ `ad_token_provider` | ✅ `access_keys` | Covered |
| EC2/VM with IAM role | ✅ `default_credentials` | ✅ `default_credentials` | Covered |
| ECS/EKS with task role | ✅ `default_credentials` | ✅ `default_credentials` | Covered |
| Lambda with execution role | ✅ `default_credentials` | ✅ `default_credentials` | Covered |
| Azure App Service with MI | ✅ `default_credentials` | N/A | Covered |
| User-assigned Managed Identity | ⚠️ Partial | N/A | Gap |
| Cross-account assume-role | N/A | ⚠️ Not explicit | Gap |
| Certificate-based auth | ❌ Not supported | N/A | Gap |

### Gaps and Future Considerations

**1. User-Assigned Managed Identity (Azure)**

Currently, `DefaultAzureCredential` uses system-assigned identity by default. For user-assigned identity, the `managed_identity_client_id` parameter would need to be exposed:

```python
# Would require:
DefaultAzureCredential(managed_identity_client_id="client-id-of-user-assigned-mi")
```

**2. Cross-Account Assume Role (AWS)**

The current `default_credentials` relies on profile configuration for assume-role. Explicit assume-role support would require:

```python
# Would require STS client and role ARN:
sts_client.assume_role(
    RoleArn="arn:aws:iam::ACCOUNT:role/RoleName",
    RoleSessionName="phoenix-session"
)
```

**3. Scope Customization (Azure)**

The scope is currently hardcoded to `https://cognitiveservices.azure.com/.default`. This is correct for Azure OpenAI but may need parameterization for other Azure AI services.

### Security Best Practices

| Practice | Implementation Status |
|----------|----------------------|
| No secrets in code | ✅ Secrets stored in database with encryption |
| Credential isolation | ✅ `without_env_vars()` prevents env var leakage |
| Least privilege | ⚠️ User responsibility (documentation needed) |
| Credential rotation | ⚠️ Supported but not enforced |
| Audit logging | ⚠️ Not implemented |

---

## Future Considerations

### Short-term Improvements

1. **Add `managed_identity_client_id` parameter** for Azure user-assigned identity support
2. **Document least privilege IAM policies** for AWS Bedrock access
3. **Add credential validation** on save to catch misconfigurations early

### Medium-term Improvements

1. **Explicit assume-role support** for AWS cross-account scenarios
2. **Certificate-based authentication** for Azure service principals
3. **Credential health checks** to detect expiring or invalid credentials

### Long-term Considerations

1. **Vault integration** (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)
2. **Credential rotation automation**
3. **Audit logging** for credential usage

---

## References

### Official Documentation

- [Azure Identity client library for Python](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme)
- [DefaultAzureCredential usage guidance](https://learn.microsoft.com/en-us/azure/developer/python/sdk/authentication/credential-chains)
- [AWS SDK credentials configuration](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)
- [AWS IAM best practices](https://aws.amazon.com/iam/resources/best-practices/)

### SDK Source Code

- [openai/openai-python](https://github.com/openai/openai-python) - `722d3fffb82e9150a16da01e432b70d126ca5254`
- [Azure/azure-sdk-for-python](https://github.com/Azure/azure-sdk-for-python) - `f7ef11846bd79d4cb36349b2d917a7b92f1fc03a`
- [boto/botocore](https://github.com/boto/botocore) - `52799594121c562b4e293bc10aef49b49b037864`
- [aio-libs/aioboto3](https://github.com/aio-libs/aioboto3) - `37216db0083e28511c4d82931855f8af2b1b102b`
