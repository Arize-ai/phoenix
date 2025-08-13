create table public.alembic_version
(
    version_num varchar(32) not null
        constraint alembic_version_pkc
            primary key
);

alter table public.alembic_version
    owner to postgres;

create table public.datasets
(
    id          serial
        constraint pk_datasets
            primary key,
    name        varchar                                not null
        constraint uq_datasets_name
            unique,
    description varchar,
    metadata    jsonb                                  not null,
    created_at  timestamp with time zone default now() not null,
    updated_at  timestamp with time zone default now() not null
);

alter table public.datasets
    owner to postgres;

create table public.dataset_versions
(
    id          serial
        constraint pk_dataset_versions
            primary key,
    dataset_id  integer                                not null
        constraint fk_dataset_versions_dataset_id_datasets
            references public.datasets
            on delete cascade,
    description varchar,
    metadata    jsonb                                  not null,
    created_at  timestamp with time zone default now() not null
);

alter table public.dataset_versions
    owner to postgres;

create index ix_dataset_versions_dataset_id
    on public.dataset_versions (dataset_id);

create table public.experiments
(
    id                 serial
        constraint pk_experiments
            primary key,
    dataset_id         integer                                not null
        constraint fk_experiments_dataset_id_datasets
            references public.datasets
            on delete cascade,
    dataset_version_id integer                                not null
        constraint fk_experiments_dataset_version_id_dataset_versions
            references public.dataset_versions
            on delete cascade,
    name               varchar                                not null,
    description        varchar,
    repetitions        integer                                not null,
    metadata           jsonb                                  not null,
    project_name       varchar,
    created_at         timestamp with time zone default now() not null,
    updated_at         timestamp with time zone default now() not null
);

alter table public.experiments
    owner to postgres;

create index ix_experiments_project_name
    on public.experiments (project_name);

create index ix_experiments_dataset_id
    on public.experiments (dataset_id);

create index ix_experiments_dataset_version_id
    on public.experiments (dataset_version_id);

create table public.user_roles
(
    id   serial
        constraint pk_user_roles
            primary key,
    name varchar not null
);

alter table public.user_roles
    owner to postgres;

create unique index ix_user_roles_name
    on public.user_roles (name);

create table public.users
(
    id                  serial
        constraint pk_users
            primary key,
    user_role_id        integer                                not null
        constraint fk_users_user_role_id_user_roles
            references public.user_roles
            on delete cascade,
    username            varchar                                not null,
    email               varchar                                not null,
    profile_picture_url varchar,
    password_hash       bytea,
    password_salt       bytea,
    reset_password      boolean                                not null,
    oauth2_client_id    varchar,
    oauth2_user_id      varchar,
    created_at          timestamp with time zone default now() not null,
    updated_at          timestamp with time zone default now() not null,
    auth_method         varchar                                not null
        constraint "ck_users_`valid_auth_method`"
            check ((auth_method)::text = ANY
        ((ARRAY ['LOCAL'::character varying, 'OAUTH2'::character varying])::text[])),
    constraint uq_users_oauth2_client_id_oauth2_user_id
        unique (oauth2_client_id, oauth2_user_id),
    constraint "ck_users_`local_auth_has_password_no_oauth`"
        check (((auth_method)::text <> 'LOCAL'::text) OR
               ((password_hash IS NOT NULL) AND (password_salt IS NOT NULL) AND (oauth2_client_id IS NULL) AND
                (oauth2_user_id IS NULL))),
    constraint "ck_users_`non_local_auth_has_no_password`"
        check (((auth_method)::text = 'LOCAL'::text) OR ((password_hash IS NULL) AND (password_salt IS NULL)))
);

alter table public.users
    owner to postgres;

create index ix_users_user_role_id
    on public.users (user_role_id);

create unique index ix_users_email
    on public.users (email);

create unique index ix_users_username
    on public.users (username);

create table public.password_reset_tokens
(
    id         serial
        constraint pk_password_reset_tokens
            primary key,
    user_id    integer
        constraint fk_password_reset_tokens_user_id_users
            references public.users
            on delete cascade,
    created_at timestamp with time zone default now() not null,
    expires_at timestamp with time zone               not null
);

