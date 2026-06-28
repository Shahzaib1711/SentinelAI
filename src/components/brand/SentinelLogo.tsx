import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/sentinel-ai-logo.png";

type SentinelLogoProps = {
  variant?: "full" | "icon";
  className?: string;
  priority?: boolean;
};

export function SentinelLogo({
  variant = "full",
  className,
  priority = false,
}: SentinelLogoProps) {
  if (variant === "icon") {
    return (
      <div
        className={cn(
          "relative h-11 w-11 shrink-0 overflow-hidden rounded-lg",
          className
        )}
        aria-hidden
      >
        <Image
          src={LOGO_SRC}
          alt=""
          width={320}
          height={96}
          priority={priority}
          className="absolute left-0 top-1/2 h-10 w-auto max-w-none -translate-y-1/2 object-left"
        />
      </div>
    );
  }

  return (
    <Image
      src={LOGO_SRC}
      alt="SentinelAI — Security Intelligence Platform"
      width={260}
      height={56}
      priority={priority}
      className={cn("h-12 w-auto max-w-[13.5rem] shrink-0 object-contain object-left", className)}
    />
  );
}
