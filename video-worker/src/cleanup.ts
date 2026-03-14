import cron from "node-cron";
import supabase from "./db";
import { listTempObjects, deleteTempObject } from "./r2";

const TEMP_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_JOB_MAX_AGE_DAYS = 7;

/**
 * Register all cleanup cron jobs.
 * Called once on worker startup.
 */
export function registerCleanupJobs(): void {
    // ── Run every hour ───────────────────────────────────────────
    cron.schedule("0 * * * *", async () => {
        console.log("[Cleanup] Running hourly cleanup...");
        await Promise.allSettled([
            cleanTempUploads(),
            cleanFailedJobs(),
        ]);
    });

    console.log("[Cleanup] Cron jobs registered (every hour).");
}

/**
 * Delete raw MP4 uploads from R2 TEMP bucket older than 24 hours.
 * This prevents storage leaks from:
 * - Uploads where the API never received the POST (browser crash)
 * - Successfully processed jobs (their temp files should already be deleted by processor.ts)
 */
async function cleanTempUploads(): Promise<void> {
    try {
        const objects = await listTempObjects("uploads/");
        const now = Date.now();
        let deleted = 0;

        for (const obj of objects) {
            if (!obj.lastModified) continue;
            const age = now - obj.lastModified.getTime();
            if (age > TEMP_UPLOAD_MAX_AGE_MS) {
                await deleteTempObject(obj.key);
                deleted++;
            }
        }

        if (deleted > 0) {
            console.log(`[Cleanup] Deleted ${deleted} stale temp uploads.`);
        }
    } catch (err) {
        console.error("[Cleanup] cleanTempUploads failed:", err);
    }
}

/**
 * Remove failed video_jobs records older than 7 days.
 * Also marks orphan videos (failed with no retry pending) for visibility.
 */
async function cleanFailedJobs(): Promise<void> {
    try {
        const cutoff = new Date(
            Date.now() - FAILED_JOB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: oldJobs } = await supabase
            .from("video_jobs")
            .select("id, video_id")
            .eq("status", "failed")
            .lt("updated_at", cutoff);

        if (!oldJobs || oldJobs.length === 0) return;

        const jobIds = oldJobs.map((j: { id: string }) => j.id);
        await supabase.from("video_jobs").delete().in("id", jobIds);

        console.log(`[Cleanup] Removed ${jobIds.length} old failed job records.`);
    } catch (err) {
        console.error("[Cleanup] cleanFailedJobs failed:", err);
    }
}
