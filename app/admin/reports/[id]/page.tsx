import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { redirect } from "next/navigation"
import { SafeHtml } from "@/components/safe-html"
import { getCurrentUser } from "@/lib/auth"
import { queryOne } from "@/lib/db/mysql"

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()
  if (!me) redirect("/auth/login")
  if (me.role !== "admin" && me.role !== "staff") redirect("/admin")

  const task = await queryOne<any>(
    `
      SELECT
        ta.id,
        ta.title,
        ta.description,
        ta.completed_at,
        COALESCE(r.report_html, ta.report_html) as report_html,
        r.staff_comments,
        r.client_comments
      FROM task_assignments ta
      LEFT JOIN reports r ON r.case_id = ta.id
      WHERE ta.id = ?
        AND ta.status = 'completed'
      LIMIT 1
    `,
    [id],
  )

  if (!task) {
    redirect("/admin/reports")
  }

  const htmlContent = task.report_html || ""

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
          <CardDescription>
            Task: {task.title}
          </CardDescription>
        </CardHeader>
      </Card>

      {(task.staff_comments || task.client_comments) && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {task.staff_comments && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Staff Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.staff_comments}</p>
              </CardContent>
            </Card>
          )}

          {task.client_comments && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Client Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.client_comments}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {htmlContent && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Report</CardTitle>
          </CardHeader>
          <CardContent>
            <SafeHtml
              html={htmlContent}
              className="prose prose-sm max-w-none dark:prose-invert"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
