import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "hsl(262, 100%, 97%)",
                    100: "hsl(262, 95%, 92%)",
                    200: "hsl(262, 90%, 83%)",
                    300: "hsl(262, 85%, 72%)",
                    400: "hsl(262, 80%, 60%)",
                    500: "hsl(262, 75%, 50%)",
                    600: "hsl(262, 80%, 42%)",
                    700: "hsl(262, 85%, 35%)",
                    800: "hsl(262, 88%, 25%)",
                    900: "hsl(262, 90%, 16%)",
                },
                surface: {
                    DEFAULT: "hsl(220, 20%, 10%)",
                    card: "hsl(220, 18%, 14%)",
                    elevated: "hsl(220, 16%, 18%)",
                    border: "hsl(220, 14%, 22%)",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "hero-gradient":
                    "linear-gradient(135deg, hsl(262,75%,10%) 0%, hsl(220,20%,8%) 50%, hsl(270,60%,12%) 100%)",
            },
            animation: {
                "fade-in": "fadeIn 0.3s ease-out",
                "slide-up": "slideUp 0.3s ease-out",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [],
};
export default config;
