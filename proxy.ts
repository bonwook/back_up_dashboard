import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/db/auth"

export async function proxy(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value

  const path = request.nextUrl.pathname

  // Public paths that don't require authentication
  const publicPaths = ["/", "/auth/login", "/auth/signup", "/api/auth/signup", "/auth/signup-success",
    "/api/auth/signin" ]
  if (publicPaths.includes(path)) {
    return NextResponse.next()
  }

  // Check authentication
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  const user = verifyToken(token)
  if (!user) {
    // Invalid token, redirect to login
    const response = NextResponse.redirect(new URL("/auth/login", request.url))
    response.cookies.delete("auth-token")
    return response
  }

  // Role-based access control
  if (path.startsWith("/admin")) {
    if (user.role !== "admin" && user.role !== "staff") {
      return NextResponse.redirect(new URL("/client", request.url))
    }
  }

  if (path.startsWith("/client")) {
    if (user.role !== "client" && user.role !== "admin") {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
