create table main.alembic_version
(
    version_num VARCHAR(32) not null
        constraint alembic_version_pkc
            primary key
);

create table main.annotation_configs
(
    id     INTEGER not null
        constraint pk_annotation_configs
            primary key,
    name   VARCHAR not null
        constraint uq_annotation_configs_name
            unique,
    config JSONB   not null
);

create table main.datasets
(
    id          INTEGER                             not null
        constraint pk_datasets
            primary key,
    name        VARCHAR                             not null
        constraint uq_datasets_name
            unique,
    description VARCHAR,
    metadata    JSONB                               not null,
    created_at  TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at  TIMESTAMP default CURRENT_TIMESTAMP not null
);

create table main.dataset_versions
(
    id          INTEGER                             not null
        constraint pk_dataset_versions
            primary key,
    dataset_id  INTEGER                             not null
        constraint fk_dataset_versions_dataset_id_datasets
            references main.datasets
            on delete cascade,
    description VARCHAR,
    metadata    JSONB                               not null,
    created_at  TIMESTAMP default CURRENT_TIMESTAMP not null
);

create index main.ix_dataset_versions_dataset_id
    on main.dataset_versions (dataset_id);

create table main.experiments
(
    id                 INTEGER                             not null
        constraint pk_experiments
            primary key,
    dataset_id         INTEGER                             not null
        constraint fk_experiments_dataset_id_datasets
            references main.datasets
            on delete cascade,
    dataset_version_id INTEGER                             not null
        constraint fk_experiments_dataset_version_id_dataset_versions
            references main.dataset_versions
            on delete cascade,
    name               VARCHAR                             not null,
    description        VARCHAR,
    repetitions        INTEGER                             not null,
    metadata           JSONB                               not null,
    project_name       VARCHAR,
    created_at         TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at         TIMESTAMP default CURRENT_TIMESTAMP not null
);

create index main.ix_experiments_dataset_id
    on main.experiments (dataset_id);

create index main.ix_experiments_dataset_version_id
    on main.experiments (dataset_version_id);

create index main.ix_experiments_project_name
    on main.experiments (project_name);

create table main.generative_models
(
    id           INTEGER                             not null
        constraint pk_generative_models
            primary key,
    name         VARCHAR                             not null,
    provider     VARCHAR                             not null,
    name_pattern VARCHAR                             not null,
    is_built_in  BOOLEAN                             not null,
    start_time   TIMESTAMP,
    created_at   TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at   TIMESTAMP default CURRENT_TIMESTAMP not null,
    deleted_at   TIMESTAMP
);

create unique index main.ix_generative_models_match_criteria
    on main.generative_models (name_pattern, provider, is_built_in)
    where deleted_at IS NULL;

create unique index main.ix_generative_models_name_is_built_in
    on main.generative_models (name, is_built_in)
    where deleted_at IS NULL;

create table main.project_trace_retention_policies
(
    id              INTEGER not null
        constraint pk_project_trace_retention_policies
            primary key,
    name            VARCHAR not null,
    cron_expression VARCHAR not null,
    rule            JSONB   not null
);

create table main.projects
(
    id                        INTEGER                             not null
        constraint pk_projects
            primary key,
    name                      VARCHAR                             not null
        constraint uq_projects_name
            unique,
    description               VARCHAR,
    gradient_start_color      VARCHAR   default '#5bdbff'         not null,
    gradient_end_color        VARCHAR   default '#1c76fc'         not null,
    created_at                TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at                TIMESTAMP default CURRENT_TIMESTAMP not null,
    trace_retention_policy_id INTEGER
        constraint fk_projects_trace_retention_policy_id_project_trace_retention_policies
            references main.project_trace_retention_policies
            on delete set null
);

