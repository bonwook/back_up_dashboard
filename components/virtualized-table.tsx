"use client"

import { useRef } from "react"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { ExcelDataWithIndex } from "@/lib/types"

interface VirtualizedTableProps {
  headers: string[]
  data: ExcelDataWithIndex[]
  highlightedCells: Set<string>
  isHighlightMode: boolean
  onCellClick: (originalIndex: number, header: string) => void
  isDraggingScroll: boolean
  dragDistanceRef: { current: number }
}

export function VirtualizedTable({
  headers,
  data,
  highlightedCells,
  isHighlightMode,
  onCellClick,
  isDraggingScroll,
  dragDistanceRef,
}: VirtualizedTableProps) {
  // 가상 스크롤링을 위한 부모 요소 참조
  const parentRef = useRef<HTMLDivElement>(null)

  // 가상 스크롤러 생성
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // 각 행의 예상 높이 (px)
    overscan: 10, // 화면 밖에 미리 렌더링할 행 수 (성능 최적화)
  })

  // 가상 항목들
  const virtualItems = rowVirtualizer.getVirtualItems()

  // 전체 테이블 높이 계산 (스크롤바 높이)
  const totalHeight = rowVirtualizer.getTotalSize()

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ 
        height: "600px",
        maxHeight: "600px",
        overflowX: "hidden", // 가로 스크롤은 외부 컨테이너에서 처리
      }}
    >
      <div
        style={{
          height: `${totalHeight}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {/* 가상 행들 렌더링 */}
        {virtualItems.map((virtualRow: VirtualItem) => {
          const row = data[virtualRow.index]
          const originalIndex = row.__originalIndex

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <Table>
                <TableBody>
                  <TableRow>
                    {headers.map((header, colIndex) => {
                      const cellValue = String(row[header] || "")
                      const cellKey = `${originalIndex}-${header}`
                      const isHighlighted = highlightedCells.has(cellKey)

                      const cellClassName = `min-w-[120px] max-w-[300px] p-2 text-center transition-colors select-none user-select-none ${
                        isHighlighted ? "bg-yellow-200 dark:bg-yellow-900/30" : ""
                      } ${isHighlightMode ? "cursor-pointer hover:bg-muted/50" : ""}`

                      return (
                        <TableCell
                          key={colIndex}
                          className={cellClassName}
                          style={{
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            MozUserSelect: "none",
                          }}
                          title={cellValue}
                          onMouseDown={(e) => {
                            if (isDraggingScroll) {
                              e.preventDefault()
                              e.stopPropagation()
                            }
                          }}
                          onClick={(e) => {
                            if (
                              dragDistanceRef.current <= 3 &&
                              !isDraggingScroll &&
                              isHighlightMode
                            ) {
                              e.preventDefault()
                              e.stopPropagation()
                              onCellClick(originalIndex, header)
                            }
                          }}
                        >
                          <div className="wrap-break-word overflow-hidden">
                            {row[header] !== null && row[header] !== undefined ? cellValue : ""}
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )
        })}
      </div>
    </div>
  )
}

