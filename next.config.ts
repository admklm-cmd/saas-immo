import path from "node:path";

import type { NextConfig } from "next";

import { securityHeadersFromEnv } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // Security headers on EVERY response (CSP, X-Frame-Options, HSTS in
  // production…). See lib/security/headers.ts for what each one covers and for
  // the documented limit of the current CSP.
  async headers() {
    return [{ source: "/:path*", headers: securityHeadersFromEnv() }];
  },
  // Pin the workspace root to this project: a stray lockfile in a parent
  // directory must not change how Turbopack resolves modules.
  turbopack: {
    root: path.join(__dirname),
  },
  // Do not advertise the framework in response headers.
  poweredByHeader: false,
  // `next dev` would otherwise append a managed block to CLAUDE.md / AGENTS.md.
  // CLAUDE.md is the project's source of truth and is edited by humans only.
  agentRules: false,
  // The floating « N » indicator of `next dev` covered « Se déconnecter » at the
  // bottom of the navigation. Development only: no effect on a production build.
  devIndicators: false,
};

export default nextConfig;
