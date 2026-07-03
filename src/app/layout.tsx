// Root layout is a passthrough — the actual <html> element lives in
// src/app/[locale]/layout.tsx so it can carry the correct lang attribute.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
