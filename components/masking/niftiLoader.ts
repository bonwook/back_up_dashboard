"use client"

import { gunzipSync, gzipSync } from "fflate"
import type { NiftiHeaderLike } from "./types"

/** GZIP 매직 넘버로 압축 여부 판별 */
function isGzip(data: ArrayBuffer): boolean {
  if (data.byteLength < 2) return false
  const v = new Uint8Array(data, 0, 2)
  return v[0] === 0x1f && v[1] === 0x8b
}

/** nifti-reader-js는 동적 import로 로드 (클라이언트 전용) */
async function getNifti() {
  const nifti = await import("nifti-reader-js")
  return nifti
}

/** 클라이언트에서 .nii.gz 해제: fflate → nifti-reader-js 파이프라인 */
export async function parseNifti(
  data: ArrayBuffer
): Promise<{
  header: NiftiHeaderLike
  imageBuffer: ArrayBuffer
  data: ArrayBuffer
  wasGzipped: boolean
}> {
  let buf: ArrayBuffer
  const wasGzipped = isGzip(data)
  if (wasGzipped) {
    const decompressed = gunzipSync(new Uint8Array(data))
    buf = decompressed.buffer.slice(
      decompressed.byteOffset,
      decompressed.byteOffset + decompressed.byteLength
    )
  } else {
    buf = data
  }
  const nifti = await getNifti()
  if (!nifti.isNIFTI(buf)) {
    throw new Error("유효한 NIfTI 파일이 아닙니다.")
  }
  const header = nifti.readHeader(buf) as NiftiHeaderLike
  const imageBuffer = nifti.readImage(header, buf)
  return { header, imageBuffer, data: buf, wasGzipped }
}

/** 헤더에서 슬라이스 크기·볼륨 크기 계산 */
export function getSliceLayout(header: NiftiHeaderLike) {
  const dims = header.dims
  const nx = dims[1] ?? 1
  const ny = dims[2] ?? 1
  const nz = dims[3] ?? 1
  const bytesPerVoxel = header.numBitsPerVoxel / 8
  const sliceSizeAxial = nx * ny * bytesPerVoxel
  const sliceSizeCoronal = nx * nz * bytesPerVoxel
  const sliceSizeSagittal = ny * nz * bytesPerVoxel
  const totalVoxels = nx * ny * nz
  const totalBytes = totalVoxels * bytesPerVoxel
  return {
    nx,
    ny,
    nz,
    bytesPerVoxel,
    sliceSizeAxial,
    sliceSizeCoronal,
    sliceSizeSagittal,
    totalVoxels,
    totalBytes,
    datatypeCode: header.datatypeCode,
    littleEndian: header.littleEndian ?? true,
  }
}

/** 2D 슬라이스 픽셀 추출 (그레이스케일 → RGBA, min/max 정규화, scl_slope/inter 적용) */
function getSlicePixels(
  imageBuffer: ArrayBuffer,
  layout: ReturnType<typeof getSliceLayout>,
  axis: "axial" | "coronal" | "sagittal",
  sliceIndex: number,
  minNorm: number,
  maxNorm: number,
  sclSlope?: number,
  sclInter?: number
): Uint8ClampedArray {
  const { nx, ny, nz, bytesPerVoxel, datatypeCode, littleEndian } = layout
  const dv = new DataView(imageBuffer)
  const getVoxel = (x: number, y: number, z: number): number => {
    let idx: number
    if (axis === "axial") {
      idx = (z * nx * ny + y * nx + x) * bytesPerVoxel
    } else if (axis === "coronal") {
      idx = (y * nx * nz + z * nx + x) * bytesPerVoxel
    } else {
      idx = (x * ny * nz + z * ny + y) * bytesPerVoxel
    }
    let raw = 0
    if (datatypeCode === 2) raw = dv.getUint8(idx)
    else if (datatypeCode === 4) raw = littleEndian ? dv.getInt16(idx, true) : dv.getInt16(idx, false)
    else if (datatypeCode === 8) raw = littleEndian ? dv.getInt32(idx, true) : dv.getInt32(idx, false)
    else if (datatypeCode === 16) raw = dv.getFloat32(idx, littleEndian)
    else raw = dv.getUint8(idx)
    return scaleValue(raw, sclSlope, sclInter)
  }
  let width: number, height: number
  let readAt: (i: number, j: number) => number
  if (axis === "axial") {
    width = nx
    height = ny
    readAt = (i, j) => getVoxel(i, j, sliceIndex)
  } else if (axis === "coronal") {
    width = nx
    height = nz
    readAt = (i, j) => getVoxel(i, sliceIndex, j)
  } else {
    width = ny
    height = nz
    readAt = (i, j) => getVoxel(sliceIndex, i, j)
  }
  const range = maxNorm - minNorm || 1
  const out = new Uint8ClampedArray(width * height * 4)
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const v = readAt(i, j)
      const t = (v - minNorm) / range
      const u = Math.max(0, Math.min(255, Math.round(t * 255)))
      const o = (j * width + i) * 4
      out[o] = u
      out[o + 1] = u
      out[o + 2] = u
      out[o + 3] = 255
    }
  }
  return out
}

