import Link from "next/link";
import type { ComponentProps } from "react";

import { buttonStyles, type ButtonSize, type ButtonVariant } from "./Button";
import { cn } from "./cn";

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** A navigation link that looks exactly like a `Button`, but stays an anchor. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonStyles(variant, size), className)} {...props}>
      {children}
    </Link>
  );
}