alter table public.password_reset_tokens
    owner to postgres;

create unique index ix_password_reset_tokens_user_id
    on public.password_reset_tokens (user_id);

create index ix_password_reset_tokens_expires_at
    on public.password_reset_tokens (expires_at);

create table public.refresh_tokens
(
    id         serial
        constraint pk_refresh_tokens
            primary key,
    user_id    integer
        constraint fk_refresh_tokens_user_id_users
            references public.users
            on delete cascade,
    created_at timestamp with time zone default now() not null,
    expires_at timestamp with time zone               not null
);

alter table public.refresh_tokens
    owner to postgres;

create index ix_refresh_tokens_user_id
    on public.refresh_tokens (user_id);

create index ix_refresh_tokens_expires_at
    on public.refresh_tokens (expires_at);

create table public.access_tokens
(
    id               serial
        constraint pk_access_tokens
            primary key,
    user_id          integer
        constraint fk_access_tokens_user_id_users
            references public.users
            on delete cascade,
    created_at       timestamp with time zone default now() not null,
    expires_at       timestamp with time zone               not null,
    refresh_token_id integer
        constraint fk_access_tokens_refresh_token_id_refresh_tokens
            references public.refresh_tokens
            on delete cascade
);

alter table public.access_tokens
    owner to postgres;

create index ix_access_tokens_expires_at
    on public.access_tokens (expires_at);

create index ix_access_tokens_user_id
    on public.access_tokens (user_id);

create unique index ix_access_tokens_refresh_token_id
    on public.access_tokens (refresh_token_id);

create table public.api_keys
(
    id          serial
        constraint pk_api_keys
            primary key,
    user_id     integer
        constraint fk_api_keys_user_id_users
            references public.users
            on delete cascade,
    name        varchar                                not null,
    description varchar,
    created_at  timestamp with time zone default now() not null,
    expires_at  timestamp with time zone
);

alter table public.api_keys
    owner to postgres;

create index ix_api_keys_expires_at
    on public.api_keys (expires_at);

create index ix_api_keys_user_id
    on public.api_keys (user_id);

create table public.prompt_labels
(
    id          serial
        constraint pk_prompt_labels
            primary key,
    name        varchar not null,
    description varchar,
    color       varchar
);

alter table public.prompt_labels
    owner to postgres;

create unique index ix_prompt_labels_name
    on public.prompt_labels (name);

create table public.prompts
(
    id               serial
        constraint pk_prompts
            primary key,
    source_prompt_id integer
        constraint fk_prompts_source_prompt_id_prompts
            references public.prompts
            on delete set null,
    name             varchar                                not null,
    description      varchar,
    metadata         jsonb                                  not null,
    created_at       timestamp with time zone default now() not null,
    updated_at       timestamp with time zone default now() not null
);

alter table public.prompts
    owner to postgres;

create index ix_prompts_source_prompt_id
    on public.prompts (source_prompt_id);

create unique index ix_prompts_name
    on public.prompts (name);

create table public.prompts_prompt_labels
(
    id              serial
        constraint pk_prompts_prompt_labels
            primary key,
    prompt_label_id integer not null
        constraint fk_prompts_prompt_labels_prompt_label_id_prompt_labels
            references public.prompt_labels
            on delete cascade,
    prompt_id       integer not null
        constraint fk_prompts_prompt_labels_prompt_id_prompts
            references public.prompts
            on delete cascade,
    constraint uq_prompts_prompt_labels_prompt_label_id_prompt_id
        unique (prompt_label_id, prompt_id)
);

alter table public.prompts_prompt_labels
    owner to postgres;

create index ix_prompts_prompt_labels_prompt_id
    on public.prompts_prompt_labels (prompt_id);

create index ix_prompts_prompt_labels_prompt_label_id
    on public.prompts_prompt_labels (prompt_label_id);

