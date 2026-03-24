import {
  Stethoscope, Scissors, Bone, Activity, Eye, Brain,
  Heart, CircleDot, Hand, Smile, Baby, Syringe,
  Radio, HeartPulse, Pill, Thermometer, FileText,
  Ear, Droplets, Dna, Microscope, TestTube, Scan, ScanLine,
  ShieldCheck, Cross, Radiation, Zap,
  Ribbon, Waypoints, Sparkles, Flame,
  Clipboard, BookOpen, GraduationCap, Hospital, Ambulance,
  Beaker, Gauge, Clock, Target, Layers,
  Users, Globe, Star, Award, BadgeCheck,
  Lightbulb, Settings, Wrench, Puzzle, BarChart3,
  Flower2, TreePine, Shell, Bug, Apple,
  // Additional medical & body
  Footprints, PersonStanding, Accessibility, HeartHandshake,
  BicepsFlexed, Fingerprint, ScanFace, ScanEye,
  // More medical tools & concepts
  Bandage, Blend, Disc, Focus, Orbit, Radius,
  ShieldPlus, ShieldAlert, CircleAlert, CircleCheck,
  Pipette, FlaskConical, FlaskRound, Atom,
  // Speciality-relevant
  Wind, Waves, Shrub, Mountain, Gem,
  Crown, Medal, Trophy, Hammer, Magnet,
  Network, GitBranch, Share2, Route,
  Laptop, Monitor, Wifi, Signal,
  Megaphone, Bell, AlertTriangle, Info,
  Bed, Sofa, Tent, Building2,
  Plane, Ship, Truck,
  Palette, Paintbrush, Pen, PenTool,
  Camera, Image, SunMedium, Moon, CloudRain,
  Lock, Key, Shield, Umbrella,
  Phone, Mail, MapPin, Navigation,
  Calendar, CalendarClock, Timer, Hourglass,
  FileHeart, FilePlus, FileSearch, FolderHeart,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  // Medical instruments & tools
  Stethoscope, Scissors, Syringe, Thermometer, Microscope,
  TestTube, Beaker, Scan, ScanLine, Pill, Bandage,
  Pipette, FlaskConical, FlaskRound,
  // Body parts & organs
  Bone, Eye, Brain, Heart, Hand, Ear, Smile, Baby,
  Footprints, PersonStanding, BicepsFlexed, Fingerprint,
  ScanFace, ScanEye,
  // Medical concepts & vitals
  Activity, HeartPulse, Radio, CircleDot, Dna, Droplets,
  Radiation, Cross, ShieldCheck, ShieldPlus, ShieldAlert, Zap,
  Ribbon, Atom, Wind, Waves,
  HeartHandshake, Accessibility,
  // Hospital & care
  Hospital, Ambulance, Bed, Building2,
  Clipboard, FileText, FileHeart, FilePlus, FileSearch, FolderHeart,
  // Specialty-themed
  Waypoints, Sparkles, Flame, Target, Layers, Gauge,
  Focus, Orbit, Radius, Disc, Blend,
  Network, GitBranch, Share2, Route,
  // Education & admin
  BookOpen, GraduationCap, Lightbulb, Award, BadgeCheck,
  Star, Users, Globe, Clock, Calendar, CalendarClock, Timer, Hourglass,
  Crown, Medal, Trophy,
  // Alert & info
  Megaphone, Bell, AlertTriangle, Info,
  CircleAlert, CircleCheck,
  // Nature & organic
  Flower2, TreePine, Shell, Bug, Apple, Shrub, Mountain, Gem,
  // Communication
  Phone, Mail, MapPin, Navigation,
  // Tech & tools
  Settings, Wrench, Puzzle, BarChart3, Hammer, Magnet,
  Laptop, Monitor, Wifi, Signal,
  Lock, Key, Shield, Umbrella,
  // Creative
  Palette, Paintbrush, Pen, PenTool,
  Camera, Image, SunMedium, Moon, CloudRain,
  // Transport
  Plane, Ship, Truck, Tent, Sofa,
};

export const ICON_NAMES = Object.keys(iconMap);

export function getIcon(name: string | null): LucideIcon {
  return iconMap[name ?? "Stethoscope"] ?? Stethoscope;
}
