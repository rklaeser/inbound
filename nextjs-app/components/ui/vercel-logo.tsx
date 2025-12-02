interface VercelLogoProps {
  height?: number;
  className?: string;
}

export function VercelLogo({ height = 24, className }: VercelLogoProps) {
  // Calculate width based on the original aspect ratio (76/65)
  const width = (height * 76) / 65;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 76 65"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor" />
    </svg>
  );
}