create table public.prompt_versions
(
    id                    serial
        constraint pk_prompt_versions
            primary key,
    prompt_id             integer                                not null
        constraint fk_prompt_versions_prompt_id_prompts
            references public.prompts
            on delete cascade,
    description           varchar,
    user_id               integer
        constraint fk_prompt_versions_user_id_users
            references public.users
            on delete set null,
    template_type         varchar                                not null
        constraint "ck_prompt_versions_`template_type`"
            check ((template_type)::text = ANY ((ARRAY ['CHAT'::character varying, 'STR'::character varying])::text[])),
    template_format       varchar                                not null
        constraint "ck_prompt_versions_`template_format`"
            check ((template_format)::text = ANY
                   ((ARRAY ['F_STRING'::character varying, 'MUSTACHE'::character varying, 'NONE'::character varying])::text[])),
    template              jsonb                                  not null,
    invocation_parameters jsonb                                  not null,
    tools                 json,
    response_format       json,
    model_provider        varchar                                not null,
    model_name            varchar                                not null,
    metadata              jsonb                                  not null,
    created_at            timestamp with time zone default now() not null
);

alter table public.prompt_versions
    owner to postgres;

create index ix_prompt_versions_prompt_id
    on public.prompt_versions (prompt_id);

create index ix_prompt_versions_user_id
    on public.prompt_versions (user_id);

create table public.prompt_version_tags
(
    id                serial
        constraint pk_prompt_version_tags
            primary key,
    name              varchar not null,
    description       varchar,
    prompt_id         integer not null
        constraint fk_prompt_version_tags_prompt_id_prompts
            references public.prompts
            on delete cascade,
    prompt_version_id integer not null
        constraint fk_prompt_version_tags_prompt_version_id_prompt_versions
            references public.prompt_versions
            on delete cascade,
    user_id           integer
        constraint fk_prompt_version_tags_user_id_users
            references public.users
            on delete set null,
    constraint uq_prompt_version_tags_name_prompt_id
        unique (name, prompt_id)
);

alter table public.prompt_version_tags
    owner to postgres;

create index ix_prompt_version_tags_user_id
    on public.prompt_version_tags (user_id);

create index ix_prompt_version_tags_prompt_version_id
    on public.prompt_version_tags (prompt_version_id);

create index ix_prompt_version_tags_prompt_id
    on public.prompt_version_tags (prompt_id);

create table public.annotation_configs
(
    id     serial
        constraint pk_annotation_configs
            primary key,
    name   varchar not null
        constraint uq_annotation_configs_name
            unique,
    config jsonb   not null
);

alter table public.annotation_configs
    owner to postgres;

create table public.project_trace_retention_policies
(
    id              serial
        constraint pk_project_trace_retention_policies
            primary key,
    name            varchar not null,
    cron_expression varchar not null,
    rule            jsonb   not null
);

alter table public.project_trace_retention_policies
    owner to postgres;

create table public.projects
(
    id                        serial
        constraint pk_projects
            primary key,
    name                      varchar                                                       not null
        constraint uq_projects_name
            unique,
    description               varchar,
    gradient_start_color      varchar                  default '#5bdbff'::character varying not null,
    gradient_end_color        varchar                  default '#1c76fc'::character varying not null,
    created_at                timestamp with time zone default now()                        not null,
    updated_at                timestamp with time zone default now()                        not null,
    trace_retention_policy_id integer
        constraint fk_projects_trace_retention_policy_id_project_trace_ret_aa47
            references public.project_trace_retention_policies
            on delete set null
);

alter table public.projects
    owner to postgres;

create index ix_projects_trace_retention_policy_id
    on public.projects (trace_retention_policy_id);

create table public.project_sessions
(
    id         serial
        constraint pk_project_sessions
            primary key,
    session_id varchar                  not null
        constraint uq_project_sessions_session_id
            unique,
    project_id integer                  not null
        constraint fk_project_sessions_project_id_projects
            references public.projects
            on delete cascade,
    start_time timestamp with time zone not null,
    end_time   timestamp with time zone not null
);

alter table public.project_sessions
    owner to postgres;

