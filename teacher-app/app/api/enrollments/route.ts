import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── GET /api/enrollments/my — student's own enrollments ────────
export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
        .from("enrollments")
        .select(`
      *,
      course:courses(
        id, title, description, thumbnail, price,
        sections(id, lessons(id, video_progress(completed)))
      )
    `)
        .eq("student_id", user.id)
        .eq("status", "active");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Compute progress % for each course
    const withProgress = (data || []).map((e) => {
        const sections = e.course?.sections || [];
        let total = 0;
        let completed = 0;
        sections.forEach((s: { lessons: { video_progress: { completed: boolean }[] }[] }) => {
            s.lessons?.forEach((l) => {
                total++;
                if (l.video_progress?.[0]?.completed) completed++;
            });
        });
        return {
            ...e,
            progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    });

    return NextResponse.json({ data: withProgress });
}

// ── POST /api/enrollments — admin approves enrollment ──────────
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only admins can manually approve enrollments
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentId, courseId } = await request.json();
    if (!studentId || !courseId) {
        return NextResponse.json({ error: "studentId and courseId required" }, { status: 400 });
    }

    const { data, error } = await adminClient
        .from("enrollments")
        .upsert(
            { student_id: studentId, course_id: courseId, status: "active" },
            { onConflict: "student_id,course_id" }
        )
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
}

// ── DELETE /api/enrollments — admin revokes enrollment ─────────
export async function DELETE(request: NextRequest) {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentId, courseId } = await request.json();

    const { error } = await adminClient
        .from("enrollments")
        .update({ status: "revoked" })
        .eq("student_id", studentId)
        .eq("course_id", courseId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: null });
}
