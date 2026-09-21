import mysql from 'mysql2/promise';

async function test() {
  console.log('A tentar ligar...');
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '01.Patmat.10',
      database: 'dlab',
      connectTimeout: 5000,
    });
    console.log('Ligado com sucesso!');
    const [rows] = await conn.query('SELECT 1');
    console.log('Query funcionou:', rows);
    await conn.end();
  } catch (err) {
    console.error('Erro:', err);
  }
}

test();