"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReportFormSection } from "./components/ReportFormSection"
import { ImportPreviewSection } from "./components/ImportPreviewSection"
import { ExportSection } from "./components/ExportSection"
import { reportFormSections, getFieldLabelById } from "./reportFormFields"
import type { FormValues } from "./types"
import type { ImportedData } from "./types"
import { FileText, Upload, FileDown } from "lucide-react"

export default function ReportsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [formValues, setFormValues] = useState<FormValues>({})
  const [importedData, setImportedData] = useState<ImportedData | null>(null)

  const onSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onValueChange = useCallback((id: string, value: string | number | undefined) => {
    setFormValues((prev) => ({ ...prev, [id]: value }))
  }, [])

  const onSelectAllInSection = useCallback((sectionId: string, checked: boolean) => {
    const section = reportFormSections.find((s) => s.id === sectionId)
    if (!section) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const f of section.fields) {
        if (checked) next.add(f.id)
        else next.delete(f.id)
      }
      return next
    })
  }, [])

  const selectedIdsOrdered = reportFormSections.flatMap((s) =>
    s.fields.filter((f) => selectedIds.has(f.id)).map((f) => f.id)
  )
  const selectedLabels = selectedIdsOrdered.map(getFieldLabelById)

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          의료 리포트
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          폼 작성 후 선택 항목만 CSV/Excel로 내보내거나, 파일을 불러와 합쳐서 내보낼 수 있습니다.
        </p>
      </div>

      <Tabs defaultValue="form" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3 h-9">
          <TabsTrigger value="form" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            리포트 폼
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            가져오기
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            내보내기
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-3">
          <ReportFormSection
            selectedIds={selectedIds}
            onSelectChange={onSelectChange}
            formValues={formValues}
            onValueChange={onValueChange}
            onSelectAllInSection={onSelectAllInSection}
          />
        </TabsContent>

        <TabsContent value="import" className="mt-3">
          <ImportPreviewSection
            selectedLabels={selectedLabels}
            importedData={importedData}
            onImportedDataChange={setImportedData}
          />
        </TabsContent>

        <TabsContent value="export" className="mt-3">
          <ExportSection
            selectedIds={selectedIdsOrdered}
            selectedLabels={selectedLabels}
            formValues={formValues}
            importedData={importedData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
