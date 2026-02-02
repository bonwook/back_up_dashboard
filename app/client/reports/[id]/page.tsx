import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { redirect } from "next/navigation"
import { SafeHtml } from "@/components/safe-html"
import { getCurrentUser } from "@/lib/auth"
import { queryOne } from "@/lib/db/mysql"

export default async function ClientReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()
  if (!me) redirect("/auth/login")

  // 완료된 작업(리포트) 조회: assigned_to/assigned_by 당사자만 접근
  const task = await queryOne<any>(
    `
      SELECT
        ta.id,
        ta.title,
        COALESCE(r.report_html, ta.report_html) as report_html
      FROM task_assignments ta
      LEFT JOIN reports r ON r.case_id = ta.id
      WHERE ta.id = ?
        AND ta.status = 'completed'
        AND (ta.assigned_to = ? OR ta.assigned_by = ?)
      LIMIT 1
    `,
    [id, me.id, me.id],
  )

  if (!task) {
    redirect("/client/reports")
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/client/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analysis Report</CardTitle>
          <CardDescription>
            Task: {task.title}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Content</CardTitle>
        </CardHeader>
        <CardContent>
          <SafeHtml
            html={task.report_html || ""}
            className="prose prose-sm max-w-none dark:prose-invert"
          />
        </CardContent>
      </Card>
    </div>
  )
}
