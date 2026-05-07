import Image from "next/image";

const LOGO_SRC = "/branding/focal-logo.png";

export type FocalLogoProps = {
  size: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

/** Official Focal mark (PNG). Use with parent `aria-label` when `alt` is empty. */
export default function FocalLogo({ size, className = "", alt = "Focal", priority }: FocalLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={["focal-logo-asset", className].filter(Boolean).join(" ")}
      draggable={false}
    />
  );
}
