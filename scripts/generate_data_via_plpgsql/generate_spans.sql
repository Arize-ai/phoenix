/*
 * Span Generation Script
 * =====================
 *
 * Purpose:
 *   Generates synthetic test data for a distributed tracing system by creating
 *   a hierarchical structure of spans with realistic timing relationships.
 *   This script is designed to populate a PostgreSQL database with test data
 *   for performance testing and development of tracing visualization tools.
 *
 * Architecture:
 *   The script follows a modular design with four main components:
 *   1. Helper Functions: insert_span and generate_child_spans
 *   2. Main Function: generate_spans
 *   3. Execution Block: DO block that configures and runs the generation
 *   4. Cleanup: Removes functions after execution
 *
 * Data Structure:
 *   - Projects: Top-level container for traces
 *   - Traces: Groups of related spans representing a complete request
 *   - Spans: Individual operations within a trace, organized in a hierarchy:
 *     * Layer 1: 8 parent spans per trace
 *     * Layer 2: 7 child spans per Layer 1 span (56 spans total)
 *     * Layer 3: 6 child spans per Layer 2 span (336 spans total)
 *     * Total spans per trace: 400 spans (8 + 56 + 336)
 *     * Each span includes attributes with input/output values and metadata
 *     * All spans within the same trace share the same conversation_id in metadata
 *
 * Span Parent-Child Relationships:
 *   The script creates two types of root spans (Layer 1):
 *   1. Standard root spans (50%): Have NULL parent_id, representing the true root of a trace
 *   2. Orphan spans (50%): Have a randomly generated parent_id that doesn't exist in the trace
 *      These orphan spans simulate scenarios where parent spans are missing or were dropped,
 *      which is common in distributed tracing systems due to sampling, data loss, or cross-service boundaries.
 *   All child spans (Layer 2 and 3) have valid parent_ids that reference their actual parent span.
 *
 * PostgreSQL Storage and TOAST:
 *   This script generates spans with two distinct sizes to test PostgreSQL's TOAST
 *   (The Oversized-Attribute Storage Technique) mechanism:
 *
 *   1. Small spans (70% of cases):
 *      - Contains ~40 bytes of random data (20 bytes per field, 2 fields total)
 *      - Each byte of random data becomes 2 hex characters, doubling the size
 *      - Attributes include:
 *        * input/output values as hex strings
 *        * metadata with only conversation_id
 *      - Total size ~350 bytes, stored inline in the main table (well below TOAST threshold)
 *      - Represents typical spans with minimal payload
 *
 *   2. Large spans (30% of cases):
 *      - Contains ~4000 bytes of random data (2000 bytes per field, 2 fields total)
 *      - Each byte of random data becomes 2 hex characters, doubling the size
 *      - Attributes include:
 *        * input/output values as hex strings
 *        * rich metadata with conversation_id and additional fields:
 *          - environment (production/staging/development)
 *          - service (api-gateway/auth-service/etc.)
 *          - location (region/zone)
 *          - metrics (array of values)
 *          - flags (array of status)
 *          - request (method/path/headers)
 *          - matrix (nested arrays)
 *          - paths (mixed type arrays)
 *      - Total size ~8KB, automatically moved to TOAST table (above TOAST threshold)
 *      - Represents spans with substantial payloads
 *
 *   TOAST is PostgreSQL's mechanism for handling large values. When a row exceeds
 *   the TOAST threshold (typically 2KB), PostgreSQL automatically compresses and/or
 *   stores the large values in a separate TOAST table. This has performance implications:
 *   - TOASTed values require additional I/O to retrieve
 *   - TOAST compression can save space for large values
 *   - Queries accessing TOASTed columns may be slower
 *
 * Configuration:
 *   - num_traces: Number of traces to generate (default: 100)
 *   - Can be set via environment variable: num_traces
 *
 * Performance Features:
 *   - Efficient batch processing
 *   - Error handling with detailed logging
 *   - Self-contained function creation and cleanup
 *
 * Usage:
 *   psql -d your_database -f generate_spans.sql
 *
 * Example:
 *   -- To run with custom parameters:
 *   num_traces=500 psql -d your_database -f generate_spans.sql
 *
 * Expected Outcome:
 *   - Creates a 'default' project if it doesn't exist
 *   - Generates spans across the specified number of traces
 *   - Each span has realistic timing and parent-child relationships
 *   - Spans include random data of two distinct sizes (1000B or 10B per field, doubled by hex encoding)
 *   - Each trace contains 400 spans (8 Layer 1 + 56 Layer 2 + 336 Layer 3)
 *   - 50% of the root spans are orphan spans with non-existent parent_ids
 *
 * Dependencies:
 *   - PostgreSQL 12+
 *   - pgcrypto extension (for random data generation)
 *   - Tables: projects, traces, spans
 *   - Sequences: projects_id_seq, traces_id_seq, spans_id_seq
 */

