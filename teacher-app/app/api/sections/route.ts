import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── POST /api/sections — create a section ─────────────────────
export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { courseId, title, position } = await request.json();

    // Verify teacher owns the course
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

    if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Auto-calculate position if not supplied
    let pos = position;
    if (pos === undefined) {
        const { count } = await supabase
            .from("sections")
            .select("*", { count: "exact", head: true })
            .eq("course_id", courseId);
        pos = count || 0;
    }

    const { data, error } = await supabase
        .from("sections")
        .insert({ course_id: courseId, title: title.trim(), position: pos })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
}
