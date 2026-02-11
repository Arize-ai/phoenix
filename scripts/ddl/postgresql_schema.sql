-- Table: alembic_version
-- ----------------------
CREATE TABLE public.alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);


-- Table: annotation_configs
-- -------------------------
CREATE TABLE public.annotation_configs (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    config JSONB NOT NULL,
    CONSTRAINT pk_annotation_configs PRIMARY KEY (id),
    CONSTRAINT uq_annotation_configs_name
        UNIQUE (name)
);


-- Table: generative_models
-- ------------------------
CREATE TABLE public.generative_models (
    id bigserial NOT NULL,
    name VARCHAR NOT NULL,
    provider VARCHAR NOT NULL,
    name_pattern VARCHAR NOT NULL,
    is_built_in BOOLEAN NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_generative_models PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_generative_models_match_criteria ON public.generative_models
    USING btree (name_pattern, provider, is_built_in) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX ix_generative_models_name_is_built_in ON public.generative_models
    USING btree (name, is_built_in) WHERE (deleted_at IS NULL);


-- Table: project_trace_retention_policies
-- ---------------------------------------
CREATE TABLE public.project_trace_retention_policies (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    cron_expression VARCHAR NOT NULL,
    rule JSONB NOT NULL,
    CONSTRAINT pk_project_trace_retention_policies PRIMARY KEY (id)
);


-- Table: projects
-- ---------------
CREATE TABLE public.projects (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    gradient_start_color VARCHAR NOT NULL DEFAULT '#5bdbff'::character varying,
    gradient_end_color VARCHAR NOT NULL DEFAULT '#1c76fc'::character varying,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    trace_retention_policy_id INTEGER,
    CONSTRAINT pk_projects PRIMARY KEY (id),
    CONSTRAINT uq_projects_name
        UNIQUE (name),
    CONSTRAINT fk_projects_trace_retention_policy_id_project_trace_ret_aa47
        FOREIGN KEY
        (trace_retention_policy_id)
        REFERENCES public.project_trace_retention_policies (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_projects_trace_retention_policy_id ON public.projects
    USING btree (trace_retention_policy_id);


-- Table: project_annotation_configs
-- ---------------------------------
CREATE TABLE public.project_annotation_configs (
    id serial NOT NULL,
    project_id INTEGER NOT NULL,
    annotation_config_id INTEGER NOT NULL,
    CONSTRAINT pk_project_annotation_configs PRIMARY KEY (id),
    CONSTRAINT uq_project_annotation_configs_project_id_annotation_config_id
        UNIQUE (project_id, annotation_config_id),
    CONSTRAINT fk_project_annotation_configs_annotation_config_id_anno_98f5
        FOREIGN KEY
        (annotation_config_id)
        REFERENCES public.annotation_configs (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_annotation_configs_project_id_projects
        FOREIGN KEY
        (project_id)
        REFERENCES public.projects (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_project_annotation_configs_annotation_config_id ON public.project_annotation_configs
    USING btree (annotation_config_id);
CREATE INDEX ix_project_annotation_configs_project_id ON public.project_annotation_configs
    USING btree (project_id);


-- Table: project_sessions
-- -----------------------
CREATE TABLE public.project_sessions (
    id serial NOT NULL,
    session_id VARCHAR NOT NULL,
    project_id INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_project_sessions PRIMARY KEY (id),
    CONSTRAINT uq_project_sessions_session_id
        UNIQUE (session_id),
    CONSTRAINT fk_project_sessions_project_id_projects FOREIGN KEY
        (project_id)
        REFERENCES public.projects (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_project_sessions_end_time ON public.project_sessions
    USING btree (end_time);
CREATE INDEX ix_project_sessions_project_id_start_time ON public.project_sessions
    USING btree (project_id, start_time DESC);


-- Table: prompt_labels
-- --------------------
CREATE TABLE public.prompt_labels (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    color VARCHAR,
    CONSTRAINT pk_prompt_labels PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_prompt_labels_name ON public.prompt_labels
    USING btree (name);


-- Table: prompts
-- --------------
CREATE TABLE public.prompts (
    id serial NOT NULL,
    source_prompt_id INTEGER,
    name VARCHAR NOT NULL,
    description VARCHAR,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_prompts PRIMARY KEY (id),
    CONSTRAINT fk_prompts_source_prompt_id_prompts FOREIGN KEY
        (source_prompt_id)
        REFERENCES public.prompts (id)
        ON DELETE SET NULL
);

CREATE UNIQUE INDEX ix_prompts_name ON public.prompts
    USING btree (name);
CREATE INDEX ix_prompts_source_prompt_id ON public.prompts
    USING btree (source_prompt_id);


-- Table: prompts_prompt_labels
-- ----------------------------
CREATE TABLE public.prompts_prompt_labels (
    id serial NOT NULL,
    prompt_label_id INTEGER NOT NULL,
    prompt_id INTEGER NOT NULL,
    CONSTRAINT pk_prompts_prompt_labels PRIMARY KEY (id),
    CONSTRAINT uq_prompts_prompt_labels_prompt_label_id_prompt_id
        UNIQUE (prompt_label_id, prompt_id),
    CONSTRAINT fk_prompts_prompt_labels_prompt_id_prompts FOREIGN KEY
        (prompt_id)
        REFERENCES public.prompts (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_prompts_prompt_labels_prompt_label_id_prompt_labels
        FOREIGN KEY
        (prompt_label_id)
        REFERENCES public.prompt_labels (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_prompts_prompt_labels_prompt_id ON public.prompts_prompt_labels
    USING btree (prompt_id);
CREATE INDEX ix_prompts_prompt_labels_prompt_label_id ON public.prompts_prompt_labels
    USING btree (prompt_label_id);


-- Table: token_prices
-- -------------------
CREATE TABLE public.token_prices (
    id bigserial NOT NULL,
    model_id BIGINT NOT NULL,
    token_type VARCHAR NOT NULL,
    is_prompt BOOLEAN NOT NULL,
    base_rate DOUBLE PRECISION NOT NULL,
    customization JSON,
    CONSTRAINT pk_token_prices PRIMARY KEY (id),
    CONSTRAINT uq_token_prices_model_id_token_type_is_prompt
        UNIQUE (model_id, token_type, is_prompt),
    CONSTRAINT fk_token_prices_model_id_generative_models FOREIGN KEY
        (model_id)
        REFERENCES public.generative_models (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_token_prices_model_id ON public.token_prices
    USING btree (model_id);


-- Table: traces
-- -------------
CREATE TABLE public.traces (
    id serial NOT NULL,
    project_rowid INTEGER NOT NULL,
    trace_id VARCHAR NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    project_session_rowid INTEGER,
    CONSTRAINT pk_traces PRIMARY KEY (id),
    CONSTRAINT uq_traces_trace_id
        UNIQUE (trace_id),
    CONSTRAINT fk_traces_project_rowid_projects FOREIGN KEY
        (project_rowid)
        REFERENCES public.projects (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_traces_project_session_rowid_project_sessions
        FOREIGN KEY
        (project_session_rowid)
        REFERENCES public.project_sessions (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_traces_project_rowid_start_time ON public.traces
    USING btree (project_rowid, start_time DESC);
CREATE INDEX ix_traces_project_session_rowid ON public.traces
    USING btree (project_session_rowid);


-- Table: spans
-- ------------
CREATE TABLE public.spans (
    id serial NOT NULL,
    trace_rowid INTEGER NOT NULL,
    span_id VARCHAR NOT NULL,
    parent_id VARCHAR,
    name VARCHAR NOT NULL,
    span_kind VARCHAR NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    attributes JSONB NOT NULL,
    events JSONB NOT NULL,
    status_code VARCHAR NOT NULL DEFAULT 'UNSET'::character varying,
    status_message VARCHAR NOT NULL,
    cumulative_error_count INTEGER NOT NULL,
    cumulative_llm_token_count_prompt INTEGER NOT NULL,
    cumulative_llm_token_count_completion INTEGER NOT NULL,
    llm_token_count_prompt INTEGER,
    llm_token_count_completion INTEGER,
    CONSTRAINT pk_spans PRIMARY KEY (id),
    CONSTRAINT uq_spans_span_id
        UNIQUE (span_id),
    CHECK (((status_code)::text = ANY ((ARRAY[
            'OK'::character varying,
            'ERROR'::character varying,
            'UNSET'::character varying
        ])::text[]))),
    CONSTRAINT fk_spans_trace_rowid_traces FOREIGN KEY
        (trace_rowid)
        REFERENCES public.traces (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_spans_parent_id ON public.spans
    USING btree (parent_id);
CREATE INDEX ix_spans_start_time ON public.spans
    USING btree (start_time);
CREATE INDEX ix_spans_trace_rowid ON public.spans
    USING btree (trace_rowid);


-- Table: span_costs
-- -----------------
CREATE TABLE public.span_costs (
    id bigserial NOT NULL,
    span_rowid BIGINT NOT NULL,
    trace_rowid BIGINT NOT NULL,
    model_id BIGINT,
    span_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_cost DOUBLE PRECISION,
    total_tokens DOUBLE PRECISION,
    prompt_cost DOUBLE PRECISION,
    prompt_tokens DOUBLE PRECISION,
    completion_cost DOUBLE PRECISION,
    completion_tokens DOUBLE PRECISION,
    CONSTRAINT pk_span_costs PRIMARY KEY (id),
    CONSTRAINT fk_span_costs_model_id_generative_models FOREIGN KEY
        (model_id)
        REFERENCES public.generative_models (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_span_costs_span_rowid_spans FOREIGN KEY
        (span_rowid)
        REFERENCES public.spans (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_span_costs_trace_rowid_traces FOREIGN KEY
        (trace_rowid)
        REFERENCES public.traces (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_span_costs_model_id_span_start_time ON public.span_costs
    USING btree (model_id, span_start_time);
CREATE INDEX ix_span_costs_span_rowid ON public.span_costs
    USING btree (span_rowid);
CREATE INDEX ix_span_costs_span_start_time ON public.span_costs
    USING btree (span_start_time);
CREATE INDEX ix_span_costs_trace_rowid ON public.span_costs
    USING btree (trace_rowid);


-- Table: span_cost_details
-- ------------------------
CREATE TABLE public.span_cost_details (
    id bigserial NOT NULL,
    span_cost_id BIGINT NOT NULL,
    token_type VARCHAR NOT NULL,
    is_prompt BOOLEAN NOT NULL,
    cost DOUBLE PRECISION,
    tokens DOUBLE PRECISION,
    cost_per_token DOUBLE PRECISION,
    CONSTRAINT pk_span_cost_details PRIMARY KEY (id),
    CONSTRAINT uq_span_cost_details_span_cost_id_token_type_is_prompt
        UNIQUE (span_cost_id, token_type, is_prompt),
    CONSTRAINT fk_span_cost_details_span_cost_id_span_costs FOREIGN KEY
        (span_cost_id)
        REFERENCES public.span_costs (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_span_cost_details_token_type ON public.span_cost_details
    USING btree (token_type);


-- Table: user_roles
-- -----------------
CREATE TABLE public.user_roles (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_user_roles_name ON public.user_roles
    USING btree (name);


-- Table: users
-- ------------
CREATE TABLE public.users (
    id serial NOT NULL,
    user_role_id INTEGER NOT NULL,
    username VARCHAR NOT NULL,
    email VARCHAR,
    profile_picture_url VARCHAR,
    password_hash BYTEA,
    password_salt BYTEA,
    reset_password BOOLEAN NOT NULL,
    oauth2_client_id VARCHAR,
    oauth2_user_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    auth_method VARCHAR NOT NULL,
    ldap_unique_id VARCHAR,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CHECK ((((auth_method)::text <> 'LDAP'::text) OR ((oauth2_client_id IS NULL) AND (oauth2_user_id IS NULL) AND ((email IS NOT NULL) OR (ldap_unique_id IS NOT NULL))))),
    CHECK ((((auth_method)::text <> 'LOCAL'::text) OR ((password_hash IS NOT NULL) AND (password_salt IS NOT NULL) AND (oauth2_client_id IS NULL) AND (oauth2_user_id IS NULL) AND (ldap_unique_id IS NULL)))),
    CHECK ((((auth_method)::text = 'LDAP'::text) OR (email IS NOT NULL))),
    CHECK ((((auth_method)::text = 'LOCAL'::text) OR ((password_hash IS NULL) AND (password_salt IS NULL)))),
    CHECK ((((auth_method)::text <> 'OAUTH2'::text) OR (ldap_unique_id IS NULL))),
    CHECK (((auth_method)::text = ANY ((ARRAY[
            'LOCAL'::character varying,
            'OAUTH2'::character varying,
            'LDAP'::character varying
        ])::text[]))),
    CONSTRAINT fk_users_user_role_id_user_roles FOREIGN KEY
        (user_role_id)
        REFERENCES public.user_roles (id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_users_email ON public.users
    USING btree (email);
CREATE UNIQUE INDEX ix_users_ldap_unique_id ON public.users
    USING btree (ldap_unique_id) WHERE (((auth_method)::text = 'LDAP'::text) AND (ldap_unique_id IS NOT NULL));
CREATE UNIQUE INDEX ix_users_oauth2_unique ON public.users
    USING btree (oauth2_client_id, oauth2_user_id) WHERE ((auth_method)::text = 'OAUTH2'::text);
CREATE INDEX ix_users_user_role_id ON public.users
    USING btree (user_role_id);
CREATE UNIQUE INDEX ix_users_username ON public.users
    USING btree (username);


-- Table: api_keys
-- ---------------
CREATE TABLE public.api_keys (
    id serial NOT NULL,
    user_id INTEGER,
    name VARCHAR NOT NULL,
    description VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_api_keys PRIMARY KEY (id),
    CONSTRAINT fk_api_keys_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_api_keys_expires_at ON public.api_keys
    USING btree (expires_at);
CREATE INDEX ix_api_keys_user_id ON public.api_keys
    USING btree (user_id);


-- Table: dataset_labels
-- ---------------------
CREATE TABLE public.dataset_labels (
    id bigserial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    color VARCHAR NOT NULL,
    user_id BIGINT,
    CONSTRAINT pk_dataset_labels PRIMARY KEY (id),
    CONSTRAINT uq_dataset_labels_name
        UNIQUE (name),
    CONSTRAINT fk_dataset_labels_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_dataset_labels_user_id ON public.dataset_labels
    USING btree (user_id);


-- Table: dataset_splits
-- ---------------------
CREATE TABLE public.dataset_splits (
    id bigserial NOT NULL,
    user_id BIGINT,
    name VARCHAR NOT NULL,
    description VARCHAR,
    color VARCHAR NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_dataset_splits PRIMARY KEY (id),
    CONSTRAINT uq_dataset_splits_name
        UNIQUE (name),
    CONSTRAINT fk_dataset_splits_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_dataset_splits_user_id ON public.dataset_splits
    USING btree (user_id);


-- Table: datasets
-- ---------------
CREATE TABLE public.datasets (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id BIGINT,
    CONSTRAINT pk_datasets PRIMARY KEY (id),
    CONSTRAINT uq_datasets_name
        UNIQUE (name),
    CONSTRAINT fk_datasets_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);


-- Table: dataset_examples
-- -----------------------
CREATE TABLE public.dataset_examples (
    id serial NOT NULL,
    dataset_id INTEGER NOT NULL,
    span_rowid INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_dataset_examples PRIMARY KEY (id),
    CONSTRAINT fk_dataset_examples_dataset_id_datasets FOREIGN KEY
        (dataset_id)
        REFERENCES public.datasets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dataset_examples_span_rowid_spans FOREIGN KEY
        (span_rowid)
        REFERENCES public.spans (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_dataset_examples_dataset_id ON public.dataset_examples
    USING btree (dataset_id);
CREATE INDEX ix_dataset_examples_span_rowid ON public.dataset_examples
    USING btree (span_rowid);


-- Table: dataset_splits_dataset_examples
-- --------------------------------------
CREATE TABLE public.dataset_splits_dataset_examples (
    dataset_split_id BIGINT NOT NULL,
    dataset_example_id BIGINT NOT NULL,
    CONSTRAINT pk_dataset_splits_dataset_examples PRIMARY KEY (dataset_split_id, dataset_example_id),
    CONSTRAINT fk_dataset_splits_dataset_examples_dataset_example_id_d_63b2
        FOREIGN KEY
        (dataset_example_id)
        REFERENCES public.dataset_examples (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dataset_splits_dataset_examples_dataset_split_id_dat_a90c
        FOREIGN KEY
        (dataset_split_id)
        REFERENCES public.dataset_splits (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_dataset_splits_dataset_examples_dataset_example_id ON public.dataset_splits_dataset_examples
    USING btree (dataset_example_id);


-- Table: dataset_versions
-- -----------------------
CREATE TABLE public.dataset_versions (
    id serial NOT NULL,
    dataset_id INTEGER NOT NULL,
    description VARCHAR,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id BIGINT,
    CONSTRAINT pk_dataset_versions PRIMARY KEY (id),
    CONSTRAINT fk_dataset_versions_dataset_id_datasets FOREIGN KEY
        (dataset_id)
        REFERENCES public.datasets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dataset_versions_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_dataset_versions_dataset_id ON public.dataset_versions
    USING btree (dataset_id);


-- Table: dataset_example_revisions
-- --------------------------------
CREATE TABLE public.dataset_example_revisions (
    id serial NOT NULL,
    dataset_example_id INTEGER NOT NULL,
    dataset_version_id INTEGER NOT NULL,
    input JSONB NOT NULL,
    output JSONB NOT NULL,
    metadata JSONB NOT NULL,
    revision_kind VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_dataset_example_revisions PRIMARY KEY (id),
    CONSTRAINT uq_dataset_example_revisions_dataset_example_id_dataset_bbf2
        UNIQUE (dataset_example_id, dataset_version_id),
    CHECK (((revision_kind)::text = ANY ((ARRAY[
            'CREATE'::character varying,
            'PATCH'::character varying,
            'DELETE'::character varying
        ])::text[]))),
    CONSTRAINT fk_dataset_example_revisions_dataset_example_id_dataset_c72a
        FOREIGN KEY
        (dataset_example_id)
        REFERENCES public.dataset_examples (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dataset_example_revisions_dataset_version_id_dataset_3a56
        FOREIGN KEY
        (dataset_version_id)
        REFERENCES public.dataset_versions (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_dataset_example_revisions_dataset_version_id ON public.dataset_example_revisions
    USING btree (dataset_version_id);


-- Table: datasets_dataset_labels
-- ------------------------------
CREATE TABLE public.datasets_dataset_labels (
    dataset_id BIGINT NOT NULL,
    dataset_label_id BIGINT NOT NULL,
    CONSTRAINT pk_datasets_dataset_labels PRIMARY KEY (dataset_id, dataset_label_id),
    CONSTRAINT fk_datasets_dataset_labels_dataset_id_datasets FOREIGN KEY
        (dataset_id)
        REFERENCES public.datasets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_datasets_dataset_labels_dataset_label_id_dataset_labels
        FOREIGN KEY
        (dataset_label_id)
        REFERENCES public.dataset_labels (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_datasets_dataset_labels_dataset_label_id ON public.datasets_dataset_labels
    USING btree (dataset_label_id);


-- Table: document_annotations
-- ---------------------------
CREATE TABLE public.document_annotations (
    id serial NOT NULL,
    span_rowid INTEGER NOT NULL,
    document_position INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    label VARCHAR,
    score DOUBLE PRECISION,
    explanation VARCHAR,
    metadata JSONB NOT NULL,
    annotator_kind VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id INTEGER,
    identifier VARCHAR NOT NULL DEFAULT ''::character varying,
    source VARCHAR NOT NULL,
    CONSTRAINT pk_document_annotations PRIMARY KEY (id),
    CONSTRAINT uq_document_annotations_name_span_rowid_document_pos_identifier
        UNIQUE (name, span_rowid, document_position, identifier),
    CHECK (((annotator_kind)::text = ANY ((ARRAY[
            'LLM'::character varying,
            'CODE'::character varying,
            'HUMAN'::character varying
        ])::text[]))),
    CHECK (((source)::text = ANY ((ARRAY[
            'API'::character varying,
            'APP'::character varying
        ])::text[]))),
    CONSTRAINT fk_document_annotations_span_rowid_spans FOREIGN KEY
        (span_rowid)
        REFERENCES public.spans (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_document_annotations_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_document_annotations_span_rowid ON public.document_annotations
    USING btree (span_rowid);


-- Table: evaluators
-- -----------------
CREATE TABLE public.evaluators (
    id bigserial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    metadata JSONB NOT NULL,
    kind VARCHAR NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_evaluators PRIMARY KEY (id),
    CONSTRAINT uq_evaluators_kind_id
        UNIQUE (kind, id),
    CONSTRAINT uq_evaluators_name
        UNIQUE (name),
    CHECK (((kind)::text = ANY ((ARRAY[
            'LLM'::character varying,
            'CODE'::character varying,
            'BUILTIN'::character varying
        ])::text[]))),
    CONSTRAINT fk_evaluators_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_evaluators_user_id ON public.evaluators
    USING btree (user_id);


-- Table: builtin_evaluators
-- -------------------------
CREATE TABLE public.builtin_evaluators (
    id BIGINT NOT NULL,
    kind VARCHAR NOT NULL DEFAULT 'BUILTIN'::character varying,
    key VARCHAR NOT NULL,
    input_schema JSONB NOT NULL,
    output_configs JSONB NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_builtin_evaluators PRIMARY KEY (id),
    CONSTRAINT uq_builtin_evaluators_key
        UNIQUE (key),
    CHECK (((kind)::text = 'BUILTIN'::text)),
    CONSTRAINT fk_builtin_evaluators_kind_evaluators FOREIGN KEY
        (kind, id)
        REFERENCES public.evaluators (kind, id)
        ON DELETE CASCADE
);


-- Table: code_evaluators
-- ----------------------
CREATE TABLE public.code_evaluators (
    id BIGINT NOT NULL,
    kind VARCHAR NOT NULL DEFAULT 'CODE'::character varying,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_code_evaluators PRIMARY KEY (id),
    CHECK (((kind)::text = 'CODE'::text)),
    CONSTRAINT fk_code_evaluators_kind_evaluators FOREIGN KEY
        (kind, id)
        REFERENCES public.evaluators (kind, id)
        ON DELETE CASCADE
);


-- Table: dataset_evaluators
-- -------------------------
CREATE TABLE public.dataset_evaluators (
    id bigserial NOT NULL,
    dataset_id BIGINT NOT NULL,
    evaluator_id BIGINT NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    output_configs JSONB NOT NULL,
    input_mapping JSONB NOT NULL,
    user_id BIGINT,
    project_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_dataset_evaluators PRIMARY KEY (id),
    CONSTRAINT uq_dataset_evaluators_dataset_id_name
        UNIQUE (dataset_id, name),
    CONSTRAINT fk_dataset_evaluators_dataset_id_datasets FOREIGN KEY
        (dataset_id)
        REFERENCES public.datasets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dataset_evaluators_evaluator_id_evaluators FOREIGN KEY
        (evaluator_id)
        REFERENCES public.evaluators (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dataset_evaluators_project_id_projects FOREIGN KEY
        (project_id)
        REFERENCES public.projects (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_dataset_evaluators_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_dataset_evaluators_dataset_id ON public.dataset_evaluators
    USING btree (dataset_id);
CREATE INDEX ix_dataset_evaluators_evaluator_id ON public.dataset_evaluators
    USING btree (evaluator_id);
CREATE INDEX ix_dataset_evaluators_project_id ON public.dataset_evaluators
    USING btree (project_id);


-- Table: experiments
-- ------------------
CREATE TABLE public.experiments (
    id serial NOT NULL,
    dataset_id INTEGER NOT NULL,
    dataset_version_id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    repetitions INTEGER NOT NULL,
    metadata JSONB NOT NULL,
    project_name VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id BIGINT,
    CONSTRAINT pk_experiments PRIMARY KEY (id),
    CONSTRAINT fk_experiments_dataset_id_datasets FOREIGN KEY
        (dataset_id)
        REFERENCES public.datasets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiments_dataset_version_id_dataset_versions
        FOREIGN KEY
        (dataset_version_id)
        REFERENCES public.dataset_versions (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiments_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_experiments_dataset_id ON public.experiments
    USING btree (dataset_id);
CREATE INDEX ix_experiments_dataset_version_id ON public.experiments
    USING btree (dataset_version_id);
CREATE INDEX ix_experiments_project_name ON public.experiments
    USING btree (project_name);


-- Table: experiment_runs
-- ----------------------
CREATE TABLE public.experiment_runs (
    id serial NOT NULL,
    experiment_id INTEGER NOT NULL,
    dataset_example_id INTEGER NOT NULL,
    repetition_number INTEGER NOT NULL,
    trace_id VARCHAR,
    output JSONB NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    prompt_token_count INTEGER,
    completion_token_count INTEGER,
    error VARCHAR,
    CONSTRAINT pk_experiment_runs PRIMARY KEY (id),
    CONSTRAINT uq_experiment_runs_experiment_id_dataset_example_id_rep_81e7
        UNIQUE (experiment_id, dataset_example_id, repetition_number),
    CONSTRAINT fk_experiment_runs_dataset_example_id_dataset_examples
        FOREIGN KEY
        (dataset_example_id)
        REFERENCES public.dataset_examples (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiment_runs_experiment_id_experiments FOREIGN KEY
        (experiment_id)
        REFERENCES public.experiments (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_experiment_runs_dataset_example_id ON public.experiment_runs
    USING btree (dataset_example_id);


-- Table: experiment_run_annotations
-- ---------------------------------
CREATE TABLE public.experiment_run_annotations (
    id serial NOT NULL,
    experiment_run_id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    annotator_kind VARCHAR NOT NULL,
    label VARCHAR,
    score DOUBLE PRECISION,
    explanation VARCHAR,
    trace_id VARCHAR,
    error VARCHAR,
    metadata JSONB NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_experiment_run_annotations PRIMARY KEY (id),
    CONSTRAINT uq_experiment_run_annotations_experiment_run_id_name
        UNIQUE (experiment_run_id, name),
    CHECK (((annotator_kind)::text = ANY ((ARRAY[
            'LLM'::character varying,
            'CODE'::character varying,
            'HUMAN'::character varying
        ])::text[]))),
    CONSTRAINT fk_experiment_run_annotations_experiment_run_id_experiment_runs
        FOREIGN KEY
        (experiment_run_id)
        REFERENCES public.experiment_runs (id)
        ON DELETE CASCADE
);


-- Table: experiment_tags
-- ----------------------
CREATE TABLE public.experiment_tags (
    id bigserial NOT NULL,
    experiment_id BIGINT NOT NULL,
    dataset_id BIGINT NOT NULL,
    user_id BIGINT,
    name VARCHAR NOT NULL,
    description VARCHAR,
    CONSTRAINT pk_experiment_tags PRIMARY KEY (id),
    CONSTRAINT uq_experiment_tags_dataset_id_name
        UNIQUE (dataset_id, name),
    CONSTRAINT fk_experiment_tags_dataset_id_datasets FOREIGN KEY
        (dataset_id)
        REFERENCES public.datasets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiment_tags_experiment_id_experiments FOREIGN KEY
        (experiment_id)
        REFERENCES public.experiments (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiment_tags_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_experiment_tags_experiment_id ON public.experiment_tags
    USING btree (experiment_id);
CREATE INDEX ix_experiment_tags_user_id ON public.experiment_tags
    USING btree (user_id);


-- Table: experiments_dataset_examples
-- -----------------------------------
CREATE TABLE public.experiments_dataset_examples (
    experiment_id BIGINT NOT NULL,
    dataset_example_id BIGINT NOT NULL,
    dataset_example_revision_id BIGINT NOT NULL,
    CONSTRAINT pk_experiments_dataset_examples PRIMARY KEY (experiment_id, dataset_example_id),
    CONSTRAINT fk_experiments_dataset_examples_dataset_example_id_data_7c5c
        FOREIGN KEY
        (dataset_example_id)
        REFERENCES public.dataset_examples (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiments_dataset_examples_dataset_example_revisio_7f42
        FOREIGN KEY
        (dataset_example_revision_id)
        REFERENCES public.dataset_example_revisions (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiments_dataset_examples_experiment_id_experiments
        FOREIGN KEY
        (experiment_id)
        REFERENCES public.experiments (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_experiments_dataset_examples_dataset_example_id ON public.experiments_dataset_examples
    USING btree (dataset_example_id);
CREATE INDEX ix_experiments_dataset_examples_dataset_example_revision_id ON public.experiments_dataset_examples
    USING btree (dataset_example_revision_id);


-- Table: experiments_dataset_splits
-- ---------------------------------
CREATE TABLE public.experiments_dataset_splits (
    experiment_id BIGINT NOT NULL,
    dataset_split_id BIGINT NOT NULL,
    CONSTRAINT pk_experiments_dataset_splits PRIMARY KEY (experiment_id, dataset_split_id),
    CONSTRAINT fk_experiments_dataset_splits_dataset_split_id_dataset_splits
        FOREIGN KEY
        (dataset_split_id)
        REFERENCES public.dataset_splits (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_experiments_dataset_splits_experiment_id_experiments
        FOREIGN KEY
        (experiment_id)
        REFERENCES public.experiments (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_experiments_dataset_splits_dataset_split_id ON public.experiments_dataset_splits
    USING btree (dataset_split_id);


-- Table: generative_model_custom_providers
-- ----------------------------------------
CREATE TABLE public.generative_model_custom_providers (
    id bigserial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    provider VARCHAR NOT NULL,
    sdk VARCHAR NOT NULL,
    config BYTEA NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_generative_model_custom_providers PRIMARY KEY (id),
    CONSTRAINT uq_generative_model_custom_providers_name
        UNIQUE (name),
    CONSTRAINT fk_generative_model_custom_providers_user_id_users
        FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);


-- Table: password_reset_tokens
-- ----------------------------
CREATE TABLE public.password_reset_tokens (
    id serial NOT NULL,
    user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id),
    CONSTRAINT fk_password_reset_tokens_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_password_reset_tokens_expires_at ON public.password_reset_tokens
    USING btree (expires_at);
CREATE UNIQUE INDEX ix_password_reset_tokens_user_id ON public.password_reset_tokens
    USING btree (user_id);


-- Table: project_session_annotations
-- ----------------------------------
CREATE TABLE public.project_session_annotations (
    id bigserial NOT NULL,
    project_session_id BIGINT NOT NULL,
    name VARCHAR NOT NULL,
    label VARCHAR,
    score DOUBLE PRECISION,
    explanation VARCHAR,
    metadata JSONB NOT NULL,
    annotator_kind VARCHAR NOT NULL,
    user_id BIGINT,
    identifier VARCHAR NOT NULL DEFAULT ''::character varying,
    source VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_project_session_annotations PRIMARY KEY (id),
    CONSTRAINT uq_project_session_annotations_name_project_session_id__6b58
        UNIQUE (name, project_session_id, identifier),
    CHECK (((annotator_kind)::text = ANY ((ARRAY[
            'LLM'::character varying,
            'CODE'::character varying,
            'HUMAN'::character varying
        ])::text[]))),
    CHECK (((source)::text = ANY ((ARRAY[
            'API'::character varying,
            'APP'::character varying
        ])::text[]))),
    CONSTRAINT fk_project_session_annotations_project_session_id_proje_ea96
        FOREIGN KEY
        (project_session_id)
        REFERENCES public.project_sessions (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_session_annotations_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_project_session_annotations_project_session_id ON public.project_session_annotations
    USING btree (project_session_id);


-- Table: prompt_versions
-- ----------------------
CREATE TABLE public.prompt_versions (
    id serial NOT NULL,
    prompt_id INTEGER NOT NULL,
    description VARCHAR,
    user_id INTEGER,
    template_type VARCHAR NOT NULL,
    template_format VARCHAR NOT NULL,
    template JSONB NOT NULL,
    invocation_parameters JSONB NOT NULL,
    tools JSON,
    response_format JSON,
    model_provider VARCHAR NOT NULL,
    model_name VARCHAR NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    custom_provider_id BIGINT,
    CONSTRAINT pk_prompt_versions PRIMARY KEY (id),
    CHECK (((template_format)::text = ANY ((ARRAY[
            'F_STRING'::character varying,
            'MUSTACHE'::character varying,
            'NONE'::character varying
        ])::text[]))),
    CHECK (((template_type)::text = ANY ((ARRAY[
            'CHAT'::character varying,
            'STR'::character varying
        ])::text[]))),
    CONSTRAINT fk_prompt_versions_custom_provider_id_generative_model__f97f
        FOREIGN KEY
        (custom_provider_id)
        REFERENCES public.generative_model_custom_providers (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_prompt_versions_prompt_id_prompts FOREIGN KEY
        (prompt_id)
        REFERENCES public.prompts (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_prompt_versions_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_prompt_versions_custom_provider_id ON public.prompt_versions
    USING btree (custom_provider_id);
CREATE INDEX ix_prompt_versions_prompt_id ON public.prompt_versions
    USING btree (prompt_id);
CREATE INDEX ix_prompt_versions_user_id ON public.prompt_versions
    USING btree (user_id);


-- Table: prompt_version_tags
-- --------------------------
CREATE TABLE public.prompt_version_tags (
    id serial NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    prompt_id INTEGER NOT NULL,
    prompt_version_id INTEGER NOT NULL,
    user_id INTEGER,
    CONSTRAINT pk_prompt_version_tags PRIMARY KEY (id),
    CONSTRAINT uq_prompt_version_tags_name_prompt_id
        UNIQUE (name, prompt_id),
    CONSTRAINT fk_prompt_version_tags_prompt_id_prompts FOREIGN KEY
        (prompt_id)
        REFERENCES public.prompts (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_prompt_version_tags_prompt_version_id_prompt_versions
        FOREIGN KEY
        (prompt_version_id)
        REFERENCES public.prompt_versions (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_prompt_version_tags_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_prompt_version_tags_prompt_id ON public.prompt_version_tags
    USING btree (prompt_id);
CREATE INDEX ix_prompt_version_tags_prompt_version_id ON public.prompt_version_tags
    USING btree (prompt_version_id);
CREATE INDEX ix_prompt_version_tags_user_id ON public.prompt_version_tags
    USING btree (user_id);


-- Table: llm_evaluators
-- ---------------------
CREATE TABLE public.llm_evaluators (
    id BIGINT NOT NULL,
    kind VARCHAR NOT NULL DEFAULT 'LLM'::character varying,
    prompt_id BIGINT NOT NULL,
    prompt_version_tag_id BIGINT,
    output_configs JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_llm_evaluators PRIMARY KEY (id),
    CHECK (((kind)::text = 'LLM'::text)),
    CONSTRAINT fk_llm_evaluators_kind_evaluators FOREIGN KEY
        (kind, id)
        REFERENCES public.evaluators (kind, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_llm_evaluators_prompt_id_prompts FOREIGN KEY
        (prompt_id)
        REFERENCES public.prompts (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_llm_evaluators_prompt_version_tag_id_prompt_version_tags
        FOREIGN KEY
        (prompt_version_tag_id)
        REFERENCES public.prompt_version_tags (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_llm_evaluators_prompt_id ON public.llm_evaluators
    USING btree (prompt_id);
CREATE INDEX ix_llm_evaluators_prompt_version_tag_id ON public.llm_evaluators
    USING btree (prompt_version_tag_id);


-- Table: refresh_tokens
-- ---------------------
CREATE TABLE public.refresh_tokens (
    id serial NOT NULL,
    user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT fk_refresh_tokens_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_refresh_tokens_expires_at ON public.refresh_tokens
    USING btree (expires_at);
CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens
    USING btree (user_id);


-- Table: access_tokens
-- --------------------
CREATE TABLE public.access_tokens (
    id serial NOT NULL,
    user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_token_id INTEGER,
    CONSTRAINT pk_access_tokens PRIMARY KEY (id),
    CONSTRAINT fk_access_tokens_refresh_token_id_refresh_tokens
        FOREIGN KEY
        (refresh_token_id)
        REFERENCES public.refresh_tokens (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_access_tokens_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_access_tokens_expires_at ON public.access_tokens
    USING btree (expires_at);
CREATE UNIQUE INDEX ix_access_tokens_refresh_token_id ON public.access_tokens
    USING btree (refresh_token_id);
CREATE INDEX ix_access_tokens_user_id ON public.access_tokens
    USING btree (user_id);


-- Table: secrets
-- --------------
CREATE TABLE public.secrets (
    key VARCHAR NOT NULL,
    value BYTEA NOT NULL,
    user_id BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pk_secrets PRIMARY KEY (key),
    CONSTRAINT fk_secrets_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);


-- Table: span_annotations
-- -----------------------
CREATE TABLE public.span_annotations (
    id serial NOT NULL,
    span_rowid INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    label VARCHAR,
    score DOUBLE PRECISION,
    explanation VARCHAR,
    metadata JSONB NOT NULL,
    annotator_kind VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id INTEGER,
    identifier VARCHAR NOT NULL DEFAULT ''::character varying,
    source VARCHAR NOT NULL,
    CONSTRAINT pk_span_annotations PRIMARY KEY (id),
    CONSTRAINT uq_span_annotations_name_span_rowid_identifier
        UNIQUE (name, span_rowid, identifier),
    CHECK (((annotator_kind)::text = ANY ((ARRAY[
            'LLM'::character varying,
            'CODE'::character varying,
            'HUMAN'::character varying
        ])::text[]))),
    CHECK (((source)::text = ANY ((ARRAY[
            'API'::character varying,
            'APP'::character varying
        ])::text[]))),
    CONSTRAINT fk_span_annotations_span_rowid_spans FOREIGN KEY
        (span_rowid)
        REFERENCES public.spans (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_span_annotations_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_span_annotations_span_rowid ON public.span_annotations
    USING btree (span_rowid);


-- Table: trace_annotations
-- ------------------------
CREATE TABLE public.trace_annotations (
    id serial NOT NULL,
    trace_rowid INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    label VARCHAR,
    score DOUBLE PRECISION,
    explanation VARCHAR,
    metadata JSONB NOT NULL,
    annotator_kind VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id INTEGER,
    identifier VARCHAR NOT NULL DEFAULT ''::character varying,
    source VARCHAR NOT NULL,
    CONSTRAINT pk_trace_annotations PRIMARY KEY (id),
    CONSTRAINT uq_trace_annotations_name_trace_rowid_identifier
        UNIQUE (name, trace_rowid, identifier),
    CHECK (((annotator_kind)::text = ANY ((ARRAY[
            'LLM'::character varying,
            'CODE'::character varying,
            'HUMAN'::character varying
        ])::text[]))),
    CHECK (((source)::text = ANY ((ARRAY[
            'API'::character varying,
            'APP'::character varying
        ])::text[]))),
    CONSTRAINT fk_trace_annotations_trace_rowid_traces FOREIGN KEY
        (trace_rowid)
        REFERENCES public.traces (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_trace_annotations_user_id_users FOREIGN KEY
        (user_id)
        REFERENCES public.users (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_trace_annotations_trace_rowid ON public.trace_annotations
    USING btree (trace_rowid);
