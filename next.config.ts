import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // `next dev` otherwise appends its own block to CLAUDE.md on every run.
  // That file is this project's hand-written working rules, so it is not
  // somewhere a framework gets to write; leaving it on means a permanently
  // dirty tree. Honoured at next/dist/server/lib/start-server.js.
  agentRules: false,
  typedRoutes: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
}

export default config
