import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Users, Video, TrendingUp, PlayCircle, Plus } from "lucide-react";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "admin") redirect("/dashboard");

    // Fetch stats in parallel
    const [coursesRes, studentsRes, enrollmentsRes, videosRes] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("videos").select("id", { count: "exact", head: true }).eq("status", "ready"),
    ]);

    const stats = [
        { label: "Total Courses", value: coursesRes.count ?? 0, icon: BookOpen, href: "/admin/courses/new" },
        { label: "Students", value: studentsRes.count ?? 0, icon: Users, href: "/admin/enrollments" },
        { label: "Active Enrollments", value: enrollmentsRes.count ?? 0, icon: TrendingUp, href: "/admin/enrollments" },
        { label: "Ready Videos", value: videosRes.count ?? 0, icon: Video, href: "/admin/courses/new" },
    ];

    // Recent courses
    const { data: recentCourses } = await supabase
        .from("courses")
        .select("id, title, is_published, created_at, teacher:user_profiles!courses_teacher_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(10);

    // Recent enrollments
    const { data: recentEnrollments } = await supabase
        .from("enrollments")
        .select("id, enrolled_at, status, student:user_profiles!enrollments_student_id_fkey(full_name), course:courses(title)")
        .order("enrolled_at", { ascending: false })
        .limit(10);

    return (
        <div className="min-h-screen bg-surface">
            <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-surface-border/50 bg-surface/80">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PlayCircle className="text-brand-400" size={24} />
                        <span className="font-bold gradient-text">EduStream Admin</span>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/admin/courses/new" className="btn-primary text-sm flex items-center gap-1.5">
                            <Plus size={14} /> New Course
                        </Link>
                        <Link href="/admin/enrollments" className="btn-secondary text-sm">Enrollments</Link>
                        <Link href="/dashboard" className="btn-ghost text-sm">← Student View</Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-slate-400 mt-1">Welcome, {profile?.full_name || "Admin"}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {stats.map(({ label, value, icon: Icon, href }) => (
                        <Link key={label} href={href} className="glass-card p-5 hover:border-brand-500/40 transition-colors">
                            <Icon className="text-brand-400 mb-3" size={20} />
                            <div className="text-3xl font-bold">{value}</div>
                            <div className="text-slate-400 text-sm mt-1">{label}</div>
                        </Link>
                    ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent Courses */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold">Recent Courses</h2>
                            <Link href="/admin/courses/new" className="text-brand-400 text-sm hover:text-brand-300">
                                + Create
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {(recentCourses || []).map((c) => (
                                <div key={c.id} className="flex items-center justify-between py-2 border-b border-surface-border/50 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium line-clamp-1">{c.title}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            by {(c.teacher as any)?.full_name || "Unknown"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_published
                                                ? "bg-green-500/20 text-green-400"
                                                : "bg-slate-500/20 text-slate-400"
                                            }`}>
                                            {c.is_published ? "Published" : "Draft"}
                                        </span>
                                        <Link href={`/admin/courses/${c.id}/edit`} className="text-xs text-brand-400 hover:text-brand-300">
                                            Edit
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Enrollments */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold">Recent Enrollments</h2>
                            <Link href="/admin/enrollments" className="text-brand-400 text-sm hover:text-brand-300">
                                View All
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {(recentEnrollments || []).map((e) => (
                                <div key={e.id} className="flex items-center justify-between py-2 border-b border-surface-border/50 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium">{(e.student as any)?.full_name || "Student"}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                            {(e.course as any)?.title}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === "active"
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-red-500/20 text-red-400"
                                        }`}>
                                        {e.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
