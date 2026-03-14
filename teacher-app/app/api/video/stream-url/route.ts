import { createClient } from "@/lib/supabase/server";
import { getProdPresignedUrl } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * GET /api/video/stream-url?lessonId=xxx
 *
 * Security flow:
 * 1. Verify Supabase JWT (middleware handles this, but double-check here)
 * 2. Check if lesson is_preview OR student has active enrollment for the course
 * 3. Generate signed R2 URL for master.m3u8 (2-min TTL)
 * 4. Log video session for audit
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");

    if (!lessonId) {
        return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    // Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch lesson + course chain
    const { data: lesson } = await supabase
        .from("lessons")
        .select(`
      id, is_preview,
      section:sections(
        course_id
      ),
      videos(id, master_playlist_key, status, r2_folder)
    `)
        .eq("id", lessonId)
        .single();

    if (!lesson) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const video = lesson.videos?.[0];
    if (!video || video.status !== "ready") {
        return NextResponse.json({ error: "Video not ready" }, { status: 422 });
    }

    const courseId = (lesson.section as { course_id: string })?.course_id;

    // Access check: preview lesson OR enrolled student
    if (!lesson.is_preview) {
        const { data: enrollment } = await supabase
            .from("enrollments")
            .select("id")
            .eq("student_id", user.id)
            .eq("course_id", courseId)
            .eq("status", "active")
            .single();

        if (!enrollment) {
            return NextResponse.json(
                { error: "You must be enrolled to watch this lesson" },
                { status: 403 }
            );
        }
    }

    // Generate signed URL for master.m3u8 — 2-minute TTL
    const masterKey = video.master_playlist_key!;
    const streamUrl = await getProdPresignedUrl(masterKey, 120); // 120s = 2 min
    const expiresAt = new Date(Date.now() + 120 * 1000).toISOString();

    // Get client IP for audit
    const headersList = await headers();
    const ip =
        headersList.get("x-forwarded-for")?.split(",")[0] ||
        headersList.get("x-real-ip") ||
        null;

    // Log video session (fire and forget — don't block the response)
    adminClient
        .from("video_sessions")
        .insert({
            user_id: user.id,
            lesson_id: lessonId,
            ip_address: ip,
        })
        .then(() => { })
        .catch(console.error);

    return NextResponse.json({
        data: { streamUrl, expiresAt },
    });
}
