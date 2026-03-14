import * as path from "path";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";

/**
 * Generate a thumbnail from a video at the 3-second mark.
 *
 * @param inputPath   Absolute path to source MP4
 * @returns           Absolute path to generated thumbnail.jpg
 */
export async function generateThumbnail(inputPath: string): Promise<string> {
    const outputPath = path.join(path.dirname(inputPath), "thumbnail.jpg");

    await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: [3],        // 3 seconds into the video
                filename: "thumbnail.jpg",
                folder: path.dirname(inputPath),
                size: "1280x720",       // 720p thumbnail
            })
            .on("end", () => resolve())
            .on("error", reject);
    });

    return outputPath;
}