create table main.project_annotation_configs
(
    id                   INTEGER not null
        constraint pk_project_annotation_configs
            primary key,
    project_id           INTEGER not null
        constraint fk_project_annotation_configs_project_id_projects
            references main.projects
            on delete cascade,
    annotation_config_id INTEGER not null
        constraint fk_project_annotation_configs_annotation_config_id_annotation_configs
            references main.annotation_configs
            on delete cascade,
    constraint uq_project_annotation_configs_project_id_annotation_config_id
        unique (project_id, annotation_config_id)
);

create index main.ix_project_annotation_configs_annotation_config_id
    on main.project_annotation_configs (annotation_config_id);

create index main.ix_project_annotation_configs_project_id
    on main.project_annotation_configs (project_id);

create table main.project_sessions
(
    id         INTEGER   not null
        constraint pk_project_sessions
            primary key,
    session_id VARCHAR   not null
        constraint uq_project_sessions_session_id
            unique,
    project_id INTEGER   not null
        constraint fk_project_sessions_project_id_projects
            references main.projects
            on delete cascade,
    start_time TIMESTAMP not null,
    end_time   TIMESTAMP not null
);

create index main.ix_project_sessions_end_time
    on main.project_sessions (end_time);

create index main.ix_project_sessions_project_id_start_time
    on main.project_sessions (project_id asc, start_time desc);

create index main.ix_projects_trace_retention_policy_id
    on main.projects (trace_retention_policy_id);

create table main.prompt_labels
(
    id          INTEGER not null
        constraint pk_prompt_labels
            primary key,
    name        VARCHAR not null,
    description VARCHAR,
    color       VARCHAR
);

create unique index main.ix_prompt_labels_name
    on main.prompt_labels (name);

create table main.prompts
(
    id               INTEGER                             not null
        constraint pk_prompts
            primary key,
    source_prompt_id INTEGER
        constraint fk_prompts_source_prompt_id_prompts
            references main.prompts
            on delete set null,
    name             VARCHAR                             not null,
    description      VARCHAR,
    metadata         JSONB                               not null,
    created_at       TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at       TIMESTAMP default CURRENT_TIMESTAMP not null
);

create unique index main.ix_prompts_name
    on main.prompts (name);

create index main.ix_prompts_source_prompt_id
    on main.prompts (source_prompt_id);

create table main.prompts_prompt_labels
(
    id              INTEGER not null
        constraint pk_prompts_prompt_labels
            primary key,
    prompt_label_id INTEGER not null
        constraint fk_prompts_prompt_labels_prompt_label_id_prompt_labels
            references main.prompt_labels
            on delete cascade,
    prompt_id       INTEGER not null
        constraint fk_prompts_prompt_labels_prompt_id_prompts
            references main.prompts
            on delete cascade,
    constraint uq_prompts_prompt_labels_prompt_label_id_prompt_id
        unique (prompt_label_id, prompt_id)
);

create index main.ix_prompts_prompt_labels_prompt_id
    on main.prompts_prompt_labels (prompt_id);

create index main.ix_prompts_prompt_labels_prompt_label_id
    on main.prompts_prompt_labels (prompt_label_id);

create table main.sqlite_master
(
    type     TEXT,
    name     TEXT,
    tbl_name TEXT,
    rootpage INT,
    sql      TEXT
);

create table main.sqlite_sequence
(
    name,
    seq
);

create table main.token_prices
(
    id            INTEGER not null
        constraint pk_token_prices
            primary key,
    model_id      INTEGER not null
        constraint fk_token_prices_model_id_generative_models
            references main.generative_models
            on delete cascade,
    token_type    VARCHAR not null,
    is_prompt     BOOLEAN not null,
    base_rate     FLOAT   not null,
    customization JSON,
    constraint uq_token_prices_model_id_token_type_is_prompt
        unique (model_id, token_type, is_prompt)
);

create index main.ix_token_prices_model_id
    on main.token_prices (model_id);

