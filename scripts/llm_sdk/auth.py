# ruff: noqa: E501 E402
# ===========================================================================
# COMPREHENSIVE LLM SDK AUTHENTICATION METHODS
# ===========================================================================
# This script demonstrates ALL authentication methods for major LLM providers.
# Each section enumerates different auth patterns: API keys, environment vars,
# IAM roles, service accounts, tokens, profiles, and more.
#
# NOTES:
# ------
# This script demonstrates authentication patterns using the latest SDK versions.
# All examples assume you have the most recent versions of each SDK installed.
#
# IMPORTANT - Google GenAI SDK Migration:
#   - The old SDK (google-generativeai) is deprecated
#   - Use the new unified SDK: google-genai (from github.com/googleapis/python-genai)
#   - Migration guide: https://ai.google.dev/gemini-api/docs/migrate-python-sdk
#
# RECOMMENDATIONS:
# - Test authentication methods in your specific environment
# - Use environment variables for credentials in production
# - Prefer IAM roles/managed identities when running on cloud platforms
# - Implement automatic token refresh for long-running applications
# - Replace placeholder values ({endpoint_name}, etc.) with your actual values
#
# 📚 OFFICIAL DOCUMENTATION CITATIONS:
# ------------------------------------
# Azure OpenAI:
#   - Python SDK: https://github.com/openai/openai-python
#   - Authentication: https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/authentication
#   - API Reference: https://learn.microsoft.com/en-us/azure/ai-services/openai/reference
#   - Azure Identity: https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/identity
#
# Google GenAI / Vertex AI:
#   - Python SDK (NEW): https://github.com/googleapis/python-genai
#   - Python SDK (DEPRECATED): https://github.com/google/generative-ai-python (deprecated, use python-genai)
#   - Migration Guide: https://ai.google.dev/gemini-api/docs/migrate-python-sdk
#   - Vertex AI Auth: https://cloud.google.com/vertex-ai/docs/authentication
#   - Application Default Credentials: https://cloud.google.com/docs/authentication/application-default-credentials
#   - Google AI Studio: https://aistudio.google.com/
#
# AWS Bedrock:
#   - boto3 Documentation: https://boto3.amazonaws.com/v1/documentation/api/latest/index.html
#   - Bedrock API Reference: https://docs.aws.amazon.com/bedrock/latest/APIReference/
#   - Credentials: https://docs.aws.amazon.com/sdk-for-python/v1/developer-guide/credentials.html
#   - Botocore Credentials: https://botocore.amazonaws.com/v1/documentation/api/latest/reference/credentials.html
#
# OpenAI:
#   - Python SDK: https://github.com/openai/openai-python
#   - API Reference: https://platform.openai.com/docs/api-reference
#   - Authentication: https://platform.openai.com/docs/api-reference/authentication
#   - API Keys: https://platform.openai.com/api-keys
#
# Anthropic (Claude):
#   - Python SDK: https://github.com/anthropics/anthropic-sdk-python
#   - API Reference: https://docs.anthropic.com/claude/reference
#   - Authentication: https://docs.anthropic.com/claude/docs/getting-access-to-claude
#
# Cohere:
#   - Python SDK: https://github.com/cohere-ai/cohere-python
#   - API Reference: https://docs.cohere.com/docs
#   - Authentication: https://docs.cohere.com/docs/authentication
#
# Mistral:
#   - Python SDK: https://github.com/mistralai/mistral-sdk-python
#   - API Reference: https://docs.mistral.ai/api/
#   - Authentication: https://docs.mistral.ai/api/#authentication
#
# Hugging Face:
#   - Transformers: https://github.com/huggingface/transformers
#   - Hub: https://github.com/huggingface/huggingface_hub
#   - Authentication: https://huggingface.co/docs/hub/security-tokens
#   - Inference API: https://huggingface.co/docs/api-inference/index
#
# Groq:
#   - API Documentation: https://console.groq.com/docs
#   - OpenAI-Compatible: https://console.groq.com/docs/openai
#
# xAI (Grok):
#   - API Documentation: https://docs.x.ai/
#   - OpenAI-Compatible: https://docs.x.ai/api
#
# Together.AI:
#   - API Documentation: https://docs.together.ai/
#   - Python SDK: https://github.com/togethercomputer/together-python
#
# Fireworks AI:
#   - API Documentation: https://readme.fireworks.ai/
#   - OpenAI-Compatible: https://readme.fireworks.ai/docs/openai-compatibility
#
# Cerebras:
#   - API Documentation: https://docs.cerebras.ai/
#   - Cloud Platform: https://cloud.cerebras.ai/
#
# Qwen (Alibaba Cloud):
#   - DashScope API: https://help.aliyun.com/zh/model-studio/
#   - Python SDK: https://help.aliyun.com/zh/model-studio/developer-reference/api-details-9
#
# Databricks:
#   - Serving Endpoints: https://docs.databricks.com/en/machine-learning/model-serving/index.html
#   - OpenAI-Compatible: https://docs.databricks.com/en/machine-learning/model-serving/openai-compatible-api.html
#   - Authentication: https://docs.databricks.com/en/dev-tools/auth/index.html
#
# Ollama:
#   - Documentation: https://ollama.ai/docs
#   - Python Library: https://github.com/ollama/ollama-python
#   - OpenAI-Compatible: https://github.com/ollama/ollama/blob/main/docs/openai.md
#
# DeepSeek:
#   - API Documentation: https://platform.deepseek.com/docs
#   - API Keys: https://platform.deepseek.com/api_keys
#
# Last Review: 2024-12-19
# ===========================================================================

# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------
# Required packages (install with pip):
#   pip install openai azure-identity boto3 google-genai anthropic cohere mistralai
#   pip install transformers huggingface-hub
#
# IMPORTANT - Google GenAI SDK Migration:
#   - Old package (DEPRECATED): google-generativeai (from github.com/google/generative-ai-python)
#   - New package: google-genai (from github.com/googleapis/python-genai)
#   - Migration guide: https://ai.google.dev/gemini-api/docs/migrate-python-sdk

import os

import boto3
import cohere
from anthropic import Anthropic
from azure.identity import (
    AzureCliCredential,
    ChainedTokenCredential,
    ClientSecretCredential,
    DefaultAzureCredential,
    EnvironmentCredential,
    ManagedIdentityCredential,
)
from google import genai
from google.oauth2 import service_account
from huggingface_hub import login as hf_login
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
from openai import AzureOpenAI, OpenAI
from transformers import pipeline