/** 현재 슬라이스 인덱스 범위 */
export function getSliceRange(header: NiftiHeaderLike, axis: "axial" | "coronal" | "sagittal") {
  const dims = header.dims
  const n = axis === "axial" ? (dims[3] ?? 1) : axis === "coronal" ? (dims[2] ?? 1) : (dims[1] ?? 1)
  return { min: 0, max: Math.max(0, n - 1) }
}

/** 헤더의 scl_slope/scl_inter 적용한 스케일 값 (표시용) */
function scaleValue(
  raw: number,
  sclSlope: number | undefined,
  sclInter: number | undefined
): number {
  if (sclSlope != null && sclSlope !== 0) return raw * sclSlope + (sclInter ?? 0)
  return raw
}

/** 볼륨 전체의 표시 픽셀 범위(min/max). 윈도우 레벨용. cal_min/cal_max 우선, 없으면 데이터 스캔 */
export function getVolumeMinMax(
  header: NiftiHeaderLike,
  imageBuffer: ArrayBuffer
): { min: number; max: number } {
  const layout = getSliceLayout(header)
  const { totalVoxels, bytesPerVoxel, datatypeCode, littleEndian } = layout
  const sclSlope = header.scl_slope
  const sclInter = header.scl_inter
  const calMin = header.cal_min
  const calMax = header.cal_max

  if (
    calMin != null &&
    calMax != null &&
    typeof calMin === "number" &&
    typeof calMax === "number" &&
    calMax > calMin
  ) {
    return {
      min: scaleValue(calMin, sclSlope, sclInter),
      max: scaleValue(calMax, sclSlope, sclInter),
    }
  }

  const dv = new DataView(imageBuffer)
  let lo = Infinity
  let hi = -Infinity
  const step = Math.max(1, Math.floor(totalVoxels / 50000))
  for (let i = 0; i < totalVoxels; i += step) {
    const idx = i * bytesPerVoxel
    let raw = 0
    if (datatypeCode === 2) raw = dv.getUint8(idx)
    else if (datatypeCode === 4) raw = dv.getInt16(idx, littleEndian)
    else if (datatypeCode === 8) raw = dv.getInt32(idx, littleEndian)
    else if (datatypeCode === 16) raw = dv.getFloat32(idx, littleEndian)
    else raw = dv.getUint8(idx)
    const v = scaleValue(raw, sclSlope, sclInter)
    if (Number.isFinite(v)) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (lo > hi) {
    lo = 0
    hi = 255
  }
  return { min: lo, max: hi }
}

/** 2D 슬라이스 생성 (밝기/대비는 호출측에서 적용 권장) */
export function extractSlice(
  header: NiftiHeaderLike,
  imageBuffer: ArrayBuffer,
  axis: "axial" | "coronal" | "sagittal",
  sliceIndex: number,
  options?: { min?: number; max?: number }
): { width: number; height: number; data: Uint8ClampedArray } {
  const layout = getSliceLayout(header)
  let { min, max } = options ?? {}
  if (min == null || max == null) {
    const dims = header.dims
    const nx = dims[1] ?? 1,
      ny = dims[2] ?? 1,
      nz = dims[3] ?? 1
    const n = nx * ny * nz
    const dv = new DataView(imageBuffer)
    let lo = Infinity,
      hi = -Infinity
    const step = Math.max(1, Math.floor(n / 10000))
    for (let i = 0; i < n; i += step) {
      const idx = i * layout.bytesPerVoxel
      let v = 0
      if (layout.datatypeCode === 2) v = dv.getUint8(idx)
      else if (layout.datatypeCode === 4) v = dv.getInt16(idx, layout.littleEndian)
      else if (layout.datatypeCode === 16) v = dv.getFloat32(idx, layout.littleEndian)
      else v = dv.getUint8(idx)
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    min = min ?? lo
    max = max ?? hi
  }
  const data = getSlicePixels(
    imageBuffer,
    layout,
    axis,
    sliceIndex,
    min,
    max,
    header.scl_slope,
    header.scl_inter
  )
  const width = axis === "axial" ? layout.nx : axis === "coronal" ? layout.nx : layout.ny
  const height = axis === "axial" ? layout.ny : axis === "coronal" ? layout.nz : layout.nz
  return { width, height, data }
}

/** 3D 마스크에서 2D 슬라이스 추출 (axial/coronal/sagittal) */
export function getSliceFrom3DMask(
  mask3D: Uint8Array,
  header: NiftiHeaderLike,
  axis: "axial" | "coronal" | "sagittal",
  sliceIndex: number
): Uint8Array {
  const layout = getSliceLayout(header)
  const { nx, ny, nz } = layout
  const w = axis === "axial" ? nx : axis === "coronal" ? nx : ny
  const h = axis === "axial" ? ny : axis === "coronal" ? nz : nz
  const out = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let idx: number
      if (axis === "axial") idx = sliceIndex * nx * ny + j * nx + i
      else if (axis === "coronal") idx = i + j * nx + sliceIndex * nx * nz
      else idx = sliceIndex * ny * nz + i + j * ny
      out[j * w + i] = mask3D[idx] ?? 0
    }
  }
  return out
}

