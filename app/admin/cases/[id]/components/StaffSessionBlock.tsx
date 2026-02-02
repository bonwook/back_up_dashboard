import React from "react"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { getStatusBadge, getStatusBorderColor } from "@/lib/utils/taskStatusHelpers"

interface Subtask {
  id: string
  task_id: string
  subtitle: string
  assigned_to: string
  assigned_to_name?: string
  assigned_to_email?: string
  content: string | null
  comment?: string | null
  status: 'pending' | 'in_progress' | 'on_hold' | 'awaiting_completion' | 'completed'
  file_keys: string[]
  comment_file_keys?: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface StaffSessionBlockProps {
  subtask: Subtask
  isSelected: boolean
  isCompleting: boolean
  onSelect: () => void
  onComplete: (subtaskId: string) => void
}

/**
 * 담당자 세션 블럭 컴포넌트
 * - 담당자별 작업 상태 표시
 * - 완료 시각 표시
 * - 작업끝내기 버튼 (완료대기 상태일 때만 표시)
 */
export function StaffSessionBlock({
  subtask,
  isSelected,
  isCompleting,
  onSelect,
  onComplete,
}: StaffSessionBlockProps) {
  const isCompleted = subtask.status === "completed"
  const isAwaitingCompletion = subtask.status === "awaiting_completion"

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2 rounded-md border-2 transition-all cursor-pointer hover:bg-muted/50 ${
        isSelected
          ? "ring-2 ring-primary ring-offset-1 shadow-sm"
          : ""
      } ${getStatusBorderColor(subtask.status)} ${
        isCompleted
          ? "bg-green-100/50 dark:bg-green-950/30"
          : "bg-background"
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium truncate">
            {subtask.assigned_to_name || subtask.assigned_to_email || "담당자 없음"}
          </span>
          {getStatusBadge(subtask.status)}
        </div>
        
        {/* 완료 시각 표시 */}
        {isCompleted && subtask.completed_at && (
          <div className="flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>
              {format(new Date(subtask.completed_at), "yyyy.MM.dd HH:mm", { locale: ko })}
            </span>
          </div>
        )}
        
        {/* 작업끝내기 버튼 - 완료대기 상태일 때만 표시 */}
        {isAwaitingCompletion && (
          <div className="mt-1 pt-1 border-t border-muted/50" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onComplete(subtask.id)
              }}
              disabled={isCompleting}
              className="w-full h-7 text-xs bg-green-600 hover:bg-green-700 cursor-pointer"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  처리중
                </>
              ) : (
                "작업끝내기"
              )}
            </Button>
          </div>
        )}
      </div>
    </button>
  )
}
