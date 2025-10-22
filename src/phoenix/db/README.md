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

⚠️ Running down-migrations can result in lost data. Only run down-migrations if you know what you are doing and consider backing up your database first. If you have any questions or doubts, contact the Phoenix team in the `#phoenix-support` channel of the [Arize AI Slack community](https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email) or via GitHub.

```bash
alembic downgrade <revision-id>
```

### Creating a Migration

All migrations are stored in the `migrations` folder. To create a new migration, run the following command:

```bash
alembic revision -m "your_revision_name"
```

Then fill the migration file with the necessary changes.

## Entity Relationship Diagram (ERD)

Below is a Mermaid diagram showing the current relationships between the main entities in the database:

```mermaid
erDiagram
    ProjectTraceRetentionPolicy ||--o{ Project : applied_to
    ProjectTraceRetentionPolicy {
        int id PK
        string name
        string cron_expression
        jsonb rule
    }

    Project ||--o{ Trace : has
    Project ||--o{ ProjectSession : has
    Project ||--o{ ProjectAnnotationConfig : has
    Project {
        int id PK
        string name
        string description
        string gradient_start_color
        string gradient_end_color
        datetime created_at
        datetime updated_at
        int trace_retention_policy_id FK
    }

    ProjectSession ||--o{ Trace : has
    ProjectSession ||--o{ ProjectSessionAnnotation : has
    ProjectSession {
        int id PK
        string session_id
        int project_id FK
        datetime start_time
        datetime end_time
    }

    Trace ||--o{ Span : contains
    Trace ||--o{ ExperimentRun : has
    Trace ||--o{ TraceAnnotation : has
    Trace ||--o{ ExperimentRunAnnotation : has
    Trace {
        int id PK
        int project_rowid FK
        string trace_id
        int project_session_rowid FK
        datetime start_time
        datetime end_time
    }

    Span ||--o{ DocumentAnnotation : has
    Span ||--o{ DatasetExample : has
    Span ||--o{ SpanAnnotation : has
    Span {
        int id PK
        int trace_rowid FK
        string span_id
        string parent_id
        string name
        string span_kind
        datetime start_time
        datetime end_time
        jsonb attributes
        jsonb events
        string status_code
        string status_message
        int cumulative_error_count
        int cumulative_llm_token_count_prompt
        int cumulative_llm_token_count_completion
        int llm_token_count_prompt
        int llm_token_count_completion
    }

    DocumentAnnotation {
        int id PK
        int span_rowid FK
        int document_position
        string name
        string label
        double score
        string explanation
        jsonb metadata
        string annotator_kind
        datetime created_at
        datetime updated_at
        string identifier
        string source
        int user_id FK
    }

    SpanAnnotation {
        int id PK
        int span_rowid FK
        string name
        string label
        double score
        string explanation
        jsonb metadata
        string annotator_kind
        datetime created_at
        datetime updated_at
        string identifier
        string source
        int user_id FK
    }

    TraceAnnotation {
        int id PK
        int trace_rowid FK
        string name
        string label
        double score
        string explanation
        jsonb metadata
        string annotator_kind
        datetime created_at
        datetime updated_at
        string identifier
        string source
        int user_id FK
    }

    Dataset ||--o{ DatasetVersion : has
    Dataset ||--o{ DatasetExample : contains
    Dataset ||--o{ Experiment : used_in
    Dataset ||--o{ DatasetsDatasetLabel : has
    Dataset ||--o{ ExperimentTag : tagged_with
    Dataset {
        int id PK
        string name
        string description
        jsonb metadata
        datetime created_at
        datetime updated_at
        bigint user_id FK
    }

    DatasetVersion ||--o{ DatasetExampleRevision : has
    DatasetVersion ||--o{ Experiment : used_in
    DatasetVersion {
        int id PK
        int dataset_id FK
        string description
        jsonb metadata
        datetime created_at
        bigint user_id FK
    }

    DatasetExample ||--o{ DatasetExampleRevision : has
    DatasetExample ||--o{ DatasetSplitsDatasetExample : belongs_to
    DatasetExample ||--o{ ExperimentsDatasetExample : linked_in
    DatasetExample {
        int id PK
        int dataset_id FK
        int span_rowid FK
        datetime created_at
    }

    DatasetExampleRevision ||--o{ ExperimentsDatasetExample : revision_used
    DatasetExampleRevision {
        int id PK
        int dataset_example_id FK
        int dataset_version_id FK
        jsonb input
        jsonb output
        jsonb metadata
        string revision_kind
        datetime created_at
    }

    Experiment ||--o{ ExperimentRun : has
    Experiment ||--o{ ExperimentTag : has
    Experiment ||--o{ ExperimentsDatasetExample : includes
    Experiment ||--o{ ExperimentsDatasetSplit : uses
    Experiment {
        int id PK
        int dataset_id FK
        int dataset_version_id FK
        string name
        string description
        int repetitions
        jsonb metadata
        string project_name
        datetime created_at
        datetime updated_at
        int user_id FK
    }

    ExperimentRun ||--o{ ExperimentRunAnnotation : has
    DatasetExample ||--o{ ExperimentRun : used_in
    ExperimentRun {
        int id PK
        int experiment_id FK
        int dataset_example_id FK
        int repetition_number
        string trace_id
        jsonb output
        datetime start_time
        datetime end_time
        int prompt_token_count
        int completion_token_count
        string error
    }

    ExperimentRunAnnotation {
        int id PK
        int experiment_run_id FK
        string name
        string annotator_kind
        string label
        double score
        string explanation
        string trace_id
        string error
        jsonb metadata
        datetime start_time
        datetime end_time
    }

    DatasetSplit ||--o{ DatasetSplitsDatasetExample : contains
    DatasetSplit ||--o{ ExperimentsDatasetSplit : used_in
    DatasetSplit {
        bigint id PK
        string name
        string description
        string color
        jsonb metadata
        datetime created_at
        datetime updated_at
        bigint user_id FK
    }

    DatasetSplitsDatasetExample {
        bigint dataset_split_id FK
        bigint dataset_example_id FK
    }

    DatasetLabel ||--o{ DatasetsDatasetLabel : applies_to
    DatasetLabel {
        bigint id PK
        string name
        string description
        string color
        bigint user_id FK
    }

    DatasetsDatasetLabel {
        int id PK
        int dataset_id FK
        int dataset_label_id FK
    }

    ExperimentTag {
        bigint id PK
        bigint experiment_id FK
        bigint dataset_id FK
        string name
        string description
        bigint user_id FK
    }

    ExperimentsDatasetExample {
        bigint experiment_id FK
        bigint dataset_example_id FK
        bigint dataset_example_revision_id FK
    }

    ExperimentsDatasetSplit {
        bigint experiment_id FK
        bigint dataset_split_id FK
    }

    ProjectSessionAnnotation {
        bigint id PK
        bigint project_session_id FK
        string name
        string label
        double score
        string explanation
        jsonb metadata
        string annotator_kind
        bigint user_id FK
        string identifier
        string source
        datetime created_at
        datetime updated_at
    }

    User ||--o{ ApiKey : has
    User ||--o{ AccessToken : has
    User ||--o{ RefreshToken : has
    User ||--o{ PasswordResetToken : has
    User ||--o{ PromptVersion : has
    User ||--o{ PromptVersionTag : has
    User ||--o{ SpanAnnotation : has
    User ||--o{ DocumentAnnotation : has
    User ||--o{ TraceAnnotation : has
    User ||--o{ ProjectSessionAnnotation : has
    User ||--o{ Experiment : creates
    User ||--o{ ExperimentTag : creates
    User ||--o{ DatasetLabel : creates
    User ||--o{ Dataset : creates
    User ||--o{ DatasetVersion : creates
    User ||--o{ DatasetSplit : creates
    User {
        int id PK
        int user_role_id FK
        string username
        string email
        string profile_picture_url
        bytes password_hash
        bytes password_salt
        boolean reset_password
        string oauth2_client_id
        string oauth2_user_id
        string auth_method
        datetime created_at
        datetime updated_at
    }

    UserRole ||--o{ User : has
    UserRole {
        int id PK
        string name
    }

    ApiKey {
        int id PK
        int user_id FK
        string name
        string description
        datetime created_at
        datetime expires_at
    }

    RefreshToken ||--o| AccessToken : creates
    AccessToken {
        int id PK
        int user_id FK
        datetime created_at
        datetime expires_at
        int refresh_token_id FK
    }

    RefreshToken {
        int id PK
        int user_id FK
        datetime created_at
        datetime expires_at
    }

    PasswordResetToken {
        int id PK
        int user_id FK
        datetime created_at
        datetime expires_at
    }

    Prompt ||--o{ PromptVersion : has
    Prompt ||--o{ PromptPromptLabel : has
    Prompt ||--o{ PromptVersionTag : has
    Prompt ||--o{ Prompt : derived_from
    Prompt {
        int id PK
        int source_prompt_id FK
        string name
        string description
        jsonb metadata
        datetime created_at
        datetime updated_at
    }

    PromptVersion ||--o{ PromptVersionTag : has
    PromptVersion {
        int id PK
        int prompt_id FK
        string description
        int user_id FK
        string template_type
        string template_format
        jsonb template
        jsonb invocation_parameters
        json tools
        json response_format
        string model_provider
        string model_name
        jsonb metadata
        datetime created_at
    }

    PromptLabel ||--o{ PromptPromptLabel : has
    PromptLabel {
        int id PK
        string name
        string description
        string color
    }

    PromptPromptLabel {
        int id PK
        int prompt_label_id FK
        int prompt_id FK
    }

    PromptVersionTag {
        int id PK
        string name
        string description
        int prompt_id FK
        int prompt_version_id FK
        int user_id FK
    }

    AnnotationConfig ||--o{ ProjectAnnotationConfig : used_in
    AnnotationConfig {
        int id PK
        string name
        jsonb config
    }

    ProjectAnnotationConfig {
        int id PK
        int project_id FK
        int annotation_config_id FK
    }

    GenerativeModel ||--o{ TokenPrice : has
    GenerativeModel ||--o{ SpanCost : used_in
    GenerativeModel {
        bigint id PK
        string name
        string provider
        string name_pattern
        boolean is_built_in
        datetime start_time
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    TokenPrice {
        bigint id PK
        bigint model_id FK
        string token_type
        boolean is_prompt
        double base_rate
        json customization
    }

    SpanCost ||--o{ SpanCostDetail : has
    SpanCost {
        bigint id PK
        bigint span_rowid FK
        bigint trace_rowid FK
        bigint model_id FK
        datetime span_start_time
        double total_cost
        double total_tokens
        double prompt_cost
        double prompt_tokens
        double completion_cost
        double completion_tokens
    }

    SpanCostDetail {
        bigint id PK
        bigint span_cost_id FK
        string token_type
        boolean is_prompt
        double cost
        double tokens
        double cost_per_token
    }
```

