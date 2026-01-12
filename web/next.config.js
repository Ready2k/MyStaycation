/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
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