create table public.traces
(
    id                    serial
        constraint pk_traces
            primary key,
    project_rowid         integer                  not null
        constraint fk_traces_project_rowid_projects
            references public.projects
            on delete cascade,
    trace_id              varchar                  not null
        constraint uq_traces_trace_id
            unique,
    start_time            timestamp with time zone not null,
    end_time              timestamp with time zone not null,
    project_session_rowid integer
        constraint fk_traces_project_session_rowid_project_sessions
            references public.project_sessions
            on delete cascade
);

alter table public.traces
    owner to postgres;

create index ix_traces_project_session_rowid
    on public.traces (project_session_rowid);

create index ix_traces_project_rowid_start_time
    on public.traces (project_rowid asc, start_time desc);

create table public.spans
(
    id                                    serial
        constraint pk_spans
            primary key,
    trace_rowid                           integer                                    not null
        constraint fk_spans_trace_rowid_traces
            references public.traces
            on delete cascade,
    span_id                               varchar                                    not null
        constraint uq_spans_span_id
            unique,
    parent_id                             varchar,
    name                                  varchar                                    not null,
    span_kind                             varchar                                    not null,
    start_time                            timestamp with time zone                   not null,
    end_time                              timestamp with time zone                   not null,
    attributes                            jsonb                                      not null,
    events                                jsonb                                      not null,
    status_code                           varchar default 'UNSET'::character varying not null
        constraint "ck_spans_`valid_status`"
            check ((status_code)::text = ANY
                   ((ARRAY ['OK'::character varying, 'ERROR'::character varying, 'UNSET'::character varying])::text[])),
    status_message                        varchar                                    not null,
    cumulative_error_count                integer                                    not null,
    cumulative_llm_token_count_prompt     integer                                    not null,
    cumulative_llm_token_count_completion integer                                    not null,
    llm_token_count_prompt                integer,
    llm_token_count_completion            integer
);

alter table public.spans
    owner to postgres;

create index ix_spans_start_time
    on public.spans (start_time);

create index ix_spans_trace_rowid
    on public.spans (trace_rowid);

create index ix_spans_parent_id
    on public.spans (parent_id);

create index ix_latency
    on public.spans ((end_time - start_time));

create index ix_cumulative_llm_token_count_total
    on public.spans ((cumulative_llm_token_count_prompt + cumulative_llm_token_count_completion));

create table public.span_annotations
(
    id             serial
        constraint pk_span_annotations
            primary key,
    span_rowid     integer                                                not null
        constraint fk_span_annotations_span_rowid_spans
            references public.spans
            on delete cascade,
    name           varchar                                                not null,
    label          varchar,
    score          double precision,
    explanation    varchar,
    metadata       jsonb                                                  not null,
    annotator_kind varchar                                                not null
        constraint "ck_span_annotations_`valid_annotator_kind`"
            check ((annotator_kind)::text = ANY
        ((ARRAY ['LLM'::character varying, 'CODE'::character varying, 'HUMAN'::character varying])::text[])),
    created_at     timestamp with time zone default now()                 not null,
    updated_at     timestamp with time zone default now()                 not null,
    user_id        integer
        constraint fk_span_annotations_user_id_users
            references public.users
            on delete set null,
    identifier     varchar                  default ''::character varying not null,
    source         varchar                                                not null
        constraint "ck_span_annotations_`valid_source`"
            check ((source)::text = ANY ((ARRAY ['API'::character varying, 'APP'::character varying])::text[])),
    constraint uq_span_annotations_name_span_rowid_identifier
        unique (name, span_rowid, identifier)
);

alter table public.span_annotations
    owner to postgres;

create index ix_span_annotations_span_rowid
    on public.span_annotations (span_rowid);

