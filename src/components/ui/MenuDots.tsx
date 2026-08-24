import './MenuDots.css';

/**
 * The "⋯" options glyph isn't in Archivo's covered character set, so the
 * browser silently falls back to a system font for just that glyph —
 * drawing the dots in CSS instead keeps it visually on-theme everywhere.
 */
export function MenuDots() {
  return (
    <span className="menu-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
