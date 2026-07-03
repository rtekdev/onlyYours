// Decorative, non-interactive background. Pure CSS (see globals.css):
// no canvas, no JS animation loop, transform-only keyframes and full
// prefers-reduced-motion support. Flip AMBIENT_BACKGROUND_ENABLED to false
// (or drop the auras) to disable it globally.

const AMBIENT_BACKGROUND_ENABLED = true;

export function AmbientBackground() {
  if (!AMBIENT_BACKGROUND_ENABLED) {
    return null;
  }
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-grid" />
      <div className="ambient-aura ambient-aura-primary" />
      <div className="ambient-aura ambient-aura-accent" />
    </div>
  );
}
