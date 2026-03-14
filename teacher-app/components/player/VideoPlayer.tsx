"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
    streamUrl: string;       // signed m3u8 URL
    userEmail: string;       // for watermark
    userIp: string;          // for watermark
    lessonId: string;        // for watermark
    lessonTitle: string;
    onProgress?: (seconds: number, completed: boolean) => void;
    startAt?: number;        // resume from (seconds)
}

export default function VideoPlayer({
    streamUrl,
    userEmail,
    userIp,
    lessonId,
    lessonTitle,
    onProgress,
    startAt = 0,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [watermarkPos, setWatermarkPos] = useState({ top: "12%", left: "6%" });
    const [currentTime, setCurrentTime] = useState(new Date().toISOString());

    // ── Update watermark timestamp every minute ──────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date().toISOString());
        }, 60_000);
        return () => clearInterval(interval);
    }, []);

    // ── Drift watermark position to different corners every 12s ──
    useEffect(() => {
        const positions = [
            { top: "10%", left: "5%" },
            { top: "12%", left: "78%" },
            { top: "72%", left: "74%" },
            { top: "75%", left: "6%" },
        ];
        let idx = 0;
        const interval = setInterval(() => {
            idx = (idx + 1) % positions.length;
            setWatermarkPos(positions[idx]);
        }, 12_000);
        return () => clearInterval(interval);
    }, []);

    // ── HLS setup ────────────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        // Destroy previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                startLevel: -1,            // Auto quality
                enableWorker: true,
                lowLatencyMode: false,
            });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setIsReady(true);
                if (startAt > 0) video.currentTime = startAt;
                video.play().catch(() => { }); // Autoplay may be blocked
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    setError("Video failed to load. The streaming URL may have expired.");
                }
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari native HLS
            video.src = streamUrl;
            video.addEventListener("loadedmetadata", () => {
                setIsReady(true);
                if (startAt > 0) video.currentTime = startAt;
            });
        } else {
            setError("Your browser does not support HLS video playback.");
        }

        return () => {
            hlsRef.current?.destroy();
        };
    }, [streamUrl, startAt]);

    // ── Progress reporting (every 10s) ───────────────────────────
    const reportProgress = useCallback(() => {
        const video = videoRef.current;
        if (!video || !onProgress) return;
        const seconds = Math.floor(video.currentTime);
        const completed = video.duration > 0 && video.currentTime / video.duration >= 0.9;
        onProgress(seconds, completed);
    }, [onProgress]);

    useEffect(() => {
        progressTimer.current = setInterval(reportProgress, 10_000);
        return () => {
            if (progressTimer.current) clearInterval(progressTimer.current);
        };
    }, [reportProgress]);

    // ── Prevent right-click on the video area ────────────────────
    function handleContextMenu(e: React.MouseEvent) {
        e.preventDefault();
        return false;
    }

    // ── Prevent common keyboard shortcuts (F12, Ctrl+S, etc.) ───
    function handleKeyDown(e: React.KeyboardEvent) {
        if (
            (e.ctrlKey && ["s", "u", "p"].includes(e.key.toLowerCase())) ||
            e.key === "F12"
        ) {
            e.preventDefault();
        }
    }

    if (error) {
        return (
            <div className="aspect-video bg-surface-elevated rounded-lg flex items-center justify-center">
                <div className="text-center text-red-400 p-6">
                    <p className="font-semibold">⚠️ {error}</p>
                    <p className="text-sm text-slate-500 mt-2">Please refresh and try again.</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative aspect-video bg-black rounded-lg overflow-hidden select-none"
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
        >
            {/* Loading skeleton */}
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-elevated z-20">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-400 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">Loading {lessonTitle}...</p>
                    </div>
                </div>
            )}

            {/* Video element */}
            <video
                ref={videoRef}
                controls
                playsInline
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                className="w-full h-full"
                aria-label={lessonTitle}
            />

            {/* ── Dynamic watermark overlay ────────────────────────── */}
            <div
                className="video-watermark"
                style={{
                    top: watermarkPos.top,
                    left: watermarkPos.left,
                    transition: "top 1.5s ease, left 1.5s ease",
                }}
                aria-hidden="true"
            >
                <svg
                    width="230"
                    height="68"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
                >
                    <text x="0" y="16" fill="white" fontSize="11" fontFamily="monospace" fontWeight="500">
                        {userEmail}
                    </text>
                    <text x="0" y="32" fill="white" fontSize="10" fontFamily="monospace" opacity="0.85">
                        {currentTime.slice(0, 19).replace("T", " ")} UTC
                    </text>
                    <text x="0" y="48" fill="white" fontSize="10" fontFamily="monospace" opacity="0.75">
                        IP: {userIp}
                    </text>
                    <text x="0" y="64" fill="white" fontSize="9" fontFamily="monospace" opacity="0.6">
                        Lesson: {lessonId.slice(0, 8)}
                    </text>
                </svg>
            </div>
        </div>
    );
}
