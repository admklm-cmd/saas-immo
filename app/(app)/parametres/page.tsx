import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: `${APP_TEXTS.nav.settings} — ${APP_TEXTS.brand.name}` };

/** Shell (out of scope of this iteration). */
export default function SettingsPage() {
  return (
    <ComingSoon
      title={APP_TEXTS.nav.settings}
      description={APP_TEXTS.shells.settings}
    />
  );
}
