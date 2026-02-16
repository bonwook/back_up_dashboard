#!/usr/bin/env node
/**
 * normalizeFileKeyArray 로직 화이트박스/경계값 테스트 (API와 동일한 규칙)
 * 실행: node scripts/test-normalize-file-keys.mjs
 */

function normalizeFileKeyArray(keys) {
  if (!Array.isArray(keys)) return []
  return keys
    .map((item) => {
      if (typeof item === "string" && item.length > 0) return item
      if (typeof item !== "object" || item === null) return null
      const o = item
      if (typeof o.key === "string" && o.key.length > 0) return o.key
      if (typeof o.s3_key === "string" && o.s3_key.length > 0) return o.s3_key
      if (typeof o.s3Key === "string" && o.s3Key.length > 0) return o.s3Key
      if (typeof o.path === "string" && o.path.length > 0) return o.path
      return null
    })
    .filter((k) => k !== null && k.length > 0)
}

function assertEqual(a, b, msg) {
  const same = Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
  if (!same) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
  passed++
}

let passed = 0
const ok = (cond, msg) => {
  if (cond) {
    passed++
    return
  }
  throw new Error(msg)
}

// 1) 배열이 아닌 경우 → []
ok(normalizeFileKeyArray(null).length === 0, "null → []")
ok(normalizeFileKeyArray(undefined).length === 0, "undefined → []")
ok(normalizeFileKeyArray("string").length === 0, "string → []")
ok(normalizeFileKeyArray(123).length === 0, "number → []")

// 2) 빈 배열
assertEqual(normalizeFileKeyArray([]), [], "[] → []")

// 3) string[] 그대로
assertEqual(normalizeFileKeyArray(["a", "b/c"]), ["a", "b/c"], "string[] 유지")
assertEqual(normalizeFileKeyArray(["only"]), ["only"], "단일 문자열")

// 4) 빈 문자열 제외 (공백만 있으면 length>0이라 통과하므로 빈 문자열만)
assertEqual(normalizeFileKeyArray(["", "x", ""]), ["x"], "빈 문자열 필터")

// 5) 객체 { key } 추출
assertEqual(normalizeFileKeyArray([{ key: "s3/path/file.pdf" }]), ["s3/path/file.pdf"], "key 추출")
assertEqual(normalizeFileKeyArray([{ key: "k" }, { key: "" }]), ["k"], "key 빈문자열 제외")

// 6) s3_key, s3Key, path 추출
assertEqual(normalizeFileKeyArray([{ s3_key: "sk" }]), ["sk"], "s3_key 추출")
assertEqual(normalizeFileKeyArray([{ s3Key: "sk2" }]), ["sk2"], "s3Key 추출")
assertEqual(normalizeFileKeyArray([{ path: "p/x" }]), ["p/x"], "path 추출")

// 7) API 응답 형태 { key, uploaded_at }
assertEqual(
  normalizeFileKeyArray([{ key: "k1", uploaded_at: "2024-01-01" }, "k2"]),
  ["k1", "k2"],
  "key + uploaded_at 혼합"
)

// 8) 혼합·null 요소
assertEqual(
  normalizeFileKeyArray([null, "a", undefined, { key: "b" }, "", 0]),
  ["a", "b"],
  "혼합 배열"
)

console.log(`OK: ${passed} tests passed (normalizeFileKeyArray)`)
process.exit(0)
