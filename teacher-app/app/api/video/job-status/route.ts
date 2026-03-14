import { getJobStatus } from "@/lib/queue/producer";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/video/job-status?jobId=xxx
 *
 * Polls the BullMQ job state AND the video_jobs DB record.
 * Used by the upload UI to show processing progress.
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get job state from BullMQ (Redis)
    const jobState = await getJobStatus(jobId);

    // Also check database record for videos.status
    const { data: job } = await supabase
        .from("video_jobs")
        .select("status, error_message, video_id")
        .eq("id", jobId)
        .single();

    return NextResponse.json({
        data: {
            jobId,
            queueState: jobState?.state || "unknown",
            progress: jobState?.progress || 0,
            dbStatus: job?.status || "unknown",
            errorMessage: job?.error_message || jobState?.failedReason,
            videoId: job?.video_id,
        },
    });
}
