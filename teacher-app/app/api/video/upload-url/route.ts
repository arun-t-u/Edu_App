import { createClient } from "@/lib/supabase/server";
import { getUploadPresignedUrl } from "@/lib/r2/client";
import { enqueueVideoJob } from "@/lib/queue/producer";
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * POST /api/video/upload-url
 *
 * Returns a presigned PUT URL for direct browser upload to R2 TEMP bucket.
 * Also creates the video record and enqueues a BullMQ processing job.
 *
 * Body: { lessonId: string, courseId: string, filename: string }
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only teachers and admins can upload videos
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!["teacher", "admin"].includes(profile?.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lessonId, courseId, filename } = await request.json();
    if (!lessonId || !courseId) {
        return NextResponse.json({ error: "lessonId and courseId are required" }, { status: 400 });
    }

    // Verify teacher owns the lesson's course
    const { data: course } = await supabase
        .from("courses")
        .select("teacher_id")
        .eq("id", courseId)
        .single();

    if (course?.teacher_id !== user.id && profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const jobId = randomUUID();
    const tempKey = `uploads/${jobId}.mp4`;
    const r2Folder = `courses/${courseId}/${lessonId}/`;

    // 1. Create video record (pending status)
    const { data: videoRecord, error: videoError } = await adminClient
        .from("videos")
        .upsert(
            {
                lesson_id: lessonId,
                r2_folder: r2Folder,
                status: "pending",
            },
            { onConflict: "lesson_id" }
        )
        .select()
        .single();

    if (videoError) {
        return NextResponse.json({ error: videoError.message }, { status: 500 });
    }

    // 2. Create job tracking record
    await adminClient.from("video_jobs").insert({
        id: jobId,
        video_id: videoRecord.id,
        lesson_id: lessonId,
        course_id: courseId,
        temp_r2_key: tempKey,
        status: "queued",
    });

    // 3. Enqueue BullMQ job
    await enqueueVideoJob({
        jobId,
        videoId: videoRecord.id,
        lessonId,
        courseId,
        tempKey,
    });

    // 4. Generate presigned PUT URL (30 min TTL for large uploads)
    const uploadUrl = await getUploadPresignedUrl(tempKey);

    return NextResponse.json({
        data: { uploadUrl, jobId, tempKey },
    });
}
