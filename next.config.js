/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'cloudinary', 'pdf-parse-new'],
  },
}

module.exports = nextConfig
