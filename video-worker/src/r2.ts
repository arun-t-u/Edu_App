import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";

// ── R2 TEMP client ─────────────────────────────────────────────
export const r2Temp = new S3Client({
    region: "auto",
    endpoint: process.env.R2_TEMP_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_TEMP_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_TEMP_SECRET_ACCESS_KEY!,
    },
});

// ── R2 PROD client ─────────────────────────────────────────────
export const r2Prod = new S3Client({
    region: "auto",
    endpoint: process.env.R2_PROD_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_PROD_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_PROD_SECRET_ACCESS_KEY!,
    },
});

/**
 * Download a file from R2 TEMP bucket to a local path.
 */
export async function downloadFromTemp(
    key: string,
    destPath: string
): Promise<void> {
    const { Body } = await r2Temp.send(
        new GetObjectCommand({ Bucket: process.env.R2_TEMP_BUCKET_NAME!, Key: key })
    );
    if (!Body) throw new Error("Empty body from R2");

    const writeStream = fs.createWriteStream(destPath);
    await new Promise<void>((resolve, reject) => {
        (Body as Readable).pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
    });
}

/**
 * Upload an entire local directory tree to R2 PROD bucket.
 * Preserves relative directory structure under the given r2Prefix.
 */
export async function uploadDirToProd(
    localDir: string,
    r2Prefix: string
): Promise<void> {
    const files = getAllFiles(localDir);
    const uploadPromises = files.map(async (filePath) => {
        const relPath = path.relative(localDir, filePath).replace(/\\/g, "/");
        const key = `${r2Prefix}${relPath}`;
        const body = fs.readFileSync(filePath);

        let contentType = "application/octet-stream";
        if (filePath.endsWith(".m3u8")) contentType = "application/x-mpegURL";
        else if (filePath.endsWith(".m4s")) contentType = "video/mp4";
        else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg"))
            contentType = "image/jpeg";

        await r2Prod.send(
            new PutObjectCommand({
                Bucket: process.env.R2_PROD_BUCKET_NAME!,
                Key: key,
                Body: body,
                ContentType: contentType,
                // Cache-Control per asset type (aligned with Cloudflare cache rules)
                CacheControl: filePath.endsWith(".m3u8")
                    ? "max-age=30"
                    : filePath.endsWith(".m4s")
                        ? "max-age=3600"
                        : "max-age=86400",
            })
        );
    });

    // Upload in batches of 10 concurrent uploads
    const BATCH_SIZE = 10;
    for (let i = 0; i < uploadPromises.length; i += BATCH_SIZE) {
        await Promise.all(uploadPromises.slice(i, i + BATCH_SIZE));
    }
}

/**
 * Upload a single file to R2 PROD bucket.
 */
export async function uploadFileToProd(
    localPath: string,
    r2Key: string,
    contentType: string
): Promise<void> {
    const body = fs.readFileSync(localPath);
    await r2Prod.send(
        new PutObjectCommand({
            Bucket: process.env.R2_PROD_BUCKET_NAME!,
            Key: r2Key,
            Body: body,
            ContentType: contentType,
            CacheControl: "max-age=86400",
        })
    );
}

/**
 * Delete an object from R2 TEMP bucket.
 */
export async function deleteTempObject(key: string): Promise<void> {
    await r2Temp.send(
        new DeleteObjectCommand({
            Bucket: process.env.R2_TEMP_BUCKET_NAME!,
            Key: key,
        })
    );
}

/**
 * List all objects in a R2 TEMP bucket with a prefix.
 */
export async function listTempObjects(
    prefix: string
): Promise<{ key: string; lastModified?: Date }[]> {
    const { Contents } = await r2Temp.send(
        new ListObjectsV2Command({
            Bucket: process.env.R2_TEMP_BUCKET_NAME!,
            Prefix: prefix,
        })
    );
    return (Contents || []).map((o) => ({
        key: o.Key!,
        lastModified: o.LastModified,
    }));
}

// ── Helpers ────────────────────────────────────────────────────

function getAllFiles(dir: string): string[] {
    const results: string[] = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            results.push(...getAllFiles(full));
        } else {
            results.push(full);
        }
    }
    return results;
}
