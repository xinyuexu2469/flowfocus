import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_5wzdiolA7gTt@ep-square-dew-a488eovw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

console.log('测试连接...');
pool.query('SELECT NOW()')
  .then(res => {
    console.log('✅ 连接成功:', res.rows[0].now);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 连接失败:', err.message);
    process.exit(1);
  });
