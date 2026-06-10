import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListOrdered,
  PenLine,
  Swords,
  Users,
  Ban,
  CalendarClock,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (max 4). */
  mobilePrimary?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
  { href: "/matches", label: "Matches", icon: Swords, mobilePrimary: true },
  { href: "/picks-bans", label: "Picks & Bans", icon: Ban },
  { href: "/drafter", label: "Drafter", icon: PenLine },
  {
    href: "/availability",
    label: "Schedule",
    icon: CalendarClock,
    mobilePrimary: true,
  },
  { href: "/players", label: "Players", icon: Users, mobilePrimary: true },
  { href: "/tierlists", label: "Tierlists", icon: ListOrdered },
];

export const MOBILE_PRIMARY_NAV = NAV_ITEMS.filter((item) => item.mobilePrimary);

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
