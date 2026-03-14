import Link from "next/link";
import { BookOpen, PlayCircle, Shield, Users, Star, ArrowRight, Zap } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-hero-gradient">
            {/* ── Navbar ─────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-surface-border/50 bg-surface/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                        <PlayCircle className="text-brand-400" size={28} />
                        <span className="gradient-text">EduStream</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link href="/courses" className="btn-ghost text-sm hidden sm:flex">
                            Browse Courses
                        </Link>
                        <Link href="/login" className="btn-secondary text-sm">
                            Sign In
                        </Link>
                        <Link href="/register" className="btn-primary text-sm">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
                <div className="inline-flex items-center gap-2 bg-brand-500/15 text-brand-300 border border-brand-500/30 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                    <Zap size={14} />
                    Secure HD Video Streaming
                </div>
                <h1 className="text-5xl sm:text-7xl font-extrabold leading-tight mb-6">
                    Learn Without
                    <br />
                    <span className="gradient-text">Limits</span>
                </h1>
                <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-10">
                    Access premium recorded courses from expert instructors. HD streaming,
                    adaptive quality, and built-in security so your learning is always
                    protected.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/courses" className="btn-primary flex items-center gap-2 justify-center text-base px-8 py-3">
                        Browse Courses <ArrowRight size={18} />
                    </Link>
                    <Link href="/register" className="btn-secondary flex items-center gap-2 justify-center text-base px-8 py-3">
                        Start Free Today
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-20">
                    {[
                        { label: "Students", value: "12,400+" },
                        { label: "Courses", value: "280+" },
                        { label: "Instructors", value: "45+" },
                        { label: "Avg Rating", value: "4.8 ★" },
                    ].map((s) => (
                        <div key={s.label} className="glass-card p-5 text-center">
                            <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
                            <div className="text-slate-400 text-sm">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ───────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <h2 className="text-3xl font-bold text-center mb-12">
                    Why Choose <span className="gradient-text">EduStream</span>?
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        {
                            icon: Shield,
                            title: "Bank-Level Security",
                            desc: "Signed URLs, enrollment checks, and dynamic watermarking protect every video.",
                        },
                        {
                            icon: PlayCircle,
                            title: "Adaptive HD Streaming",
                            desc: "Auto-quality switching from 360p to 1080p via HLS. Seamless on any connection.",
                        },
                        {
                            icon: BookOpen,
                            title: "Structured Courses",
                            desc: "Organized sections and lessons with progress tracking and resume support.",
                        },
                        {
                            icon: Zap,
                            title: "Instant Access",
                            desc: "After enrollment, access all lessons immediately. No waiting.",
                        },
                        {
                            icon: Users,
                            title: "Expert Instructors",
                            desc: "Verified teachers with real-world experience in their fields.",
                        },
                        {
                            icon: Star,
                            title: "Track Your Progress",
                            desc: "See completion %, resume where you left off, and earn course certificates.",
                        },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="glass-card p-6 group hover:border-brand-500/40 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-4 group-hover:bg-brand-500/30 transition-colors">
                                <Icon className="text-brand-400" size={22} />
                            </div>
                            <h3 className="font-semibold text-white mb-2">{title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────── */}
            <section className="max-w-4xl mx-auto px-4 py-20 text-center">
                <div className="glass-card p-12 border-brand-500/20">
                    <h2 className="text-4xl font-bold mb-4">
                        Ready to start learning?
                    </h2>
                    <p className="text-slate-400 mb-8">
                        Join thousands of students already learning on EduStream.
                    </p>
                    <Link href="/register" className="btn-primary text-base px-10 py-3 inline-flex items-center gap-2">
                        Create Free Account <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer className="border-t border-surface-border py-8">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <PlayCircle size={16} className="text-brand-400" />
                        © {new Date().getFullYear()} EduStream. All rights reserved.
                    </div>
                    <div className="flex gap-6 text-slate-500 text-sm">
                        <Link href="/courses" className="hover:text-white transition-colors">Courses</Link>
                        <Link href="/login" className="hover:text-white transition-colors">Login</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