create table main.traces
(
    id                    INTEGER   not null
        constraint pk_traces
            primary key,
    project_rowid         INTEGER   not null
        constraint fk_traces_project_rowid_projects
            references main.projects
            on delete cascade,
    trace_id              VARCHAR   not null
        constraint uq_traces_trace_id
            unique,
    start_time            TIMESTAMP not null,
    end_time              TIMESTAMP not null,
    project_session_rowid INTEGER
        constraint fk_traces_project_session_rowid_project_sessions
            references main.project_sessions
            on delete cascade
);

create table main.spans
(
    id                                    INTEGER                 not null
        constraint pk_spans
            primary key,
    trace_rowid                           INTEGER                 not null
        constraint fk_spans_trace_rowid_traces
            references main.traces
            on delete cascade,
    span_id                               VARCHAR                 not null
        constraint uq_spans_span_id
            unique,
    parent_id                             VARCHAR,
    name                                  VARCHAR                 not null,
    span_kind                             VARCHAR                 not null,
    start_time                            TIMESTAMP               not null,
    end_time                              TIMESTAMP               not null,
    attributes                            JSONB                   not null,
    events                                JSONB                   not null,
    status_code                           VARCHAR default 'UNSET' not null,
    status_message                        VARCHAR                 not null,
    cumulative_error_count                INTEGER                 not null,
    cumulative_llm_token_count_prompt     INTEGER                 not null,
    cumulative_llm_token_count_completion INTEGER                 not null,
    llm_token_count_prompt                INTEGER,
    llm_token_count_completion            INTEGER,
    constraint "ck_spans_`valid_status`"
        check (status_code IN ('OK', 'ERROR', 'UNSET'))
);

create table main.dataset_examples
(
    id         INTEGER                             not null
        constraint pk_dataset_examples
            primary key,
    dataset_id INTEGER                             not null
        constraint fk_dataset_examples_dataset_id_datasets
            references main.datasets
            on delete cascade,
    span_rowid INTEGER
        constraint fk_dataset_examples_span_rowid_spans
            references main.spans
            on delete set null,
    created_at TIMESTAMP default CURRENT_TIMESTAMP not null
);

create table main.dataset_example_revisions
(
    id                 INTEGER                             not null
        constraint pk_dataset_example_revisions
            primary key,
    dataset_example_id INTEGER                             not null
        constraint fk_dataset_example_revisions_dataset_example_id_dataset_examples
            references main.dataset_examples
            on delete cascade,
    dataset_version_id INTEGER                             not null
        constraint fk_dataset_example_revisions_dataset_version_id_dataset_versions
            references main.dataset_versions
            on delete cascade,
    input              JSONB                               not null,
    output             JSONB                               not null,
    metadata           JSONB                               not null,
    revision_kind      VARCHAR                             not null,
    created_at         TIMESTAMP default CURRENT_TIMESTAMP not null,
    constraint uq_dataset_example_revisions_dataset_example_id_dataset_version_id
        unique (dataset_example_id, dataset_version_id),
    constraint "ck_dataset_example_revisions_`valid_revision_kind`"
        check (revision_kind IN ('CREATE', 'PATCH', 'DELETE'))
);

create index main.ix_dataset_example_revisions_dataset_example_id
    on main.dataset_example_revisions (dataset_example_id);

create index main.ix_dataset_example_revisions_dataset_version_id
    on main.dataset_example_revisions (dataset_version_id);

create index main.ix_dataset_examples_dataset_id
    on main.dataset_examples (dataset_id);

create index main.ix_dataset_examples_span_rowid
    on main.dataset_examples (span_rowid);

create table main.experiment_runs
(
    id                     INTEGER   not null
        constraint pk_experiment_runs
            primary key,
    experiment_id          INTEGER   not null
        constraint fk_experiment_runs_experiment_id_experiments
            references main.experiments
            on delete cascade,
    dataset_example_id     INTEGER   not null
        constraint fk_experiment_runs_dataset_example_id_dataset_examples
            references main.dataset_examples
            on delete cascade,
    repetition_number      INTEGER   not null,
    trace_id               VARCHAR,
    output                 JSONB     not null,
    start_time             TIMESTAMP not null,
    end_time               TIMESTAMP not null,
    prompt_token_count     INTEGER,
    completion_token_count INTEGER,
    error                  VARCHAR,
    constraint uq_experiment_runs_experiment_id_dataset_example_id_repetition_number
        unique (experiment_id, dataset_example_id, repetition_number)
);

