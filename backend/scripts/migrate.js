import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const command = process.argv[2];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

async function tableExists(tableName) {
  const { rows } = await pool.query(
    `select 1 as ok
     from information_schema.tables
     where table_schema = 'public' and table_name = $1
     limit 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const { rows } = await pool.query(
    `select 1 as ok
     from information_schema.columns
     where table_schema = 'public'
       and table_name = $1
       and column_name = $2
     limit 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const schemaPath = path.join(repoRoot, 'schema.sql');
  const googleCalendarMigrationPath = path.join(__dirname, '..', 'migrations', 'add_google_calendar.sql');
  const prdMigrationPath = path.join(__dirname, '..', 'migrations', 'add_prd_fields.sql');

  if (!command || !['schema', 'gc', 'prd', 'init'].includes(command)) {
    console.error('Usage: node scripts/migrate.js <schema|gc|prd|init>');
    process.exit(1);
  }

  if (command === 'init') {
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
      console.log('✅ ensured pgcrypto');
    } catch (err) {
      console.warn('⚠️  could not create pgcrypto extension:', err.message);
    }

    if (await tableExists('tasks')) {
      console.log('ℹ️  schema already applied (tasks exists), skipping schema.sql');
    } else {
      await runSqlFile(schemaPath);
      console.log('✅ applied schema.sql');
    }

    // PRD fields are required by /api/tasks (planned_date, priority_color, etc.)
    // Apply migration if key columns are missing.
    const hasPlannedDate = await columnExists('tasks', 'planned_date');
    const hasPriorityColor = await columnExists('tasks', 'priority_color');
    if (hasPlannedDate && hasPriorityColor) {
      console.log('ℹ️  PRD fields already applied (tasks.planned_date/priority_color exist), skipping add_prd_fields.sql');
    } else {
      await runSqlFile(prdMigrationPath);
      console.log('✅ applied add_prd_fields.sql');
    }

    if (await tableExists('google_calendar_tokens')) {
      console.log('ℹ️  google calendar migration already applied (google_calendar_tokens exists), skipping');
    } else {
      await runSqlFile(googleCalendarMigrationPath);
      console.log('✅ applied add_google_calendar.sql');
    }

    return;
  }

  if (command === 'schema') {
    if (await tableExists('tasks')) {
      console.log('ℹ️  schema already applied (tasks exists), skipping schema.sql');
    } else {
      await runSqlFile(schemaPath);
      console.log('✅ applied schema.sql');
    }
    return;
  }

  if (command === 'gc') {
    if (await tableExists('google_calendar_tokens')) {
      console.log('ℹ️  google calendar migration already applied (google_calendar_tokens exists), skipping');
    } else {
      await runSqlFile(googleCalendarMigrationPath);
      console.log('✅ applied add_google_calendar.sql');
    }

    return;
  }

  if (command === 'prd') {
    if (!(await tableExists('tasks'))) {
      console.log('ℹ️  tasks table not found; apply schema first (node scripts/migrate.js schema or init)');
      process.exit(1);
    }

    const hasPlannedDate = await columnExists('tasks', 'planned_date');
    const hasPriorityColor = await columnExists('tasks', 'priority_color');
    if (hasPlannedDate && hasPriorityColor) {
      console.log('ℹ️  PRD fields already applied (tasks.planned_date/priority_color exist), skipping add_prd_fields.sql');
    } else {
      await runSqlFile(prdMigrationPath);
      console.log('✅ applied add_prd_fields.sql');
    }
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('❌ migration failed:', err.message);
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(1);
  });
