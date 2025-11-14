import { PluginSettings, RewardRoleSettings, RewardSettings } from "../types/plugin-input";
import { RewardUserRole } from "./permissions";

const ROLE_TO_CONFIG_KEY: Record<RewardUserRole, keyof RewardRoleSettings> = {
  admin: "admin",
  collaborator: "collaborator",
  contributor: "contributor",
  billing_manager: "billingManager",
};

export function isGlobalRewardSettings(rewards: PluginSettings["rewards"]): rewards is RewardSettings {
  if (!rewards || typeof rewards !== "object") {
    return false;
  }
  return "evmNetworkId" in rewards;
}

export function resolveRewardSettingsForRole(
  rewards: PluginSettings["rewards"],
  role: RewardUserRole
): RewardSettings | null {
  if (!rewards) {
    return null;
  }
  if (isGlobalRewardSettings(rewards)) {
    return rewards;
  }
  const key = ROLE_TO_CONFIG_KEY[role];
  const config = rewards[key];
  return config ?? null;
}

export function rewardConfigKey(config: RewardSettings) {
  return JSON.stringify([config.evmNetworkId, config.erc20RewardToken, config.evmPrivateEncrypted]);
}