---

## Focused Relationship Views

> **Note**: The following subsection diagrams show simplified table structures focusing only on foreign keys to highlight relationships. These tables contain additional columns (including primary keys and other fields) not shown here - refer to the comprehensive ERD above for complete table definitions.

### Core Tracing & Projects

This subgroup represents the core functionality of Phoenix - projects organize traces into sessions, traces contain spans, and retention policies manage data lifecycle:

```mermaid
erDiagram
    ProjectTraceRetentionPolicy ||--o{ Project : applied_to
    ProjectTraceRetentionPolicy {
    }

    Project ||--o{ ProjectSession : has
    Project ||--o{ Trace : has
    Project {
        int trace_retention_policy_id FK
    }

    ProjectSession ||--o{ Trace : has
    ProjectSession {
        int project_id FK
    }

    Trace ||--o{ Span : contains
    Trace {
        int project_rowid FK
        int project_session_rowid FK
    }

    Span {
        int trace_rowid FK
        string parent_id
    }
```

### Datasets & Data Management

This subgroup shows how datasets are created from spans, organized with versions and splits, and labeled for better organization:

```mermaid
erDiagram
    User ||--o{ DatasetLabel : creates
    User ||--o{ Dataset : creates
    User ||--o{ DatasetSplit : creates
    User ||--o{ DatasetVersion : creates
    User {
    }

    Trace ||--o{ Span : contains
    Trace {
    }

    Span ||--o{ DatasetExample : becomes
    Span {
        int trace_rowid FK
    }

    Dataset ||--o{ DatasetVersion : has
    Dataset ||--o{ DatasetExample : contains
    Dataset ||--o{ DatasetsDatasetLabel : has
    Dataset {
        bigint user_id FK
    }

    DatasetVersion ||--o{ DatasetExampleRevision : has
    DatasetVersion {
        int dataset_id FK
        bigint user_id FK
    }

    DatasetExample ||--o{ DatasetExampleRevision : has
    DatasetExample ||--o{ DatasetSplitsDatasetExample : belongs_to
    DatasetExample {
        int dataset_id FK
        int span_rowid FK
    }

    DatasetExampleRevision {
        int dataset_example_id FK
        int dataset_version_id FK
    }

    DatasetSplit ||--o{ DatasetSplitsDatasetExample : contains
    DatasetSplit {
        bigint user_id FK
    }

    DatasetSplitsDatasetExample {
        bigint dataset_split_id FK
        bigint dataset_example_id FK
    }

    DatasetLabel ||--o{ DatasetsDatasetLabel : applies_to
    DatasetLabel {
        bigint user_id FK
    }

    DatasetsDatasetLabel {
        int dataset_id FK
        int dataset_label_id FK
    }
```

