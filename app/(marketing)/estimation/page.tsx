import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: `${APP_TEXTS.marketing.estimation} — ${APP_TEXTS.brand.name}`,
};

/**
 * Shell (out of scope of this iteration).
 * The estimation form will collect one non-pre-ticked consent per channel.
 */
export default function EstimationPage() {
  return (
    <ComingSoon
      title={APP_TEXTS.marketing.estimation}
      description={APP_TEXTS.shells.estimation}
    />
  );
}
