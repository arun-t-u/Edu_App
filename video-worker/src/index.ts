import "dotenv/config";
import { Worker, Queue } from "bullmq";
import { processVideoJob, VideoJobData } from "./processor";
import { registerCleanupJobs } from "./cleanup";

// ── Parse Redis connection ─────────────────────────────────────
function parseRedis(url: string) {
    try {
        const u = new URL(url);
        return {
            host: u.hostname,
            port: parseInt(u.port || "6379"),
            password: u.password || undefined,
        };
    } catch {
        return { host: "localhost", port: 6379 };
    }
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const connection = parseRedis(REDIS_URL);

console.log("🚀 Video Worker starting...");
console.log(`   Redis: ${connection.host}:${connection.port}`);

// ── BullMQ Worker ──────────────────────────────────────────────
const worker = new Worker<VideoJobData>(
    "video-processing",
    async (job) => {
        console.log(`\n[Job ${job.id}] Processing: ${JSON.stringify(job.data)}`);

        await processVideoJob(job.data, async (progress) => {
            await job.updateProgress(progress);
        });
    },
    {
        connection,
        concurrency: 2, // Process up to 2 videos simultaneously
        limiter: {
            max: 5,
            duration: 60_000, // Max 5 jobs/minute
        },
    }
);

// ── Worker event handlers ──────────────────────────────────────
worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed.`);
});

worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

worker.on("error", (err) => {
    console.error("Worker error:", err);
});

// ── Register cleanup cron ──────────────────────────────────────
registerCleanupJobs();

// ── Graceful shutdown ──────────────────────────────────────────
async function shutdown() {
    console.log("\n⏳ Graceful shutdown...");
    await worker.close();
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("✅ Worker ready. Waiting for jobs...");