### Experiments & Evaluation

This subgroup shows how experiments use datasets to run evaluations, track results, and organize findings with tags and annotations:

```mermaid
erDiagram
    User ||--o{ Experiment : creates
    User ||--o{ ExperimentTag : creates
    User {
    }

    Dataset ||--o{ Experiment : used_in
    Dataset {
    }

    DatasetVersion ||--o{ Experiment : used_in
    DatasetVersion {
    }

    DatasetExample ||--o{ ExperimentRun : used_in
    DatasetExample ||--o{ ExperimentsDatasetExample : linked_in
    DatasetExample {
    }

    DatasetExampleRevision ||--o{ ExperimentsDatasetExample : revision_used
    DatasetExampleRevision {
    }

    DatasetSplit ||--o{ ExperimentsDatasetSplit : used_in
    DatasetSplit {
    }

    Experiment ||--o{ ExperimentRun : has
    Experiment ||--o{ ExperimentTag : has
    Experiment ||--o{ ExperimentsDatasetExample : includes
    Experiment ||--o{ ExperimentsDatasetSplit : uses
    Experiment {
        int dataset_id FK
        int dataset_version_id FK
        bigint user_id FK
    }

    ExperimentRun ||--o{ ExperimentRunAnnotation : has
    ExperimentRun {
        int experiment_id FK
        int dataset_example_id FK
        string trace_id
    }

    ExperimentRunAnnotation {
        int experiment_run_id FK
    }

    ExperimentTag {
        bigint experiment_id FK
        bigint dataset_id FK
        bigint user_id FK
    }

    ExperimentsDatasetExample {
        bigint experiment_id FK
        bigint dataset_example_id FK
        bigint dataset_example_revision_id FK
    }

    ExperimentsDatasetSplit {
        bigint experiment_id FK
        bigint dataset_split_id FK
    }
```

