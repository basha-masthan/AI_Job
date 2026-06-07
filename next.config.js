/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'cloudinary', 'pdf-parse-new', 'pdfkit'],
  },
  // Suppress repeated polling noise in terminal
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

// Patch console to suppress noisy status poll lines in dev
if (process.env.NODE_ENV !== 'production') {
  const _write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    // Suppress lines that are ONLY the autopilot status 200 poll
    if (/GET \/api\/autopilot\/status 200 in \d+ms/.test(str) && !str.includes('\n\n')) {
      return true;
    }
    return _write(chunk, ...args);
  };
}

module.exports = nextConfig
