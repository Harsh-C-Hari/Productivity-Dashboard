import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string; // any valid CSS color/hex
  trackClassName?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * A color-parameterized sibling of `components/tasks/UrgencyRing`. That
 * component's color is driven by urgency tier; this one takes any color
 * directly, for contexts like subject completion where there's no
 * urgency semantic (just a plain percentage).
 */
export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  color = "#D9A75B",
  trackClassName,
  children,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const target = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [progress, circumference]);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.8s ease-out",
            filter: `drop-shadow(0 0 3px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
