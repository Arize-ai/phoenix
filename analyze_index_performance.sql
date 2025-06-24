-- Test script to compare index performance in PostgreSQL

-- Current ascending index query plan
EXPLAIN (ANALYZE, BUFFERS) 
SELECT model_id, MAX(span_start_time) as last_used_time
FROM span_costs 
WHERE model_id IN (1,2,3,4,5)
GROUP BY model_id;

-- Look for:
-- 1. "Index Scan Backward" or "Index Only Scan Backward" 
-- 2. Buffer reads
-- 3. Execution time

-- With descending index, you would see:
-- 1. "Index Scan" or "Index Only Scan" (forward)
-- 2. Similar buffer reads  
-- 3. Potentially similar execution time

-- The key metrics to compare:
-- - Planning Time
-- - Execution Time  
-- - Shared Hit Blocks
-- - Whether it uses "Index Only Scan" (covers query without table access) 