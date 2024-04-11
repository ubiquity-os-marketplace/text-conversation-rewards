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
} from "@ubiquibot/permit-generation";
import configuration from "../configuration/config-reader";
import contentEvaluatorConfig from "../configuration/content-evaluator-config";
import { getOctokitInstance } from "../get-authentication-token";
import { IssueActivity } from "../issue-activity";
import { Module, Result } from "./processor";
import program from "./command-line";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  issue: { id: number };
}

export class PermitGenerationModule implements Module {
  readonly _configuration: PermitGenerationModule = configuration.permitGeneration;
  readonly _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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
    const env = process.env;
    const eventName = context.eventName as SupportedEvents;
    const octokit = getOctokitInstance();
    const logger = {
      debug(message: unknown, optionalParams: unknown) {
        console.log(message, optionalParams);
      },
      error(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      fatal(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      info(message: unknown, optionalParams: unknown) {
        console.log(message, optionalParams);
      },
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
              userId: value.userId,
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
          [
            {
              type: "ERC20",
              userId: value.userId,
              amount: value.total,
              contributionType: "",
            },
          ]
        );
        result[key].permitUrl = `https://pay.ubq.fi?claim=${encodePermits(permits)}`;
      } catch (e) {
        console.error(e);
      }
    }
    return Promise.resolve(result);
  }

  get enabled(): boolean {
    if (!Value.Check(contentEvaluatorConfig, this._configuration)) {
      console.warn("Invalid configuration detected for PermitGenerationModule, disabling.");
      return false;
    }
    return this._configuration.enabled;
  }
}
