import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    GO_API_URL: process.env.GO_API_URL ?? 'http://localhost:8080',
  },
}

export default nextConfig
