import { StaticDecode, Type as T } from "@sinclair/typebox";

/**
 * Configuration for task management platform adapter
 * Allows switching between GitHub, Asana, and other task management systems
 */
export const taskAdapterConfigurationType = T.Object(
  {
    /**
     * The task management platform to use
     * @default "github"
     */
    platform: T.Union([T.Literal("github"), T.Literal("asana"), T.String()], {
      default: "github",
      description: "The task management platform (github, asana, or custom)",
    }),

    /**
     * Asana-specific configuration
     * Only required when platform is set to "asana"
     */
    asana: T.Optional(
      T.Object(
        {
          accessToken: T.String({
            description: "Asana personal access token",
          }),
          workspaceGid: T.String({
            description: "Asana workspace GID",
          }),
          projectGid: T.Optional(
            T.String({
              description: "Asana project GID (optional, for project-scoped operations)",
            })
          ),
        },
        { additionalProperties: false }
      )
    ),

    /**
     * Custom adapter configuration
     * Used when platform is set to a custom adapter name
     */
    customAdapter: T.Optional(
      T.Object(
        {
          adapterName: T.String({
            description: "Name of the custom adapter to use",
          }),
          config: T.Record(T.String(), T.String(), {
            description: "Key-value configuration for the custom adapter",
          }),
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false, default: { platform: "github" } }
);

export type TaskAdapterConfiguration = StaticDecode<typeof taskAdapterConfigurationType>;
