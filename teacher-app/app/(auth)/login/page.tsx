"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlayCircle, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleEmailLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }
        router.push("/dashboard");
        router.refresh();
    }

    async function handleGoogleLogin() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) setError(error.message);
        setLoading(false);
    }

    return (
        <div className="min-h-screen bg-hero-gradient flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <Link href="/" className="flex items-center justify-center gap-2 mb-8">
                    <PlayCircle className="text-brand-400" size={32} />
                    <span className="text-2xl font-bold gradient-text">EduStream</span>
                </Link>

                <div className="glass-card p-8">
                    <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
                    <p className="text-slate-400 text-sm mb-6">Sign in to continue learning</p>

                    {/* Google SSO */}
                    <button
                        id="google-login-btn"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full btn-secondary flex items-center justify-center gap-3 mb-4"
                    >
                        <svg width="18" height="18" viewBox="0 0 48 48">
                            <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.1c-.6 3.1-2.4 5.8-5.1 7.6v6.3h8.2c4.8-4.4 7.3-10.9 7.3-18z" />
                            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8.2-6.3c-2.1 1.4-4.8 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.3H2.8v6.5C6.8 42.6 14.8 48 24 48z" />
                            <path fill="#FBBC05" d="M11.3 28.8C10.8 27.3 10.5 25.7 10.5 24s.3-3.3.8-4.8v-6.5H2.8C1 16.3 0 20 0 24s1 7.7 2.8 11.3l8.5-6.5z" />
                            <path fill="#EA4335" d="M24 9.5c3.3 0 6.3 1.1 8.6 3.4l6.4-6.4C35.9 2.8 30.5.5 24 .5 14.8.5 6.8 5.9 2.8 13.7l8.5 6.5C13.1 13.5 18.1 9.5 24 9.5z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-surface-border" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-surface-card px-3 text-slate-500 text-xs">
                                or sign in with email
                            </span>
                        </div>
                    </div>

                    {/* Email / Password form */}
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                id="email-input"
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="input-field pl-10"
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                id="password-input"
                                type={showPw ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="input-field pl-10 pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={14} />
                                {error}
                            </div>
                        )}

                        <button
                            id="login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center"
                        >
                            {loading ? (
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <p className="text-center text-slate-400 text-sm mt-6">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">
                            Create one free
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
