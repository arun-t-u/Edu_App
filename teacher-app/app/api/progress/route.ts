import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── POST /api/progress — upsert video progress ────────────────
export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { lessonId, watchedSeconds, completed } = await request.json();
    if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

    const { data, error } = await supabase
        .from("video_progress")
        .upsert(
            {
                student_id: user.id,
                lesson_id: lessonId,
                watched_seconds: watchedSeconds || 0,
                completed: completed ?? false,
                last_watched_at: new Date().toISOString(),
            },
            { onConflict: "student_id,lesson_id" }
        )
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}

// ── GET /api/progress?lessonId=xxx ────────────────────────────
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (lessonId) {
        const { data } = await supabase
            .from("video_progress")
            .select("*")
            .eq("student_id", user.id)
            .eq("lesson_id", lessonId)
            .single();
        return NextResponse.json({ data: data || null });
    }

    // Return all progress for the student
    const { data } = await supabase
        .from("video_progress")
        .select("*")
        .eq("student_id", user.id);

    return NextResponse.json({ data: data || [] });
}
