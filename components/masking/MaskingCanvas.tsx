"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Paintbrush, Eraser, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  extractSlice,
  getSliceLayout,
  getSliceRange,
  getSliceFrom3DMask,
  getVolumeMinMax,
} from "./niftiLoader"
import type { NiftiHeaderLike, SliceAxis } from "./types"

type Tool = "brush" | "eraser"

interface MaskingCanvasProps {
  header: NiftiHeaderLike | null
  imageBuffer: ArrayBuffer | null
  /** 3D 마스크 (볼륨과 동일 voxel 수); 없으면 내부 상태 사용 */
  mask3D: Uint8Array | null
  onMaskChange: (axis: SliceAxis, sliceIndex: number, mask: Uint8Array) => void
  onSaveRequest: () => void
  onDownloadRequest: () => void
  className?: string
}

export function MaskingCanvas({
  header,
  imageBuffer,
  mask3D,
  onMaskChange,
  onSaveRequest,
  onDownloadRequest,
  className,
}: MaskingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [axis, setAxis] = useState<SliceAxis>("axial")
  const [sliceIndex, setSliceIndex] = useState(0)
  const [tool, setTool] = useState<Tool>("brush")
  const [brushSize, setBrushSize] = useState(8)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const localMaskRef = useRef<Uint8Array | null>(null)
  const sliceDimsRef = useRef({ width: 0, height: 0 })
  const minMaxRef = useRef<{ min: number; max: number }>({ min: 0, max: 255 })
  const [volumeMinMaxReady, setVolumeMinMaxReady] = useState(0)

  const sliceRange = header ? getSliceRange(header, axis) : { min: 0, max: 0 }
  const sliceCount = sliceRange.max - sliceRange.min + 1

  const getSliceDims = useCallback(() => {
    if (!header) return { width: 0, height: 0 }
    const layout = getSliceLayout(header)
    if (axis === "axial") return { width: layout.nx, height: layout.ny }
    if (axis === "coronal") return { width: layout.nx, height: layout.nz }
    return { width: layout.ny, height: layout.nz }
  }, [header, axis])

  const drawSlice = useCallback(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!header || !imageBuffer || !canvas || !overlay) return
    const dims = getSliceDims()
    sliceDimsRef.current = dims
    if (dims.width === 0 || dims.height === 0) return
    const { data } = extractSlice(header, imageBuffer, axis, sliceIndex, {
      min: minMaxRef.current.min,
      max: minMaxRef.current.max,
    })
    canvas.width = dims.width
    canvas.height = dims.height
    overlay.width = dims.width
    overlay.height = dims.height
    const ctx = canvas.getContext("2d")
    const imgData = ctx!.createImageData(dims.width, dims.height)
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      const br = 1 + brightness / 100
      const co = 1 + contrast / 100
      const mid = 128
      r = Math.round(mid + (r - mid) * co * br + brightness)
      g = Math.round(mid + (g - mid) * co * br + brightness)
      b = Math.round(mid + (b - mid) * co * br + brightness)
      imgData.data[i] = Math.max(0, Math.min(255, r))
      imgData.data[i + 1] = Math.max(0, Math.min(255, g))
      imgData.data[i + 2] = Math.max(0, Math.min(255, b))
      imgData.data[i + 3] = 255
    }
    ctx!.putImageData(imgData, 0, 0)
    const sliceMask = mask3D
      ? getSliceFrom3DMask(mask3D, header, axis, sliceIndex)
      : localMaskRef.current
    if (sliceMask && sliceMask.length === dims.width * dims.height) {
      const oCtx = overlay.getContext("2d")!
      const oImg = oCtx.createImageData(dims.width, dims.height)
      for (let i = 0; i < sliceMask.length; i++) {
        const v = sliceMask[i]
        oImg.data[i * 4] = 255
        oImg.data[i * 4 + 1] = 0
        oImg.data[i * 4 + 2] = 0
        oImg.data[i * 4 + 3] = v * 0.5
      }
      oCtx.putImageData(oImg, 0, 0)
    }
  }, [header, imageBuffer, axis, sliceIndex, brightness, contrast, mask3D, getSliceDims, volumeMinMaxReady])

  useEffect(() => {
    if (!header) return
    const r = getSliceRange(header, axis)
    setSliceIndex((i) => Math.max(r.min, Math.min(r.max, i)))
  }, [header, axis])

  useEffect(() => {
    if (!header || !imageBuffer) return
    const { min, max } = getVolumeMinMax(header, imageBuffer)
    minMaxRef.current = { min, max }
    setVolumeMinMaxReady((n) => n + 1)
  }, [header, imageBuffer])

  useEffect(() => {
    drawSlice()
  }, [drawSlice])

  const canvasToSlice = useCallback(
    (clientX: number, clientY: number) => {
      const overlay = overlayRef.current
      const cont = containerRef.current
      if (!overlay || !cont) return null
      const rect = cont.getBoundingClientRect()
      const sx = (clientX - rect.left - pan.x) / scale
      const sy = (clientY - rect.top - pan.y) / scale
      const w = sliceDimsRef.current.width
      const h = sliceDimsRef.current.height
      const x = Math.floor(sx)
      const y = Math.floor(sy)
      if (x < 0 || x >= w || y < 0 || y >= h) return null
      return { x, y }
    },
    [pan, scale]
  )

  const applyBrush = useCallback(
    (px: number, py: number) => {
      const dims = sliceDimsRef.current
      const w = dims.width
      const h = dims.height
      if (w === 0 || h === 0 || !header) return
      let sliceMask = mask3D ? getSliceFrom3DMask(mask3D, header, axis, sliceIndex) : localMaskRef.current
      if (!sliceMask || sliceMask.length !== w * h) {
        sliceMask = new Uint8Array(w * h)
        localMaskRef.current = sliceMask
      } else {
        sliceMask = new Uint8Array(sliceMask)
      }
      const r = Math.max(1, Math.floor(brushSize / 2))
      const value = tool === "brush" ? 255 : 0
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const nx = px + dx
          const ny = py + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sliceMask[ny * w + nx] = value
          }
        }
      }
      onMaskChange(axis, sliceIndex, sliceMask)
      if (!mask3D) drawSlice()
    },
    [brushSize, tool, mask3D, header, axis, sliceIndex, onMaskChange, drawSlice]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isRightOrAux = e.button === 2 || e.button === 1
      if (isRightOrAux) {
        setIsPanning(true)
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        return
      }
      if (e.button !== 0) return
      const p = canvasToSlice(e.clientX, e.clientY)
      if (p) {
        setIsDrawing(true)
        setLastPoint(p)
        applyBrush(p.x, p.y)
      }
    },
    [pan.x, pan.y, canvasToSlice, applyBrush]
  )
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        setPan({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        })
        return
      }
      if (!isDrawing) return
      const p = canvasToSlice(e.clientX, e.clientY)
      if (p) {
        if (lastPoint) {
          const dx = Math.abs(p.x - lastPoint.x)
          const dy = Math.abs(p.y - lastPoint.y)
          const steps = Math.max(dx, dy, 1)
          for (let t = 0; t <= steps; t++) {
            const x = Math.round(lastPoint.x + (p.x - lastPoint.x) * (t / steps))
            const y = Math.round(lastPoint.y + (p.y - lastPoint.y) * (t / steps))
            applyBrush(x, y)
          }
        }
        setLastPoint(p)
      }
    },
    [isPanning, isDrawing, lastPoint, canvasToSlice, applyBrush]
  )
  const handlePointerUp = useCallback(
    (e?: React.PointerEvent) => {
      if (e?.currentTarget && e.pointerId != null) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
      setIsDrawing(false)
      setLastPoint(null)
      setIsPanning(false)
      panStartRef.current = null
    },
    []
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        setScale((s) => Math.max(0.25, Math.min(4, s + (e.deltaY > 0 ? -0.1 : 0.1))))
      } else {
        setSliceIndex((i) => Math.max(sliceRange.min, Math.min(sliceRange.max, i + (e.deltaY > 0 ? 1 : -1))))
      }
    },
    [sliceRange.min, sliceRange.max]
  )

  if (!header || !imageBuffer) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground",
          className
        )}
      >
        <p>.nii 파일을 선택하면 여기에 슬라이스가 표시됩니다</p>
      </div>
    )
  }

  const dims = getSliceDims()
  return (
    <div className={cn("flex flex-1 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-1">
          <Button
            type="button"
            variant={tool === "brush" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTool("brush")}
          >
            <Paintbrush className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={tool === "eraser" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">브러시: {brushSize}px</Label>
          <Slider
            value={[brushSize]}
            onValueChange={([v]) => setBrushSize(v)}
            min={1}
            max={40}
            step={1}
            className="w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <ZoomIn
            className="h-4 w-4 cursor-pointer"
            onClick={() => setScale((s) => Math.min(4, s + 0.25))}
          />
          <ZoomOut
            className="h-4 w-4 cursor-pointer"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
          />
          <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onSaveRequest}>
            저장
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDownloadRequest}>
            다운로드
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs">밝기</Label>
        <Slider
          value={[brightness]}
          onValueChange={([v]) => setBrightness(v)}
          min={-100}
          max={100}
          className="w-32"
        />
        <Label className="text-xs">대비</Label>
        <Slider
          value={[contrast]}
          onValueChange={([v]) => setContrast(v)}
          min={-100}
          max={100}
          className="w-32"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">방향</span>
        {(["axial", "coronal", "sagittal"] as const).map((a) => (
          <Button
            key={a}
            type="button"
            variant={axis === a ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAxis(a)}
          >
            {a === "axial" ? "Axial" : a === "coronal" ? "Coronal" : "Sagittal"}
          </Button>
        ))}
        <Label className="text-xs">
          슬라이스 {sliceIndex} / {sliceRange.max}
        </Label>
        <Slider
          value={[sliceIndex]}
          onValueChange={([v]) => setSliceIndex(v)}
          min={sliceRange.min}
          max={sliceRange.max}
          step={1}
          className="max-w-[200px]"
        />
      </div>
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-lg border bg-black flex-1 flex items-center justify-center min-h-[400px]"
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : "crosshair" }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            position: "relative",
            width: dims.width,
            height: dims.height,
          }}
        >
          <canvas
            ref={canvasRef}
            width={dims.width}
            height={dims.height}
            className="block"
            style={{ imageRendering: "pixelated" }}
          />
          <canvas
            ref={overlayRef}
            width={dims.width}
            height={dims.height}
            className="absolute left-0 top-0 block"
            style={{
              imageRendering: "pixelated",
              cursor: isPanning ? "grabbing" : "crosshair",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => handlePointerUp()}
            onContextMenu={(e) => e.preventDefault()}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
