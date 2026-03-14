import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import supabase from "./db";
import { convertToHLS } from "./convert";
import { generateThumbnail } from "./thumbnail";
import { downloadFromTemp, uploadDirToProd, uploadFileToProd, deleteTempObject } from "./r2";

export interface VideoJobData {
    jobId: string;
    videoId: string;
    lessonId: string;
    courseId: string;
    tempKey: string; // R2 temp bucket key for the MP4
}

/**
 * Main video processing job handler.
 * Called by BullMQ worker for each "process-video" job.
 *
 * Steps:
 * 1.  Update DB status → processing
 * 2.  Download MP4 from R2 TEMP bucket
 * 3.  Run FFmpeg → 4-quality ABR HLS (fMP4)
 * 4.  Generate thumbnail.jpg
 * 5.  Upload HLS folder + thumbnail to R2 PROD
 * 6.  Update videos + lessons tables
 * 7.  Delete temp files (local + R2 TEMP)
 * 8.  Update DB status → done
 */
export async function processVideoJob(
    data: VideoJobData,
    updateProgress: (progress: number) => Promise<void>
): Promise<void> {
    const { jobId, videoId, lessonId, courseId, tempKey } = data;
    const tmpDir = path.join(os.tmpdir(), `job_${jobId}`);
    const inputPath = path.join(tmpDir, "input.mp4");

    try {
        // ── 1. Mark as processing ──────────────────────────────────
        await updateStatus(jobId, videoId, "processing");
        await updateProgress(5);

        // ── 2. Download MP4 ───────────────────────────────────────
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log(`[${jobId}] Downloading MP4 from R2...`);
        await downloadFromTemp(tempKey, inputPath);
        await updateProgress(20);

        // ── 3. Convert to ABR HLS ─────────────────────────────────
        const r2Folder = `courses/${courseId}/${lessonId}/`;
        console.log(`[${jobId}] Converting to HLS (this may take several minutes)...`);
        const { masterPlaylistKey, outputDir, durationSeconds } = await convertToHLS(
            inputPath,
            r2Folder
        );
        await updateProgress(70);

        // ── 4. Generate thumbnail ─────────────────────────────────
        console.log(`[${jobId}] Generating thumbnail...`);
        const thumbnailLocalPath = await generateThumbnail(inputPath);
        const thumbnailR2Key = `${r2Folder}thumbnail.jpg`;
        await updateProgress(75);

        // ── 5. Upload HLS dir to R2 PROD ──────────────────────────
        console.log(`[${jobId}] Uploading HLS files to R2 PROD...`);
        await uploadDirToProd(outputDir, r2Folder);
        await updateProgress(90);

        // Upload thumbnail separately
        await uploadFileToProd(thumbnailLocalPath, thumbnailR2Key, "image/jpeg");
        await updateProgress(93);

        // ── 6. Update DB records ──────────────────────────────────
        await supabase
            .from("videos")
            .update({
                master_playlist_key: masterPlaylistKey,
                duration_seconds: durationSeconds,
                status: "ready",
                error_message: null,
            })
            .eq("id", videoId);

        await supabase
            .from("lessons")
            .update({
                duration_seconds: durationSeconds,
                thumbnail_url: thumbnailR2Key,
            })
            .eq("id", lessonId);

        await updateProgress(96);

        // ── 7. Clean up local files ────────────────────────────────
        cleanup(tmpDir);
        cleanup(outputDir);

        // Delete raw MP4 from TEMP bucket
        await deleteTempObject(tempKey);
        await updateProgress(98);

        // ── 8. Mark job as done ───────────────────────────────────
        await supabase
            .from("video_jobs")
            .update({ status: "done" })
            .eq("id", jobId);

        await updateProgress(100);
        console.log(`[${jobId}] ✅ Video processing complete.`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${jobId}] ❌ Video processing failed: ${message}`);

        // Update DB with error
        await supabase
            .from("videos")
            .update({ status: "failed", error_message: message })
            .eq("id", videoId);

        await supabase
            .from("video_jobs")
            .update({ status: "failed", error_message: message })
            .eq("id", jobId);

        // Clean up any partial files
        cleanup(tmpDir);

        throw err; // Re-throw so BullMQ can retry
    }
}

// ── Helpers ────────────────────────────────────────────────────

async function updateStatus(
    jobId: string,
    videoId: string,
    status: "processing" | "done" | "failed"
): Promise<void> {
    await supabase
        .from("video_jobs")
        .update({ status })
        .eq("id", jobId);

    if (status === "processing") {
        await supabase
            .from("videos")
            .update({ status: "processing" })
            .eq("id", videoId);
    }
}

function cleanup(dir: string): void {
    try {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    } catch (e) {
        console.warn("Cleanup warning:", e);
    }
}
