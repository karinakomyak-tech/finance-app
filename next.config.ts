import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isDev, // в dev не мешает
})

export default withPWA(nextConfig)
