"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, Loader } from "lucide-react";

export default function CreateCoursePage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("0");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const res = await fetch("/api/courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, price }),
        });

        const { data, error: apiError } = await res.json();
        if (apiError) {
            setError(apiError);
            setLoading(false);
            return;
        }

        router.push(`/admin/courses/${data.id}/edit`);
    }

    return (
        <div className="min-h-screen bg-surface">
            <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur px-4 h-16 flex items-center gap-4">
                <Link href="/admin/dashboard" className="text-slate-400 hover:text-white">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="font-semibold">Create New Course</h1>
            </nav>

            <main className="max-w-2xl mx-auto px-4 py-10">
                <div className="glass-card p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-300">
                                Course Title *
                            </label>
                            <input
                                id="course-title-input"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Complete Python Bootcamp"
                                required
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-300">Description</label>
                            <textarea
                                id="course-description-input"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What will students learn?"
                                rows={4}
                                className="input-field resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-300">
                                Price (USD)
                            </label>
                            <input
                                id="course-price-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="input-field"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}

                        <button
                            id="create-course-btn"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader size={16} className="animate-spin" /> : null}
                            {loading ? "Creating..." : "Create Course & Add Lessons →"}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
