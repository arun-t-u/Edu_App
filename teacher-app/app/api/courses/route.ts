import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── GET /api/courses — list published courses ──────────────────
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 50);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
        .from("courses")
        .select(
            `
      *,
      teacher:user_profiles!courses_teacher_id_fkey(id, full_name, avatar_url),
      sections(id, lessons(id))
    `,
            { count: "exact" }
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute total_lessons count
    const courses = (data || []).map((c) => ({
        ...c,
        total_lessons: c.sections?.reduce(
            (acc: number, s: { lessons: unknown[] }) => acc + (s.lessons?.length || 0),
            0
        ),
        sections: undefined, // don't leak nested data
    }));

    return NextResponse.json({
        data: courses,
        meta: { total: count, page, limit },
    });
}

// ── POST /api/courses — create a new course (teacher/admin) ────
export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check teacher or admin role
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!["teacher", "admin"].includes(profile?.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, price, thumbnail } = body;

    if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("courses")
        .insert({
            teacher_id: user.id,
            title: title.trim(),
            description: description?.trim() || null,
            price: parseFloat(price) || 0,
            thumbnail: thumbnail || null,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
}
