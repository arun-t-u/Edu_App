import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "*.r2.cloudflarestorage.com",
            },
            {
                protocol: "https",
                hostname: "pub-*.r2.dev",
            },
        ],
    },
    // Ensure large video uploads work (API body size)
    api: {
        bodyParser: {
            sizeLimit: "500mb",
        },
        responseLimit: false,
    },
};

export default nextConfig;