create table public.trace_annotations
(
    id             serial
        constraint pk_trace_annotations
            primary key,
    trace_rowid    integer                                                not null
        constraint fk_trace_annotations_trace_rowid_traces
            references public.traces
            on delete cascade,
    name           varchar                                                not null,
    label          varchar,
    score          double precision,
    explanation    varchar,
    metadata       jsonb                                                  not null,
    annotator_kind varchar                                                not null
        constraint "ck_trace_annotations_`valid_annotator_kind`"
            check ((annotator_kind)::text = ANY
        ((ARRAY ['LLM'::character varying, 'CODE'::character varying, 'HUMAN'::character varying])::text[])),
    created_at     timestamp with time zone default now()                 not null,
    updated_at     timestamp with time zone default now()                 not null,
    user_id        integer
        constraint fk_trace_annotations_user_id_users
            references public.users
            on delete set null,
    identifier     varchar                  default ''::character varying not null,
    source         varchar                                                not null
        constraint "ck_trace_annotations_`valid_source`"
            check ((source)::text = ANY ((ARRAY ['API'::character varying, 'APP'::character varying])::text[])),
    constraint uq_trace_annotations_name_trace_rowid_identifier
        unique (name, trace_rowid, identifier)
);

alter table public.trace_annotations
    owner to postgres;

create index ix_trace_annotations_trace_rowid
    on public.trace_annotations (trace_rowid);

create table public.document_annotations
(
    id                serial
        constraint pk_document_annotations
            primary key,
    span_rowid        integer                                                not null
        constraint fk_document_annotations_span_rowid_spans
            references public.spans
            on delete cascade,
    document_position integer                                                not null,
    name              varchar                                                not null,
    label             varchar,
    score             double precision,
    explanation       varchar,
    metadata          jsonb                                                  not null,
    annotator_kind    varchar                                                not null
        constraint "ck_document_annotations_`valid_annotator_kind`"
            check ((annotator_kind)::text = ANY
        ((ARRAY ['LLM'::character varying, 'CODE'::character varying, 'HUMAN'::character varying])::text[])),
    created_at        timestamp with time zone default now()                 not null,
    updated_at        timestamp with time zone default now()                 not null,
    user_id           integer
        constraint fk_document_annotations_user_id_users
            references public.users
            on delete set null,
    identifier        varchar                  default ''::character varying not null,
    source            varchar                                                not null
        constraint "ck_document_annotations_`valid_source`"
            check ((source)::text = ANY ((ARRAY ['API'::character varying, 'APP'::character varying])::text[])),
    constraint uq_document_annotations_name_span_rowid_document_pos_identifier
        unique (name, span_rowid, document_position, identifier)
);

alter table public.document_annotations
    owner to postgres;

create index ix_document_annotations_span_rowid
    on public.document_annotations (span_rowid);

create table public.dataset_examples
(
    id         serial
        constraint pk_dataset_examples
            primary key,
    dataset_id integer                                not null
        constraint fk_dataset_examples_dataset_id_datasets
            references public.datasets
            on delete cascade,
    span_rowid integer
        constraint fk_dataset_examples_span_rowid_spans
            references public.spans
            on delete set null,
    created_at timestamp with time zone default now() not null
);

alter table public.dataset_examples
    owner to postgres;

create index ix_dataset_examples_span_rowid
    on public.dataset_examples (span_rowid);

create index ix_dataset_examples_dataset_id
    on public.dataset_examples (dataset_id);

create table public.dataset_example_revisions
(
    id                 serial
        constraint pk_dataset_example_revisions
            primary key,
    dataset_example_id integer                                not null
        constraint fk_dataset_example_revisions_dataset_example_id_dataset_c72a
            references public.dataset_examples
            on delete cascade,
    dataset_version_id integer                                not null
        constraint fk_dataset_example_revisions_dataset_version_id_dataset_3a56
            references public.dataset_versions
            on delete cascade,
    input              jsonb                                  not null,
    output             jsonb                                  not null,
    metadata           jsonb                                  not null,
    revision_kind      varchar                                not null
        constraint "ck_dataset_example_revisions_`valid_revision_kind`"
            check ((revision_kind)::text = ANY
        ((ARRAY ['CREATE'::character varying, 'PATCH'::character varying, 'DELETE'::character varying])::text[])),
    created_at         timestamp with time zone default now() not null,
    constraint uq_dataset_example_revisions_dataset_example_id_dataset_bbf2
        unique (dataset_example_id, dataset_version_id)
);

