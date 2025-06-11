import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Check if the route requires authentication
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/my-sops') || 
                          (request.nextUrl.pathname.startsWith('/api/') && 
                          !request.nextUrl.pathname.startsWith('/api/get-upload-url') &&
                          !request.nextUrl.pathname.startsWith('/api/job-status') &&
                          !request.nextUrl.pathname.startsWith('/api/direct-sop') &&
                          !request.nextUrl.pathname.startsWith('/api/aef/start-vnc-environment') &&
                          !request.nextUrl.pathname.startsWith('/api/aef/stop-vnc-environment') &&
                          !request.nextUrl.pathname.startsWith('/api/vnc/')) ||
                          (request.nextUrl.pathname.startsWith('/sop/') &&
                          !request.nextUrl.pathname.startsWith('/direct-sop/'))

  // If no session and trying to access protected route
  if (!session && isProtectedRoute) {
    // For API routes, return 401 Unauthorized
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // For page routes, redirect to home
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/my-sops',
    '/api/:path*',
    '/sop/:path*',
    '/direct-sop/:path*'
  ],
} 