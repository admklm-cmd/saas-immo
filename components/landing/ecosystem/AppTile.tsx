import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";

import styles from "./app-tile.module.css";

export type AppTileTone = "orange" | "violet" | "green";

/**
 * The app tile of a block of the hero (docs/design-system.md §2.11.8.8 L4-A):
 * a coloured square with rounded corners, like an app icon, and a glyph of
 * our family painted all white inside — no cobalt dot. The ONLY place of the
 * site where colour goes beyond black / white / grey / cobalt; the three
 * tones are local to `app-tile.module.css` and used nowhere else (tested).
 * Decorative (`aria-hidden`): the block name next to it is what is read; the
 * colour carries no meaning on its own. `animate`: the glyph plays its story
 * once (existing CSS stories of the `sm` icon), never at rest nor under
 * reduced motion. Server-safe.
 */
export function AppTile({ glyph, tone, animate = false }: { glyph: IconName; tone: AppTileTone; animate?: boolean }) {
  return (
    <span aria-hidden="true" className={styles.tile} data-app-tile="" data-tone={tone}>
      <Icon name={glyph} size="sm" px={36} animate={animate} className={styles.glyph} />
    </span>
  );
}
