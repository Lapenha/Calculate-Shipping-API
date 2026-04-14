import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { env } from '../../config/env'

export const pool = new Pool({
  connectionString: env.databaseUrl,
})

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_unsubscribes (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const passwordHash = await bcrypt.hash(env.adminPassword, 10)
  await pool.query(
    `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING
    `,
    [env.adminEmail.toLowerCase(), passwordHash],
  )
}
