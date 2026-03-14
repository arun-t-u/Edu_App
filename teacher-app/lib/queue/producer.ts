import { Queue } from "bullmq";

/**
 * BullMQ video-processing queue producer.
 * Used by Next.js API routes to enqueue jobs.
 * The actual processing is done by the video-worker service.
 */
const connection = {
    url: process.env.REDIS_URL || "redis://localhost:6379",
};

// Singleton queue instance (avoids creating multiple connections)
let videoQueue: Queue | null = null;

export function getVideoQueue(): Queue {
    if (!videoQueue) {
        videoQueue = new Queue("video-processing", {
            connection: { lazyConnect: true, ...parseRedisUrl(connection.url) },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
                removeOnComplete: 100,
                removeOnFail: 500,
            },
        });
    }
    return videoQueue;
}

/**
 * Enqueue a video processing job.
 */
export async function enqueueVideoJob(data: {
    jobId: string;
    videoId: string;
    lessonId: string;
    courseId: string;
    tempKey: string;
}): Promise<void> {
    const queue = getVideoQueue();
    await queue.add("process-video", data, { jobId: data.jobId });
}

/**
 * Get the current state of a queued job.
 */
export async function getJobStatus(
    jobId: string
): Promise<{ state: string; progress: number; failedReason?: string } | null> {
    const queue = getVideoQueue();
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
        state,
        progress: typeof job.progress === "number" ? job.progress : 0,
        failedReason: job.failedReason,
    };
}

// ----------------------------------------------------------------
// Helper: parse redis:// URL into ioredis connection options
// ----------------------------------------------------------------
function parseRedisUrl(url: string) {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port || "6379"),
            password: parsed.password || undefined,
            username: parsed.username || undefined,
        };
    } catch {
        return { host: "localhost", port: 6379 };
    }
}
