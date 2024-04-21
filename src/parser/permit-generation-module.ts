import { context } from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import {
  Context,
  createAdapters,
  Database,
  encodePermits,
  generatePayoutPermit,
  SupportedEvents,
  TokenType,
} from "@ubiquibot/permit-generation/core";
import configuration from "../configuration/config-reader";
import permitGenerationConfigurationType, {
  PermitGenerationConfiguration,
} from "../configuration/permit-generation-configuration";
import { getOctokitInstance } from "../get-authentication-token";
import { IssueActivity } from "../issue-activity";
import envConfigSchema, { EnvConfigType } from "../types/env-type";
import program from "./command-line";
import { Module, Result } from "./processor";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  issue: { id: number };
}

export class PermitGenerationModule implements Module {
  readonly _configuration: PermitGenerationConfiguration = configuration.permitGeneration;
  readonly _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: program.opts().issue,
      evmPrivateEncrypted: program.opts().evmPrivateEncrypted,
      evmNetworkId: program.opts().evmNetworkId,
    };
    const issueId = Number(payload.issueUrl.match(/[0-9]+$/)?.[1]);
    payload.issue = {
      id: issueId,
    };
    const env: EnvConfigType = process.env;
    if (!Value.Check(envConfigSchema, env)) {
      console.warn("[PermitGenerationModule] Invalid env detected, skipping.");
      return Promise.resolve(result);
    }
    const eventName = context.eventName as SupportedEvents;
    const octokit = getOctokitInstance();
    const logger = {
      debug() {},
      error(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      fatal(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      info() {},
      warn(message: unknown, optionalParams: unknown) {
        console.warn(message, optionalParams);
      },
    };
    const adapters = {} as ReturnType<typeof createAdapters>;

    for (const [key, value] of Object.entries(result)) {
      try {
        const config: Context["config"] = {
          evmNetworkId: payload.evmNetworkId,
          evmPrivateEncrypted: payload.evmPrivateEncrypted,
          permitRequests: [
            {
              amount: value.total,
              username: key,
              contributionType: "",
              type: TokenType.ERC20,
            },
          ],
        };
        const permits = await generatePayoutPermit(
          {
            env,
            eventName,
            logger,
            payload,
            adapters: createAdapters(this._supabase, {
              env,
              eventName,
              octokit,
              config,
              logger,
              payload,
              adapters,
            }),
            octokit,
            config,
          },
          config.permitRequests
        );
        result[key].permitUrl = `https://pay.ubq.fi?claim=${encodePermits(permits)}`;
      } catch (e) {
        console.error(e);
      }
    }
    return Promise.resolve(result);
  }

  get enabled(): boolean {
    if (!Value.Check(permitGenerationConfigurationType, this._configuration)) {
      console.warn("Invalid configuration detected for PermitGenerationModule, disabling.");
      return false;
    }
    return this._configuration.enabled;
  }
}