create table main.experiment_run_annotations
(
    id                INTEGER   not null
        constraint pk_experiment_run_annotations
            primary key,
    experiment_run_id INTEGER   not null
        constraint fk_experiment_run_annotations_experiment_run_id_experiment_runs
            references main.experiment_runs
            on delete cascade,
    name              VARCHAR   not null,
    annotator_kind    VARCHAR   not null,
    label             VARCHAR,
    score             FLOAT,
    explanation       VARCHAR,
    trace_id          VARCHAR,
    error             VARCHAR,
    metadata          JSONB     not null,
    start_time        TIMESTAMP not null,
    end_time          TIMESTAMP not null,
    constraint uq_experiment_run_annotations_experiment_run_id_name
        unique (experiment_run_id, name),
    constraint "ck_experiment_run_annotations_`valid_annotator_kind`"
        check (annotator_kind IN ('LLM', 'CODE', 'HUMAN'))
);

create index main.ix_experiment_run_annotations_experiment_run_id
    on main.experiment_run_annotations (experiment_run_id);

create index main.ix_experiment_runs_dataset_example_id
    on main.experiment_runs (dataset_example_id);

create index main.ix_experiment_runs_experiment_id
    on main.experiment_runs (experiment_id);

create table main.span_costs
(
    id                INTEGER   not null
        constraint pk_span_costs
            primary key,
    span_rowid        INTEGER   not null
        constraint fk_span_costs_span_rowid_spans
            references main.spans
            on delete cascade,
    trace_rowid       INTEGER   not null
        constraint fk_span_costs_trace_rowid_traces
            references main.traces
            on delete cascade,
    model_id          INTEGER
        constraint fk_span_costs_model_id_generative_models
            references main.generative_models
            on delete restrict,
    span_start_time   TIMESTAMP not null,
    total_cost        FLOAT,
    total_tokens      FLOAT,
    prompt_cost       FLOAT,
    prompt_tokens     FLOAT,
    completion_cost   FLOAT,
    completion_tokens FLOAT
);

create table main.span_cost_details
(
    id             INTEGER not null
        constraint pk_span_cost_details
            primary key,
    span_cost_id   INTEGER not null
        constraint fk_span_cost_details_span_cost_id_span_costs
            references main.span_costs
            on delete cascade,
    token_type     VARCHAR not null,
    is_prompt      BOOLEAN not null,
    cost           FLOAT,
    tokens         FLOAT,
    cost_per_token FLOAT,
    constraint uq_span_cost_details_span_cost_id_token_type_is_prompt
        unique (span_cost_id, token_type, is_prompt)
);

create index main.ix_span_cost_details_span_cost_id
    on main.span_cost_details (span_cost_id);

create index main.ix_span_cost_details_token_type
    on main.span_cost_details (token_type);

create index main.ix_span_costs_model_id_span_start_time
    on main.span_costs (model_id, span_start_time);

create index main.ix_span_costs_span_rowid
    on main.span_costs (span_rowid);

create index main.ix_span_costs_span_start_time
    on main.span_costs (span_start_time);

create index main.ix_span_costs_trace_rowid
    on main.span_costs (trace_rowid);

create index main.ix_cumulative_llm_token_count_total
    on main.spans ("(cumulative_llm_token_count_prompt + cumulative_llm_token_count_completion)");

create index main.ix_latency
    on main.spans ("(end_time - start_time)");

create index main.ix_spans_parent_id
    on main.spans (parent_id);

create index main.ix_spans_start_time
    on main.spans (start_time);

