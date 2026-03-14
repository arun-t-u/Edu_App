"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Plus, Upload, CheckCircle, AlertCircle,
    Loader, Video, ChevronDown, ChevronRight
} from "lucide-react";

interface Lesson { id: string; title: string; position: number; videos?: { status: string }[] }
interface Section { id: string; title: string; lessons: Lesson[] }

export default function EditCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    const [sections, setSections] = useState<Section[]>([]);
    const [newSectionTitle, setNewSectionTitle] = useState("");
    const [newLessonTitles, setNewLessonTitles] = useState<Record<string, string>>({});
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [uploadState, setUploadState] = useState<Record<string, { progress: number; status: string }>>({});
    const [loading, setLoading] = useState(false);

    // ── Section ───────────────────────────────────────────────────
    async function addSection() {
        if (!newSectionTitle.trim()) return;
        const res = await fetch("/api/sections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId, title: newSectionTitle }),
        });
        const { data } = await res.json();
        setSections((s) => [...s, { ...data, lessons: [] }]);
        setNewSectionTitle("");
        setExpandedSections((s) => new Set([...s, data.id]));
    }

    // ── Lesson ────────────────────────────────────────────────────
    async function addLesson(sectionId: string) {
        const title = newLessonTitles[sectionId];
        if (!title?.trim()) return;
        const res = await fetch("/api/lessons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sectionId, title }),
        });
        const { data } = await res.json();
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId
                    ? { ...s, lessons: [...s.lessons, { ...data, videos: [] }] }
                    : s
            )
        );
        setNewLessonTitles((p) => ({ ...p, [sectionId]: "" }));
    }

    // ── Video upload ──────────────────────────────────────────────
    async function handleVideoUpload(lessonId: string, file: File) {
        setUploadState((p) => ({ ...p, [lessonId]: { progress: 0, status: "uploading" } }));

        // 1. Get presigned URL
        const urlRes = await fetch("/api/video/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId, courseId, filename: file.name }),
        });
        const { data: urlData, error } = await urlRes.json();
        if (error) {
            setUploadState((p) => ({ ...p, [lessonId]: { progress: 0, status: "error" } }));
            return;
        }

        // 2. Upload to R2 via presigned URL (XHR for progress tracking)
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 80); // 80% = upload done
                    setUploadState((p) => ({ ...p, [lessonId]: { progress: pct, status: "uploading" } }));
                }
            };
            xhr.onload = () => (xhr.status < 400 ? resolve() : reject());
            xhr.onerror = reject;
            xhr.open("PUT", urlData.uploadUrl);
            xhr.setRequestHeader("Content-Type", "video/mp4");
            xhr.send(file);
        });

        setUploadState((p) => ({ ...p, [lessonId]: { progress: 85, status: "processing" } }));

        // 3. Poll job status until done
        const poll = async () => {
            const statusRes = await fetch(`/api/video/job-status?jobId=${urlData.jobId}`);
            const { data: statusData } = await statusRes.json();
            if (statusData?.dbStatus === "done") {
                setUploadState((p) => ({ ...p, [lessonId]: { progress: 100, status: "ready" } }));
            } else if (statusData?.dbStatus === "failed") {
                setUploadState((p) => ({ ...p, [lessonId]: { progress: 0, status: "error" } }));
            } else {
                setTimeout(poll, 5000);
            }
        };
        poll();
    }

    return (
        <div className="min-h-screen bg-surface">
            <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur px-4 h-16 flex items-center gap-4">
                <Link href="/admin/dashboard" className="text-slate-400 hover:text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="font-semibold">Edit Course Content</h1>
                <div className="ml-auto flex gap-2">
                    <Link href={`/course/${courseId}`} className="btn-ghost text-sm">Preview</Link>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
                {/* Existing sections */}
                {sections.map((section) => (
                    <div key={section.id} className="glass-card overflow-hidden">
                        <button
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-elevated/50 transition-colors"
                            onClick={() =>
                                setExpandedSections((s) => {
                                    const next = new Set(s);
                                    next.has(section.id) ? next.delete(section.id) : next.add(section.id);
                                    return next;
                                })
                            }
                        >
                            {expandedSections.has(section.id) ? (
                                <ChevronDown size={16} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={16} className="text-slate-400" />
                            )}
                            <span className="font-semibold">{section.title}</span>
                            <span className="text-slate-500 text-sm ml-auto">{section.lessons.length} lessons</span>
                        </button>

                        {expandedSections.has(section.id) && (
                            <div className="border-t border-surface-border px-4 pb-4">
                                {/* Lessons */}
                                {section.lessons.map((lesson) => {
                                    const state = uploadState[lesson.id];
                                    return (
                                        <div key={lesson.id} className="flex items-center gap-3 py-3 border-b border-surface-border/50 last:border-0">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{lesson.title}</p>
                                                {state && (
                                                    <div className="mt-1.5">
                                                        <div className="progress-bar">
                                                            <div className="progress-bar-fill" style={{ width: `${state.progress}%` }} />
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1 capitalize">
                                                            {state.status === "ready" ? "✅ Video ready" :
                                                                state.status === "error" ? "❌ Upload failed" :
                                                                    state.status === "processing" ? "⚙️ Converting to HLS..." :
                                                                        `Uploading... ${state.progress}%`}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Video upload button */}
                                            <label className={`cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${state?.status === "ready"
                                                    ? "border-green-500/40 text-green-400 bg-green-500/10"
                                                    : "border-surface-border text-slate-400 hover:text-white hover:border-brand-400"
                                                }`}>
                                                {state?.status === "ready" ? (
                                                    <><CheckCircle size={14} /> Ready</>
                                                ) : state?.status === "processing" ? (
                                                    <><Loader size={14} className="animate-spin" /> Processing</>
                                                ) : (
                                                    <><Upload size={14} /> Upload Video</>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="video/mp4"
                                                    className="hidden"
                                                    disabled={!!state && state.status !== "error"}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleVideoUpload(lesson.id, file);
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    );
                                })}

                                {/* Add lesson */}
                                <div className="flex gap-2 mt-3">
                                    <input
                                        type="text"
                                        placeholder="New lesson title..."
                                        value={newLessonTitles[section.id] || ""}
                                        onChange={(e) => setNewLessonTitles((p) => ({ ...p, [section.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === "Enter" && addLesson(section.id)}
                                        className="input-field text-sm py-2 flex-1"
                                    />
                                    <button onClick={() => addLesson(section.id)} className="btn-secondary text-sm px-3">
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add section */}
                <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold mb-3 text-slate-400">Add New Section</h3>
                    <div className="flex gap-2">
                        <input
                            id="new-section-input"
                            type="text"
                            placeholder="Section title (e.g. Getting Started)"
                            value={newSectionTitle}
                            onChange={(e) => setNewSectionTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addSection()}
                            className="input-field text-sm flex-1"
                        />
                        <button id="add-section-btn" onClick={addSection} className="btn-primary text-sm px-4">
                            Add Section
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
