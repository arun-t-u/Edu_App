// ============================================================
// Shared TypeScript types for the entire platform
// ============================================================

export type UserRole = "student" | "teacher" | "admin";

export interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: UserRole;
    created_at: string;
}

export interface Course {
    id: string;
    teacher_id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    price: number;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    // Computed / joined
    teacher?: Pick<UserProfile, "id" | "full_name" | "avatar_url">;
    sections?: Section[];
    enrollment_count?: number;
    total_lessons?: number;
}

export interface Section {
    id: string;
    course_id: string;
    title: string;
    position: number;
    created_at: string;
    lessons?: Lesson[];
}

export interface Lesson {
    id: string;
    section_id: string;
    title: string;
    description: string | null;
    position: number;
    is_preview: boolean;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    created_at: string;
    video?: Video;
}

export type VideoStatus = "pending" | "processing" | "ready" | "failed";

export interface Video {
    id: string;
    lesson_id: string;
    r2_folder: string;
    master_playlist_key: string | null;
    duration_seconds: number | null;
    status: VideoStatus;
    error_message: string | null;
    created_at: string;
}

export type EnrollmentStatus = "active" | "expired" | "revoked";

export interface Enrollment {
    id: string;
    student_id: string;
    course_id: string;
    status: EnrollmentStatus;
    enrolled_at: string;
    course?: Course;
    student?: UserProfile;
}

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface Payment {
    id: string;
    student_id: string;
    course_id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    provider: string | null;
    provider_ref: string | null;
    created_at: string;
}

export interface VideoProgress {
    id: string;
    student_id: string;
    lesson_id: string;
    watched_seconds: number;
    completed: boolean;
    last_watched_at: string;
}

export interface DeviceSession {
    id: string;
    user_id: string;
    device_id: string;
    ip_address: string | null;
    user_agent: string | null;
    session_id: string | null;
    last_active: string;
}

export interface VideoSession {
    id: string;
    user_id: string;
    lesson_id: string;
    started_at: string;
    ended_at: string | null;
    ip_address: string | null;
    device_id: string | null;
}

// ---- API Response shapes ----

export interface ApiResponse<T = void> {
    data?: T;
    error?: string;
}

export interface StreamUrlResponse {
    streamUrl: string;
    expiresAt: string;
}

export interface UploadUrlResponse {
    uploadUrl: string;
    jobId: string;
    tempKey: string;
}

export interface CourseWithProgress extends Course {
    progress_percent: number;
    last_lesson_id?: string;
}
