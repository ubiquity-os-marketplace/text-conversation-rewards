import { ContextPlugin } from "../types/plugin-input";

export const ADMIN_ROLES = ["admin", "owner", "billing_manager"];
export const COLLABORATOR_ROLES = ["write", "member", "collaborator"];

function isAdminRole(role: string) {
  return ADMIN_ROLES.includes(role.toLowerCase());
}

function isCollaboratorRole(role: string) {
  return COLLABORATOR_ROLES.includes(role.toLowerCase());
}

export async function isUserAllowedToGeneratePermits(context: ContextPlugin) {
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
