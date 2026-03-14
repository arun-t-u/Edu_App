import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: {
        default: "EduStream — Secure Online Courses",
        template: "%s | EduStream",
    },
    description:
        "Learn from world-class instructors with secure HD video streaming.",
    keywords: ["online courses", "e-learning", "video lessons", "education"],
    openGraph: {
        type: "website",
        locale: "en_US",
        title: "EduStream",
        description: "Secure online learning platform",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={inter.variable}>
            <body className="bg-surface text-white antialiased">{children}</body>
        </html>
    );
}
