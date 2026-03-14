import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ----------------------------------------------------------------
// R2 TEMP bucket  — raw MP4 uploads (auto-purged after 24h)
// ----------------------------------------------------------------
export const r2TempClient = new S3Client({
    region: "auto",
    endpoint: process.env.R2_TEMP_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_TEMP_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_TEMP_SECRET_ACCESS_KEY!,
    },
});

// ----------------------------------------------------------------
// R2 PROD bucket  — HLS segments, playlists, thumbnails
// ----------------------------------------------------------------
export const r2ProdClient = new S3Client({
    region: "auto",
    endpoint: process.env.R2_PROD_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_PROD_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_PROD_SECRET_ACCESS_KEY!,
    },
});

/**
 * Generate a presigned PUT URL for uploading an MP4 to the TEMP bucket.
 * Expires in 30 minutes to give the browser time to upload large files.
 */
export async function getUploadPresignedUrl(key: string): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: process.env.R2_TEMP_BUCKET_NAME!,
        Key: key,
        ContentType: "video/mp4",
    });
    return getSignedUrl(r2TempClient, command, { expiresIn: 1800 });
}

/**
 * Generate a presigned GET URL for a PROD bucket asset.
 *
 * @param key     R2 object key (e.g. courses/xxx/yyy/master.m3u8)
 * @param ttl     Expiry in seconds (default 120 = 2 min for playlists)
 */
export async function getProdPresignedUrl(
    key: string,
    ttl: number = 120
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: process.env.R2_PROD_BUCKET_NAME!,
        Key: key,
    });
    return getSignedUrl(r2ProdClient, command, { expiresIn: ttl });
}

/**
 * Delete an object from the TEMP bucket (cleanup after processing).
 */
export async function deleteTempObject(key: string): Promise<void> {
    await r2TempClient.send(
        new DeleteObjectCommand({
            Bucket: process.env.R2_TEMP_BUCKET_NAME!,
            Key: key,
        })
    );
}