/** 2D 슬라이스 마스크를 3D 마스크에 반영 (getSlicePixels의 getVoxel 순서와 동일) */
export function setSliceIn3DMask(
  mask3D: Uint8Array,
  header: NiftiHeaderLike,
  axis: "axial" | "coronal" | "sagittal",
  sliceIndex: number,
  sliceMask: Uint8Array
): void {
  const layout = getSliceLayout(header)
  const { nx, ny, nz } = layout
  const w = axis === "axial" ? nx : axis === "coronal" ? nx : ny
  const h = axis === "axial" ? ny : axis === "coronal" ? nz : nz
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let idx: number
      if (axis === "axial") idx = sliceIndex * nx * ny + j * nx + i
      else if (axis === "coronal") idx = i + j * nx + sliceIndex * nx * nz
      else idx = sliceIndex * ny * nz + i + j * ny
      mask3D[idx] = sliceMask[j * w + i] ?? 0
    }
  }
}

export interface BuildNiftiOptions {
  /** true면 .nii.gz로 압축하여 반환 (기본값: true, 원본이 .gz였을 때 권장) */
  compressOutput?: boolean
}

/** 원본 NIfTI 데이터 + 마스크 반영 이미지로 .nii/.nii.gz 다운로드용 Blob 생성 (헤더 유지) */
export function buildNiftiBlobWithMask(
  rawData: ArrayBuffer,
  header: NiftiHeaderLike,
  imageBuffer: ArrayBuffer,
  mask3D: Uint8Array,
  options?: BuildNiftiOptions
): Blob {
  const { compressOutput = true } = options ?? {}
  const layout = getSliceLayout(header)
  const offset = header.vox_offset
  const out = new ArrayBuffer(offset + imageBuffer.byteLength)
  const outView = new Uint8Array(out)
  outView.set(new Uint8Array(rawData, 0, offset), 0)
  const imgView = new DataView(imageBuffer)
  const outViewData = new DataView(out, offset, imageBuffer.byteLength)
  const bpv = layout.bytesPerVoxel
  const littleEndian = layout.littleEndian
  const n = layout.totalVoxels
  for (let i = 0; i < n; i++) {
    const byteOff = i * bpv
    if (mask3D[i] > 0) {
      if (bpv === 1) outViewData.setUint8(byteOff, 255)
      else if (bpv === 2) outViewData.setInt16(byteOff, 255, littleEndian)
      else if (bpv === 4) outViewData.setInt32(byteOff, 255, littleEndian)
      else outViewData.setUint8(byteOff, 255)
    } else {
      if (bpv === 1) outViewData.setUint8(byteOff, imgView.getUint8(byteOff))
      else if (bpv === 2) outViewData.setInt16(byteOff, imgView.getInt16(byteOff, littleEndian), littleEndian)
      else if (bpv === 4) outViewData.setInt32(byteOff, imgView.getInt32(byteOff, littleEndian), littleEndian)
      else for (let b = 0; b < bpv; b++) outViewData.setUint8(byteOff + b, imgView.getUint8(byteOff + b))
    }
  }
  if (compressOutput) {
    const compressed = gzipSync(new Uint8Array(out))
    return new Blob([compressed], { type: "application/octet-stream" })
  }
  return new Blob([out], { type: "application/octet-stream" })
}
