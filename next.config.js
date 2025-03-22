/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    webpack: (config) => {
        // Add WASM file handling
        config.experiments = { ...config.experiments, asyncWebAssembly: true };

        return config;
    },
};

module.exports = nextConfig;
