// Schema introspection helpers used by promoteContent.js. Table names in
// this codebase's promotion scope always use `id` as the BIGSERIAL primary
// key column, so promotion logic can treat "column named id" as the
// universal identity column without a per-table lookup table.

const columnsCache = new Map();
const foreignKeysCache = new Map();

export const getColumns = async (pool, table) => {
  if (columnsCache.has(table)) {
    return columnsCache.get(table);
  }

  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );

  if (!rows.length) {
    throw new Error(`No such table (or no columns): ${table}`);
  }

  const columns = rows.map((row) => row.column_name);
  columnsCache.set(table, columns);
  return columns;
};

// Returns [{ column, refTable, refColumn }] for every FOREIGN KEY constraint
// declared on `table`.
export const getForeignKeys = async (pool, table) => {
  if (foreignKeysCache.has(table)) {
    return foreignKeysCache.get(table);
  }

  const { rows } = await pool.query(
    `
      SELECT
        kcu.column_name AS column,
        ccu.table_name AS ref_table,
        ccu.column_name AS ref_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `,
    [table]
  );

  const foreignKeys = rows.map((row) => ({
    column: row.column,
    refTable: row.ref_table,
    refColumn: row.ref_column,
  }));
  foreignKeysCache.set(table, foreignKeys);
  return foreignKeys;
};