# ===========================================================================
# 1️⃣ AZURE OPENAI — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Python SDK: https://github.com/openai/openai-python
#   - Authentication Guide: https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/authentication
#   - API Reference: https://learn.microsoft.com/en-us/azure/ai-services/openai/reference
#   - Azure Identity SDK: https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/identity
# ===========================================================================
print("\n" + "=" * 80)
print("🔷 AZURE OPENAI — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 1A: API Key (Simplest)
# ---------------------------------------------------------------------------
print("\n[1A] API Key Authentication (Simplest)\n" + "-" * 40)
# Use when: Development, testing, or when Azure AD is not available
# Security: Store in environment variables, never hardcode
azure_client_apikey = AzureOpenAI(
    api_key="YOUR_AZURE_OPENAI_API_KEY",
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
    api_version="2024-08-01-preview",
)

# ---------------------------------------------------------------------------
# Method 1B: API Key via Environment Variable (Recommended for API Key Auth)
# ---------------------------------------------------------------------------
print("\n[1B] API Key via Environment Variable\n" + "-" * 40)
# Set: export AZURE_OPENAI_API_KEY="your-key"
#      export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
os.environ["AZURE_OPENAI_API_KEY"] = "YOUR_KEY_HERE"
os.environ["AZURE_OPENAI_ENDPOINT"] = "https://YOUR-RESOURCE.openai.azure.com/"

azure_client_env = AzureOpenAI(
    api_version="2024-08-01-preview",  # Use latest stable API version
    # api_key and azure_endpoint automatically read from environment
    # Environment variables: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT
)

# ---------------------------------------------------------------------------
# Method 1C: Managed Identity — System-Assigned (Production on Azure)
# ---------------------------------------------------------------------------
print("\n[1C] Managed Identity — System-Assigned\n" + "-" * 40)
# Use when: Running on Azure VM, App Service, Container Apps, AKS, etc.
# No credentials needed — Azure platform provides identity automatically
try:
    managed_cred = ManagedIdentityCredential()
    token = managed_cred.get_token("https://cognitiveservices.azure.com/.default")
    print("✅ System-assigned Managed Identity token obtained")

    azure_client_managed = AzureOpenAI(
        azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
        api_version="2024-08-01-preview",
        azure_ad_token=token.token,
    )
except Exception as e:
    print(f"⚠️ Managed Identity unavailable: {e}")

# ---------------------------------------------------------------------------
# Method 1D: Managed Identity — User-Assigned
# ---------------------------------------------------------------------------
print("\n[1D] Managed Identity — User-Assigned\n" + "-" * 40)
# Use when: You want explicit control over which managed identity to use
# Useful for multi-tenant scenarios or multiple identities per resource
try:
    user_managed_cred = ManagedIdentityCredential(client_id="YOUR_USER_ASSIGNED_MI_CLIENT_ID")
    token = user_managed_cred.get_token("https://cognitiveservices.azure.com/.default")
    print("✅ User-assigned Managed Identity token obtained")

    azure_client_user_managed = AzureOpenAI(
        azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
        api_version="2024-08-01-preview",
        azure_ad_token=token.token,
    )
except Exception as e:
    print(f"⚠️ User-assigned Managed Identity unavailable: {e}")

# ---------------------------------------------------------------------------
# Method 1E: Service Principal (Client Secret)
# ---------------------------------------------------------------------------
print("\n[1E] Service Principal with Client Secret\n" + "-" * 40)
# Use when: Running outside Azure (on-prem, other clouds, CI/CD)
# Requires: App registration in Azure AD with client secret
secret_cred = ClientSecretCredential(
    tenant_id="YOUR_TENANT_ID",
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET",
)
token = secret_cred.get_token("https://cognitiveservices.azure.com/.default")

azure_client_sp = AzureOpenAI(
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
    api_version="2024-08-01-preview",
    azure_ad_token=token.token,
)

# ---------------------------------------------------------------------------
# Method 1F: Service Principal via Environment Variables
# ---------------------------------------------------------------------------
print("\n[1F] Service Principal via Environment Variables\n" + "-" * 40)
# Set these environment variables:
# export AZURE_TENANT_ID="your-tenant-id"
# export AZURE_CLIENT_ID="your-client-id"
# export AZURE_CLIENT_SECRET="your-client-secret"
os.environ["AZURE_TENANT_ID"] = "YOUR_TENANT_ID"
os.environ["AZURE_CLIENT_ID"] = "YOUR_CLIENT_ID"
os.environ["AZURE_CLIENT_SECRET"] = "YOUR_CLIENT_SECRET"

env_cred = EnvironmentCredential()
token = env_cred.get_token("https://cognitiveservices.azure.com/.default")

azure_client_sp_env = AzureOpenAI(
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
    api_version="2024-08-01-preview",
    azure_ad_token=token.token,
)

# ---------------------------------------------------------------------------
# Method 1G: Azure CLI Credential (Developer Machine)
# ---------------------------------------------------------------------------
print("\n[1G] Azure CLI Credential (Developer Auth)\n" + "-" * 40)
# Use when: Local development after running 'az login'
# Great for developers — uses cached credentials from Azure CLI
try:
    cli_cred = AzureCliCredential()
    token = cli_cred.get_token("https://cognitiveservices.azure.com/.default")
    print("✅ Azure CLI credential obtained")

    azure_client_cli = AzureOpenAI(
        azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
        api_version="2024-08-01-preview",
        azure_ad_token=token.token,
    )
except Exception as e:
    print(f"⚠️ Azure CLI credential unavailable: {e}")

# ---------------------------------------------------------------------------
# Method 1H: DefaultAzureCredential (Automatic Credential Chain)
# ---------------------------------------------------------------------------
print("\n[1H] DefaultAzureCredential (Recommended for Production)\n" + "-" * 40)
# Automatically tries credentials in this order:
# 1. Environment variables (EnvironmentCredential)
# 2. Managed Identity (ManagedIdentityCredential)
# 3. Azure CLI (AzureCliCredential)
# 4. Visual Studio Code
# 5. Azure PowerShell
# This is the MOST flexible — works in dev and prod without code changes
default_cred = DefaultAzureCredential()
token = default_cred.get_token("https://cognitiveservices.azure.com/.default")

azure_client_default = AzureOpenAI(
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
    api_version="2024-08-01-preview",
    azure_ad_token=token.token,
)

# ---------------------------------------------------------------------------
# Method 1I: Dynamic Token Provider (Auto-Refresh - PRODUCTION BEST PRACTICE)
# ---------------------------------------------------------------------------
print("\n[1I] Dynamic Token Provider with Auto-Refresh ⭐ RECOMMENDED\n" + "-" * 40)


# This is THE BEST method for production — tokens refresh automatically
# No need to worry about token expiration
def azure_token_provider():
    cred = DefaultAzureCredential()
    token = cred.get_token("https://cognitiveservices.azure.com/.default")
    return token.token


azure_client_dynamic = AzureOpenAI(
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
    api_version="2024-08-01-preview",
    azure_ad_token_provider=azure_token_provider,  # Function, not static token
)

# Test the dynamic client
try:
    resp_dyn = azure_client_dynamic.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello from Azure OpenAI!"}],
    )
    print(f"✅ Response: {resp_dyn.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 1J: Chained Token Credential (Custom Fallback Order)
# ---------------------------------------------------------------------------
print("\n[1J] ChainedTokenCredential (Custom Priority Order)\n" + "-" * 40)
# Use when: You want to customize the credential priority order
# Example: Try environment vars first, then managed identity, then CLI
chained_cred = ChainedTokenCredential(
    EnvironmentCredential(),
    ManagedIdentityCredential(),
    AzureCliCredential(),
)
token = chained_cred.get_token("https://cognitiveservices.azure.com/.default")

azure_client_chained = AzureOpenAI(
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com/",
    api_version="2024-08-01-preview",
    azure_ad_token=token.token,
)

print("\n✅ Azure OpenAI: 10 authentication methods demonstrated\n")


# ===========================================================================
# 2️⃣ GOOGLE GENAI & VERTEX AI — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Python SDK (NEW): https://github.com/googleapis/python-genai
#   - Migration Guide: https://ai.google.dev/gemini-api/docs/migrate-python-sdk
#   - Vertex AI Authentication: https://cloud.google.com/vertex-ai/docs/authentication
#   - Application Default Credentials: https://cloud.google.com/docs/authentication/application-default-credentials
#   - Google AI Studio: https://aistudio.google.com/
#   - Note: The old SDK (github.com/google/generative-ai-python) is deprecated
# ===========================================================================
print("\n" + "=" * 80)
print("🔵 GOOGLE GENAI & VERTEX AI — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# GOOGLE AI STUDIO (Consumer API with API Key)
# ---------------------------------------------------------------------------
print("\n📌 PART A: GOOGLE AI STUDIO / GEMINI API (API Key-Based)\n")

# ---------------------------------------------------------------------------
# Method 2A: API Key (Direct)
# ---------------------------------------------------------------------------
print("\n[2A] API Key (Direct)\n" + "-" * 40)
# Use when: Prototyping, personal projects, Google AI Studio access
# Get key from: https://aistudio.google.com/apikey
genai_client_apikey = genai.Client(api_key="YOUR_GOOGLE_API_KEY_FROM_AI_STUDIO")

try:
    response = genai_client_apikey.models.generate_content(
        model="gemini-1.5-pro", contents="Write a haiku about the ocean and sky."
    )
    print(f"✅ Response: {response.text}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 2B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[2B] API Key via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export GOOGLE_API_KEY="your-api-key"
os.environ["GOOGLE_API_KEY"] = "YOUR_GOOGLE_API_KEY_FROM_AI_STUDIO"

genai_client_env = genai.Client()  # Automatically reads GOOGLE_API_KEY from environment

# Streaming example
print("Streaming example:")
try:
    stream = genai_client_env.models.generate_content_stream(
        model="gemini-1.5-pro",
        contents=["Give two short fun facts about space."],
    )
    for event in stream:
        if getattr(event, "text", None):
            print(event.text, end="", flush=True)
    print("\n")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# GOOGLE VERTEX AI (Enterprise GCP with IAM)
# ---------------------------------------------------------------------------
print("\n📌 PART B: GOOGLE VERTEX AI (Enterprise GCP with IAM)\n")

# ---------------------------------------------------------------------------
# Method 2C: Vertex AI with Application Default Credentials (ADC)
# ---------------------------------------------------------------------------
print("\n[2C] Vertex AI with Application Default Credentials ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Running on GCP (Cloud Run, GKE, Compute Engine, Cloud Functions)
# Setup: gcloud auth application-default login (for local dev)
# ADC chain checks:
# 1. GOOGLE_APPLICATION_CREDENTIALS env var (service account JSON)
# 2. Cloud SDK credentials (gcloud auth)
# 3. Compute Engine/GKE metadata service
vertex_client_adc = genai.Client(
    vertexai=True,
    project="YOUR_GCP_PROJECT_ID",
    location="us-central1",
    # No credentials needed — uses Application Default Credentials
)

try:
    response = vertex_client_adc.models.generate_content(
        model="gemini-1.5-pro",
        contents="Summarize the benefits of Vertex AI for enterprise AI workloads.",
    )
    print(f"✅ Response: {response.text}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 2D: Vertex AI with Service Account JSON Key File
# ---------------------------------------------------------------------------
print("\n[2D] Vertex AI with Service Account JSON Key File\n" + "-" * 40)
# Use when: Running outside GCP (on-prem, other clouds, CI/CD)
# Create service account: https://console.cloud.google.com/iam-admin/serviceaccounts
# Download JSON key file
# Grant role: "Vertex AI User" or "Vertex AI Administrator"

# Option 2D-1: Via environment variable (recommended)
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/path/to/service-account-key.json"

vertex_client_sa_env = genai.Client(
    vertexai=True,
    project="YOUR_GCP_PROJECT_ID",
    location="us-central1",
)

# Option 2D-2: Programmatically load credentials
print("\n[2D-2] Service Account JSON — Programmatic Loading\n")
# This requires google-auth library and direct credential management
# Note: genai.Client uses Application Default Credentials automatically
# For programmatic credential loading, use GOOGLE_APPLICATION_CREDENTIALS env var
try:
    credentials = service_account.Credentials.from_service_account_file(
        "/path/to/service-account-key.json",
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    # Set environment variable for genai.Client to use
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/path/to/service-account-key.json"
    print("✅ Service account credentials loaded")
except Exception as e:
    print(f"⚠️ Error loading service account: {e}")

# ---------------------------------------------------------------------------
# Method 2E: Vertex AI with gcloud CLI Credentials
# ---------------------------------------------------------------------------
print("\n[2E] Vertex AI with gcloud CLI Credentials (Developer)\n" + "-" * 40)
# Use when: Local development
# Setup: gcloud auth application-default login
# This caches credentials that ADC can use
# Run: gcloud auth application-default login
vertex_client_gcloud = genai.Client(
    vertexai=True,
    project="YOUR_GCP_PROJECT_ID",
    location="us-central1",
    # Uses gcloud cached credentials automatically
)

# ---------------------------------------------------------------------------
# Method 2F: Vertex AI with Workload Identity (GKE)
# ---------------------------------------------------------------------------
print("\n[2F] Vertex AI with Workload Identity (GKE)\n" + "-" * 40)
# Use when: Running in Google Kubernetes Engine (GKE)
# Setup: Configure Workload Identity to bind Kubernetes SA to GCP SA
# No code changes needed — works same as ADC
# Workload Identity is more secure than downloading JSON keys
vertex_client_workload = genai.Client(
    vertexai=True,
    project="YOUR_GCP_PROJECT_ID",
    location="us-central1",
    # Workload Identity provides credentials via metadata service
)

# ---------------------------------------------------------------------------
# Method 2G: Vertex AI with Compute Engine Default Service Account
# ---------------------------------------------------------------------------
print("\n[2G] Vertex AI with Compute Engine Default Service Account\n" + "-" * 40)
# Use when: Running on GCE VM, Cloud Run, Cloud Functions
# The compute service account is automatically available via metadata service
# Grant the compute service account "Vertex AI User" role
vertex_client_compute = genai.Client(
    vertexai=True,
    project="YOUR_GCP_PROJECT_ID",
    location="us-central1",
    # Metadata service provides credentials automatically
)

# ---------------------------------------------------------------------------
# Method 2H: Vertex AI with User-Specified Service Account
# ---------------------------------------------------------------------------
print("\n[2H] Vertex AI with Impersonation / User-Specified SA\n" + "-" * 40)
# Use when: You want to impersonate a specific service account
# Requires: IAM permission to impersonate the target service account
# This pattern requires google-auth library for credential impersonation
print("Note: Service account impersonation requires additional setup with google-auth")
print("Pattern: Use google.auth.impersonated_credentials.Credentials")

print("\n✅ Google GenAI/Vertex AI: 8 authentication methods demonstrated\n")


# ===========================================================================
# 3️⃣ AWS BEDROCK — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - boto3 Documentation: https://boto3.amazonaws.com/v1/documentation/api/latest/index.html
#   - Bedrock API Reference: https://docs.aws.amazon.com/bedrock/latest/APIReference/
#   - Credentials Guide: https://docs.aws.amazon.com/sdk-for-python/v1/developer-guide/credentials.html
#   - Botocore Credentials: https://botocore.amazonaws.com/v1/documentation/api/latest/reference/credentials.html
# ===========================================================================
print("\n" + "=" * 80)
print("🟢 AWS BEDROCK — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# AWS Credential Provider Chain (in order of precedence):
# 1. Explicit credentials passed to boto3.client()
# 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN)
# 3. Shared credentials file (~/.aws/credentials)
# 4. AWS config file (~/.aws/config)
# 5. AssumeRole provider (for assuming IAM roles)
# 6. Instance metadata service (IMDS) for EC2/ECS/Lambda
# 7. Container credentials (ECS Task Role)
#
# NOTE: AWS Bedrock also supports API keys with Bearer token authentication:
# - Environment variable: AWS_BEARER_TOKEN_BEDROCK
# - Authorization header: Authorization: Bearer <api-key>
# - Documentation: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html

# ---------------------------------------------------------------------------
# Method 3A: Default Credential Chain (Recommended for Most Cases)
# ---------------------------------------------------------------------------
print("\n[3A] Default Credential Chain ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Works everywhere (dev, prod, EC2, Lambda, ECS, local)
# Automatically tries all credential sources in order
bedrock_client_default = boto3.client("bedrock-runtime", region_name="us-east-1")

try:
    response = bedrock_client_default.converse(
        modelId="anthropic.claude-3-sonnet-20240229-v1:0",
        messages=[{"role": "user", "content": [{"text": "Hello from AWS Bedrock!"}]}],
    )
    print(f"✅ Response: {response['output']['message']['content'][0]['text']}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 3B: Environment Variables
# ---------------------------------------------------------------------------
print("\n[3B] Environment Variables\n" + "-" * 40)
# Set these environment variables:
# export AWS_ACCESS_KEY_ID="your-access-key-id"
# export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
# export AWS_SESSION_TOKEN="your-session-token"  # Optional, for temporary credentials
# export AWS_DEFAULT_REGION="us-east-1"
os.environ["AWS_ACCESS_KEY_ID"] = "YOUR_ACCESS_KEY_ID"
os.environ["AWS_SECRET_ACCESS_KEY"] = "YOUR_SECRET_ACCESS_KEY"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

bedrock_client_env = boto3.client("bedrock-runtime")  # Region from env var

# ---------------------------------------------------------------------------
# Method 3C: Explicit Credentials (Not Recommended for Production)
# ---------------------------------------------------------------------------
print("\n[3C] Explicit Credentials (Testing Only)\n" + "-" * 40)
# Use when: Testing, temporary access, or programmatic credential rotation
# WARNING: Never hardcode credentials in production code
bedrock_client_explicit = boto3.client(
    "bedrock-runtime",
    region_name="us-east-1",
    aws_access_key_id="YOUR_ACCESS_KEY_ID",
    aws_secret_access_key="YOUR_SECRET_ACCESS_KEY",
    # aws_session_token="YOUR_SESSION_TOKEN",  # Optional for temporary credentials
)

# ---------------------------------------------------------------------------
# Method 3D: Named Profile from ~/.aws/credentials
# ---------------------------------------------------------------------------
print("\n[3D] Named Profile from ~/.aws/credentials\n" + "-" * 40)
# ~/.aws/credentials file format:
# [default]
# aws_access_key_id = AKIAIOSFODNN7EXAMPLE
# aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
#
# [production]
# aws_access_key_id = AKIAI44QH8DHBEXAMPLE
# aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
#
# [dev]
# aws_access_key_id = AKIAIOSFODNN7EXAMPLE
# aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Use specific profile
session_with_profile = boto3.Session(profile_name="production")
bedrock_client_profile = session_with_profile.client("bedrock-runtime", region_name="us-east-1")

# Alternatively, set AWS_PROFILE environment variable
os.environ["AWS_PROFILE"] = "production"
bedrock_client_profile_env = boto3.client("bedrock-runtime", region_name="us-east-1")

# ---------------------------------------------------------------------------
# Method 3E: IAM Role on EC2 Instance (Instance Profile)
# ---------------------------------------------------------------------------
print("\n[3E] EC2 Instance Profile (IAM Role)\n" + "-" * 40)
# Use when: Running on EC2 instance
# Setup: Attach IAM role to EC2 instance with bedrock:InvokeModel permission
# Credentials automatically fetched from EC2 instance metadata service (IMDS)
# No code changes needed — default credential chain handles this automatically
bedrock_client_ec2 = boto3.client("bedrock-runtime", region_name="us-east-1")
print("Note: This works automatically on EC2 with attached IAM role")

# ---------------------------------------------------------------------------
# Method 3F: ECS Task Role (Container Credentials)
# ---------------------------------------------------------------------------
print("\n[3F] ECS Task Role (Container Credentials)\n" + "-" * 40)
# Use when: Running in ECS (Elastic Container Service)
# Setup: Define task role in ECS task definition
# Credentials automatically provided via AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
bedrock_client_ecs = boto3.client("bedrock-runtime", region_name="us-east-1")
print("Note: This works automatically in ECS with task role defined")

# ---------------------------------------------------------------------------
# Method 3G: Lambda Execution Role
# ---------------------------------------------------------------------------
print("\n[3G] Lambda Execution Role\n" + "-" * 40)
# Use when: Running in AWS Lambda
# Setup: Attach IAM role to Lambda function with bedrock:InvokeModel permission
# Credentials automatically injected as environment variables
bedrock_client_lambda = boto3.client("bedrock-runtime", region_name="us-east-1")
print("Note: This works automatically in Lambda with execution role")

# ---------------------------------------------------------------------------
# Method 3H: AssumeRole / STS (Cross-Account or Temporary Credentials)
# ---------------------------------------------------------------------------
print("\n[3H] AssumeRole / STS (Cross-Account Access)\n" + "-" * 40)
# Use when: Accessing resources in another AWS account or need temporary credentials
# Setup: Create role in target account with trust policy

sts_client = boto3.client("sts")
try:
    # Assume role in another account or same account
    assumed_role = sts_client.assume_role(
        RoleArn="arn:aws:iam::123456789012:role/BedrockAccessRole",
        RoleSessionName="bedrock-session",
        DurationSeconds=3600,  # 1 hour
    )

    # Extract temporary credentials
    credentials = assumed_role["Credentials"]

    # Create client with temporary credentials
    bedrock_client_assumed = boto3.client(
        "bedrock-runtime",
        region_name="us-east-1",
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )
    print("✅ AssumeRole credentials obtained")
except Exception as e:
    print(f"⚠️ AssumeRole error: {e}")

# ---------------------------------------------------------------------------
# Method 3I: AssumeRoleWithWebIdentity (OIDC/SAML Federation)
# ---------------------------------------------------------------------------
print("\n[3I] AssumeRoleWithWebIdentity (OIDC/SAML)\n" + "-" * 40)
# Use when: Using external identity provider (Okta, Auth0, Google, etc.)
# Common in Kubernetes (EKS) with IRSA (IAM Roles for Service Accounts)
try:
    assumed_role = sts_client.assume_role_with_web_identity(
        RoleArn="arn:aws:iam::123456789012:role/BedrockWebIdentityRole",
        RoleSessionName="web-identity-session",
        WebIdentityToken="YOUR_OIDC_TOKEN",  # From identity provider
    )
    credentials = assumed_role["Credentials"]

    bedrock_client_web_identity = boto3.client(
        "bedrock-runtime",
        region_name="us-east-1",
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )
    print("✅ Web identity credentials obtained")
except Exception as e:
    print(f"⚠️ Web identity error: {e}")

# ---------------------------------------------------------------------------
# Method 3J: EKS IRSA (IAM Roles for Service Accounts)
# ---------------------------------------------------------------------------
print("\n[3J] EKS IRSA (IAM Roles for Service Accounts)\n" + "-" * 40)
# Use when: Running in Amazon EKS (Kubernetes)
# Setup: Annotate Kubernetes service account with IAM role ARN
# Credentials automatically provided via web identity token
# No code changes — default credential chain handles this
bedrock_client_irsa = boto3.client("bedrock-runtime", region_name="us-east-1")
print("Note: This works automatically in EKS pods with IRSA configured")

# ---------------------------------------------------------------------------
# Method 3K: Session with Custom Botocore Session
# ---------------------------------------------------------------------------
print("\n[3K] Custom Botocore Session\n" + "-" * 40)
# Use when: Need fine-grained control over credential providers
from botocore.session import Session as BotocoreSession

botocore_session = BotocoreSession()
# Customize credential providers, retries, etc.
boto_session = boto3.Session(botocore_session=botocore_session)
bedrock_client_custom = boto_session.client("bedrock-runtime", region_name="us-east-1")

# ---------------------------------------------------------------------------
# Method 3L: AWS SSO (Single Sign-On)
# ---------------------------------------------------------------------------
print("\n[3L] AWS SSO (Single Sign-On)\n" + "-" * 40)
# Use when: Organization uses AWS SSO
# Setup: aws sso login --profile my-sso-profile
# ~/.aws/config format:
# [profile my-sso-profile]
# sso_start_url = https://my-sso-portal.awsapps.com/start
# sso_region = us-east-1
# sso_account_id = 123456789012
# sso_role_name = PowerUserAccess
# region = us-east-1

session_sso = boto3.Session(profile_name="my-sso-profile")
bedrock_client_sso = session_sso.client("bedrock-runtime")
print("Note: Requires 'aws sso login --profile my-sso-profile' first")

# ---------------------------------------------------------------------------
# Method 3M: Streaming with ConverseStream
# ---------------------------------------------------------------------------
print("\n[3M] Streaming Response (ConverseStream)\n" + "-" * 40)
# All above auth methods work with streaming too
try:
    stream_response = bedrock_client_default.converse_stream(
        modelId="anthropic.claude-3-sonnet-20240229-v1:0",
        messages=[{"role": "user", "content": [{"text": "Count to 5 slowly"}]}],
    )

    print("Streaming: ", end="")
    for event in stream_response["stream"]:
        if "contentBlockDelta" in event:
            delta = event["contentBlockDelta"]["delta"]
            if "text" in delta:
                print(delta["text"], end="", flush=True)
    print()
except Exception as e:
    print(f"⚠️ Streaming error: {e}")

# ---------------------------------------------------------------------------
# Method 3N: Automatic Token Refresh with AssumeRole ⭐ RECOMMENDED
# ---------------------------------------------------------------------------
print("\n[3N] Automatic Token Refresh (AssumeRole) ⭐ PRODUCTION\n" + "-" * 40)
# Use when: Long-running applications need automatic credential refresh
# AWS temporary credentials expire (typically 1 hour), but boto3 can auto-refresh

from botocore.session import Session as BotocoreSession


def create_refreshable_assume_role_session(
    role_arn: str, session_name: str, duration_seconds: int = 3600
):
    """
    Creates a boto3 session with auto-refreshing AssumeRole credentials.
    Credentials are automatically refreshed before expiration.
    """
    # Get STS client to assume role
    sts_client = boto3.client("sts")

    def refresh_credentials():
        """Fetches new credentials by assuming the role"""
        print(f"🔄 Refreshing AWS credentials for role: {role_arn}")
        response = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=session_name,
            DurationSeconds=duration_seconds,
        )
        credentials = response["Credentials"]
        return {
            "access_key": credentials["AccessKeyId"],
            "secret_key": credentials["SecretAccessKey"],
            "token": credentials["SessionToken"],
            "expiry_time": credentials["Expiration"].isoformat(),
        }

    # Create refreshable credentials
    from botocore.credentials import RefreshableCredentials

    initial_creds = refresh_credentials()
    refreshable_credentials = RefreshableCredentials.create_from_metadata(
        metadata=initial_creds,
        refresh_using=refresh_credentials,
        method="sts-assume-role",
    )

    # Create botocore session with refreshable credentials
    botocore_session = BotocoreSession()
    botocore_session._credentials = refreshable_credentials

    # Create boto3 session from botocore session
    return boto3.Session(botocore_session=botocore_session)


# Example usage
try:
    # This session will automatically refresh credentials before they expire
    refreshable_session = create_refreshable_assume_role_session(
        role_arn="arn:aws:iam::123456789012:role/BedrockAccessRole",
        session_name="bedrock-long-running-app",
        duration_seconds=3600,  # 1 hour
    )

    bedrock_client_refreshable = refreshable_session.client(
        "bedrock-runtime", region_name="us-east-1"
    )
    print("✅ Auto-refreshing credentials configured")
    print("   Credentials will refresh automatically before expiration")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 3O: Instance Metadata Auto-Refresh (EC2/ECS/Lambda)
# ---------------------------------------------------------------------------
print("\n[3O] Instance Metadata Auto-Refresh ⭐ AUTOMATIC\n" + "-" * 40)
# Use when: Running on EC2, ECS, or Lambda
# IMDS credentials automatically refresh - no code needed!
# boto3 handles this transparently using the credential provider chain

print("When running on AWS infrastructure (EC2/ECS/Lambda):")
print("  ✅ Credentials from instance metadata (IMDS) refresh automatically")
print("  ✅ boto3 checks expiration and fetches new credentials as needed")
print("  ✅ No manual refresh code required")
print("  ✅ Credentials typically refresh 5 minutes before expiration")
print("\nExample:")

# Standard client - credentials auto-refresh when on AWS infrastructure
bedrock_client_imds = boto3.client("bedrock-runtime", region_name="us-east-1")
print("✅ Client created - credentials will auto-refresh from IMDS")

# ---------------------------------------------------------------------------
# Method 3P: STS Get Session Token with Refresh
# ---------------------------------------------------------------------------
print("\n[3P] STS Get Session Token (MFA with Refresh)\n" + "-" * 40)
# Use when: Using MFA (Multi-Factor Authentication)
# Get temporary credentials that can last up to 36 hours

sts_client_mfa = boto3.client("sts")
try:
    # Get session token with MFA
    session_token_response = sts_client_mfa.get_session_token(
        DurationSeconds=43200,  # 12 hours (can be up to 129600 for root user)
        SerialNumber="arn:aws:iam::123456789012:mfa/user",  # MFA device ARN
        TokenCode="123456",  # Current MFA code
    )

    mfa_credentials = session_token_response["Credentials"]

    # Create client with MFA-authenticated credentials
    bedrock_client_mfa = boto3.client(
        "bedrock-runtime",
        region_name="us-east-1",
        aws_access_key_id=mfa_credentials["AccessKeyId"],
        aws_secret_access_key=mfa_credentials["SecretAccessKey"],
        aws_session_token=mfa_credentials["SessionToken"],
    )
    print("✅ MFA session token obtained (lasts up to 36 hours)")
    print(f"   Expires at: {mfa_credentials['Expiration']}")
except Exception as e:
    print(f"⚠️ MFA auth error: {e}")

# ---------------------------------------------------------------------------
# Method 3Q: Credential Caching for Performance
# ---------------------------------------------------------------------------
print("\n[3Q] Credential Caching (Performance Optimization)\n" + "-" * 40)
# Use when: Want to minimize STS API calls
# boto3 automatically caches credentials, but you can customize

from botocore.credentials import JSONFileCache

# Custom credential cache location
cache_dir = "/tmp/aws_credentials_cache"
os.makedirs(cache_dir, exist_ok=True)

# Create session with custom cache
botocore_session_cached = BotocoreSession()
botocore_session_cached.get_component("credential_provider").get_provider(
    "assume-role"
).cache = JSONFileCache(cache_dir)

boto_session_cached = boto3.Session(botocore_session=botocore_session_cached)
bedrock_client_cached = boto_session_cached.client("bedrock-runtime", region_name="us-east-1")

print("✅ Credential caching enabled")
print(f"   Cache location: {cache_dir}")
print("   Benefits: Reduces STS API calls, faster credential retrieval")

# ---------------------------------------------------------------------------
# Method 3R: AWS Bedrock API Key (Bearer Token) ⭐ NEW FEATURE
# ---------------------------------------------------------------------------
print("\n[3R] AWS Bedrock API Key (Bearer Token) ⭐ NEW\n" + "-" * 40)
# Use when: Simplified authentication without IAM credentials
# AWS Bedrock now supports API keys with bearer token authentication
# Documentation: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html
# Note: API keys are limited to Bedrock and Bedrock Runtime actions only
# Limitations: Cannot use with InvokeModelWithBidirectionalStream, Agents, or Data Automation APIs

# Option 3R-1: Via Environment Variable (Recommended)
print("\n[3R-1] API Key via Environment Variable\n")
# Set: export AWS_BEARER_TOKEN_BEDROCK="your-api-key"
os.environ["AWS_BEARER_TOKEN_BEDROCK"] = "YOUR_BEDROCK_API_KEY"

# boto3 automatically reads AWS_BEARER_TOKEN_BEDROCK from environment
bedrock_client_api_key_env = boto3.client("bedrock-runtime", region_name="us-east-1")

try:
    response = bedrock_client_api_key_env.converse(
        modelId="us.anthropic.claude-3-5-haiku-20241022-v1:0",
        messages=[{"role": "user", "content": [{"text": "Hello from Bedrock API key!"}]}],
    )
    print(f"✅ Response: {response['output']['message']['content'][0]['text']}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# Option 3R-2: Direct HTTP Request with Bearer Token
print("\n[3R-2] Direct HTTP Request with Bearer Token\n")
import requests

bedrock_api_key = "YOUR_BEDROCK_API_KEY"
url = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-3-5-haiku-20241022-v1:0/converse"

payload = {"messages": [{"role": "user", "content": [{"text": "Hello from HTTP request!"}]}]}

headers = {"Content-Type": "application/json", "Authorization": f"Bearer {bedrock_api_key}"}

try:
    http_response = requests.post(url, json=payload, headers=headers)
    if http_response.status_code == 200:
        print(f"✅ HTTP Response: {http_response.json()}")
    else:
        print(f"⚠️ HTTP Error {http_response.status_code}: {http_response.text}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# Option 3R-3: Using OpenAI-Compatible SDK
print("\n[3R-3] Using OpenAI-Compatible SDK\n")
# Some SDKs support API keys in the api_key parameter
# Example with OpenAI-compatible SDK:
try:
    from openai import OpenAI

    bedrock_client_openai_sdk = OpenAI(
        api_key=bedrock_api_key,
        base_url="https://bedrock-runtime.us-east-1.amazonaws.com",
    )
    print("✅ OpenAI-compatible client created with Bedrock API key")
    print("   Note: Check SDK documentation for Bedrock-specific endpoints")
except ImportError:
    print("⚠️ OpenAI SDK not installed (optional for this method)")
except Exception as e:
    print(f"⚠️ Error: {e}")

print("\n📝 Important Notes about AWS Bedrock API Keys:")
print("   • API keys are simpler than IAM credentials (no access keys/secrets)")
print("   • Limited to Bedrock and Bedrock Runtime actions only")
print("   • Cannot use with:")
print("     - InvokeModelWithBidirectionalStream")
print("     - Agents for Amazon Bedrock")
print("     - Data Automation for Amazon Bedrock")
print("   • Generate API keys in AWS Bedrock console")
print("   • Use Authorization: Bearer <api-key> header format")

print("\n✅ AWS Bedrock: 18 authentication methods demonstrated")
print("   🔄 Including 4 token refresh/caching methods + API key (bearer token)\n")


# ===========================================================================
# 4️⃣ OPENAI — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Python SDK: https://github.com/openai/openai-python
#   - API Reference: https://platform.openai.com/docs/api-reference
#   - Authentication: https://platform.openai.com/docs/api-reference/authentication
#   - API Keys: https://platform.openai.com/api-keys
# ===========================================================================
print("\n" + "=" * 80)
print("🟢 OPENAI — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 4A: API Key (Direct)
# ---------------------------------------------------------------------------
print("\n[4A] API Key (Direct)\n" + "-" * 40)
# Use when: Simple scripts, testing, personal projects
# Get key from: https://platform.openai.com/api-keys
openai_client_apikey = OpenAI(api_key="YOUR_OPENAI_API_KEY")

try:
    response = openai_client_apikey.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello from OpenAI!"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 4B: API Key via Environment Variable (Recommended)
# ---------------------------------------------------------------------------
print("\n[4B] API Key via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export OPENAI_API_KEY="your-api-key"
os.environ["OPENAI_API_KEY"] = "YOUR_OPENAI_API_KEY"

openai_client_env = OpenAI()  # Automatically reads OPENAI_API_KEY

# ---------------------------------------------------------------------------
# Method 4C: Organization and Project Scoping
# ---------------------------------------------------------------------------
print("\n[4C] Organization and Project Scoping (Enterprise)\n" + "-" * 40)
# Use when: Multi-team environments, need billing/quota isolation
# - `organization`: your OpenAI workspace (billing + governance boundary)
# - `project`: logical grouping of API keys and usage within an org
#
# Best practices:
#   • Create one project per app/team/environment (dev/prod)
#   • Set organization only if you belong to multiple orgs
#   • Helps segregate billing, limits, and analytics

openai_client_org_proj = OpenAI(
    api_key="YOUR_OPENAI_API_KEY",
    organization="org_ABC123",  # Optional: only if multiple orgs
    project="proj_DEF456",  # Optional: billing/quota isolation
)

# Can also set via environment variables:
os.environ["OPENAI_ORG_ID"] = "org_ABC123"
# Note: project parameter must be set programmatically, not via env var

# ---------------------------------------------------------------------------
# Method 4D: Custom Base URL (Self-Hosted or Proxy)
# ---------------------------------------------------------------------------
print("\n[4D] Custom Base URL (Proxy/Self-Hosted)\n" + "-" * 40)
# Use when: Using corporate proxy, self-hosted OpenAI-compatible API,
# or services like Azure OpenAI via compatibility layer
openai_client_custom_url = OpenAI(
    api_key="YOUR_OPENAI_API_KEY",
    base_url="https://your-custom-endpoint.example.com/v1",
)

# Common use cases:
# - Azure OpenAI compatibility: base_url="https://your-resource.openai.azure.com/openai/deployments/your-deployment"
# - Corporate proxy: base_url="https://proxy.corp.com/openai/v1"
# - LocalAI, Ollama, vLLM: base_url="http://localhost:8000/v1"

# ---------------------------------------------------------------------------
# Method 4E: Custom HTTP Client (Advanced)
# ---------------------------------------------------------------------------
print("\n[4E] Custom HTTP Client (Advanced)\n" + "-" * 40)
# Use when: Need custom headers, timeouts, retries, or proxy configuration
import httpx

custom_http_client = httpx.Client(
    timeout=60.0,
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
    # proxies="http://proxy.corp.com:8080",  # Corporate proxy
)

openai_client_custom_http = OpenAI(
    api_key="YOUR_OPENAI_API_KEY",
    http_client=custom_http_client,
)

# ---------------------------------------------------------------------------
# Method 4F: Per-Request Configuration
# ---------------------------------------------------------------------------
print("\n[4F] Per-Request Configuration\n" + "-" * 40)
# Use when: Need different settings per request (rare)
openai_client_base = OpenAI(api_key="YOUR_OPENAI_API_KEY")

# Override headers per request
response = openai_client_base.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
    extra_headers={"X-Custom-Header": "value"},
    extra_query={"custom_param": "value"},
    timeout=30.0,  # Override timeout for this request
)

# ---------------------------------------------------------------------------
# Method 4G: Multiple Projects Pattern (Enterprise Best Practice)
# ---------------------------------------------------------------------------
print("\n[4G] Multiple Projects Pattern ⭐ ENTERPRISE PATTERN\n" + "-" * 40)
# Separate clients for different environments or teams
client_dev = OpenAI(api_key="sk-dev-...", project="proj_DEV123")
client_staging = OpenAI(api_key="sk-staging-...", project="proj_STAGING456")
client_prod = OpenAI(api_key="sk-prod-...", project="proj_PROD789")

# This pattern provides:
# - Separate billing tracking
# - Independent rate limits
# - Environment isolation
# - Easier cost attribution
print("✅ Multi-project pattern enables environment isolation and cost tracking")

print("\n✅ OpenAI: 7 authentication methods demonstrated\n")


# ===========================================================================
# 5️⃣ ANTHROPIC (CLAUDE) — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Python SDK: https://github.com/anthropics/anthropic-sdk-python
#   - API Reference: https://docs.anthropic.com/claude/reference
#   - Authentication: https://docs.anthropic.com/claude/docs/getting-access-to-claude
# ===========================================================================
print("\n" + "=" * 80)
print("🟣 ANTHROPIC (CLAUDE) — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 5A: API Key (Direct)
# ---------------------------------------------------------------------------
print("\n[5A] API Key (Direct)\n" + "-" * 40)
# Use when: Simple scripts, testing
# Get key from: https://console.anthropic.com/settings/keys
anthropic_client_apikey = Anthropic(api_key="YOUR_ANTHROPIC_API_KEY")

try:
    response = anthropic_client_apikey.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=200,
        messages=[{"role": "user", "content": "Summarize 'The Matrix' in one sentence."}],
    )
    print(f"✅ Response: {response.content[0].text}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 5B: API Key via Environment Variable (Recommended)
# ---------------------------------------------------------------------------
print("\n[5B] API Key via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export ANTHROPIC_API_KEY="your-api-key"
os.environ["ANTHROPIC_API_KEY"] = "YOUR_ANTHROPIC_API_KEY"

anthropic_client_env = Anthropic()  # Automatically reads ANTHROPIC_API_KEY

# ---------------------------------------------------------------------------
# Method 5C: Custom Base URL (Proxy)
# ---------------------------------------------------------------------------
print("\n[5C] Custom Base URL (Proxy)\n" + "-" * 40)
# Use when: Using corporate proxy or self-hosted compatible endpoint
anthropic_client_custom = Anthropic(
    api_key="YOUR_ANTHROPIC_API_KEY",
    base_url="https://proxy.corp.com/anthropic",
)

# ---------------------------------------------------------------------------
# Method 5D: Custom Headers and Timeout
# ---------------------------------------------------------------------------
print("\n[5D] Custom Headers and Timeout\n" + "-" * 40)
# Use when: Need custom HTTP configuration
anthropic_client_advanced = Anthropic(
    api_key="YOUR_ANTHROPIC_API_KEY",
    timeout=60.0,  # Custom timeout
    max_retries=3,  # Retry on transient failures
    default_headers={"X-Custom-Header": "value"},
)

print("\n✅ Anthropic: 4 authentication methods demonstrated\n")


# ===========================================================================
# 6️⃣ COHERE — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Python SDK: https://github.com/cohere-ai/cohere-python
#   - API Reference: https://docs.cohere.com/docs
#   - Authentication: https://docs.cohere.com/docs/authentication
# ===========================================================================
print("\n" + "=" * 80)
print("🟠 COHERE — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 6A: API Key (Direct)
# ---------------------------------------------------------------------------
print("\n[6A] API Key (Direct)\n" + "-" * 40)
# Use when: Simple scripts, testing
# Get key from: https://dashboard.cohere.com/api-keys
cohere_client_apikey = cohere.Client("YOUR_COHERE_API_KEY")

try:
    response = cohere_client_apikey.chat(
        model="command-r-plus",
        message="Give a one-line summary of quantum computing.",
    )
    print(f"✅ Response: {response.text}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 6B: API Key via Environment Variable (Recommended)
# ---------------------------------------------------------------------------
print("\n[6B] API Key via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export CO_API_KEY="your-api-key"
os.environ["CO_API_KEY"] = "YOUR_COHERE_API_KEY"

cohere_client_env = cohere.Client()  # Automatically reads CO_API_KEY from environment

# ---------------------------------------------------------------------------
# Method 6C: Custom Base URL and Timeout
# ---------------------------------------------------------------------------
print("\n[6C] Custom Base URL and Timeout\n" + "-" * 40)
# Use when: Using enterprise deployment or proxy
cohere_client_custom = cohere.Client(
    api_key="YOUR_COHERE_API_KEY",
    api_url="https://proxy.corp.com/cohere",
    timeout=60,
)

print("\n✅ Cohere: 3 authentication methods demonstrated\n")


# ===========================================================================
# 7️⃣ MISTRAL — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Python SDK: https://github.com/mistralai/mistral-sdk-python
#   - API Reference: https://docs.mistral.ai/api/
#   - Authentication: https://docs.mistral.ai/api/#authentication
# ===========================================================================
print("\n" + "=" * 80)
print("🟡 MISTRAL — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 7A: API Key (Direct)
# ---------------------------------------------------------------------------
print("\n[7A] API Key (Direct)\n" + "-" * 40)
# Use when: Simple scripts, testing
# Get key from: https://console.mistral.ai/api-keys/
mistral_client_apikey = MistralClient(api_key="YOUR_MISTRAL_API_KEY")

try:
    response = mistral_client_apikey.chat(
        model="mistral-large-latest",
        messages=[ChatMessage(role="user", content="Explain AI alignment briefly.")],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 7B: API Key via Environment Variable (Recommended)
# ---------------------------------------------------------------------------
print("\n[7B] API Key via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export MISTRAL_API_KEY="your-api-key"
os.environ["MISTRAL_API_KEY"] = "YOUR_MISTRAL_API_KEY"

# MistralClient reads MISTRAL_API_KEY from environment automatically
mistral_client_env = MistralClient(api_key=os.environ.get("MISTRAL_API_KEY"))

# ---------------------------------------------------------------------------
# Method 7C: Custom Endpoint
# ---------------------------------------------------------------------------
print("\n[7C] Custom Endpoint (Self-Hosted)\n" + "-" * 40)
# Use when: Using self-hosted Mistral models or proxy
mistral_client_custom = MistralClient(
    api_key="YOUR_MISTRAL_API_KEY",
    endpoint="https://your-mistral-endpoint.example.com",
)

print("\n✅ Mistral: 3 authentication methods demonstrated\n")


# ===========================================================================
# 8️⃣ HUGGING FACE — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Transformers: https://github.com/huggingface/transformers
#   - Hub SDK: https://github.com/huggingface/huggingface_hub
#   - Authentication: https://huggingface.co/docs/hub/security-tokens
#   - Inference API: https://huggingface.co/docs/api-inference/index
# ===========================================================================
print("\n" + "=" * 80)
print("🧩 HUGGING FACE — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 8A: No Authentication (Public Models)
# ---------------------------------------------------------------------------
print("\n[8A] No Authentication (Public Models)\n" + "-" * 40)
# Use when: Using public models in offline/air-gapped environments
# No credentials needed for public models
try:
    hf_pipeline_public = pipeline("text-generation", model="gpt2", max_length=50)
    output = hf_pipeline_public("Hello, I am", max_length=30)
    print(f"✅ Response: {output[0]['generated_text']}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 8B: Token Authentication (Private/Gated Models)
# ---------------------------------------------------------------------------
print("\n[8B] Token Authentication (Private/Gated Models)\n" + "-" * 40)
# Use when: Accessing private models, gated models (Llama, Mistral, etc.)
# Get token from: https://huggingface.co/settings/tokens
# Two types of tokens: read, write

# Option 8B-1: Via huggingface-cli login (caches token locally)
print("Option 8B-1: CLI Login (caches token)")
# Run once: huggingface-cli login
# Token stored in ~/.cache/huggingface/token
try:
    # This uses cached token from CLI login
    hf_pipeline_cached = pipeline(
        "text-generation",
        model="meta-llama/Llama-2-7b-chat-hf",  # Gated model
        # token automatically read from cache
    )
    print("✅ Using cached token from CLI login")
except Exception as e:
    print(f"⚠️ Error: {e}")

# Option 8B-2: Programmatic login
print("\nOption 8B-2: Programmatic Login")
try:
    hf_login(token="YOUR_HUGGINGFACE_TOKEN")
    print("✅ Logged in programmatically")
except Exception as e:
    print(f"⚠️ Error: {e}")

# Option 8B-3: Pass token directly to pipeline/model
print("\nOption 8B-3: Direct Token to Pipeline")
try:
    hf_pipeline_token = pipeline(
        "text-generation",
        model="meta-llama/Llama-2-7b-chat-hf",
        token="YOUR_HUGGINGFACE_TOKEN",  # Direct token
    )
    print("✅ Token passed directly to pipeline")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 8C: Environment Variable (HF_TOKEN or HUGGING_FACE_HUB_TOKEN)
# ---------------------------------------------------------------------------
print("\n[8C] Token via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export HF_TOKEN="your-token" or HUGGING_FACE_HUB_TOKEN="your-token"
os.environ["HF_TOKEN"] = "YOUR_HUGGINGFACE_TOKEN"

try:
    # Automatically reads from HF_TOKEN environment variable
    hf_pipeline_env = pipeline(
        "text-generation",
        model="meta-llama/Llama-2-7b-chat-hf",
        # token automatically read from HF_TOKEN
    )
    print("✅ Token read from environment variable")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 8D: Using Transformers with from_pretrained
# ---------------------------------------------------------------------------
print("\n[8D] Direct Model Loading with from_pretrained\n" + "-" * 40)
# Lower-level API for more control
from transformers import AutoModelForCausalLM, AutoTokenizer

try:
    tokenizer = AutoTokenizer.from_pretrained(
        "gpt2",
        token="YOUR_HUGGINGFACE_TOKEN",  # Optional for private models
    )
    model = AutoModelForCausalLM.from_pretrained(
        "gpt2",
        token="YOUR_HUGGINGFACE_TOKEN",  # Optional for private models
    )
    print("✅ Model and tokenizer loaded with explicit token")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 8E: Offline Mode (Cached Models)
# ---------------------------------------------------------------------------
print("\n[8E] Offline Mode (Air-Gapped / No Internet)\n" + "-" * 40)
# Use when: Running in environments without internet access
# Pre-download models, then use offline mode
os.environ["HF_HUB_OFFLINE"] = "1"  # Enable offline mode

try:
    # Will only use locally cached models
    hf_pipeline_offline = pipeline(
        "text-generation",
        model="gpt2",  # Must be already downloaded
        # local_files_only=True,  # Alternative way to force local-only
    )
    print("✅ Offline mode enabled — using cached models only")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 8F: Custom Cache Directory
# ---------------------------------------------------------------------------
print("\n[8F] Custom Cache Directory\n" + "-" * 40)
# Use when: Want to control where models are cached
# Default: ~/.cache/huggingface/hub
os.environ["HF_HOME"] = "/custom/cache/path"
os.environ["HUGGINGFACE_HUB_CACHE"] = "/custom/cache/path/hub"

try:
    hf_pipeline_custom_cache = pipeline(
        "text-generation",
        model="gpt2",
        # Models will be cached in custom location
    )
    print("✅ Using custom cache directory")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 8G: Inference Endpoints (Hosted)
# ---------------------------------------------------------------------------
print("\n[8G] Hugging Face Inference Endpoints (Hosted API)\n" + "-" * 40)
# Use when: Want hosted inference without local compute
# Requires: Inference Endpoint subscription
from huggingface_hub import InferenceClient

try:
    hf_inference_client = InferenceClient(
        model="meta-llama/Llama-2-7b-chat-hf",
        token="YOUR_HUGGINGFACE_TOKEN",
    )
    response = hf_inference_client.text_generation(
        "What is the capital of France?",
        max_new_tokens=50,
    )
    print(f"✅ Response from Inference Endpoint: {response}")
except Exception as e:
    print(f"⚠️ Error: {e}")

print("\n✅ Hugging Face: 7 authentication methods demonstrated\n")


# ===========================================================================
# 9️⃣ GROQ — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - API Documentation: https://console.groq.com/docs
#   - OpenAI-Compatible: https://console.groq.com/docs/openai
#   - API Keys: https://console.groq.com/keys
# ===========================================================================
print("\n" + "=" * 80)
print("⚡ GROQ — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: Groq uses OpenAI-compatible API\n")

# ---------------------------------------------------------------------------
# Method 9A: API Key with OpenAI Client (Recommended)
# ---------------------------------------------------------------------------
print("\n[9A] API Key with OpenAI Client ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Fastest inference with OpenAI-compatible interface
# Get key from: https://console.groq.com/keys
groq_client_openai = OpenAI(
    api_key="YOUR_GROQ_API_KEY",
    base_url="https://api.groq.com/openai/v1",
)

try:
    response = groq_client_openai.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[{"role": "user", "content": "What makes Groq fast?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 9B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[9B] API Key via Environment Variable\n" + "-" * 40)
# Set: export GROQ_API_KEY="your-api-key"
os.environ["GROQ_API_KEY"] = "YOUR_GROQ_API_KEY"

groq_client_env = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

# ---------------------------------------------------------------------------
# Method 9C: Native Groq SDK (Alternative)
# ---------------------------------------------------------------------------
print("\n[9C] Native Groq SDK (pip install groq)\n" + "-" * 40)
# If using the native groq SDK:
# from groq import Groq
# groq_client_native = Groq(api_key="YOUR_GROQ_API_KEY")
# or with env var: groq_client_native = Groq()  # reads GROQ_API_KEY
print("Note: Native SDK auto-reads GROQ_API_KEY environment variable")

print("\n✅ Groq: 3 authentication methods demonstrated\n")


# ===========================================================================
# 🔟 XAI (GROK) — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - API Documentation: https://docs.x.ai/
#   - OpenAI-Compatible: https://docs.x.ai/api
#   - Console: https://console.x.ai/
# ===========================================================================
print("\n" + "=" * 80)
print("🤖 XAI (GROK) — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: xAI uses OpenAI-compatible API\n")

# ---------------------------------------------------------------------------
# Method 10A: API Key with OpenAI Client (Recommended)
# ---------------------------------------------------------------------------
print("\n[10A] API Key with OpenAI Client ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Accessing Grok models via API
# Get key from: https://console.x.ai/
xai_client_openai = OpenAI(
    api_key="YOUR_XAI_API_KEY",
    base_url="https://api.x.ai/v1",
)

try:
    response = xai_client_openai.chat.completions.create(
        model="grok-beta",
        messages=[{"role": "user", "content": "What is xAI?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 10B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[10B] API Key via Environment Variable\n" + "-" * 40)
# Set: export XAI_API_KEY="your-api-key"
os.environ["XAI_API_KEY"] = "YOUR_XAI_API_KEY"

xai_client_env = OpenAI(
    api_key=os.environ.get("XAI_API_KEY"),
    base_url="https://api.x.ai/v1",
)

print("\n✅ xAI: 2 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣1️⃣ TOGETHER.AI — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - API Documentation: https://docs.together.xyz/
#   - Python SDK: https://github.com/togethercomputer/together-python
#   - API Keys: https://api.together.xyz/settings/api-keys
# ===========================================================================
print("\n" + "=" * 80)
print("🌐 TOGETHER.AI — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: Together AI uses OpenAI-compatible API\n")

# ---------------------------------------------------------------------------
# Method 11A: API Key with OpenAI Client (Recommended)
# ---------------------------------------------------------------------------
print("\n[11A] API Key with OpenAI Client ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Access to 50+ open-source models
# Get key from: https://api.together.xyz/settings/api-keys
together_client_openai = OpenAI(
    api_key="YOUR_TOGETHER_API_KEY",
    base_url="https://api.together.xyz/v1",
)

try:
    response = together_client_openai.chat.completions.create(
        model="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        messages=[{"role": "user", "content": "What is Together AI?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 11B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[11B] API Key via Environment Variable\n" + "-" * 40)
# Set: export TOGETHER_API_KEY="your-api-key"
os.environ["TOGETHER_API_KEY"] = "YOUR_TOGETHER_API_KEY"

together_client_env = OpenAI(
    api_key=os.environ.get("TOGETHER_API_KEY"),
    base_url="https://api.together.xyz/v1",
)

# ---------------------------------------------------------------------------
# Method 11C: Native Together SDK (Alternative)
# ---------------------------------------------------------------------------
print("\n[11C] Native Together SDK (pip install together)\n" + "-" * 40)
# If using the native together SDK:
# from together import Together
# together_client_native = Together(api_key="YOUR_TOGETHER_API_KEY")
# or with env var: together_client_native = Together()  # reads TOGETHER_API_KEY
print("Note: Native SDK auto-reads TOGETHER_API_KEY environment variable")

print("\n✅ Together.AI: 3 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣2️⃣ FIREWORKS AI — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - API Documentation: https://readme.fireworks.ai/
#   - OpenAI-Compatible: https://readme.fireworks.ai/docs/openai-compatibility
#   - API Keys: https://fireworks.ai/account/api-keys
# ===========================================================================
print("\n" + "=" * 80)
print("🔥 FIREWORKS AI — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: Fireworks AI uses OpenAI-compatible API\n")

# ---------------------------------------------------------------------------
# Method 12A: API Key with OpenAI Client (Recommended)
# ---------------------------------------------------------------------------
print("\n[12A] API Key with OpenAI Client ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Fast inference for production workloads
# Get key from: https://fireworks.ai/account/api-keys
fireworks_client_openai = OpenAI(
    api_key="YOUR_FIREWORKS_API_KEY",
    base_url="https://api.fireworks.ai/inference/v1",
)

try:
    response = fireworks_client_openai.chat.completions.create(
        model="accounts/fireworks/models/llama-v3p1-70b-instruct",
        messages=[{"role": "user", "content": "What is Fireworks AI?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 12B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[12B] API Key via Environment Variable\n" + "-" * 40)
# Set: export FIREWORKS_API_KEY="your-api-key"
os.environ["FIREWORKS_API_KEY"] = "YOUR_FIREWORKS_API_KEY"

fireworks_client_env = OpenAI(
    api_key=os.environ.get("FIREWORKS_API_KEY"),
    base_url="https://api.fireworks.ai/inference/v1",
)

# ---------------------------------------------------------------------------
# Method 12C: Custom Timeout and Retries
# ---------------------------------------------------------------------------
print("\n[12C] Custom Timeout and Retries\n" + "-" * 40)
fireworks_client_custom = OpenAI(
    api_key=os.environ.get("FIREWORKS_API_KEY"),
    base_url="https://api.fireworks.ai/inference/v1",
    timeout=60.0,
    max_retries=3,
)

print("\n✅ Fireworks AI: 3 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣3️⃣ CEREBRAS — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - API Documentation: https://docs.cerebras.ai/
#   - Cloud Platform: https://cloud.cerebras.ai/
# ===========================================================================
print("\n" + "=" * 80)
print("🧠 CEREBRAS — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: Cerebras uses OpenAI-compatible API\n")

# ---------------------------------------------------------------------------
# Method 13A: API Key with OpenAI Client (Recommended)
# ---------------------------------------------------------------------------
print("\n[13A] API Key with OpenAI Client ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Ultra-fast inference on wafer-scale engines
# Get key from: https://cloud.cerebras.ai/
cerebras_client_openai = OpenAI(
    api_key="YOUR_CEREBRAS_API_KEY",
    base_url="https://api.cerebras.ai/v1",
)

try:
    response = cerebras_client_openai.chat.completions.create(
        model="llama3.1-8b",
        messages=[{"role": "user", "content": "What is Cerebras?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 13B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[13B] API Key via Environment Variable\n" + "-" * 40)
# Set: export CEREBRAS_API_KEY="your-api-key"
os.environ["CEREBRAS_API_KEY"] = "YOUR_CEREBRAS_API_KEY"

cerebras_client_env = OpenAI(
    api_key=os.environ.get("CEREBRAS_API_KEY"),
    base_url="https://api.cerebras.ai/v1",
)

print("\n✅ Cerebras: 2 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣4️⃣ QWEN (ALIBABA CLOUD) — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - DashScope API: https://help.aliyun.com/zh/model-studio/
#   - Python SDK: https://help.aliyun.com/zh/model-studio/developer-reference/api-details-9
#   - API Keys: https://dashscope.console.aliyun.com/apiKey
# ===========================================================================
print("\n" + "=" * 80)
print("☁️ QWEN (ALIBABA CLOUD) — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)

# ---------------------------------------------------------------------------
# Method 14A: API Key (DashScope API)
# ---------------------------------------------------------------------------
print("\n[14A] API Key (DashScope API)\n" + "-" * 40)
# Use when: Accessing Qwen models via Alibaba Cloud
# Get key from: https://dashscope.console.aliyun.com/apiKey
# Note: Requires dashscope SDK: pip install dashscope
print("Note: Requires 'pip install dashscope'")
print("from dashscope import Generation")
print("response = Generation.call(")
print("    model='qwen-turbo',")
print("    api_key='YOUR_DASHSCOPE_API_KEY',")
print("    messages=[{'role': 'user', 'content': 'Hello'}]")
print(")")

# ---------------------------------------------------------------------------
# Method 14B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[14B] API Key via Environment Variable\n" + "-" * 40)
# Set: export DASHSCOPE_API_KEY="your-api-key"
os.environ["DASHSCOPE_API_KEY"] = "YOUR_DASHSCOPE_API_KEY"
print("SDK auto-reads DASHSCOPE_API_KEY environment variable")

# ---------------------------------------------------------------------------
# Method 14C: OpenAI-Compatible Endpoint (Alternative)
# ---------------------------------------------------------------------------
print("\n[14C] OpenAI-Compatible Endpoint (if available)\n" + "-" * 40)
# Some Qwen deployments offer OpenAI-compatible endpoints
qwen_client_openai = OpenAI(
    api_key="YOUR_QWEN_API_KEY",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)
print("Note: Check Alibaba Cloud documentation for current compatible endpoints")

# ---------------------------------------------------------------------------
# Method 14D: Alibaba Cloud RAM (Resource Access Management)
# ---------------------------------------------------------------------------
print("\n[14D] Alibaba Cloud RAM (Enterprise)\n" + "-" * 40)
# Use when: Enterprise deployment with RAM roles
# Requires: aliyun-python-sdk-core
# Similar to AWS IAM roles - uses AccessKey ID and Secret
print("Pattern: Use AccessKey ID + AccessKey Secret")
print("Similar to AWS IAM: configure via SDK or environment variables")

print("\n✅ Qwen: 4 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣5️⃣ DATABRICKS — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Serving Endpoints: https://docs.databricks.com/en/machine-learning/model-serving/index.html
#   - OpenAI-Compatible: https://docs.databricks.com/en/machine-learning/model-serving/openai-compatible-api.html
#   - Authentication: https://docs.databricks.com/en/dev-tools/auth/index.html
# ===========================================================================
print("\n" + "=" * 80)
print("🧱 DATABRICKS — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: Databricks supports both OpenAI-compatible and native APIs\n")

# ---------------------------------------------------------------------------
# Method 15A: Personal Access Token (PAT) - Direct
# ---------------------------------------------------------------------------
print("\n[15A] Personal Access Token (PAT) - Direct\n" + "-" * 40)
# Use when: Individual development, testing
# Get PAT from: Databricks workspace -> User Settings -> Access Tokens
# Using OpenAI-compatible endpoint
# Note: Replace {endpoint_name} with your actual serving endpoint name
databricks_client_pat = OpenAI(
    api_key="YOUR_DATABRICKS_PAT",
    base_url="https://your-workspace.databricks.com/serving-endpoints/{endpoint_name}/openai/v1",
)

try:
    response = databricks_client_pat.chat.completions.create(
        model="databricks-llama-2-70b-chat",
        messages=[{"role": "user", "content": "What is Databricks?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 15B: Personal Access Token via Environment Variable
# ---------------------------------------------------------------------------
print("\n[15B] PAT via Environment Variable ⭐ RECOMMENDED\n" + "-" * 40)
# Set: export DATABRICKS_TOKEN="your-pat"
#      export DATABRICKS_HOST="https://your-workspace.databricks.com"
os.environ["DATABRICKS_TOKEN"] = "YOUR_DATABRICKS_PAT"
os.environ["DATABRICKS_HOST"] = "https://your-workspace.databricks.com"

# Note: Replace {endpoint_name} with your actual serving endpoint name
databricks_client_env = OpenAI(
    api_key=os.environ.get("DATABRICKS_TOKEN"),
    base_url=f"{os.environ.get('DATABRICKS_HOST')}/serving-endpoints/{{endpoint_name}}/openai/v1",
)

# ---------------------------------------------------------------------------
# Method 15C: Service Principal (OAuth M2M)
# ---------------------------------------------------------------------------
print("\n[15C] Service Principal (OAuth Machine-to-Machine)\n" + "-" * 40)
# Use when: Production deployments, CI/CD pipelines
# Requires: Service principal created in Databricks account console
# Set: export DATABRICKS_CLIENT_ID="your-client-id"
#      export DATABRICKS_CLIENT_SECRET="your-client-secret"
print("Pattern: OAuth 2.0 client credentials flow")
print("Note: Requires databricks-sdk for OAuth flow")
print("from databricks.sdk import WorkspaceClient")
print("w = WorkspaceClient()")
print("# SDK handles OAuth token exchange automatically")

# ---------------------------------------------------------------------------
# Method 15D: Azure Active Directory Token (Azure Databricks)
# ---------------------------------------------------------------------------
print("\n[15D] Azure AD Token (Azure Databricks)\n" + "-" * 40)
# Use when: Running on Azure with AAD integration
# Leverages Azure identity (similar to Azure OpenAI pattern)
try:
    from azure.identity import DefaultAzureCredential

    azure_cred = DefaultAzureCredential()
    # Get token for Databricks resource
    token = azure_cred.get_token("2ff814a6-3304-4ab8-85cb-cd0e6f879c1d/.default")

    # Note: Replace {endpoint_name} with your actual serving endpoint name
    databricks_client_aad = OpenAI(
        api_key=token.token,
        base_url="https://your-workspace.databricks.com/serving-endpoints/{endpoint_name}/openai/v1",
    )
    print("✅ Azure AD token obtained for Databricks")
except Exception as e:
    print(f"⚠️ Azure AD auth error: {e}")

# ---------------------------------------------------------------------------
# Method 15E: Databricks CLI Configuration
# ---------------------------------------------------------------------------
print("\n[15E] Databricks CLI Configuration (Developer)\n" + "-" * 40)
# Use when: Local development after running 'databricks configure'
# Credentials stored in ~/.databrickscfg
print("Note: Run 'databricks configure --token' first")
print("Credentials cached in ~/.databrickscfg")
print("SDK auto-reads from config file")

# ---------------------------------------------------------------------------
# Method 15F: AWS IAM Role (AWS Databricks)
# ---------------------------------------------------------------------------
print("\n[15F] AWS IAM Role (AWS Databricks)\n" + "-" * 40)
# Use when: Running on AWS with instance profile/role
# Similar to AWS Bedrock IAM authentication
print("Pattern: Uses AWS credentials chain")
print("Works with EC2 instance profiles, ECS task roles, Lambda execution roles")

print("\n✅ Databricks: 6 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣6️⃣ OLLAMA — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - Documentation: https://ollama.ai/docs
#   - Python Library: https://github.com/ollama/ollama-python
#   - OpenAI-Compatible: https://github.com/ollama/ollama/blob/main/docs/openai.md
# ===========================================================================
print("\n" + "=" * 80)
print("🦙 OLLAMA — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: Ollama is for LOCAL model inference (usually no auth required)\n")

# ---------------------------------------------------------------------------
# Method 16A: No Authentication (Default Local)
# ---------------------------------------------------------------------------
print("\n[16A] No Authentication (Default Local) ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Running Ollama locally (default: localhost:11434)
# Setup: Install Ollama and run 'ollama serve'
ollama_client_local = OpenAI(
    api_key="ollama",  # Ollama doesn't require a real key, but OpenAI client needs something
    base_url="http://localhost:11434/v1",
)

try:
    response = ollama_client_local.chat.completions.create(
        model="llama3.1",
        messages=[{"role": "user", "content": "What is Ollama?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error (Ollama not running?): {e}")

# ---------------------------------------------------------------------------
# Method 16B: Custom Host/Port
# ---------------------------------------------------------------------------
print("\n[16B] Custom Host/Port\n" + "-" * 40)
# Use when: Ollama running on different host or port
# Set: export OLLAMA_HOST="http://192.168.1.100:11434"
os.environ["OLLAMA_HOST"] = "http://localhost:11434"

ollama_client_custom = OpenAI(
    api_key="ollama",
    base_url=f"{os.environ.get('OLLAMA_HOST')}/v1",
)

# ---------------------------------------------------------------------------
# Method 16C: Ollama with Basic Auth (Self-Hosted with Proxy)
# ---------------------------------------------------------------------------
print("\n[16C] Basic Auth (Self-Hosted Behind Proxy)\n" + "-" * 40)
# Use when: Ollama behind authentication proxy (nginx, etc.)
# Requires custom HTTP client
import httpx

http_client_with_auth = httpx.Client(
    auth=("username", "password"),  # Basic auth
)

ollama_client_auth = OpenAI(
    api_key="ollama",
    base_url="http://your-ollama-server.com/v1",
    http_client=http_client_with_auth,
)

# ---------------------------------------------------------------------------
# Method 16D: Ollama via SSH Tunnel
# ---------------------------------------------------------------------------
print("\n[16D] Remote Access via SSH Tunnel\n" + "-" * 40)
# Use when: Accessing remote Ollama instance
# Setup: ssh -L 11434:localhost:11434 user@remote-server
print("Pattern: SSH tunnel forwards remote Ollama to local port")
print("Command: ssh -L 11434:localhost:11434 user@remote-server")
print("Then connect to: http://localhost:11434/v1")

# ---------------------------------------------------------------------------
# Method 16E: Native Ollama Python Library
# ---------------------------------------------------------------------------
print("\n[16E] Native Ollama Python Library (Alternative)\n" + "-" * 40)
# Use when: Want native Ollama features (not OpenAI-compatible)
# pip install ollama
print("Note: Requires 'pip install ollama'")
print("import ollama")
print("response = ollama.chat(model='llama3.1', messages=[...])")
print("# Native library for advanced Ollama features")

print("\n✅ Ollama: 5 authentication methods demonstrated\n")


# ===========================================================================
# 1️⃣7️⃣ DEEPSEEK — ALL AUTHENTICATION METHODS
# ===========================================================================
# Documentation:
#   - API Documentation: https://platform.deepseek.com/docs
#   - API Keys: https://platform.deepseek.com/api_keys
# ===========================================================================
print("\n" + "=" * 80)
print("🔍 DEEPSEEK — COMPREHENSIVE AUTHENTICATION METHODS")
print("=" * 80)
print("Note: DeepSeek uses OpenAI-compatible API\n")

# ---------------------------------------------------------------------------
# Method 17A: API Key with OpenAI Client (Recommended)
# ---------------------------------------------------------------------------
print("\n[17A] API Key with OpenAI Client ⭐ RECOMMENDED\n" + "-" * 40)
# Use when: Accessing DeepSeek models via API
# Get key from: https://platform.deepseek.com/api_keys
deepseek_client_openai = OpenAI(
    api_key="YOUR_DEEPSEEK_API_KEY",
    base_url="https://api.deepseek.com/v1",  # OpenAI-compatible APIs require /v1
)

try:
    response = deepseek_client_openai.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": "What is DeepSeek?"}],
    )
    print(f"✅ Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"⚠️ Error: {e}")

# ---------------------------------------------------------------------------
# Method 17B: API Key via Environment Variable
# ---------------------------------------------------------------------------
print("\n[17B] API Key via Environment Variable\n" + "-" * 40)
# Set: export DEEPSEEK_API_KEY="your-api-key"
os.environ["DEEPSEEK_API_KEY"] = "YOUR_DEEPSEEK_API_KEY"

deepseek_client_env = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1",  # OpenAI-compatible APIs require /v1
)

# ---------------------------------------------------------------------------
# Method 17C: DeepSeek Coder Models
# ---------------------------------------------------------------------------
print("\n[17C] DeepSeek Coder Models (Specialized)\n" + "-" * 40)
# DeepSeek offers specialized models for different tasks
deepseek_coder_client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1",  # OpenAI-compatible APIs require /v1
)

try:
    response = deepseek_coder_client.chat.completions.create(
        model="deepseek-coder",  # Specialized coding model
        messages=[{"role": "user", "content": "Write a Python function to sort a list"}],
    )
    print(f"✅ Coder model response: {response.choices[0].message.content[:100]}...")
except Exception as e:
    print(f"⚠️ Error: {e}")

print("\n✅ DeepSeek: 3 authentication methods demonstrated\n")


# ===========================================================================
# SUMMARY AND COMPARISON
# ===========================================================================
print("\n" + "=" * 80)
print("📊 AUTHENTICATION METHODS SUMMARY")
print("=" * 80)
print("""
┌─────────────────────┬────────────┬────────────────────────────────────────────┐
│ Provider            │ Methods    │ Best Practice                              │
├─────────────────────┼────────────┼────────────────────────────────────────────┤
│ Azure OpenAI        │ 10         │ Dynamic Token Provider (auto-refresh)      │
│ Google Vertex AI    │ 8          │ Application Default Credentials (ADC)      │
│ AWS Bedrock         │ 18         │ API Key (Bearer) + Default Credential Chain│
│ OpenAI              │ 7          │ Environment Variable + Project Scoping     │
│ Anthropic (Claude)  │ 4          │ Environment Variable                       │
│ Cohere              │ 3          │ Environment Variable                       │
│ Mistral             │ 3          │ Environment Variable                       │
│ Hugging Face        │ 7          │ Environment Variable (HF_TOKEN)            │
│ Groq                │ 3          │ OpenAI Client + Environment Variable       │
│ xAI (Grok)          │ 2          │ OpenAI Client + Environment Variable       │
│ Together.AI         │ 3          │ OpenAI Client + Environment Variable       │
│ Fireworks AI        │ 3          │ OpenAI Client + Environment Variable       │
│ Cerebras            │ 2          │ OpenAI Client + Environment Variable       │
│ Qwen (Alibaba)      │ 4          │ DashScope API + Environment Variable       │
│ Databricks          │ 6          │ PAT + Environment Variable                 │
│ Ollama (Local)      │ 5          │ No Auth (Local) or Custom Host             │
│ DeepSeek            │ 3          │ OpenAI Client + Environment Variable       │
├─────────────────────┼────────────┼────────────────────────────────────────────┤
│ TOTAL               │ 91 Methods │ 17 Providers                               │
└─────────────────────┴────────────┴────────────────────────────────────────────┘

🔄 TOKEN REFRESH SUPPORT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Automatic token refresh is critical for long-running applications:

✅ Azure OpenAI: Dynamic token provider with auto-refresh (Method 1I)
✅ AWS Bedrock: Multiple auto-refresh methods (Methods 3N, 3O, 3P, 3Q)
   • AssumeRole with RefreshableCredentials
   • Instance Metadata (EC2/ECS/Lambda) - automatic
   • STS GetSessionToken with MFA
   • Credential caching for performance

✅ Google Vertex AI: ADC auto-refreshes tokens (Method 2C)
⚠️ OpenAI/Others: API keys don't expire (no refresh needed)

🔐 SECURITY BEST PRACTICES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ALWAYS use environment variables in production (never hardcode)
2. ✅ Use IAM roles/managed identities when running on cloud platforms
3. ✅ Implement automatic token refresh for long-running applications
4. ✅ Use credential chains (try multiple methods in priority order)
5. ✅ Rotate credentials regularly and use short-lived tokens
6. ✅ Store secrets in secure vaults (AWS Secrets Manager, Azure Key Vault, etc.)
7. ✅ Use service accounts with least-privilege permissions
8. ✅ Enable audit logging for all API access
9. ✅ Use separate credentials per environment (dev/staging/prod)
10. ✅ Never commit credentials to version control (.gitignore)

📋 USE CASE RECOMMENDATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Local Development:
  • Azure: Azure CLI Credential
  • Google: gcloud ADC (gcloud auth application-default login)
  • AWS: Named profiles (~/.aws/credentials)
  • Others: Environment variables from .env file

Production (Cloud):
  • Azure: Managed Identity + Token Provider
  • Google: Workload Identity / Service Account
  • AWS: IAM Role (EC2/ECS/Lambda/EKS IRSA)
  • Others: Environment variables from secrets manager

CI/CD:
  • Azure: Service Principal (env vars)
  • Google: Service Account JSON (env var path)
  • AWS: OIDC federation / AssumeRoleWithWebIdentity
  • Others: Short-lived tokens from secrets

Enterprise/Multi-Team:
  • Azure: User-assigned Managed Identities
  • Google: Separate service accounts per team
  • AWS: Cross-account roles with AssumeRole
  • OpenAI: Project scoping for billing isolation

Air-Gapped/Offline:
  • Hugging Face: Offline mode with cached models
  • Self-hosted: Custom base URLs for all providers
""")

print("=" * 80)
print("✅ COMPREHENSIVE LLM AUTHENTICATION GUIDE COMPLETE")
print("=" * 80)
print("\nTotal Authentication Methods Documented: 91+")
print("Providers Covered: 17 major LLM platforms")
print("\n🔄 TOKEN REFRESH METHODS: 4+ methods for AWS automatic credential refresh")
print("\n🎯 This script serves as a complete reference for production deployments\n")
print("\n📝 ALL PROVIDERS COVERED:")
print("\n🏢 ENTERPRISE CLOUD PLATFORMS:")
print("  • Azure OpenAI - Microsoft cloud AI")
print("  • Google Vertex AI - Google cloud AI")
print("  • AWS Bedrock - Amazon cloud AI")
print("  • Databricks - Data + AI platform")
print("\n🚀 MAJOR API PROVIDERS:")
print("  • OpenAI - GPT models")
print("  • Anthropic - Claude models")
print("  • Cohere - Enterprise NLP")
print("  • Mistral - European AI")
print("\n⚡ HIGH-PERFORMANCE INFERENCE:")
print("  • Groq - Ultra-fast LPU inference")
print("  • Fireworks AI - Production-optimized")
print("  • Cerebras - Wafer-scale engines")
print("  • Together.AI - Decentralized AI")
print("\n🌏 REGIONAL/SPECIALIZED:")
print("  • xAI (Grok) - X.ai platform")
print("  • DeepSeek - Chinese AI (coding-focused)")
print("  • Qwen (Alibaba) - Alibaba Cloud AI")
print("\n🏠 LOCAL/SELF-HOSTED:")
print("  • Ollama - Local inference runtime")
print("  • Hugging Face - Open-source models\n")
print("\n" + "=" * 80)
print("📝 IMPORTANT NOTES")
print("=" * 80)
print("""
This script demonstrates authentication patterns using the latest SDK versions.
All examples assume you have the most recent versions of each SDK installed.

KEY REMINDERS:
• Replace placeholder values ({endpoint_name}, YOUR_API_KEY, etc.) with actual values
• Test authentication methods in your specific environment before production use
• Use environment variables or IAM roles for credentials (never hardcode)
• Implement automatic token refresh for long-running applications
• Review provider-specific documentation for latest best practices

For detailed documentation links, see the header comments at the top of this script.
""")
print("=" * 80)
