import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
    "/",
    "/courses",
    "/login",
    "/register",
    "/api/courses",     // public course listing
];

// Routes only for admins
const ADMIN_ROUTES = ["/admin"];

// Routes only for teachers or admins
const TEACHER_ROUTES = ["/api/video/upload-url", "/api/video/process"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next({ request });

    // ── Security Headers ───────────────────────────────────────────
    response.headers.set(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed by video.js
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "media-src 'self' blob: https:",                   // blob: for hls.js, https: for CDN
            "img-src 'self' data: https:",
            "connect-src 'self' https://*.r2.cloudflarestorage.com https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'none'",
        ].join("; ")
    );
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()"
    );

    // ── Skip auth for fully public routes ─────────────────────────
    const isPublicRoute = PUBLIC_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(route + "?")
    );

    // Public GET on /api/courses/* is allowed
    if (
        request.method === "GET" &&
        pathname.startsWith("/api/courses") &&
        !pathname.includes("/api/courses/admin")
    ) {
        return response;
    }

    // ── Create Supabase server client (session from cookies) ────────
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, {
                            ...options,
                            httpOnly: true,
                            secure: process.env.NODE_ENV === "production",
                            sameSite: "strict",
                        })
                    );
                },
            },
        }
    );

    // Refresh session (keeps cookies fresh)
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // ── Redirect unauthenticated users ─────────────────────────────
    if (!user && !isPublicRoute) {
        const redirectUrl = new URL("/login", request.url);
        redirectUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(redirectUrl);
    }

    // ── Admin route guard ──────────────────────────────────────────
    if (user && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profile?.role !== "admin") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public folder
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