alter table public.dataset_example_revisions
    owner to postgres;

create index ix_dataset_example_revisions_dataset_example_id
    on public.dataset_example_revisions (dataset_example_id);

create index ix_dataset_example_revisions_dataset_version_id
    on public.dataset_example_revisions (dataset_version_id);

create table public.experiment_runs
(
    id                     serial
        constraint pk_experiment_runs
            primary key,
    experiment_id          integer                  not null
        constraint fk_experiment_runs_experiment_id_experiments
            references public.experiments
            on delete cascade,
    dataset_example_id     integer                  not null
        constraint fk_experiment_runs_dataset_example_id_dataset_examples
            references public.dataset_examples
            on delete cascade,
    repetition_number      integer                  not null,
    trace_id               varchar,
    output                 jsonb                    not null,
    start_time             timestamp with time zone not null,
    end_time               timestamp with time zone not null,
    prompt_token_count     integer,
    completion_token_count integer,
    error                  varchar,
    constraint uq_experiment_runs_experiment_id_dataset_example_id_rep_81e7
        unique (experiment_id, dataset_example_id, repetition_number)
);

alter table public.experiment_runs
    owner to postgres;

create index ix_experiment_runs_dataset_example_id
    on public.experiment_runs (dataset_example_id);

create index ix_experiment_runs_experiment_id
    on public.experiment_runs (experiment_id);

create table public.experiment_run_annotations
(
    id                serial
        constraint pk_experiment_run_annotations
            primary key,
    experiment_run_id integer                  not null
        constraint fk_experiment_run_annotations_experiment_run_id_experiment_runs
            references public.experiment_runs
            on delete cascade,
    name              varchar                  not null,
    annotator_kind    varchar                  not null
        constraint "ck_experiment_run_annotations_`valid_annotator_kind`"
            check ((annotator_kind)::text = ANY
        ((ARRAY ['LLM'::character varying, 'CODE'::character varying, 'HUMAN'::character varying])::text[])),
    label             varchar,
    score             double precision,
    explanation       varchar,
    trace_id          varchar,
    error             varchar,
    metadata          jsonb                    not null,
    start_time        timestamp with time zone not null,
    end_time          timestamp with time zone not null,
    constraint uq_experiment_run_annotations_experiment_run_id_name
        unique (experiment_run_id, name)
);

alter table public.experiment_run_annotations
    owner to postgres;

create index ix_experiment_run_annotations_experiment_run_id
    on public.experiment_run_annotations (experiment_run_id);

create index ix_project_sessions_end_time
    on public.project_sessions (end_time);

create index ix_project_sessions_project_id_start_time
    on public.project_sessions (project_id asc, start_time desc);

create table public.project_annotation_configs
(
    id                   serial
        constraint pk_project_annotation_configs
            primary key,
    project_id           integer not null
        constraint fk_project_annotation_configs_project_id_projects
            references public.projects
            on delete cascade,
    annotation_config_id integer not null
        constraint fk_project_annotation_configs_annotation_config_id_anno_98f5
            references public.annotation_configs
            on delete cascade,
    constraint uq_project_annotation_configs_project_id_annotation_config_id
        unique (project_id, annotation_config_id)
);

alter table public.project_annotation_configs
    owner to postgres;

create index ix_project_annotation_configs_annotation_config_id
    on public.project_annotation_configs (annotation_config_id);

create index ix_project_annotation_configs_project_id
    on public.project_annotation_configs (project_id);

create table public.generative_models
(
    id           bigserial
        constraint pk_generative_models
            primary key,
    name         varchar                                not null,
    provider     varchar                                not null,
    name_pattern varchar                                not null,
    is_built_in  boolean                                not null,
    start_time   timestamp with time zone,
    created_at   timestamp with time zone default now() not null,
    updated_at   timestamp with time zone default now() not null,
    deleted_at   timestamp with time zone
);

alter table public.generative_models
    owner to postgres;

create unique index ix_generative_models_match_criteria
    on public.generative_models (name_pattern, provider, is_built_in)
    where (deleted_at IS NULL);

