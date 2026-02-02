import { type NextRequest, NextResponse } from "next/server"
import { createUser } from "@/lib/db/auth"
import { cookies } from "next/headers"
import { authRateLimiter } from "@/lib/middleware/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting 체크
    const rateLimit = await authRateLimiter(request)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
          },
        }
      )
    }

    console.log("Signup API called")

    const body = await request.json()
    console.log("Request body:", { email: body.email, hasPassword: !!body.password })

    const { email, password, fullName, organization } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // 회원가입은 client만 허용 (서버에서 강제)
    const validRole: "client" = "client"

    const { getPool } = await import("@/lib/db/mysql")
    try {
      const pool = getPool()
      await pool.query("SELECT 1")
      console.log("Database connection successful")
    } catch (dbError: unknown) {
      const errorMessage = dbError instanceof Error ? dbError.message : "Database connection failed"
      console.error("Database connection failed:", errorMessage)
      return NextResponse.json(
        { error: "Database connection failed. Please check your environment variables." },
        { status: 503 },
      )
    }

    // Create user
    console.log("Creating user...")
    const user = await createUser(email, password, fullName, organization, validRole)
    console.log("User created:", user.id)

    // Generate JWT token
    const { generateToken } = await import("@/lib/db/auth")
    const token = generateToken(user)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    console.log("Signup successful")
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        organization: user.organization,
      },
    }, {
      headers: {
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error("Signup error:", error)

    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 })
    }

    const errorMessage = error instanceof Error ? error.message : "Failed to sign up"
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 },
    )
  }
}