create index main.ix_spans_trace_rowid
    on main.spans (trace_rowid);

create index main.ix_traces_project_rowid_start_time
    on main.traces (project_rowid asc, start_time desc);

create index main.ix_traces_project_session_rowid
    on main.traces (project_session_rowid);

create table main.user_roles
(
    id   INTEGER not null
        constraint pk_user_roles
            primary key,
    name VARCHAR not null
);

create unique index main.ix_user_roles_name
    on main.user_roles (name);

create table main.users
(
    id                  INTEGER                             not null
        primary key,
    user_role_id        INTEGER                             not null
        constraint fk_users_user_role_id_user_roles
            references main.user_roles
            on delete cascade,
    username            VARCHAR                             not null,
    email               VARCHAR                             not null,
    profile_picture_url VARCHAR,
    password_hash       BLOB,
    password_salt       BLOB,
    reset_password      BOOLEAN                             not null,
    oauth2_client_id    VARCHAR,
    oauth2_user_id      VARCHAR,
    created_at          TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at          TIMESTAMP default CURRENT_TIMESTAMP not null,
    auth_method         VARCHAR                             not null,
    constraint uq_users_oauth2_client_id_oauth2_user_id
        unique (oauth2_client_id, oauth2_user_id),
    constraint "ck_users_`local_auth_has_password_no_oauth`"
        check (auth_method != 'LOCAL' OR
               (password_hash IS NOT NULL AND password_salt IS NOT NULL AND oauth2_client_id IS NULL AND
                oauth2_user_id IS NULL)),
    constraint "ck_users_`non_local_auth_has_no_password`"
        check (auth_method = 'LOCAL' OR (password_hash IS NULL AND password_salt IS NULL)),
    constraint "ck_users_`valid_auth_method`"
        check (auth_method IN ('LOCAL', 'OAUTH2'))
);

create table main.api_keys
(
    id          INTEGER                             not null
        primary key autoincrement,
    user_id     INTEGER
        constraint fk_api_keys_user_id_users
            references main.users
            on delete cascade,
    name        VARCHAR                             not null,
    description VARCHAR,
    created_at  TIMESTAMP default CURRENT_TIMESTAMP not null,
    expires_at  TIMESTAMP
);

create index main.ix_api_keys_expires_at
    on main.api_keys (expires_at);

create index main.ix_api_keys_user_id
    on main.api_keys (user_id);

create table main.document_annotations
(
    id                INTEGER                             not null
        constraint pk_document_annotations
            primary key,
    span_rowid        INTEGER                             not null
        constraint fk_document_annotations_span_rowid_spans
            references main.spans
            on delete cascade,
    document_position INTEGER                             not null,
    name              VARCHAR                             not null,
    label             VARCHAR,
    score             FLOAT,
    explanation       VARCHAR,
    metadata          NUMERIC                             not null,
    annotator_kind    VARCHAR                             not null,
    created_at        TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at        TIMESTAMP default CURRENT_TIMESTAMP not null,
    user_id           INTEGER
        constraint fk_document_annotations_user_id_users
            references main.users
            on delete set null,
    identifier        VARCHAR   default ''                not null,
    source            VARCHAR                             not null,
    constraint uq_document_annotations_name_span_rowid_document_pos_identifier
        unique (name, span_rowid, document_position, identifier),
    constraint "ck_document_annotations_`valid_annotator_kind`"
        check (annotator_kind IN ('LLM', 'CODE', 'HUMAN')),
    constraint "ck_document_annotations_`valid_source`"
        check (source IN ('API', 'APP'))
);

create index main.ix_document_annotations_span_rowid
    on main.document_annotations (span_rowid);

create table main.password_reset_tokens
(
    id         INTEGER                             not null
        primary key autoincrement,
    user_id    INTEGER
        constraint fk_password_reset_tokens_user_id_users
            references main.users
            on delete cascade,
    created_at TIMESTAMP default CURRENT_TIMESTAMP not null,
    expires_at TIMESTAMP                           not null
);

