const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'vocational_user',
  host: process.env.DB_HOST || 'localhost', 
  database: process.env.DB_NAME || 'vocational_db',
  password: process.env.DB_PASSWORD || undefined,
  port: 5432,
});
module.exports = pool;

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Koneksi Database Gagal:', err.stack);
  } else {
    console.log('Koneksi Database Berhasil pada:', res.rows[0].now);
  }
});