### User Management & Authentication

This subgroup shows how users are managed with roles and different authentication methods:

```mermaid
erDiagram
    UserRole ||--o{ User : has
    UserRole {
    }

    User ||--o{ ApiKey : has
    User ||--o{ AccessToken : has
    User ||--o{ RefreshToken : has
    User ||--o{ PasswordResetToken : has
    User {
        int user_role_id FK
    }

    ApiKey {
        int user_id FK
    }

    RefreshToken ||--o| AccessToken : creates
    RefreshToken {
        int user_id FK
    }

    AccessToken {
        int user_id FK
        int refresh_token_id FK
    }

    PasswordResetToken {
        int user_id FK
    }
```

### Annotations

This subgroup shows how annotations are attached to spans, documents, traces, and project sessions, including their configuration:

```mermaid
erDiagram
    Project ||--o{ ProjectAnnotationConfig : has
    Project ||--o{ ProjectSession : has
    Project ||--o{ Trace : has
    Project {
    }

    ProjectSession ||--o{ ProjectSessionAnnotation : has
    ProjectSession {
        int project_id FK
    }

    Trace ||--o{ Span : contains
    Trace ||--o{ TraceAnnotation : has
    Trace {
        int project_rowid FK
    }

    Span ||--o{ SpanAnnotation : has
    Span ||--o{ DocumentAnnotation : has
    Span {
        int trace_rowid FK
    }

    User ||--o{ SpanAnnotation : creates
    User ||--o{ DocumentAnnotation : creates
    User ||--o{ TraceAnnotation : creates
    User ||--o{ ProjectSessionAnnotation : creates
    User {
    }

    AnnotationConfig ||--o{ ProjectAnnotationConfig : configures
    AnnotationConfig {
    }

    ProjectAnnotationConfig {
        int project_id FK
        int annotation_config_id FK
    }

    SpanAnnotation {
        int span_rowid FK
        int user_id FK
    }

    DocumentAnnotation {
        int span_rowid FK
        int user_id FK
    }

    TraceAnnotation {
        int trace_rowid FK
        int user_id FK
    }

    ProjectSessionAnnotation {
        bigint project_session_id FK
        bigint user_id FK
    }
```

