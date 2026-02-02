/**
 * 댓글 작성자에 따른 색상 지정 로직
 */

interface Subtask {
  id: string
  assigned_to: string
  [key: string]: any
}

interface CommentColorScheme {
  bg: string
  border: string
}

interface CommentColorOptions {
  commentUserId: string
  requesterId: string | null
  assigneeId: string | null
  subtasks: Subtask[]
}

/**
 * 댓글 작성자에 따른 색상 스킴 반환
 */
export function getCommentColorScheme(options: CommentColorOptions): CommentColorScheme {
  const { commentUserId, requesterId, assigneeId, subtasks } = options

  // 공동 작업일 때 각 담당자별 색상 지정
  if (subtasks.length > 0) {
    const subtaskUsers = Array.from(new Set(subtasks.map(st => st.assigned_to)))
    const userIndex = subtaskUsers.indexOf(commentUserId)
    
    // 색상 팔레트 (담당자별로 다른 색상)
    const colorPalette: CommentColorScheme[] = [
      { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
      { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800" },
      { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800" },
      { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800" },
      { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800" },
      { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800" },
    ]
    
    if (userIndex >= 0) {
      return colorPalette[userIndex % colorPalette.length]
    }
    
    // 요청자인 경우
    if (requesterId && commentUserId === requesterId) {
      return { bg: "bg-primary/5", border: "border-primary/20" }
    }
  } else {
    // 개별 작업일 때
    // 요청자 또는 담당자인 경우
    if ((requesterId && commentUserId === requesterId) || (assigneeId && commentUserId === assigneeId)) {
      return { bg: "bg-primary/5", border: "border-primary/20" }
    }
  }
  
  // 기본 색상
  return { bg: "bg-muted/30", border: "border-border" }
}
