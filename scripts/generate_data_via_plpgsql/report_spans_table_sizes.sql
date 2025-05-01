-- =============================================
-- Direct Report Generation
-- =============================================

-- Set output format to unaligned and without headers
\pset format unaligned
\pset tuples_only on

-- Generate a report of table sizes
\echo '\n# Table Size Snapshot\n'

-- Create header and separator
\echo '| Metric               | Spans            | Traces           | Projects         |'
\echo '|----------------------|------------------|------------------|------------------|'

-- Execute the query and format results
WITH size_metrics AS (
    SELECT 'Total Size'::TEXT as metric_name,
           pg_size_pretty(pg_total_relation_size('spans')) as spans,
           pg_size_pretty(pg_total_relation_size('traces')) as traces,
           pg_size_pretty(pg_total_relation_size('projects')) as projects
    UNION ALL
    SELECT 'Base Table Size'::TEXT,
           pg_size_pretty(pg_table_size('spans')),
           pg_size_pretty(pg_table_size('traces')),
           pg_size_pretty(pg_table_size('projects'))
    UNION ALL
    SELECT 'Index Size'::TEXT,
           pg_size_pretty(pg_indexes_size('spans')),
           pg_size_pretty(pg_indexes_size('traces')),
           pg_size_pretty(pg_indexes_size('projects'))
    UNION ALL
    SELECT 'Row Count'::TEXT,
           to_char((SELECT COUNT(*) FROM spans), 'FM999,999,999,999,999'),
           to_char((SELECT COUNT(*) FROM traces), 'FM999,999,999,999,999'),
           to_char((SELECT COUNT(*) FROM projects), 'FM999,999,999,999,999')
    UNION ALL
    SELECT 'Current Sequence'::TEXT,
           to_char((SELECT last_value FROM spans_id_seq), 'FM999,999,999,999,999'),
           to_char((SELECT last_value FROM traces_id_seq), 'FM999,999,999,999,999'),
           to_char((SELECT last_value FROM projects_id_seq), 'FM999,999,999,999,999')
)
SELECT '| ' ||
       rpad(metric_name, 20) || ' | ' ||
       lpad(spans, 16) || ' | ' ||
       lpad(traces, 16) || ' | ' ||
       lpad(projects, 16) || ' |'
FROM size_metrics
ORDER BY CASE metric_name
             WHEN 'Total Size' THEN 1
             WHEN 'Base Table Size' THEN 2
             WHEN 'Index Size' THEN 3
             WHEN 'Row Count' THEN 4
             WHEN 'Current Sequence' THEN 5
         END;

-- Reset output format
\pset format aligned
\pset tuples_only off