-- =============================================
-- Setup
-- =============================================

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.generate_spans CASCADE;
DROP FUNCTION IF EXISTS public.generate_child_spans CASCADE;
DROP FUNCTION IF EXISTS public.insert_span CASCADE;
DROP FUNCTION IF EXISTS public.report_table_sizes CASCADE;
DROP FUNCTION IF EXISTS public.report_table_sizes_with_sequences CASCADE;

-- Create pgcrypto extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- Helper Functions
-- =============================================

-- Function to insert a span
-- Parameters:
--   p_trace_rowid: ID of the trace this span belongs to
--   p_parent_id: ID of the parent span (NULL for root spans)
--   p_start_time: Start time of the span
--   p_end_time: End time of the span
--   p_conversation_id: UUID to use for conversation_id in metadata
-- Returns: The generated span_id
CREATE OR REPLACE FUNCTION insert_span(
    p_trace_rowid BIGINT,
    p_parent_id TEXT,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_conversation_id UUID
) RETURNS TEXT AS
$$
DECLARE
    v_span_id    TEXT;
    v_input_hex  TEXT;
    v_output_hex TEXT;
    v_hex_size   INTEGER;
    v_metadata   JSONB;
BEGIN
    -- Generate span_id
    v_span_id := encode(gen_random_bytes(8), 'hex');

    -- Randomly set hex_size to two different scenarios to test TOAST behavior:
    -- 1. Large spans (30%): v_hex_size = 1000, generating ~2000 bytes of hex string
    --    This exceeds the TOAST threshold (typically 2KB) and will be stored in TOAST tables
    -- 2. Small spans (70%): v_hex_size = 10, generating ~20 bytes of hex string
    --    This stays below the TOAST threshold and will be stored inline
    IF random() < 0.3 THEN
        v_hex_size := 1000;
    ELSE
        v_hex_size := 10;
    END IF;

    -- Generate random hex strings of the calculated size
    -- Each byte of random data becomes 2 hex characters, doubling the size:
    -- v_hex_size = 1000 generates 2000 hex characters (~4000 bytes for two fields)
    -- v_hex_size = 10 generates 20 hex characters (~40 bytes for two fields)
    v_input_hex := encode(gen_random_bytes(v_hex_size), 'hex');
    v_output_hex := encode(gen_random_bytes(v_hex_size), 'hex');

    -- Generate random metadata
    v_metadata := CASE
                      WHEN random() < 0.7 THEN
                          -- Small spans (70%): Just conversation_id
                          jsonb_build_object(
                                  'conversation_id', p_conversation_id
                          )
                      ELSE
                          -- Large spans (30%): Rich metadata
                          jsonb_build_object(
                                  'conversation_id', p_conversation_id,
                                  'environment', CASE floor(random() * 3)::INTEGER
                                                     WHEN 0 THEN 'production'
                                                     WHEN 1 THEN 'staging'
                                                     ELSE 'development'
                                      END,
                                  'service', CASE floor(random() * 5)::INTEGER
                                                 WHEN 0 THEN 'api-gateway'
                                                 WHEN 1 THEN 'auth-service'
                                                 WHEN 2 THEN 'user-service'
                                                 WHEN 3 THEN 'payment-service'
                                                 ELSE 'notification-service'
                                      END,
                                  'location', jsonb_build_object(
                                          'region', CASE floor(random() * 3)::INTEGER
                                                        WHEN 0 THEN 'us-east-1'
                                                        WHEN 1 THEN 'us-west-2'
                                                        ELSE 'eu-west-1'
                                      END,
                                          'zone', CASE floor(random() * 3)::INTEGER
                                                      WHEN 0 THEN 'a'
                                                      WHEN 1 THEN 'b'
                                                      ELSE 'c'
                                              END
                                              ),
                                  'metrics', jsonb_build_array(
                                          floor(random() * 1000)::INTEGER,
                                          floor(random() * 1000)::INTEGER,
                                          floor(random() * 1000)::INTEGER
                                             ),
                                  'flags', jsonb_build_array(
                                          CASE
                                              WHEN random() < 0.5 THEN 'active'
                                              ELSE 'inactive' END,
                                          CASE
                                              WHEN random() < 0.5 THEN 'enabled'
                                              ELSE 'disabled' END
                                           ),
                                  'request', jsonb_build_object(
                                          'method', CASE floor(random() * 4)::INTEGER
                                                        WHEN 0 THEN 'GET'
                                                        WHEN 1 THEN 'POST'
                                                        WHEN 2 THEN 'PUT'
                                                        ELSE 'DELETE'
                                      END,
                                          'path',
                                          '/api/v' || floor(random() * 3 + 1)::TEXT || '/users',
                                          'headers', jsonb_build_object(
                                                  'content-type', 'application/json',
                                                  'authorization',
                                                  'Bearer ' || encode(gen_random_bytes(32), 'hex')
                                                     )
                                             ),
                                  'matrix', jsonb_build_array(
                                          jsonb_build_array(1, 2, 3),
                                          jsonb_build_array(4, 5, 6),
                                          jsonb_build_array(7, 8, 9)
                                            ),
                                  'paths', jsonb_build_array(
                                          jsonb_build_array('a', 'b', jsonb_build_array('c', 'd')),
                                          jsonb_build_array(1, 2, jsonb_build_array(3, 4)),
                                          jsonb_build_array('x', 'y', jsonb_build_array('z', 'w'))
                                           )
                          )
        END;

    -- Insert span
    BEGIN
        INSERT INTO public.spans (trace_rowid,
                                  span_id,
                                  parent_id,
                                  name,
                                  span_kind,
                                  start_time,
                                  end_time,
                                  attributes,
                                  events,
                                  status_code,
                                  status_message,
                                  cumulative_error_count,
                                  cumulative_llm_token_count_prompt,
                                  cumulative_llm_token_count_completion,
                                  llm_token_count_prompt,
                                  llm_token_count_completion)
        VALUES (p_trace_rowid,
                v_span_id,
                p_parent_id,
                v_span_id, -- Using span_id as name
                'INTERNAL', -- Default span_kind
                p_start_time,
                p_end_time,
                jsonb_build_object(
                        'input', jsonb_build_object('value', v_input_hex),
                        'output', jsonb_build_object('value', v_output_hex),
                        'metadata', v_metadata
                ),
                '[]'::jsonb, -- Empty events array
                'UNSET', -- Default status_code
                '', -- Empty status_message
                0, -- cumulative_error_count
                0, -- cumulative_llm_token_count_prompt
                0, -- cumulative_llm_token_count_completion
                NULL, -- llm_token_count_prompt (nullable)
                NULL -- llm_token_count_completion (nullable)
               );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error inserting span: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
            RETURN NULL;
    END;

    RETURN v_span_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate child spans for a parent
