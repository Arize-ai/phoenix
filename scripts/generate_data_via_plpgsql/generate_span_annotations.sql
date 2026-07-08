/*
 * Generate Span Annotations
 *
 * This script generates random annotations for spans in the database. It:
 * 1. Samples random spans using TABLESAMPLE SYSTEM (1)
 * 2. For each sampled span, generates between 1 and max_annotations_per_span annotations
 * 3. Each annotation has:
 *    - Random name from the provided list
 *    - Random label: either "YES" or "NO"
 *    - Random score: an integer between -100,000,000 and 100,000,000
 *    - Detailed metadata JSON object with model parameters and context
 *    - Random annotator kind: either "HUMAN" or "LLM"
 *    - Multi-paragraph explanation text
 *
 * The script uses a single bulk INSERT operation for efficiency.
 * TABLESAMPLE SYSTEM (1) samples approximately 1% of the table randomly.
 * When a duplicate annotation (same name and span_rowid) is found, it is skipped.
 *
 * Note: This script assumes the existence of the following tables:
 * - public.spans: Contains the spans to be annotated
 * - public.span_annotations: Where the annotations will be stored
 *
 * The script maintains referential integrity by using the span's id as span_rowid.
 */

-- Main insert with optimized sampling and data generation
INSERT INTO public.span_annotations (
    span_rowid,
    identifier,
    source,
    name,
    label,
    score,
    metadata,
    annotator_kind,
    explanation
)
WITH annotation_names AS (
    SELECT array_agg(name) as names_array
    FROM unnest(string_to_array(:'annotation_names', ',')) as name
),
sampled_spans AS (
    SELECT
        id,
        1 + floor(random() * :max_annotations_per_span)::int as num_annotations
    FROM public.spans
    TABLESAMPLE SYSTEM (1)
    LIMIT :limit
),
span_repeats AS (
    SELECT
        s.id,
        generate_series(1, s.num_annotations) as annotation_num,
        random() < :label_missing_prob as label_missing,
        random() < :score_missing_prob as score_missing,
        random() < :explanation_missing_prob as explanation_missing,
        random() < :metadata_missing_prob as metadata_missing
    FROM sampled_spans s
)
SELECT
    s.id,
    CASE WHEN s.annotation_num = 1 THEN '' ELSE gen_random_uuid()::text END,
    CASE WHEN random() < 0.5 THEN 'APP' ELSE 'API' END,
    a.names_array[1 + floor(random() * array_length(a.names_array, 1))::int],
    CASE
        WHEN s.label_missing THEN NULL
        ELSE CASE WHEN random() < 0.5 THEN 'YES' ELSE 'NO' END
    END,
    CASE
        WHEN s.score_missing THEN NULL
        ELSE floor(random() * 200000001 - 100000000)::int
    END,
    CASE
        WHEN s.metadata_missing THEN '{}'::jsonb
        ELSE jsonb_build_object(
            'confidence', random(),
            'timestamp', extract(epoch from now())::bigint,
            'version', '1.0',
            'model', CASE WHEN random() < 0.5 THEN 'gpt-4' ELSE 'gpt-3.5-turbo' END,
            'temperature', random() * 2,
            'max_tokens', floor(random() * 1000)::int,
            'context_length', floor(random() * 4000)::int,
            'top_p', random(),
            'frequency_penalty', random() * 2 - 1,
            'presence_penalty', random() * 2 - 1,
            'stop_sequences', ARRAY['\n', '.', '?', '!'],
            'logprobs', floor(random() * 5)::int,
            'best_of', floor(random() * 3 + 1)::int,
            'echo', random() < 0.5,
            'stream', random() < 0.5,
            'user', 'user_' || floor(random() * 1000)::text,
            'organization', 'org_' || floor(random() * 100)::text,
            'deployment', 'deploy_' || floor(random() * 10)::text
        )
    END,
    CASE WHEN random() < 0.5 THEN 'HUMAN' ELSE 'LLM' END,
    CASE
        WHEN s.explanation_missing THEN NULL
        ELSE 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.'
    END
FROM span_repeats s
CROSS JOIN annotation_names a
ON CONFLICT (name, span_rowid, identifier) DO NOTHING;
