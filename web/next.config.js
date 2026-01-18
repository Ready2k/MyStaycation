/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // Increase limits for long-running searches
    experimental: {
        proxyTimeout: 300000, // 5 minutes for proxy requests
    },
    // Remove hardcoded env to avoid build-time baking confusion for dynamic proxy
    async rewrites() {
        return [
            {
                source: '/api/proxy/:path*',
                destination: `${process.env.API_URL || 'http://api:4000'}/:path*`,
            },
        ]
    },
}

module.exports = nextConfig
