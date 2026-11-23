"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";

interface OdooImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallbackClassName?: string;
}

export function OdooImage({
  src,
  alt,
  width,
  height,
  className = "h-full w-full object-cover",
  fallbackClassName = "flex h-full w-full items-center justify-center bg-slate-100 text-slate-400",
}: OdooImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={fallbackClassName} role="img" aria-label={alt}>
        <Package className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