create index main.ix_password_reset_tokens_expires_at
    on main.password_reset_tokens (expires_at);

create unique index main.ix_password_reset_tokens_user_id
    on main.password_reset_tokens (user_id);

create table main.project_session_annotations
(
    id                 INTEGER                             not null
        constraint pk_project_session_annotations
            primary key,
    project_session_id INTEGER                             not null
        constraint fk_project_session_annotations_project_session_id_project_sessions
            references main.project_sessions
            on delete cascade,
    name               VARCHAR                             not null,
    label              VARCHAR,
    score              FLOAT,
    explanation        VARCHAR,
    metadata           JSONB                               not null,
    annotator_kind     VARCHAR                             not null,
    user_id            INTEGER
        constraint fk_project_session_annotations_user_id_users
            references main.users
            on delete set null,
    identifier         VARCHAR   default ''                not null,
    source             VARCHAR                             not null,
    created_at         TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at         TIMESTAMP default CURRENT_TIMESTAMP not null,
    constraint uq_project_session_annotations_name_project_session_id_identifier
        unique (name, project_session_id, identifier),
    constraint "ck_project_session_annotations_`valid_annotator_kind`"
        check (annotator_kind IN ('LLM', 'CODE', 'HUMAN')),
    constraint "ck_project_session_annotations_`valid_source`"
        check (source IN ('API', 'APP'))
);

create index main.ix_project_session_annotations_project_session_id
    on main.project_session_annotations (project_session_id);

create table main.prompt_versions
(
    id                    INTEGER                             not null
        primary key,
    prompt_id             INTEGER                             not null
        constraint fk_prompt_versions_prompt_id_prompts
            references main.prompts
            on delete cascade,
    description           VARCHAR,
    user_id               INTEGER
        constraint fk_prompt_versions_user_id_users
            references main.users
            on delete set null,
    template_type         VARCHAR                             not null,
    template_format       VARCHAR                             not null,
    template              NUMERIC                             not null,
    invocation_parameters NUMERIC                             not null,
    tools                 JSON,
    response_format       JSON,
    model_provider        VARCHAR                             not null,
    model_name            VARCHAR                             not null,
    metadata              NUMERIC                             not null,
    created_at            TIMESTAMP default CURRENT_TIMESTAMP not null,
    constraint "ck_prompt_versions_`template_format`"
        check (template_format IN ('F_STRING', 'MUSTACHE', 'NONE')),
    constraint "ck_prompt_versions_`template_type`"
        check (template_type IN ('CHAT', 'STR'))
);

create table main.prompt_version_tags
(
    id                INTEGER not null
        constraint pk_prompt_version_tags
            primary key,
    name              VARCHAR not null,
    description       VARCHAR,
    prompt_id         INTEGER not null
        constraint fk_prompt_version_tags_prompt_id_prompts
            references main.prompts
            on delete cascade,
    prompt_version_id INTEGER not null
        constraint fk_prompt_version_tags_prompt_version_id_prompt_versions
            references main.prompt_versions
            on delete cascade,
    user_id           INTEGER
        constraint fk_prompt_version_tags_user_id_users
            references main.users
            on delete set null,
    constraint uq_prompt_version_tags_name_prompt_id
        unique (name, prompt_id)
);

create index main.ix_prompt_version_tags_prompt_id
    on main.prompt_version_tags (prompt_id);

create index main.ix_prompt_version_tags_prompt_version_id
    on main.prompt_version_tags (prompt_version_id);

create index main.ix_prompt_version_tags_user_id
    on main.prompt_version_tags (user_id);

create index main.ix_prompt_versions_prompt_id
    on main.prompt_versions (prompt_id);

create index main.ix_prompt_versions_user_id
    on main.prompt_versions (user_id);

