"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SafeHtml } from "@/components/safe-html"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Send, X } from "lucide-react"

export type CommentItem = {
  id: string
  content: string
  created_at: string
  user_id: string
  full_name: string | null
}

interface TaskCommentSectionProps {
  taskId: string | null
  /** 현재 로그인 사용자 (id, role). 삭제 권한 판단에 사용 */
  me: { id: string; role?: string } | null
  /** 댓글 작성 가능 여부. false면 입력란 대신 안내 문구 표시 */
  allowWrite?: boolean
  /** 댓글 삭제 가능 여부. false면 삭제 버튼 숨김 (task 카드 안에서는 수정 불가) */
  allowDelete?: boolean
}

export function TaskCommentSection({ taskId, me, allowWrite = true, allowDelete = true }: TaskCommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [newComment, setNewComment] = useState("")
  const [isPostingComment, setIsPostingComment] = useState(false)
  const { toast } = useToast()

  const loadComments = useCallback(async () => {
    if (!taskId) return
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    } catch {
      // ignore
    }
  }, [taskId])

  useEffect(() => {
    if (!taskId) return
    loadComments()
  }, [taskId, loadComments])

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!taskId) return
      const ok = confirm("이 댓글을 삭제할까요?")
      if (!ok) return
      try {
        const res = await fetch(
          `/api/tasks/${taskId}/comments?commentId=${encodeURIComponent(commentId)}`,
          { method: "DELETE", credentials: "include" }
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "댓글 삭제 실패")
        }
        await loadComments()
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "댓글을 삭제하는 중 오류가 발생했습니다."
        toast({
          title: "댓글 삭제 실패",
          description: message,
          variant: "destructive",
        })
      }
    },
    [taskId, loadComments, toast]
  )

  const handlePostComment = useCallback(async () => {
    if (!taskId) return
    const content = newComment.trim()
    if (!content) return
    setIsPostingComment(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "댓글 저장 실패")
      }
      setNewComment("")
      await loadComments()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "댓글을 저장하는 중 오류가 발생했습니다."
      toast({
        title: "댓글 작성 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsPostingComment(false)
    }
  }, [taskId, newComment, loadComments, toast])

  if (!taskId) return null

  const userRole = me?.role ?? null
  const bubbleColors = [
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  ]

  return (
    <div
      className="mb-6 rounded-xl border bg-muted/20 overflow-hidden flex flex-col mt-8"
      style={{ minHeight: "280px" }}
    >
      <div className="flex-1 max-h-[320px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">아직 댓글이 없습니다.</p>
        ) : (
          comments.map((c) => {
            const canDelete =
              allowDelete && ((me?.id && c.user_id === me.id) || userRole === "admin")
            const isMe = me?.id && c.user_id === me.id
            const userOrder = Array.from(new Set(comments.map((x) => x.user_id)))
            const userIndex = userOrder.indexOf(c.user_id)
            const bubbleClass = isMe
              ? "bg-primary text-primary-foreground"
              : bubbleColors[userIndex % bubbleColors.length]

            return (
              <div
                key={c.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`flex items-center gap-2 px-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}
                  >
                    <span className="text-[11px] font-medium text-foreground/90">
                      {c.full_name || "사용자"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-md ${bubbleClass}`}
                  >
                    <div className="flex items-end gap-2">
                      <div className="text-sm wrap-break-word word-break break-all text-inherit [&_p]:my-0 [&_pre]:whitespace-pre-wrap [&_a]:underline">
                        <SafeHtml
                          html={c.content || ""}
                          className="prose prose-sm max-w-none prose-p:my-0 [&_table]:w-max [&_pre]:whitespace-pre-wrap [&_code]:break-all prose-inherit"
                        />
                      </div>
                      {canDelete && (
                        <div className="shrink-0 self-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-current opacity-80 hover:opacity-100 hover:bg-black/10"
                            onClick={() => handleDeleteComment(c.id)}
                            title="댓글 삭제"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {allowWrite ? (
        <div className="border-t bg-background p-2 flex gap-2 items-end">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="min-h-[44px] max-h-[120px] resize-none py-3 px-4 rounded-2xl border-0 focus-visible:ring-2 bg-muted/50"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (newComment.trim()) handlePostComment()
              }
            }}
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shrink-0"
            onClick={handlePostComment}
            disabled={isPostingComment || newComment.trim().length === 0}
            title="전송"
          >
            {isPostingComment ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      ) : (
        <div className="border-t bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          댓글은 작업 진행 페이지에서만 작성할 수 있습니다
        </div>
      )}
    </div>
  )
}
