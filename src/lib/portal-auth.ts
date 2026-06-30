import { TeamRole } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export type PortalUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

type PortalAuthSuccess = {
  user: PortalUser;
  error: null;
  status: 200;
};

type PortalAuthFailure = {
  user: null;
  error: string;
  status: 401 | 403;
};

export type PortalAuthResult = PortalAuthSuccess | PortalAuthFailure;

export function getEffectiveTeamRole(user: PortalUser): TeamRole | "OWNER" {
  if (user.isAccountOwner) return "OWNER";
  return user.teamRole ?? "VIEWER";
}

export function userHasPermission(user: PortalUser, permission: string): boolean {
  if (!user.wholesaleAccount) return false;
  return hasPermission(getEffectiveTeamRole(user), permission);
}

export async function requirePortalAccount(
  permission?: string
): Promise<PortalAuthResult> {
  const user = await getUser();
  if (!user) {
    return { user: null, error: "Unauthorized", status: 401 };
  }
  if (!user.wholesaleAccount) {
    return { user: null, error: "No wholesale account found", status: 403 };
  }
  if (permission && !userHasPermission(user, permission)) {
    return { user: null, error: "Insufficient permissions", status: 403 };
  }
  return { user, error: null, status: 200 };
}
