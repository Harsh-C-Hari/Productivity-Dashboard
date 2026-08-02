import { useEffect, useState } from "react";
import type { Urgency } from "@/types";

const RING_COLORS: Record<Urgency, string> = {
  critical: "#C1584A",
  high: "#D9915A",
  medium: "#D9C15A",
  low: "#7FA872",
  none: "#6B6B70",
};

interface UrgencyRingProps {
  progress: number; // 0-100
  urgency: Urgency;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/**
 * The app's signature HUD element: a gauge-style ring (borrowed from
 * game health/mana bars) that fuses two numbers into one glanceable
 * shape - task completion (the fill) and urgency tier (the color).
 */
export function UrgencyRing({
  progress,
  urgency,
  size = 56,
  strokeWidth = 5,
  children,
}: UrgencyRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const target = circumference - (progress / 100) * circumference;
    // Delay one tick so the transition animates from full to target on mount.
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [progress, circumference]);

  const color = RING_COLORS[urgency];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
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
            transition: "stroke-dashoffset 0.8s ease-out, stroke 0.4s",
            filter: `drop-shadow(0 0 3px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (
          <span className="font-mono text-[11px] font-medium text-foreground">{progress}%</span>
        )}
      </div>
    </div>
  );
}
