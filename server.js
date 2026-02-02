// server.js
const path = require("path")
const fs = require("fs")

// 명시적으로 작업 디렉토리 설정 (PM2 실행 시 안정성을 위해)
const rootDir = path.resolve(__dirname)
process.chdir(rootDir)

const envPath = path.join(rootDir, ".env")

console.log("[Server] cwd:", rootDir)
console.log("[Server] env path:", envPath)

if (fs.existsSync(envPath)) {
  require("dotenv").config({
    path: envPath,
    override: false,
  })
  console.log("[Server] .env loaded")
} else {
  console.warn("[Server] .env not found")
}

// 필수 환경변수 체크
const requiredVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
]

const missingVars = requiredVars.filter(
  (key) => !process.env[key] || process.env[key].trim() === ""
)

if (missingVars.length > 0) {
  console.error("[Server] Missing env vars:", missingVars)
  process.exit(1)
}

console.log("[Server] Environment OK")
console.log("[Server] Working directory:", process.cwd())
console.log("[Server] __dirname:", __dirname)

// Next.js가 올바른 디렉토리에서 실행되도록 확인
if (process.cwd() !== rootDir) {
  console.warn("[Server] Warning: Working directory mismatch, changing to:", rootDir)
  process.chdir(rootDir)
  console.log("[Server] Changed working directory to:", process.cwd())
}

// Next.js 실행
const nextArgs = process.argv.slice(2)
process.argv = ["node", "next", ...nextArgs]
require("next/dist/bin/next")