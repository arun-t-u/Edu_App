import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — use in Client Components.
 * Session is stored in cookies and synced with the server.
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
