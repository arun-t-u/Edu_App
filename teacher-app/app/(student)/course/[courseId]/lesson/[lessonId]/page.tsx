"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/player/VideoPlayer";
import { ChevronLeft, ChevronRight, CheckCircle, Clock, PlayCircle, Lock } from "lucide-react";

interface Lesson {
    id: string;
    title: string;
    description: string | null;
    position: number;
    is_preview: boolean;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    videos?: { status: string }[];
}

interface Section {
    id: string;
    title: string;
    position: number;
    lessons: Lesson[];
}

interface CourseData {
    id: string;
    title: string;
    sections: Section[];
}

export default function LessonPlayerPage() {
    const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
    const router = useRouter();

    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [course, setCourse] = useState<CourseData | null>(null);
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [userEmail, setUserEmail] = useState("student@example.com");
    const [userIp, setUserIp] = useState("---.---.---.---");
    const [progress, setProgress] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Load course structure ─────────────────────────────────────
    useEffect(() => {
        fetch(`/api/courses/${courseId}`)
            .then((r) => r.json())
            .then(({ data }) => setCourse(data))
            .catch(console.error);
    }, [courseId]);

    // ── Get user info ─────────────────────────────────────────────
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then(({ data }) => {
                if (data?.email) setUserEmail(data.email);
                if (data?.ip) setUserIp(data.ip);
            })
            .catch(() => { });
    }, []);

    // ── Fetch signed streaming URL ────────────────────────────────
    const loadStreamUrl = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStreamUrl(null);

        const res = await fetch(`/api/video/stream-url?lessonId=${lessonId}`);
        const { data, error: apiError } = await res.json();

        if (apiError) {
            setError(apiError);
        } else {
            setStreamUrl(data.streamUrl);
        }
        setLoading(false);
    }, [lessonId]);

    useEffect(() => {
        if (lessonId) loadStreamUrl();
    }, [lessonId, loadStreamUrl]);

    // ── Report progress back to API ───────────────────────────────
    async function handleProgress(seconds: number, completed: boolean) {
        await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId, watchedSeconds: seconds, completed }),
        });
        if (completed) {
            setProgress((p) => ({ ...p, [lessonId]: true }));
        }
    }

    // ── Navigation helpers ────────────────────────────────────────
    const allLessons = course?.sections?.flatMap((s) => s.lessons) || [];
    const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
    const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
    const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

    useEffect(() => {
        const lesson = allLessons.find((l) => l.id === lessonId);
        setCurrentLesson(lesson || null);
    }, [course, lessonId]);

    function formatDuration(s: number | null) {
        if (!s) return "";
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, "0")}`;
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col">
            {/* Top bar */}
            <nav className="h-14 border-b border-surface-border bg-surface-card/80 backdrop-blur flex items-center px-4 gap-4 sticky top-0 z-50">
                <Link href={`/course/${courseId}`} className="text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </Link>
                <span className="text-sm text-slate-300 font-medium truncate flex-1">
                    {course?.title || "Loading..."}
                </span>
                <div className="flex items-center gap-2">
                    {prevLesson && (
                        <Link
                            href={`/course/${courseId}/lesson/${prevLesson.id}`}
                            className="btn-ghost text-xs flex items-center gap-1"
                        >
                            <ChevronLeft size={14} /> Prev
                        </Link>
                    )}
                    {nextLesson && (
                        <Link
                            href={`/course/${courseId}/lesson/${nextLesson.id}`}
                            className="btn-primary text-xs flex items-center gap-1"
                        >
                            Next <ChevronRight size={14} />
                        </Link>
                    )}
                </div>
            </nav>

            <div className="flex flex-1 overflow-hidden">
                {/* ── Video area ─────────────────────────────────────── */}
                <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-auto">
                    {/* Player */}
                    <div className="w-full max-w-5xl mx-auto">
                        {loading ? (
                            <div className="aspect-video bg-surface-elevated rounded-lg flex items-center justify-center">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-400 mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm">Loading secure stream...</p>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="aspect-video bg-surface-elevated rounded-lg flex items-center justify-center">
                                <div className="text-center text-red-400 p-8">
                                    <Lock size={36} className="mx-auto mb-3" />
                                    <p className="font-semibold mb-1">Access Denied</p>
                                    <p className="text-sm text-slate-500">{error}</p>
                                    <Link href="/my-courses" className="btn-secondary mt-4 inline-block text-sm">
                                        My Courses
                                    </Link>
                                </div>
                            </div>
                        ) : streamUrl ? (
                            <VideoPlayer
                                streamUrl={streamUrl}
                                userEmail={userEmail}
                                userIp={userIp}
                                lessonId={lessonId}
                                lessonTitle={currentLesson?.title || ""}
                                onProgress={handleProgress}
                            />
                        ) : null}

                        {/* Lesson info */}
                        <div className="mt-5">
                            <h1 className="text-xl font-bold">{currentLesson?.title}</h1>
                            {currentLesson?.description && (
                                <p className="text-slate-400 text-sm mt-2">{currentLesson.description}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Sidebar: Lesson list ────────────────────────────── */}
                <div className="hidden lg:flex flex-col w-80 border-l border-surface-border bg-surface-card overflow-y-auto">
                    <div className="p-4 border-b border-surface-border">
                        <h3 className="font-semibold text-sm">Course Content</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {currentIdx + 1} / {allLessons.length} lessons
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {course?.sections?.map((section) => (
                            <div key={section.id}>
                                <div className="px-4 py-2 bg-surface-elevated text-xs font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                                    {section.title}
                                </div>
                                {section.lessons.map((lesson) => {
                                    const isActive = lesson.id === lessonId;
                                    const isCompleted = progress[lesson.id];
                                    return (
                                        <Link
                                            key={lesson.id}
                                            href={`/course/${courseId}/lesson/${lesson.id}`}
                                            className={`flex items-start gap-3 px-4 py-3 text-sm hover:bg-surface-elevated transition-colors border-l-2 ${isActive
                                                    ? "border-brand-400 bg-brand-500/10 text-white"
                                                    : "border-transparent text-slate-400 hover:text-white"
                                                }`}
                                        >
                                            <div className="mt-0.5 flex-shrink-0">
                                                {isCompleted ? (
                                                    <CheckCircle size={16} className="text-green-400" />
                                                ) : isActive ? (
                                                    <PlayCircle size={16} className="text-brand-400" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border border-slate-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="line-clamp-2 leading-tight">{lesson.title}</p>
                                                {lesson.duration_seconds && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                                        <Clock size={11} />
                                                        {formatDuration(lesson.duration_seconds)}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
