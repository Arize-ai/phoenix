/** Refresh the data-model diagram from the database schema. */
import { readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";

import { migrateDatabase } from "./migrate";
import { withTemporaryPostgres } from "./temporary-postgres";

await withTemporaryPostgres(async (databaseUrl): Promise<void> => {
  migrateDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ schema: unknown }>(`
      SELECT json_agg(json_build_object(
        'name', relation.relname,
        'columns', (SELECT json_agg(json_build_object(
          'name', attribute.attname,
          'type', attribute.atttypid::regtype::text,
          'nullable', NOT attribute.attnotnull,
          'default', pg_get_expr(default_value.adbin, default_value.adrelid)
        ) ORDER BY attribute.attnum)
          FROM pg_attribute attribute
          LEFT JOIN pg_attrdef default_value ON default_value.adrelid = attribute.attrelid AND default_value.adnum = attribute.attnum
          WHERE attribute.attrelid = relation.oid AND attribute.attnum > 0 AND NOT attribute.attisdropped),
        'constraints', COALESCE((SELECT json_agg(json_build_object(
          'type', constraint_row.contype,
          'definition', pg_get_constraintdef(constraint_row.oid),
          'columns', ARRAY(SELECT attribute.attname FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(number, position)
            JOIN pg_attribute attribute ON attribute.attrelid = relation.oid AND attribute.attnum = key_column.number ORDER BY key_column.position),
          'target', CASE WHEN constraint_row.contype = 'f' THEN constraint_row.confrelid::regclass::text END,
          'targetColumns', ARRAY(SELECT attribute.attname FROM unnest(constraint_row.confkey) WITH ORDINALITY key_column(number, position)
            JOIN pg_attribute attribute ON attribute.attrelid = constraint_row.confrelid AND attribute.attnum = key_column.number ORDER BY key_column.position)
        ) ORDER BY constraint_row.conname) FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = relation.oid AND constraint_row.contype IN ('p','u','f','c')), '[]'::json)::jsonb
          || COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'type', 'i', 'definition', pg_get_indexdef(index_row.indexrelid),
            'columns', '[]'::json, 'target', NULL, 'targetColumns', '[]'::json
          )) FROM pg_index index_row WHERE index_row.indrelid = relation.oid
            AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conindid = index_row.indexrelid)), '[]'::jsonb),
        'triggers', ARRAY(SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = relation.oid AND NOT tgisinternal)
      ) ORDER BY relation.relname) AS schema
      FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public' AND relation.relkind = 'r' AND relation.relname <> 'schema_migrations'
    `);
    const path = "data-model.html";
    const schema = JSON.stringify(result.rows[0].schema, null, 2).replaceAll(
      "<",
      "\\u003c"
    );
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        /(<script id="schema" type="application\/json">)[\s\S]*?(<\/script>)/,
        (_match, opening: string, closing: string): string =>
          `${opening}\n${schema}\n${closing}`
      )
    );
  } finally {
    await pool.end();
  }
});
