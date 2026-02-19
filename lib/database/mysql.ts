import mysql from "mysql2/promise"
import { getDbPassword } from "@/lib/aws/secrets"

const globalForPool = globalThis as unknown as {
  __flonicsMysqlPool: mysql.Pool | undefined
}

function checkRequiredEnvVars(): void {
  const useSecretsManager = !!(process.env.AWS_DB_SECRET_NAME || process.env.DB_SECRET_ARN)
  const required = ["DB_HOST", "DB_USER", "DB_NAME"] as const
  if (!useSecretsManager) {
    required.push("DB_PASSWORD")
  }
  const missingVars = required.filter((varName) => !process.env[varName]?.trim())
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`)
  }
}

/**
 * MySQL 연결 풀 반환. 첫 호출 시 비밀번호를 env 또는 AWS Secrets Manager에서 로드합니다.
 */
export async function getPool(): Promise<mysql.Pool> {
  if (!globalForPool.__flonicsMysqlPool) {
    checkRequiredEnvVars()
    const password = await getDbPassword()
    globalForPool.__flonicsMysqlPool = mysql.createPool({
      host: process.env.DB_HOST!,
      port: Number.parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER!,
      password,
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
  const pool = await getPool()
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params)
  return results.length > 0 ? results[0] : null
}
