import {
  Stethoscope, Scissors, Bone, Activity, Eye, Brain,
  Heart, CircleDot, Hand, Smile, Baby, Syringe,
  Radio, HeartPulse, Pill, Thermometer, FileText,
  // Medical & Body
  Ear, Droplets, Dna, Microscope, TestTube, Scan, ScanLine,
  ShieldCheck, Cross, Radiation, Zap,
  // Organs & Systems
  Lungs, Ribbon, Waypoints, Sparkles, Flame,
  // General
  Clipboard, BookOpen, GraduationCap, Hospital, Ambulance,
  Beaker, Gauge, Clock, Target, Layers,
  Users, Globe, Star, Award, BadgeCheck,
  Lightbulb, Settings, Wrench, Puzzle, BarChart3,
  Flower2, TreePine, Shell, Bug, Apple,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  // Medical instruments & tools
  Stethoscope, Scissors, Syringe, Thermometer, Microscope,
  TestTube, Beaker, Scan, ScanLine, Pill,
  // Body parts & organs
  Bone, Eye, Brain, Heart, Hand, Ear, Lungs, Smile, Baby,
  // Medical concepts
  Activity, HeartPulse, Radio, CircleDot, Dna, Droplets,
  Radiation, Cross, ShieldCheck, Zap, Ribbon,
  // General medical
  Hospital, Ambulance, Clipboard, FileText,
  // Specialty-themed
  Waypoints, Sparkles, Flame, Target, Layers, Gauge,
  // Education & admin
  BookOpen, GraduationCap, Lightbulb, Award, BadgeCheck,
  Star, Users, Globe, Clock,
  // Misc
  Settings, Wrench, Puzzle, BarChart3,
  Flower2, TreePine, Shell, Bug, Apple,
};

export const ICON_NAMES = Object.keys(iconMap);

export function getIcon(name: string | null): LucideIcon {
  return iconMap[name ?? "Stethoscope"] ?? Stethoscope;
}
