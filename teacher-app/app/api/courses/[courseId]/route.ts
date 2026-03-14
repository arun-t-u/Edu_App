import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── GET /api/courses/[courseId] ────────────────────────────────
export async function GET(
    _req: NextRequest,
    { params }: { params: { courseId: string } }
) {
    const supabase = await createClient();
    const { courseId } = params;

    const { data, error } = await supabase
        .from("courses")
        .select(
            `
      *,
      teacher:user_profiles!courses_teacher_id_fkey(id, full_name, avatar_url),
      sections(
        id, title, position,
        lessons(id, title, description, position, is_preview, duration_seconds, thumbnail_url,
          videos(id, status, duration_seconds)
        )
      )
    `
        )
        .eq("id", courseId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Sort sections and lessons by position
    if (data.sections) {
        data.sections.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
        data.sections.forEach((s: { lessons: { position: number }[] }) => {
            s.lessons?.sort((a, b) => a.position - b.position);
        });
    }

    return NextResponse.json({ data });
}

// ── PUT /api/courses/[courseId] — update course ─────────────────
export async function PUT(
    request: NextRequest,
    { params }: { params: { courseId: string } }
) {
    const supabase = await createClient();
    const { courseId } = params;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch course to verify ownership
    const { data: course } = await supabase
        .from("courses")
        .select("teacher_id")
        .eq("id", courseId)
        .single();

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
        course?.teacher_id !== user.id &&
        profile?.role !== "admin"
    ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, price, thumbnail, is_published } = body;

    const { data, error } = await supabase
        .from("courses")
        .update({
            ...(title && { title: title.trim() }),
            ...(description !== undefined && { description }),
            ...(price !== undefined && { price: parseFloat(price) }),
            ...(thumbnail !== undefined && { thumbnail }),
            ...(is_published !== undefined && { is_published }),
        })
        .eq("id", courseId)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}

// ── DELETE /api/courses/[courseId] ────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: { courseId: string } }
) {
    const supabase = await createClient();
    const { courseId } = params;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: course } = await supabase
        .from("courses")
        .select("teacher_id")
        .eq("id", courseId)
        .single();

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (course?.teacher_id !== user.id && profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: null }, { status: 204 });
}
