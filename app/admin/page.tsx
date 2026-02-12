"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, FileText, Clock, TrendingUp, AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminCalendar } from "@/components/admin-calendar"

interface DashboardStats {
  totalTasks: number
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  onHoldTasks: number
  awaitingCompletionTasks: number
  totalClients: number
  totalReports: number
  totalStaff: number
  totalAdmins: number
  completionRate: number
}

export default function AdminOverviewPage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" })
      if (res.ok) {
        const userData = await res.json()
        setUser(userData)
      }
    } catch (error) {
      console.error("사용자 로드 오류:", error)
    }
  }

  const loadStats = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    }
    try {
      const res = await fetch("/api/analytics/dashboard", { 
        credentials: "include",
        cache: "no-store" 
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error("통계 로드 오류:", error)
    } finally {
      setIsLoading(false)
      if (isManualRefresh) {
        setIsRefreshing(false)
      }
    }
  }

  useEffect(() => {
    loadUser()
    loadStats()
    
    // 30초마다 자동 새로고침
    const interval = setInterval(() => {
      loadStats()
    }, 30000)
    
    // 페이지 포커스 시 자동 새로고침
    const handleFocus = () => {
      loadStats()
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="relative mx-auto max-w-7xl p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">시스템 개요</h1>
          <p className="text-muted-foreground">
            
            {lastUpdated && (
              <span className="ml-0 text-xs">
                (최근 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === "admin" || user?.role === "staff") && (
            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 px-3 py-1">
              {user?.role === "admin" ? "관리자" : "Staff"}
            </Badge>
          )}
        </div>
      </div>

      {stats && (
        <>
          {/* 1줄: 대기 / 작업 / 보류 / 완료대기 */}
          <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">대기</CardTitle>
                <Clock className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/cases?tab=worklist&status=pending"
                  className="inline-block text-3xl font-bold text-blue-500 hover:underline underline-offset-4"
                >
                  {stats.pendingTasks || 0}
                </Link>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">작업</CardTitle>
                <Activity className="h-5 w-5 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/cases?tab=worklist&status=in_progress"
                  className="inline-block text-3xl font-bold text-yellow-500 hover:underline underline-offset-4"
                >
                  {stats.inProgressTasks || 0}
                </Link>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">보류</CardTitle>
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/cases?tab=worklist&status=on_hold"
                  className="inline-block text-3xl font-bold text-orange-500 hover:underline underline-offset-4"
                >
                  {stats.onHoldTasks || 0}
                </Link>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">완료대기</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <Link
                  href="/admin/cases?tab=worklist&status=awaiting_completion"
                  className="inline-block text-3xl font-bold text-purple-500 hover:underline underline-offset-4"
                >
                  {stats.awaitingCompletionTasks || 0}
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AdminCalendar />
    </div>
  )
}
