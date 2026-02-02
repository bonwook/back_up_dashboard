"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText } from "lucide-react"

export default function ReportsPage() {
  const [cases, setCases] = useState<any[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState("")
  const [staffComments, setStaffComments] = useState("")
  const [clientComments, setClientComments] = useState("")
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const loadCases = async () => {
    try {
      const res = await fetch("/api/tasks/all", { credentials: "include", cache: "no-store" as any })
      if (!res.ok) return
      const data = await res.json()
      const tasks = Array.isArray(data.tasks) ? data.tasks : []
      const filtered = tasks.filter((t: any) => ["in_progress", "completed", "awaiting_completion"].includes(t.status))
      filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setCases(filtered)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadCases()
  }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("task_id", selectedCaseId)
      formData.append("staff_comments", staffComments)
      formData.append("client_comments", clientComments)
      if (htmlFile) formData.append("html_file", htmlFile)

      const res = await fetch("/api/reports", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to upload report")
      }

      toast({
        title: "성공",
        description: "리포트가 성공적으로 업로드되었습니다.",
      })

      setStaffComments("")
      setClientComments("")
      setHtmlFile(null)
      setSelectedCaseId("")
    } catch (error: unknown) {
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "리포트 업로드에 실패했습니다",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/html") {
      setHtmlFile(file)
    } else {
      toast({
        title: "잘못된 파일",
        description: "HTML 파일을 선택해주세요",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">리포트(REDCap 벤치마킹 예정)</h1>
        <p className="text-muted-foreground">환자 정보 및 분석 리포트를 입력하세요</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleUpload} className="space-y-6">
            {/* 케이스 선택 섹션 */}
            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-md border-l-4 border-blue-500">
                <h2 className="text-lg font-semibold">케이스 선택</h2>
                <p className="text-sm text-muted-foreground mt-1">리포트를 작성할 케이스를 선택하세요</p>
              </div>
              
              <div className="space-y-2 pl-4">
                <Label htmlFor="caseSelect" className="text-base">
                  케이스 <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="케이스를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.map((caseItem: any, index: number) => (
                      <SelectItem key={caseItem.id || `case-${index}`} value={caseItem.id || `case-${index}`}>
                        {caseItem.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">진행 중이거나 완료된 케이스만 표시됩니다</p>
              </div>
            </div>

            {/* 리포트 파일 업로드 섹션 */}
            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-md border-l-4 border-green-500">
                <h2 className="text-lg font-semibold">리포트 파일</h2>
                <p className="text-sm text-muted-foreground mt-1">분석 결과 HTML 파일을 업로드하세요</p>
              </div>
              
              <div className="space-y-2 pl-4">
                <Label htmlFor="htmlFile" className="text-base">
                  HTML 리포트 파일
                </Label>
                <Input
                  id="htmlFile"
                  type="file"
                  accept=".html"
                  onChange={handleFileChange}
                  className="cursor-pointer w-full"
                />
                {htmlFile && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {htmlFile.name} ({(htmlFile.size / 1024).toFixed(2)} KB)
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">HTML 형식의 파일만 업로드 가능합니다</p>
              </div>
            </div>

            {/* 코멘트 섹션 */}
            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-md border-l-4 border-purple-500">
                <h2 className="text-lg font-semibold">코멘트 및 메모</h2>
                <p className="text-sm text-muted-foreground mt-1">분석 담당자 및 고객용 코멘트를 입력하세요</p>
              </div>
              
              <div className="space-y-6 pl-4">
                <div className="space-y-2">
                  <Label htmlFor="staffComments" className="text-base">
                    분석 담당자 코멘트
                  </Label>
                  <Textarea
                    id="staffComments"
                    value={staffComments}
                    onChange={(e) => setStaffComments(e.target.value)}
                    placeholder="분석 과정에서의 특이사항, 기술적 메모 등을 입력하세요..."
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-sm text-muted-foreground">내부 검토용 메모입니다</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientComments" className="text-base">
                    고객용 코멘트
                  </Label>
                  <Textarea
                    id="clientComments"
                    value={clientComments}
                    onChange={(e) => setClientComments(e.target.value)}
                    placeholder="고객에게 전달할 분석 결과 해석, 권장사항 등을 입력하세요..."
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-sm text-muted-foreground">고객에게 표시되는 코멘트입니다</p>
                </div>
              </div>
            </div>

            {/* 제출 버튼 */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStaffComments("")
                  setClientComments("")
                  setHtmlFile(null)
                  setSelectedCaseId("")
                }}
              >
                초기화
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !selectedCaseId || (!htmlFile && !staffComments && !clientComments)}
                className="min-w-[120px]"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isLoading ? "업로드 중..." : "리포트 제출"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
