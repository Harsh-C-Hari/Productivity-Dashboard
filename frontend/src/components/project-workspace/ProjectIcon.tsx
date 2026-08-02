import {
  Folder,
  Rocket,
  Code,
  Database,
  Globe,
  Smartphone,
  Cpu,
  LayoutDashboard,
  Gamepad2,
  Server,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  rocket: Rocket,
  code: Code,
  database: Database,
  globe: Globe,
  smartphone: Smartphone,
  cpu: Cpu,
  "layout-dashboard": LayoutDashboard,
  "gamepad-2": Gamepad2,
  server: Server,
};

export function resolveProjectIcon(icon: string): LucideIcon {
  return ICON_MAP[icon] ?? Folder;
}

export function ProjectIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = resolveProjectIcon(icon);
  return <Icon className={className} />;
}