### Prompts

This subgroup shows how users create and manage prompt templates, versions, labels, and tags:

```mermaid
erDiagram
    User ||--o{ PromptVersion : creates
    User ||--o{ PromptVersionTag : creates
    User {
    }

    Prompt ||--o{ PromptVersion : has
    Prompt ||--o{ PromptPromptLabel : has
    Prompt ||--o{ PromptVersionTag : has
    Prompt ||--o{ Prompt : derived_from
    Prompt {
        int source_prompt_id FK
    }

    PromptVersion ||--o{ PromptVersionTag : has
    PromptVersion {
        int prompt_id FK
        int user_id FK
    }

    PromptLabel ||--o{ PromptPromptLabel : has
    PromptLabel {
    }

    PromptPromptLabel {
        int prompt_label_id FK
        int prompt_id FK
    }

    PromptVersionTag {
        int prompt_id FK
        int prompt_version_id FK
        int user_id FK
    }
```

### Cost & Pricing

This subgroup shows how LLM costs are calculated and tracked for spans and traces:

```mermaid
erDiagram
    Trace ||--o{ Span : contains
    Trace ||--o{ SpanCost : tracks
    Trace {
    }

    Span ||--o{ SpanCost : generates
    Span {
        int trace_rowid FK
    }

    GenerativeModel ||--o{ TokenPrice : defines
    GenerativeModel ||--o{ SpanCost : calculates
    GenerativeModel {
    }

    TokenPrice {
        bigint model_id FK
    }

    SpanCost ||--o{ SpanCostDetail : has
    SpanCost {
        bigint span_rowid FK
        bigint trace_rowid FK
        bigint model_id FK
    }

    SpanCostDetail {
        bigint span_cost_id FK
    }
```

### User-Created Content

This subgroup shows all entities that track user ownership through user_id foreign keys, representing content created or managed by users across datasets, experiments, prompts, and annotations:

```mermaid
erDiagram
    User ||--o{ Dataset : creates
    User ||--o{ DatasetVersion : creates
    User ||--o{ DatasetSplit : creates
    User ||--o{ DatasetLabel : creates
    User ||--o{ Experiment : creates
    User ||--o{ ExperimentTag : creates
    User ||--o{ PromptVersion : creates
    User ||--o{ PromptVersionTag : creates
    User ||--o{ SpanAnnotation : creates
    User ||--o{ DocumentAnnotation : creates
    User ||--o{ TraceAnnotation : creates
    User ||--o{ ProjectSessionAnnotation : creates
    User {
    }

    Dataset {
        bigint user_id FK
    }

    DatasetVersion {
        bigint user_id FK
    }

    DatasetSplit {
        bigint user_id FK
    }

    DatasetLabel {
        bigint user_id FK
    }

    Experiment {
        bigint user_id FK
    }

    ExperimentTag {
        bigint user_id FK
    }

    PromptVersion {
        int user_id FK
    }

    PromptVersionTag {
        int user_id FK
    }

    SpanAnnotation {
        int user_id FK
    }

    DocumentAnnotation {
        int user_id FK
    }

    TraceAnnotation {
        int user_id FK
    }

    ProjectSessionAnnotation {
        bigint user_id FK
    }
```

