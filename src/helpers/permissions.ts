import { ContextPlugin } from "../types/plugin-input";

export const ADMIN_ROLES = ["admin", "owner", "billing_manager"];
export const COLLABORATOR_ROLES = ["write", "member", "collaborator", "maintain", "triage", "push"];

export type RewardUserRole = "admin" | "collaborator" | "contributor" | "billing_manager";

// Use WeakMap for caching so that cache entries are automatically garbage collected
// when the context is no longer referenced. This is important for memory management
// in a long-running process, as it prevents memory leaks from unused contexts.
const rewardRoleCache = new WeakMap<ContextPlugin, Map<string, RewardUserRole>>();

function getRoleCache(context: ContextPlugin) {
  let cache = rewardRoleCache.get(context);
  if (!cache) {
    cache = new Map<string, RewardUserRole>();
    rewardRoleCache.set(context, cache);
  }
  return cache;
}

function normalizeRole(role: string | null | undefined) {
  return role?.toLowerCase() ?? null;
}

interface RepoPermissionInfo {
  role: string | null;
  permission: string | null;
  permissions: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
  };
}

async function fetchMembershipRole(context: ContextPlugin, username: string) {
  try {
    const membership = await context.octokit.rest.orgs.getMembershipForUser({
      org: context.payload.repository.owner.login,
      username,
    });
    return normalizeRole(membership.data.role);
  } catch (e) {
    context.logger.debug(`${username} is not a member of ${context.payload.repository.owner.login}`, { e });
    return null;
  }
}

async function fetchRepoPermissionInfo(context: ContextPlugin, username: string): Promise<RepoPermissionInfo> {
  try {
    const permissionLevel = await context.octokit.rest.repos.getCollaboratorPermissionLevel({
      username,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    return {
      role: normalizeRole(permissionLevel.data.role_name),
      permission: normalizeRole(permissionLevel.data.permission),
      permissions: permissionLevel.data.user?.permissions ?? {},
    };
  } catch (e) {
    context.logger.warn(`Failed to determine collaborator permission level for ${username}`, { e });
    return {
      role: null,
      permission: null,
      permissions: {},
    };
  }
}

function membershipRoleToRewardRole(role: string | null): RewardUserRole | null {
  if (!role) {
    return null;
  }
  if (role === "member") {
    return "collaborator";
  }
  if (role === "billing_manager") {
    return "billing_manager";
  }
  if (role === "admin" || role === "owner") {
    return "admin";
  }
  return null;
}

function isAdminPermission(info: RepoPermissionInfo) {
  return info.permissions?.admin || info.role === "admin" || info.role === "owner" || info.permission === "admin";
}

function isCollaboratorPermission(info: RepoPermissionInfo) {
  return (
    (info.role ? COLLABORATOR_ROLES.includes(info.role) : false) ||
    (info.permission ? COLLABORATOR_ROLES.includes(info.permission) : false) ||
    info.permissions?.maintain ||
    info.permissions?.push ||
    info.permissions?.triage
  );
}

export async function getUserRewardRole(context: ContextPlugin, username: string): Promise<RewardUserRole> {
  const cache = getRoleCache(context);
  const cached = cache.get(username);
  if (cached) {
    return cached;
  }

  const membershipRole = await fetchMembershipRole(context, username);
  const membershipDerivedRole = membershipRoleToRewardRole(membershipRole);
  if (membershipDerivedRole && membershipDerivedRole !== "contributor") {
    cache.set(username, membershipDerivedRole);
    return membershipDerivedRole;
  }

  const repoInfo = await fetchRepoPermissionInfo(context, username);

  let resolvedRole: RewardUserRole = "contributor";
  if (isAdminPermission(repoInfo)) {
    resolvedRole = "admin";
  } else if (isCollaboratorPermission(repoInfo)) {
    resolvedRole = "collaborator";
  }

  cache.set(username, resolvedRole);
  return resolvedRole;
}

function isAdminRole(role: string) {
  return ADMIN_ROLES.includes(role.toLowerCase());
}

function isCollaboratorRole(role: string) {
  return COLLABORATOR_ROLES.includes(role.toLowerCase());
}

export async function isUserAllowedToGenerateRewards(context: ContextPlugin) {
  const { octokit, payload } = context;
  const username = payload.sender.login;
  try {
    await octokit.rest.orgs.getMembershipForUser({
      org: payload.repository.owner.login,
      username,
    });
    return true;
  } catch (e) {
    context.logger.debug(`${username} is not a member of ${context.payload.repository.owner.login}`, { e });
  }

  // If we failed to get organization membership, narrow down to repo role
  const permissionLevel = await octokit.rest.repos.getCollaboratorPermissionLevel({
    username,
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
  const role = permissionLevel.data.role_name?.toLowerCase();
  context.logger.debug(`Retrieved collaborator permission level for ${username}.`, {
    username,
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    isAdmin: permissionLevel.data.user?.permissions?.admin,
    role,
    data: permissionLevel.data,
  });

  return isAdminRole(role) || isCollaboratorRole(role);
}
