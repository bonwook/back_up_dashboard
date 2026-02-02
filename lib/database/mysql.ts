import mysql from "mysql2/promise"

const globalForPool = globalThis as unknown as {
  __flonicsMysqlPool: mysql.Pool | undefined
}

export function getPool(): mysql.Pool {
  // In Next.js dev (especially with Turbopack), server modules can be instantiated multiple times
  // across different SSR chunks. Using globalThis prevents creating multiple pools and exhausting MySQL.
  if (!globalForPool.__flonicsMysqlPool) {
    const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`)
    }

    globalForPool.__flonicsMysqlPool = mysql.createPool({
      host: process.env.DB_HOST!,
      port: Number.parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
  }
  return globalForPool.__flonicsMysqlPool
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPool()
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params)
  return results.length > 0 ? results[0] : null
}
