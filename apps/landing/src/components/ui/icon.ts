import {
  GraduationCap,
  ClipboardCheck,
  MessageCircleQuestion,
  Clock,
  Video,
  Sparkles,
  Bot,
  Award,
  MessagesSquare,
  Brain,
  Timer,
  type LucideIcon,
} from 'lucide-react';

export const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  ClipboardCheck,
  MessageCircleQuestion,
  Clock,
  Video,
  Sparkles,
  Bot,
  Award,
  MessagesSquare,
  Brain,
  Timer,
};

export function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? Sparkles;
}
