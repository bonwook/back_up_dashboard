#!/usr/bin/env node
/**
 * toS3Key 로직 화이트박스/경계값 테스트 (Node만 사용, 추가 패키지 없음)
 * 실행: node scripts/test-s3-updates-logic.mjs
 */

function toS3Key(row) {
  const name = row.file_name ?? ""
  const prefix = (row.bucket_name ?? "").trim()
  return prefix ? `${prefix}/${name}` : name
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

let passed = 0
const ok = (cond, msg) => {
  if (cond) {
    passed++
    return
  }
  throw new Error(msg)
}

// --- 경계값/화이트박스 테스트 ---

// 1) file_name만 있는 경우 (prefix 없음)
ok(toS3Key({ file_name: "report.pdf" }) === "report.pdf", "file_name only")
ok(toS3Key({ file_name: "a" }) === "a", "file_name single char")

// 2) bucket_name이 있는 경우
ok(toS3Key({ file_name: "a", bucket_name: "prefix" }) === "prefix/a", "prefix + file")
ok(toS3Key({ file_name: "x.zip", bucket_name: "uploads/2024" }) === "uploads/2024/x.zip", "path prefix")

// 3) bucket_name이 null/undefined
ok(toS3Key({ file_name: "f", bucket_name: null }) === "f", "bucket_name null")
ok(toS3Key({ file_name: "f", bucket_name: undefined }) === "f", "bucket_name undefined")

// 4) bucket_name 공백만
ok(toS3Key({ file_name: "f", bucket_name: "   " }) === "f", "bucket_name whitespace only")
ok(toS3Key({ file_name: "f", bucket_name: "" }) === "f", "bucket_name empty string")

// 5) file_name 빈 문자열 (경계)
ok(toS3Key({ file_name: "" }) === "", "file_name empty")
ok(toS3Key({ file_name: "", bucket_name: "p" }) === "p/", "prefix + empty file_name")

// 6) trim 동작
ok(toS3Key({ file_name: "f", bucket_name: "  p  " }) === "p/f", "bucket_name trimmed")

console.log(`OK: ${passed} tests passed (toS3Key)`)
process.exit(0)
