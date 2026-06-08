import type { MemberRole, TeamRole } from "@/lib/player-profile-types";

export function formatTeamRole(role: TeamRole): string {
  if (role === "TOP") return "TOP";
  if (role === "JUNGLE") return "JG";
  if (role === "MID") return "MID";
  if (role === "ADC") return "ADC";
  if (role === "SUPPORT") return "SUPP";
  if (role === "FILL") return "FILL";
  return role;
}

export function rosterLabel(memberRole: MemberRole): "Starter" | "Sub" {
  return memberRole === "SUB" ? "Sub" : "Starter";
}