create table main.refresh_tokens
(
    id         INTEGER                             not null
        primary key autoincrement,
    user_id    INTEGER
        constraint fk_refresh_tokens_user_id_users
            references main.users
            on delete cascade,
    created_at TIMESTAMP default CURRENT_TIMESTAMP not null,
    expires_at TIMESTAMP                           not null
);

create table main.access_tokens
(
    id               INTEGER                             not null
        primary key autoincrement,
    user_id          INTEGER
        constraint fk_access_tokens_user_id_users
            references main.users
            on delete cascade,
    created_at       TIMESTAMP default CURRENT_TIMESTAMP not null,
    expires_at       TIMESTAMP                           not null,
    refresh_token_id INTEGER
        constraint fk_access_tokens_refresh_token_id_refresh_tokens
            references main.refresh_tokens
            on delete cascade
);

create index main.ix_access_tokens_expires_at
    on main.access_tokens (expires_at);

create unique index main.ix_access_tokens_refresh_token_id
    on main.access_tokens (refresh_token_id);

create index main.ix_access_tokens_user_id
    on main.access_tokens (user_id);

create index main.ix_refresh_tokens_expires_at
    on main.refresh_tokens (expires_at);

create index main.ix_refresh_tokens_user_id
    on main.refresh_tokens (user_id);

create table main.span_annotations
(
    id             INTEGER                             not null
        constraint pk_span_annotations
            primary key,
    span_rowid     INTEGER                             not null
        constraint fk_span_annotations_span_rowid_spans
            references main.spans
            on delete cascade,
    name           VARCHAR                             not null,
    label          VARCHAR,
    score          FLOAT,
    explanation    VARCHAR,
    metadata       NUMERIC                             not null,
    annotator_kind VARCHAR                             not null,
    created_at     TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at     TIMESTAMP default CURRENT_TIMESTAMP not null,
    user_id        INTEGER
        constraint fk_span_annotations_user_id_users
            references main.users
            on delete set null,
    identifier     VARCHAR   default ''                not null,
    source         VARCHAR                             not null,
    constraint uq_span_annotations_name_span_rowid_identifier
        unique (name, span_rowid, identifier),
    constraint "ck_span_annotations_`valid_annotator_kind`"
        check (annotator_kind IN ('LLM', 'CODE', 'HUMAN')),
    constraint "ck_span_annotations_`valid_source`"
        check (source IN ('API', 'APP'))
);

create index main.ix_span_annotations_span_rowid
    on main.span_annotations (span_rowid);

create table main.trace_annotations
(
    id             INTEGER                             not null
        constraint pk_trace_annotations
            primary key,
    trace_rowid    INTEGER                             not null
        constraint fk_trace_annotations_trace_rowid_traces
            references main.traces
            on delete cascade,
    name           VARCHAR                             not null,
    label          VARCHAR,
    score          FLOAT,
    explanation    VARCHAR,
    metadata       NUMERIC                             not null,
    annotator_kind VARCHAR                             not null,
    created_at     TIMESTAMP default CURRENT_TIMESTAMP not null,
    updated_at     TIMESTAMP default CURRENT_TIMESTAMP not null,
    user_id        INTEGER
        constraint fk_trace_annotations_user_id_users
            references main.users
            on delete set null,
    identifier     VARCHAR   default ''                not null,
    source         VARCHAR                             not null,
    constraint uq_trace_annotations_name_trace_rowid_identifier
        unique (name, trace_rowid, identifier),
    constraint "ck_trace_annotations_`valid_annotator_kind`"
        check (annotator_kind IN ('LLM', 'CODE', 'HUMAN')),
    constraint "ck_trace_annotations_`valid_source`"
        check (source IN ('API', 'APP'))
);

create index main.ix_trace_annotations_trace_rowid
    on main.trace_annotations (trace_rowid);

create unique index main.ix_users_email
    on main.users (email);

create index main.ix_users_user_role_id
    on main.users (user_role_id);

create unique index main.ix_users_username
    on main.users (username);

