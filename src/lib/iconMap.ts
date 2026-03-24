import {
  Stethoscope, Scissors, Bone, Activity, Eye, Brain,
  Heart, CircleDot, Hand, Smile, Baby, Syringe,
  Radio, HeartPulse, Pill, Thermometer, FileText,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Stethoscope, Scissors, Bone, Activity, Eye, Brain,
  Heart, CircleDot, Hand, Smile, Baby, Syringe,
  Radio, HeartPulse, Pill, Thermometer, FileText,
};

export function getIcon(name: string | null): LucideIcon {
  return iconMap[name ?? "Stethoscope"] ?? Stethoscope;
}
