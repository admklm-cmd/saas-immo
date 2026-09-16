import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: `${APP_TEXTS.nav.dashboard} — ${APP_TEXTS.brand.name}` };

/** Shell (out of scope of this iteration). */
export default function DashboardPage() {
  return (
    <ComingSoon
      title={APP_TEXTS.nav.dashboard}
      description={APP_TEXTS.shells.dashboard}
    />
  );
}
