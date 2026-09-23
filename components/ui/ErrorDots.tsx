/**
 * The glyph of an error: three sober red dots that shake ONCE (≈ .45 s, 5 px
 * max) when the error appears, then stay still. Decorative: the error is
 * always written next to it, never carried by the colour alone.
 */
export function ErrorDots() {
  return (
    <span aria-hidden="true" className="error-dots" data-testid="error-dots">
      <i />
      <i />
      <i />
    </span>
  );
}
