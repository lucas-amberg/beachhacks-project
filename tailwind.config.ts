// tailwind.config.js
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#659B5E", // strong green
                secondary: "#ACC7AB", // soft green
                background: "#F3F3F7", // light gray
                foreground: "#000000", // default text color

                // Optional: More semantic roles
                muted: "#ACC7AB",
                accent: "#659B5E",
                card: "#F3F3F7",
                border: "#ACC7AB",
            },
        },
    },
    plugins: [],
};
