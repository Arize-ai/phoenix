---
description: Phoenix can be deployed on AWS Fargate using CloudFormation
---

# AWS with CloudFormation

## Prerequisites

**AWS Account & CLI**

* An [AWS account](https://www.googleadservices.com/pagead/aclk?sa=L\&ai=DChsSEwiAtLCbkOqMAxUSAa0GHXCbNXsYACICCAEQABoCcHY\&ae=2\&aspm=1\&co=1\&ase=5\&gclid=Cj0KCQjw2ZfABhDBARIsAHFTxGwg0XwS9htaZw1EV3FQkuQkeRBffwh7i_zMVLieS6vZVVN6_0C_aO4aAr_lEALw_wcB\&ei=RsAGaKGZO52_0PEPjr3TgQw\&ohost=www.google.com\&cid=CAESVuD2SCOo1kgykltK7QlneZO0kLjLVm-DLo7K-rZ_XoWbVM-U6idlYAS9y_mWcJ4NbmQ708KWp8jyoVeqtfRilZiTt4Y6dLdSq2xpvHvSjMlfCp9Rrvm1\&sig=AOD64_0SOO-BnErIbCFIx6UqvzYtcdt8Uw\&q\&sqi=2\&adurl\&ved=2ahUKEwih1KubkOqMAxWdHzQIHY7eNMAQ0Qx6BAgJEAE).
* [AWS CLI v2 installed](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html#getting-started-install-instructions) and configured (`aws configure`) with credentials that can deploy CloudFormation stacks.

**Export your AWS Account and Region for future use**

Before you run any of the CloudFormation or ECR commands, export two env‑vars so you don’t have to repeat your account/region everywhere:

```bash
# grab your AWS account ID and default region from your CLI creds
export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export REGION=$(aws configure get region)
```

## IAM Permissions

**Copy the following JSON file of permissions:** [**permissions.json**](https://github.com/Arize-ai/phoenix/blob/main/tutorials/deployment/AWS%20Cloudformation/permissions.json)

Before you can deploy any of the CloudFormation stacks above, you’ll want a single, least‑privilege managed policy that your CI/CD user or role can assume.

#### Create the IAM policy

```bash
aws iam create-policy \
  --policy-name PhoenixDeployPermissions \
  --policy-document file://deploy-permissions.json
```

This will return the new policy’s ARN, e.g.:

```
arn:aws:iam::123456789012:policy/PhoenixDeployPermissions
```

#### Attach it to your deploy principal

**a) If you use an IAM User:**

```bash
bashCopyEditaws iam attach-user-policy \
  --user-name <YOUR_DEPLOY_USER> \
  --policy-arn <PASTE ARN HERE>
```

**b) If you use an IAM Role (e.g. CodeBuild or CI/CD):**

```bash
bashCopyEditaws iam attach-role-policy \
  --role-name <YOUR_DEPLOY_ROLE> \
  --policy-arn <PASTE ARN HERE>
```

***

Once attached, that user or role will have exactly the rights needed to stand up all of the VPCs, ECS/Fargate clusters, ECR repos, Secrets Manager secrets, ALBs, CloudWatch Logs, IAM roles, and CloudFormation stacks in this guide

## Set up ECR (Elastic Container Registry) Repositories for Phoenix and your application

Before deploying Phoenix and your application into ECS/Fargate, you need to host your container images in Amazon Elastic Container Registry (ECR). Here’s a quick rundown:

#### 1. Create ECR repositories

Run these once:

```bash
# Repository for the Phoenix UI image
aws ecr create-repository \
  --repository-name phoenix \
  --image-scanning-configuration scanOnPush=true \
  --region $REGION

# Repository for your application (agent, backend, frontend, etc.)
aws ecr create-repository \
  --repository-name my-app \
  --image-scanning-configuration scanOnPush=true \
  --region $REGION
```

Each command returns the repo URI:

```
$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/phoenix
$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/my-app
```

***

#### 2. Authenticate Docker to ECR

```bash
ecr get-login-password --region $REGION \
  | docker login \
    --username AWS \
    --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
```

This writes your Docker credentials so you can push and pull.

***

#### 3. Push Phoenix and your apps (backend, frontend, db)

If you’ve built locally:

```bash
# Tag your local Phoenix image
docker pull arizephoenix/phoenix
docker tag arizephoenix/phoenix:latest \
  $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/phoenix:latest

# Push to ECR
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/phoenix:latest

# Repeat for your app
docker tag my-app:latest \
  $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/my-app:latest
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/my-app:latest
```

## Create VPCs and Subnets

**Copy this CloudFormation template:** [**phoenix-network.yml**](https://github.com/Arize-ai/phoenix/blob/main/tutorials/deployment/AWS%20Cloudformation/phoenix-network.yml)

This template:

1. **Creates a VPC** (10.0.0.0/16 for example) with DNS support
2. **Provisions two public subnets** (one per AZ) for your Internet‑facing components (ALBs, NAT gateway)
3. **Provisions two private subnets** (one per AZ) for your ECS tasks (Phoenix, agents, backend services)
4. **Deploys a NAT Gateway** in the first public subnet so private tasks can reach out (for secrets, Docker registries, external APIs)
5. **Exports** the VPC ID and the comma‑separated Public/Private Subnet IDs for easy consumption by downstream stacks

#### Deploy with:

```bash
cloudformation deploy \
  --template-file phoenix-network.yml \
  --stack-name phoenix-network \
  --parameter-overrides \
      AZ1=us-west-2a \
      AZ2=us-west-2b \
  --capabilities CAPABILITY_NAMED_IAM
```

Make sure to change AZ1 and AZ2 to match your region.&#x20;

**You can now access your VPC and public + private subnet IDs at AWS -> CloudFormation -> Stacks -> phoenix-network -> Outputs.**

#### Extending for multiple components

If you plan to run **multiple services** (e.g. a separate frontend, backend, worker pool), consider:

* **Additional subnets**\
  You might carve out extra AZ‑distributed subnets (e.g. “app‑subnets”, “db‑subnets”) with their own route tables and security rules.
* **Security groups per tier**
  * **ALB SG**: allows inbound HTTP(S) from 0.0.0.0/0
  * **App SG**: allows inbound from the ALB SG on your HTTP port
  * **DB SG**: allows inbound only from your App SG on your database port

## Deploy Phoenix (with Authentication)

**Copy this CloudFormation template:** [**phoenix-auth.yml**](https://github.com/Arize-ai/phoenix/blob/main/tutorials/deployment/AWS%20Cloudformation/phoenix-auth.yml)

You are now ready to deploy Phoenix to AWS.&#x20;

**Deploy the `phoenix-auth.yml` stack**\
Consume the network stack’s outputs (`VPC‑ID`, `PublicSubnetIds`, `PrivateSubnetIds`) along with your new ECR URI:

```bash
aws cloudformation deploy \
  --template-file phoenix-auth.yml \
  --stack-name phoenix-auth \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    PhoenixImageUri=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/phoenix:latest \
    VpcId=$(aws cloudformation describe-stacks \
            --stack-name phoenix-network \
            --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' \
            --output text) \
    PublicSubnetIds=$(aws cloudformation describe-stacks \
            --stack-name phoenix-network \
            --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetIds`].OutputValue' \
            --output text) \
    PrivateSubnetIds=$(aws cloudformation describe-stacks \
            --stack-name phoenix-network \
            --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetIds`].OutputValue' \
            --output text)
```

**Fetch your Phoenix URL**

```bash
PHOENIX_URL=$(aws cloudformation describe-stacks \
  --stack-name phoenix-auth \
  --query 'Stacks[0].Outputs[?OutputKey==`PhoenixURL`].OutputValue' \
  --output text)
```

**Log in and create your System API key**

* In your browser, go to `$PHOENIX_URL`.
* Sign in as `admin@localhost` / `admin`.
* Set a new admin password.
* Go to **Settings → API Keys** and **Create System Key**.
* **Copy the new key** (you’ll need it in the next step).

**IMPORTANT**: **Security‑group ingress** is wide open (`0.0.0.0/0` on port 80). You should tighten it if you know your CIDR or are behind a corporate proxy.

## Store Phoenix API Key + other API Keys

Once you have your Phoenix System API key, bundle it (and any other service keys) into AWS Secrets Manager:

```bash
# Store Phoenix API key
aws secretsmanager create-secret \
  --name phoenix-system-api-key \
  --description "Phoenix System API Key for OTLP traces" \
  --secret-string '{"PHOENIX_API_KEY":"<PASTE SYSTEM KEY HERE>"}'

# (Optional) Store other service keys similarly:
aws secretsmanager create-secret \
  --name openai-api-key \
  --description "OpenAI API key for LLM calls" \
  --secret-string '{"OPENAI_API_KEY":"<PASTE OPENAI KEY HERE>"}'
```

You can now reference these secrets in your downstream CloudFormation templates (e.g. in your application stacks) via the `PhoenixArn`, `OpenAIArn`, etc., parameters.

## Deploying your App that ships Spans to Phoenix

**Copy this CloudFormation template:** [**app.yml**](https://github.com/Arize-ai/phoenix/blob/main/tutorials/deployment/AWS%20Cloudformation/app.yml)

This CloudFormation stack (`app.yaml`) launches:

* An ECS **Cluster**
* An **IAM Task Execution Role** & **Task Role** (to pull images, read secrets)
* A **Security Group** that allows outbound Internet access
* A **Log Group** for container logs
* An ECS **Task Definition** (family: `app`)
* An ECS **Service** (Fargate) running one copy of the “app” container

The app container will:

1. Read your OTLP endpoint and Phoenix API key from Secrets Manager
2. Read your other API keys from Secrets Manager
3. Emit spans to your Phoenix deployment

**IMPORTANT: This template assumes only one secret is being used (OpenAI API Key). Make sure to add ARNs for additional secrets in the list of parameters (line 34 and line 86) and store those additional secrets as environment variables (line 134).**

**Template parameters**

| Parameter            | Description                                                     | Example                                                            |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| **AgentImageUri**    | ECR URI (with tag) of your agent container                      | `123456789012.dkr.ecr.us-west-2.amazonaws.com/agent:latest`        |
| **PhoenixHost**      | DNS name (no scheme) of your Phoenix UI load‑balancer           | `phoenix-auth-ALB-abc123.us-west-2.elb.amazonaws.com`              |
| **VpcId**            | Your VPC ID                                                     | `vpc-0abc123def456ghi7`                                            |
| **PublicSubnetIds**  | Comma‑separated public subnets for the NAT/ALB                  | `subnet-aaa111,subnet-bbb222`                                      |
| **PrivateSubnetIds** | Comma‑separated private subnets for your ECS tasks              | `subnet-ccc333,subnet-ddd444`                                      |
| **OpenAIArn**        | ARN of Secrets Manager secret holding `{"OPENAI_API_KEY": "…"}` | `arn:aws:secretsmanager:us-west-2:920904165384:secret:openai-key`  |
| **PhoenixArn**       | ARN of secret holding `{"PHOENIX_API_KEY": "…"}`                | `arn:aws:secretsmanager:us-west-2:920904165384:secret:phoenix-key` |

**Example deploy command (add additional ARNs for more secrets):**

```bash
aws cloudformation deploy \
  --template-file app.yml \
  --stack-name app \
  --parameter-overrides \
      AgentImageUri=123456789012.dkr.ecr.us-west-2.amazonaws.com/agent:latest \
      PhoenixHost=phoenix-auth-ALB-abc123.us-west-2.elb.amazonaws.com \
      VpcId=vpc-0abc123def456ghi7 \
      PublicSubnetIds=subnet-aaa111,subnet-bbb222 \
      PrivateSubnetIds=subnet-ccc333,subnet-ddd444 \
      OpenAIArn=arn:aws:secretsmanager:us-west-2:920904165384:secret:openai-key \
      PhoenixArn=arn:aws:secretsmanager:us-west-2:920904165384:secret:phoenix-key \
  --capabilities CAPABILITY_NAMED_IAM
```

Once complete, ECS will spin up your agent task, and you can verify in the console:

```bash
# See the running task
aws ecs list-tasks --cluster agent-only --output table

# Check logs for any “Connectivity to http://<PhoenixHost>” output
aws logs tail \
  --log-group-name /aws/ecs/agent \
  --since 5m
```

**Now your traces should flow from the agent into your Phoenix project!**

## (Optional) Extending for Additional Components (Frontend, DB, etc.)

Once you have Phoenix + your agent/LLM task up and running, you can easily add more services to the same VPC:

1. **Create new ECR repos** for your frontend, backend, DB‑migrations job, worker service, etc.
2.  **Add new TaskDefinitions / Services** to your `app.yml` (or split each into its own CFN stack):

    ```yaml
    yamlCopyEditParameters:
      FrontendImageUri: …
      BackendImageUri: …
      DbMigrationImageUri: …

    Resources:
      # reuse same VpcId, SubnetIds, SecurityGroup
      FrontendTaskDef:
        Type: AWS::ECS::TaskDefinition
        Properties:
          Family: frontend
          ContainerDefinitions:
            - Name: frontend
              Image: !Ref FrontendImageUri
              PortMappings: [{ContainerPort: 80}]
              # …env & secrets…
      FrontendService:
        Type: AWS::ECS::Service
        Properties:
          Cluster: !Ref Cluster
          DesiredCount: 2
          TaskDefinition: !Ref FrontendTaskDef
          LoadBalancers:  # attach to same (or new) ALB
    ```
3. **Subnet segmentation**\
   If you want stricter isolation, you can carve out **“app‑subnets”** vs **“db‑subnets”**, each with its own route table and SG rules. Just update `phoenix-network.yml` to output those extra subnet IDs.
4. **Security groups per tier**
   * ALB SG → allows 0.0.0.0/0 on 80/443
   * App SG → allows inbound from ALB SG on 80
   * DB SG → allows inbound from App SG on 5432 (Postgres) or 3306 (MySQL)

With these patterns you can grow from one simple “agent-only” service into a multi‑tier architecture, all launched and managed via CloudFormation.