-- Parameters:
--   p_trace_rowid: ID of the trace
--   p_parent_id: ID of the parent span
--   p_parent_start_time: Start time of the parent span
--   p_parent_end_time: End time of the parent span
--   p_num_children: Number of child spans to generate
--   p_conversation_id: UUID to use for conversation_id in metadata
-- Returns: Total number of spans generated
CREATE OR REPLACE FUNCTION generate_child_spans(
    p_trace_rowid BIGINT,
    p_parent_id TEXT,
    p_parent_start_time TIMESTAMP WITH TIME ZONE,
    p_parent_end_time TIMESTAMP WITH TIME ZONE,
    p_num_children INTEGER,
    p_conversation_id UUID
) RETURNS INTEGER AS
$$
DECLARE
    v_span_id          TEXT;
    v_child_start_time TIMESTAMP WITH TIME ZONE;
    v_child_end_time   TIMESTAMP WITH TIME ZONE;
    v_random_seconds   INTEGER;
    v_random_duration  INTEGER;
    v_total_spans      INTEGER := 0;
BEGIN
    FOR i IN 1..p_num_children
        LOOP
            -- Calculate random start time within parent's time window
            v_random_seconds := floor(random() * (EXTRACT(EPOCH FROM
                                                          (p_parent_end_time - p_parent_start_time)) -
                                                  2))::INTEGER;
            v_child_start_time := p_parent_start_time + (v_random_seconds * INTERVAL '1 second');

            -- Calculate random duration (1-4 seconds)
            v_random_duration := floor(random() * 4 + 1)::INTEGER;
            v_child_end_time := v_child_start_time + (v_random_duration * INTERVAL '1 second');

            -- Ensure child span doesn't exceed parent's end time
            IF v_child_end_time > p_parent_end_time THEN
                v_child_end_time := p_parent_end_time;
            END IF;

            -- Insert child span
            v_span_id := insert_span(
                    p_trace_rowid,
                    p_parent_id,
                    v_child_start_time,
                    v_child_end_time,
                    p_conversation_id
                         );

            v_total_spans := v_total_spans + 1;
        END LOOP;

    RETURN v_total_spans;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Main Function