create unique index ix_generative_models_name_is_built_in
    on public.generative_models (name, is_built_in)
    where (deleted_at IS NULL);

create table public.token_prices
(
    id            bigserial
        constraint pk_token_prices
            primary key,
    model_id      bigint           not null
        constraint fk_token_prices_model_id_generative_models
            references public.generative_models
            on delete cascade,
    token_type    varchar          not null,
    is_prompt     boolean          not null,
    base_rate     double precision not null,
    customization json,
    constraint uq_token_prices_model_id_token_type_is_prompt
        unique (model_id, token_type, is_prompt)
);

alter table public.token_prices
    owner to postgres;

create index ix_token_prices_model_id
    on public.token_prices (model_id);

create table public.span_costs
(
    id                bigserial
        constraint pk_span_costs
            primary key,
    span_rowid        bigint                   not null
        constraint fk_span_costs_span_rowid_spans
            references public.spans
            on delete cascade,
    trace_rowid       bigint                   not null
        constraint fk_span_costs_trace_rowid_traces
            references public.traces
            on delete cascade,
    model_id          bigint
        constraint fk_span_costs_model_id_generative_models
            references public.generative_models
            on delete restrict,
    span_start_time   timestamp with time zone not null,
    total_cost        double precision,
    total_tokens      double precision,
    prompt_cost       double precision,
    prompt_tokens     double precision,
    completion_cost   double precision,
    completion_tokens double precision
);

alter table public.span_costs
    owner to postgres;

create index ix_span_costs_span_start_time
    on public.span_costs (span_start_time);

create index ix_span_costs_trace_rowid
    on public.span_costs (trace_rowid);

create index ix_span_costs_span_rowid
    on public.span_costs (span_rowid);

create index ix_span_costs_model_id_span_start_time
    on public.span_costs (model_id, span_start_time);

create table public.span_cost_details
(
    id             bigserial
        constraint pk_span_cost_details
            primary key,
    span_cost_id   bigint  not null
        constraint fk_span_cost_details_span_cost_id_span_costs
            references public.span_costs
            on delete cascade,
    token_type     varchar not null,
    is_prompt      boolean not null,
    cost           double precision,
    tokens         double precision,
    cost_per_token double precision,
    constraint uq_span_cost_details_span_cost_id_token_type_is_prompt
        unique (span_cost_id, token_type, is_prompt)
);

alter table public.span_cost_details
    owner to postgres;

create index ix_span_cost_details_span_cost_id
    on public.span_cost_details (span_cost_id);

create index ix_span_cost_details_token_type
    on public.span_cost_details (token_type);

create table public.project_session_annotations
(
    id                 bigserial
        constraint pk_project_session_annotations
            primary key,
    project_session_id bigint                                                 not null
        constraint fk_project_session_annotations_project_session_id_proje_ea96
            references public.project_sessions
            on delete cascade,
    name               varchar                                                not null,
    label              varchar,
    score              double precision,
    explanation        varchar,
    metadata           jsonb                                                  not null,
    annotator_kind     varchar                                                not null
        constraint "ck_project_session_annotations_`valid_annotator_kind`"
            check ((annotator_kind)::text = ANY
        ((ARRAY ['LLM'::character varying, 'CODE'::character varying, 'HUMAN'::character varying])::text[])),
    user_id            bigint
        constraint fk_project_session_annotations_user_id_users
            references public.users
            on delete set null,
    identifier         varchar                  default ''::character varying not null,
    source             varchar                                                not null
        constraint "ck_project_session_annotations_`valid_source`"
            check ((source)::text = ANY ((ARRAY ['API'::character varying, 'APP'::character varying])::text[])),
    created_at         timestamp with time zone default now()                 not null,
    updated_at         timestamp with time zone default now()                 not null,
    constraint uq_project_session_annotations_name_project_session_id__6b58
        unique (name, project_session_id, identifier)
);

alter table public.project_session_annotations
    owner to postgres;

create index ix_project_session_annotations_project_session_id
    on public.project_session_annotations (project_session_id);

