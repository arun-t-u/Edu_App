import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, PlayCircle, Clock, TrendingUp } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    // Fetch enrollments with nested progress data
    const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
      id, enrolled_at, status,
      course:courses(id, title, description, thumbnail,
        sections(id, lessons(id,
          video_progress!inner(student_id, completed)
        ))
      )
    `)
        .eq("student_id", user.id)
        .eq("status", "active")
        .limit(20);

    // Compute progress for each enrollment
    const enrollmentsWithProgress = (enrollments || []).map((e) => {
        const sections = (e.course as any)?.sections || [];
        let total = 0;
        let completed = 0;
        sections.forEach((s: any) =>
            s.lessons?.forEach((l: any) => {
                total++;
                if (l.video_progress?.[0]?.completed) completed++;
            })
        );
        return {
            ...e,
            progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
            total_lessons: total,
            completed_lessons: completed,
        };
    });

    const totalCompleted = enrollmentsWithProgress.reduce(
        (acc, e) => acc + e.completed_lessons,
        0
    );

    return (
        <div className="min-h-screen bg-surface">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-surface-border/50 bg-surface/80">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold">
                        <PlayCircle className="text-brand-400" size={24} />
                        <span className="gradient-text">EduStream</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        {profile?.role === "admin" && (
                            <Link href="/admin/dashboard" className="btn-ghost text-sm">
                                Admin Panel
                            </Link>
                        )}
                        <Link href="/my-courses" className="btn-ghost text-sm">My Courses</Link>
                        <Link href="/profile" className="btn-ghost text-sm">Profile</Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Welcome header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold">
                        Welcome back, {profile?.full_name?.split(" ")[0] || "Learner"} 👋
                    </h1>
                    <p className="text-slate-400 mt-1">Pick up where you left off</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    {[
                        { label: "Enrolled Courses", value: enrollmentsWithProgress.length, icon: BookOpen },
                        { label: "Lessons Completed", value: totalCompleted, icon: PlayCircle },
                        { label: "In Progress", value: enrollmentsWithProgress.filter(e => e.progress_percent > 0 && e.progress_percent < 100).length, icon: TrendingUp },
                        { label: "Completed Courses", value: enrollmentsWithProgress.filter(e => e.progress_percent === 100).length, icon: Clock },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="glass-card p-5">
                            <Icon className="text-brand-400 mb-3" size={20} />
                            <div className="text-2xl font-bold">{value}</div>
                            <div className="text-slate-400 text-sm">{label}</div>
                        </div>
                    ))}
                </div>

                {/* My Courses */}
                <h2 className="text-xl font-semibold mb-5">Continue Learning</h2>
                {enrollmentsWithProgress.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <BookOpen className="text-slate-600 mx-auto mb-4" size={48} />
                        <p className="text-slate-400 mb-4">You haven&apos;t enrolled in any courses yet.</p>
                        <Link href="/courses" className="btn-primary">Browse Courses</Link>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrollmentsWithProgress.map((e) => {
                            const course = e.course as any;
                            return (
                                <div key={e.id} className="glass-card overflow-hidden group">
                                    <div className="aspect-video bg-surface-elevated relative overflow-hidden">
                                        {course.thumbnail ? (
                                            <img
                                                src={course.thumbnail}
                                                alt={course.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <PlayCircle className="text-slate-600" size={40} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-2 right-2 bg-black/70 rounded px-2 py-0.5 text-xs text-white">
                                            {e.progress_percent}%
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-sm line-clamp-2 mb-2">{course.title}</h3>
                                        {/* Progress bar */}
                                        <div className="progress-bar mb-3">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${e.progress_percent}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                                            <span>{e.completed_lessons}/{e.total_lessons} lessons</span>
                                            <span>{e.progress_percent}% complete</span>
                                        </div>
                                        <Link
                                            href={`/course/${course.id}`}
                                            className="btn-primary w-full text-center text-sm py-2"
                                        >
                                            {e.progress_percent === 0 ? "Start Learning" : "Continue"}
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
