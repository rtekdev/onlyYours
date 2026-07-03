import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // pg loads its Cloudflare socket shim conditionally at runtime, which file
  // tracing cannot see — include it explicitly so the Workers bundle
  // (@opennextjs/cloudflare) can resolve it.
  outputFileTracingIncludes: {
    "/*": ["node_modules/pg-cloudflare/**"],
  },
  // Baseline security headers; CSP is documented as a deployment concern
  // (nonce-based CSP requires per-request handling — see docs/security.md).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