-- =============================================

-- Function to generate spans
-- Parameters:
--   p_num_traces: Number of traces to generate (default: 100)
-- Returns: void
CREATE OR REPLACE FUNCTION generate_spans(
    p_num_traces INTEGER DEFAULT 100
) RETURNS void AS
$$
DECLARE
    project_id        INTEGER;
    trace_record      RECORD;
    span_id           TEXT;
    start_time        TIMESTAMP WITH TIME ZONE;
    end_time          TIMESTAMP WITH TIME ZONE;
    span_start_time   TIMESTAMP WITH TIME ZONE;
    span_end_time     TIMESTAMP WITH TIME ZONE;
    random_minutes    INTEGER;
    random_seconds    INTEGER;
    random_duration   INTEGER;
    total_spans       BIGINT  := 0;
    layer2_spans      INTEGER := 0;
    layer3_spans      INTEGER := 0;
    v_layer2_count    INTEGER := 0;
    v_layer3_count    INTEGER := 0;
    v_conversation_id UUID;
BEGIN
    -- Get the default project ID
    SELECT id INTO project_id FROM public.projects WHERE name = 'default';

    -- If project doesn't exist, create it
    IF project_id IS NULL THEN
        INSERT INTO public.projects (name, description)
        VALUES ('default', 'Default project for testing span generation')
        RETURNING id INTO project_id;
    END IF;

    -- Generate traces
    FOR i IN 1..p_num_traces
        LOOP
            BEGIN
                -- Generate a UUID for this trace's conversation_id
                v_conversation_id := gen_random_uuid();

                -- Set trace time range with random offset (within last 24 hours)
                random_minutes := floor(random() * 1440)::INTEGER;
                start_time := NOW() - INTERVAL '24 hours' +
                              (random_minutes * INTERVAL '1 minute');

                random_duration := floor(random() * 7 + 3)::INTEGER;
                end_time := start_time + (random_duration * INTERVAL '1 minute');

                -- Insert trace
                INSERT INTO public.traces (project_rowid,
                                           trace_id,
                                           start_time,
                                           end_time)
                VALUES (project_id,
                        encode(gen_random_bytes(16), 'hex'),
                        start_time,
                        end_time)
                RETURNING * INTO trace_record;

                -- Generate 8 initial spans (Layer 1)
                FOR j IN 1..8
                    LOOP
                        random_seconds := floor(random() *
                                                (EXTRACT(EPOCH FROM (end_time - start_time)) - 20))::INTEGER;
                        span_start_time :=
                                start_time + (random_seconds * INTERVAL '1 second');

                        random_duration := floor(random() * 20 + 10)::INTEGER;
                        span_end_time :=
                                span_start_time + (random_duration * INTERVAL '1 second');

                        IF span_end_time > end_time THEN
                            span_end_time := end_time;
                        END IF;

                        -- Insert parent span and get its ID
                        span_id := insert_span(
                                trace_record.id,
                                CASE
                                    WHEN random() < 0.5
                                        THEN encode(gen_random_bytes(8), 'hex')
                                    ELSE NULL::TEXT
                                    END,
                                span_start_time,
                                span_end_time,
                                v_conversation_id
                                   );

                        total_spans := total_spans + 1;

                        -- Generate 7 child spans for each parent (Layer 2)
                        IF span_id IS NOT NULL THEN
                            v_layer2_count := generate_child_spans(
                                    trace_record.id,
                                    span_id,
                                    span_start_time,
                                    span_end_time,
                                    7,
                                    v_conversation_id
                                              );
                            layer2_spans := layer2_spans + v_layer2_count;
                            total_spans := total_spans + v_layer2_count;
                        END IF;

                        -- For each Layer 2 span, generate 6 children (Layer 3)
                        FOR k IN 1..7
                            LOOP
                                random_seconds := floor(random() *
                                                        (EXTRACT(EPOCH FROM (span_end_time - span_start_time)) - 2))::INTEGER;
                                span_start_time := span_start_time +
                                                   (random_seconds * INTERVAL '1 second');

                                random_duration := floor(random() * 4 + 1)::INTEGER;
                                span_end_time := span_start_time +
                                                 (random_duration * INTERVAL '1 second');

                                -- Fix: Compare with parent span's end time
                                IF span_end_time > end_time THEN
                                    span_end_time := end_time;
                                END IF;

                                -- Insert Layer 2 span
                                BEGIN
                                    span_id := insert_span(
                                            trace_record.id,
                                            span_id,
                                            span_start_time,
                                            span_end_time,
                                            v_conversation_id
                                               );

                                    total_spans := total_spans + 1;

                                    -- Generate 6 children for Layer 2 span (Layer 3)
                                    IF span_id IS NOT NULL THEN
                                        v_layer3_count := generate_child_spans(
                                                trace_record.id,
                                                span_id,
                                                span_start_time,
                                                span_end_time,
                                                6,
                                                v_conversation_id
                                                          );
                                        layer3_spans := layer3_spans + v_layer3_count;
                                        total_spans := total_spans + v_layer3_count;
                                    END IF;
                                EXCEPTION
                                    WHEN OTHERS THEN
                                        RAISE NOTICE 'Error inserting Layer 2 span: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
                                        CONTINUE;
                                END;
                            END LOOP;
                    END LOOP;

            EXCEPTION
                WHEN OTHERS THEN
                    -- Log detailed error information
                    RAISE NOTICE 'Error processing trace %: % (SQLSTATE: %)',
                        i, SQLERRM, SQLSTATE;

                    -- Continue with next trace
                    CONTINUE;
            END;
        END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Execution
-- =============================================

DO
$$
    DECLARE
        v_num_traces INTEGER;
    BEGIN
        -- Get number of traces to generate from parameter if provided
        v_num_traces := current_setting('num_traces', true)::INTEGER;

        -- Use default if not set
        IF v_num_traces IS NULL THEN
            v_num_traces := 100;
        END IF;

        -- Generate spans
        PERFORM generate_spans(v_num_traces);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
            RAISE;
    END;
$$;

-- =============================================
-- Cleanup
-- =============================================

-- Clean up functions after execution
DROP FUNCTION IF EXISTS public.generate_spans CASCADE;
DROP FUNCTION IF EXISTS public.generate_child_spans CASCADE;
DROP FUNCTION IF EXISTS public.insert_span CASCADE;
DROP FUNCTION IF EXISTS public.report_table_sizes CASCADE;
DROP FUNCTION IF EXISTS public.report_table_sizes_with_sequences CASCADE;
