export type UserRole = "admin" | "client" | "staff"

export type CaseStatus = "registered" | "processing" | "completed" | "failed"

export type BillingStatus = "pending" | "paid" | "cancelled"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  organization: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Case {
  id: string
  case_number: string
  patient_name: string
  study_date: string
  data_type: string
  client_id: string
  client_organization: string | null
  dicom_source: string | null
  s3_path: string | null
  status: CaseStatus
  assigned_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  case_id: string
  report_html: string
  uploaded_by: string
  created_at: string
}

export interface Billing {
  id: string
  case_id: string
  amount: number | null
  currency: string
  status: BillingStatus
  invoice_date: string | null
  paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  case_id: string | null
  user_id: string | null
  action: string
  details: Record<string, any> | null
  created_at: string
}

// Excel 관련 타입
export interface ExcelData {
  [key: string]: any
}

export interface ExcelDataWithIndex extends ExcelData {
  __originalIndex: number
}

export interface ParseResponse {
  headers: string[]
  data: ExcelData[]
  error?: string
}
