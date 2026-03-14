import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── POST /api/lessons — create a lesson ──────────────────────
export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sectionId, title, description, is_preview, position } = await request.json();

    if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Verify teacher owns the parent section's course
    const { data: section } = await supabase
        .from("sections")
        .select("course_id")
        .eq("id", sectionId)
        .single();

    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    const { data: course } = await supabase
        .from("courses")
        .select("teacher_id")
        .eq("id", section.course_id)
        .single();

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (course?.teacher_id !== user.id && profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Auto-position
    let pos = position;
    if (pos === undefined) {
        const { count } = await supabase
            .from("lessons")
            .select("*", { count: "exact", head: true })
            .eq("section_id", sectionId);
        pos = count || 0;
    }

    const { data, error } = await supabase
        .from("lessons")
        .insert({
            section_id: sectionId,
            title: title.trim(),
            description: description?.trim() || null,
            is_preview: is_preview ?? false,
            position: pos,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
}
