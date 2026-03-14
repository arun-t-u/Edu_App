import * as path from "path";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";

export interface ConvertResult {
    masterPlaylistKey: string;  // R2 key for master.m3u8
    outputDir: string;          // local /tmp dir with all generated files
    durationSeconds: number;
}

/**
 * Convert an MP4 file to adaptive bitrate HLS (fMP4 segments).
 * Produces 4 quality levels: 1080p, 720p, 480p, 360p
 * Uses: libx264 -preset veryfast -crf 23 (fast encode, great quality-size tradeoff)
 *
 * @param inputPath   Absolute path to source MP4
 * @param r2Folder    R2 folder prefix (e.g. courses/{courseId}/{lessonId}/)
 * @returns           ConvertResult with output dir and master playlist key
 */
export async function convertToHLS(
    inputPath: string,
    r2Folder: string
): Promise<ConvertResult> {
    const outputDir = path.join("/tmp", `hls_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    // Create quality subdirectories
    ["1080p", "720p", "480p", "360p"].forEach((q) =>
        fs.mkdirSync(path.join(outputDir, q), { recursive: true })
    );

    await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
            .complexFilter([
                "[v:0]split=4[v1][v2][v3][v4]",
                "[v1]scale=1920:1080[vh1]",
                "[v2]scale=1280:720[vh2]",
                "[v3]scale=854:480[vh3]",
                "[v4]scale=640:360[vh4]",
            ])
            // 1080p
            .addOutput(path.join(outputDir, "1080p", "1080p.m3u8"))
            .outputOptions([
                "-map [vh1]", "-map a:0",
                "-c:v:0 libx264", "-preset veryfast", "-crf 23", "-b:v:0 5000k",
                "-c:a:0 aac", "-b:a:0 192k",
                "-f hls",
                "-hls_time 6",
                "-hls_playlist_type vod",
                "-hls_segment_type fmp4",
                "-hls_flags independent_segments",
                `-hls_segment_filename ${path.join(outputDir, "1080p", "seg%03d.m4s")}`,
            ])
            // 720p
            .addOutput(path.join(outputDir, "720p", "720p.m3u8"))
            .outputOptions([
                "-map [vh2]", "-map a:0",
                "-c:v:1 libx264", "-preset veryfast", "-crf 23", "-b:v:1 2800k",
                "-c:a:1 aac", "-b:a:1 128k",
                "-f hls",
                "-hls_time 6",
                "-hls_playlist_type vod",
                "-hls_segment_type fmp4",
                "-hls_flags independent_segments",
                `-hls_segment_filename ${path.join(outputDir, "720p", "seg%03d.m4s")}`,
            ])
            // 480p
            .addOutput(path.join(outputDir, "480p", "480p.m3u8"))
            .outputOptions([
                "-map [vh3]", "-map a:0",
                "-c:v:2 libx264", "-preset veryfast", "-crf 23", "-b:v:2 1400k",
                "-c:a:2 aac", "-b:a:2 128k",
                "-f hls",
                "-hls_time 6",
                "-hls_playlist_type vod",
                "-hls_segment_type fmp4",
                "-hls_flags independent_segments",
                `-hls_segment_filename ${path.join(outputDir, "480p", "seg%03d.m4s")}`,
            ])
            // 360p
            .addOutput(path.join(outputDir, "360p", "360p.m3u8"))
            .outputOptions([
                "-map [vh4]", "-map a:0",
                "-c:v:3 libx264", "-preset veryfast", "-crf 23", "-b:v:3 800k",
                "-c:a:3 aac", "-b:a:3 96k",
                "-f hls",
                "-hls_time 6",
                "-hls_playlist_type vod",
                "-hls_segment_type fmp4",
                "-hls_flags independent_segments",
                `-hls_segment_filename ${path.join(outputDir, "360p", "seg%03d.m4s")}`,
            ])
            .on("end", () => resolve())
            .on("error", reject)
            .run();
    });

    // Get duration from probe
    const durationSeconds = await getVideoDuration(inputPath);

    // Write master.m3u8 manually (EXT-X-STREAM-INF with bandwidth hints)
    const masterContent = `#EXTM3U
#EXT-X-VERSION:6

#EXT-X-STREAM-INF:BANDWIDTH=5192000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",CLOSED-CAPTIONS=NONE
${r2Folder}1080p/1080p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2",CLOSED-CAPTIONS=NONE
${r2Folder}720p/720p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1528000,RESOLUTION=854x480,CODECS="avc1.4d401e,mp4a.40.2",CLOSED-CAPTIONS=NONE
${r2Folder}480p/480p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360,CODECS="avc1.4d4015,mp4a.40.2",CLOSED-CAPTIONS=NONE
${r2Folder}360p/360p.m3u8
`;

    const masterPath = path.join(outputDir, "master.m3u8");
    fs.writeFileSync(masterPath, masterContent, "utf-8");

    return {
        masterPlaylistKey: `${r2Folder}master.m3u8`,
        outputDir,
        durationSeconds,
    };
}

/**
 * Extract duration from video file using ffprobe.
 */
function getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                resolve(0);
                return;
            }
            resolve(Math.round(metadata.format.duration || 0));
        });
    });
}
