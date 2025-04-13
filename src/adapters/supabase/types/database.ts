export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      access: {
        Row: {
          created: string;
          id: number;
          labels: Json | null;
          location_id: number | null;
          multiplier: number;
          multiplier_reason: string | null;
          updated: string | null;
          user_id: number;
        };
        Insert: {
          created?: string;
          id?: number;
          labels?: Json | null;
          location_id?: number | null;
          multiplier?: number;
          multiplier_reason?: string | null;
          updated?: string | null;
          user_id: number;
        };
        Update: {
          created?: string;
          id?: number;
          labels?: Json | null;
          location_id?: number | null;
          multiplier?: number;
          multiplier_reason?: string | null;
          updated?: string | null;
          user_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "access_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_access_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_access_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      credits: {
        Row: {
          amount: number;
          created: string;
          id: number;
          location_id: number | null;
          permit_id: number | null;
          updated: string | null;
        };
        Insert: {
          amount: number;
          created?: string;
          id?: number;
          location_id?: number | null;
          permit_id?: number | null;
          updated?: string | null;
        };
        Update: {
          amount?: number;
          created?: string;
          id?: number;
          location_id?: number | null;
          permit_id?: number | null;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credits_permit_id_fkey";
            columns: ["permit_id"];
            isOneToOne: false;
            referencedRelation: "permits";
            referencedColumns: ["id"];
          },
        ];
      };
      debits: {
        Row: {
          amount: number;
          created: string;
          id: number;
          location_id: number | null;
          token_id: number | null;
          updated: string | null;
        };
        Insert: {
          amount: number;
          created?: string;
          id?: number;
          location_id?: number | null;
          token_id?: number | null;
          updated?: string | null;
        };
        Update: {
          amount?: number;
          created?: string;
          id?: number;
          location_id?: number | null;
          token_id?: number | null;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "debits_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "tokens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_debits_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_debits_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      labels: {
        Row: {
          authorized: boolean | null;
          created: string;
          id: number;
          label_from: string | null;
          label_to: string | null;
          location_id: number | null;
          updated: string | null;
        };
        Insert: {
          authorized?: boolean | null;
          created?: string;
          id?: number;
          label_from?: string | null;
          label_to?: string | null;
          location_id?: number | null;
          updated?: string | null;
        };
        Update: {
          authorized?: boolean | null;
          created?: string;
          id?: number;
          label_from?: string | null;
          label_to?: string | null;
          location_id?: number | null;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "labels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "labels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          comment_id: number | null;
          created: string;
          id: number;
          issue_id: number | null;
          node_id: string | null;
          node_type: string | null;
          node_url: string | null;
          organization_id: number | null;
          repository_id: number | null;
          updated: string | null;
          user_id: number | null;
        };
        Insert: {
          comment_id?: number | null;
          created?: string;
          id?: number;
          issue_id?: number | null;
          node_id?: string | null;
          node_type?: string | null;
          node_url?: string | null;
          organization_id?: number | null;
          repository_id?: number | null;
          updated?: string | null;
          user_id?: number | null;
        };
        Update: {
          comment_id?: number | null;
          created?: string;
          id?: number;
          issue_id?: number | null;
          node_id?: string | null;
          node_type?: string | null;
          node_url?: string | null;
          organization_id?: number | null;
          repository_id?: number | null;
          updated?: string | null;
          user_id?: number | null;
        };
        Relationships: [];
      };
      logs: {
        Row: {
          created: string;
          id: number;
          level: string | null;
          location_id: number | null;
          log: string;
          metadata: Json | null;
          updated: string | null;
        };
        Insert: {
          created?: string;
          id?: number;
          level?: string | null;
          location_id?: number | null;
          log: string;
          metadata?: Json | null;
          updated?: string | null;
        };
        Update: {
          created?: string;
          id?: number;
          level?: string | null;
          location_id?: number | null;
          log?: string;
          metadata?: Json | null;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_logs_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_logs_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      partners: {
        Row: {
          created: string;
          id: number;
          location_id: number | null;
          updated: string | null;
          wallet_id: number | null;
        };
        Insert: {
          created?: string;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
          wallet_id?: number | null;
        };
        Update: {
          created?: string;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
          wallet_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_partners_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_partners_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partners_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: true;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      permits: {
        Row: {
          amount: string;
          beneficiary_id: number;
          created: string;
          deadline: string;
          id: number;
          location_id: number | null;
          nonce: string;
          partner_id: number | null;
          signature: string;
          token_id: number | null;
          transaction: string | null;
          updated: string | null;
        };
        Insert: {
          amount: string;
          beneficiary_id: number;
          created?: string;
          deadline: string;
          id?: number;
          location_id?: number | null;
          nonce: string;
          partner_id?: number | null;
          signature: string;
          token_id?: number | null;
          transaction?: string | null;
          updated?: string | null;
        };
        Update: {
          amount?: string;
          beneficiary_id?: number;
          created?: string;
          deadline?: string;
          id?: number;
          location_id?: number | null;
          nonce?: string;
          partner_id?: number | null;
          signature?: string;
          token_id?: number | null;
          transaction?: string | null;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_permits_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_permits_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permits_beneficiary_id_fkey";
            columns: ["beneficiary_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permits_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permits_token_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "tokens";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          created: string;
          credit_id: number | null;
          debit_id: number | null;
          id: number;
          location_id: number | null;
          updated: string | null;
          user_id: number;
        };
        Insert: {
          created?: string;
          credit_id?: number | null;
          debit_id?: number | null;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
          user_id: number;
        };
        Update: {
          created?: string;
          credit_id?: number | null;
          debit_id?: number | null;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
          user_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fk_settlements_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_settlements_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_credit_id_fkey";
            columns: ["credit_id"];
            isOneToOne: false;
            referencedRelation: "credits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_debit_id_fkey";
            columns: ["debit_id"];
            isOneToOne: false;
            referencedRelation: "debits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tokens: {
        Row: {
          address: string;
          created: string;
          id: number;
          location_id: number | null;
          network: number;
          updated: string | null;
        };
        Insert: {
          address: string;
          created?: string;
          id?: number;
          location_id?: number | null;
          network?: number;
          updated?: string | null;
        };
        Update: {
          address?: string;
          created?: string;
          id?: number;
          location_id?: number | null;
          network?: number;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tokens_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tokens_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created: string;
          id: number;
          location_id: number | null;
          updated: string | null;
          wallet_id: number | null;
        };
        Insert: {
          created?: string;
          id: number;
          location_id?: number | null;
          updated?: string | null;
          wallet_id?: number | null;
        };
        Update: {
          created?: string;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
          wallet_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "users_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "users_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          address: string | null;
          created: string;
          id: number;
          location_id: number | null;
          updated: string | null;
        };
        Insert: {
          address?: string | null;
          created?: string;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
        };
        Update: {
          address?: string | null;
          created?: string;
          id?: number;
          location_id?: number | null;
          updated?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "issues_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallets_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      issues_view: {
        Row: {
          comment_id: number | null;
          created: string | null;
          id: number | null;
          issue_id: number | null;
          node_id: string | null;
          node_type: string | null;
          node_url: string | null;
          organization_id: number | null;
          repository_id: number | null;
          updated: string | null;
          user_id: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      insert_with_exception_handling: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      read_secret: {
        Args: {
          secret_name: string;
        };
        Returns: string;
      };
    };
    Enums: {
      github_node_type:
        | "App"
        | "Bot"
        | "CheckRun"
        | "CheckSuite"
        | "ClosedEvent"
        | "CodeOfConduct"
        | "Commit"
        | "CommitComment"
        | "CommitContributionsByRepository"
        | "ContributingGuidelines"
        | "ConvertToDraftEvent"
        | "CreatedCommitContribution"
        | "CreatedIssueContribution"
        | "CreatedPullRequestContribution"
        | "CreatedPullRequestReviewContribution"
        | "CreatedRepositoryContribution"
        | "CrossReferencedEvent"
        | "Discussion"
        | "DiscussionComment"
        | "Enterprise"
        | "EnterpriseUserAccount"
        | "FundingLink"
        | "Gist"
        | "Issue"
        | "IssueComment"
        | "JoinedGitHubContribution"
        | "Label"
        | "License"
        | "Mannequin"
        | "MarketplaceCategory"
        | "MarketplaceListing"
        | "MergeQueue"
        | "MergedEvent"
        | "MigrationSource"
        | "Milestone"
        | "Organization"
        | "PackageFile"
        | "Project"
        | "ProjectCard"
        | "ProjectColumn"
        | "ProjectV2"
        | "PullRequest"
        | "PullRequestCommit"
        | "PullRequestReview"
        | "PullRequestReviewComment"
        | "ReadyForReviewEvent"
        | "Release"
        | "ReleaseAsset"
        | "Repository"
        | "RepositoryContactLink"
        | "RepositoryTopic"
        | "RestrictedContribution"
        | "ReviewDismissedEvent"
        | "SecurityAdvisoryReference"
        | "SocialAccount"
        | "SponsorsListing"
        | "Team"
        | "TeamDiscussion"
        | "TeamDiscussionComment"
        | "User"
        | "Workflow"
        | "WorkflowRun"
        | "WorkflowRunFile";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string;
          name: string;
          owner: string;
          metadata: Json;
        };
        Returns: undefined;
      };
      extension: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      filename: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      foldername: {
        Args: {
          name: string;
        };
        Returns: string[];
      };
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>;
        Returns: {
          size: number;
          bucket_id: string;
        }[];
      };
      search: {
        Args: {
          prefix: string;
          bucketname: string;
          limits?: number;
          levels?: number;
          offsets?: number;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          name: string;
          id: string;
          updated_at: string;
          created_at: string;
          last_accessed_at: string;
          metadata: Json;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

/** @public */
export type Tables<
  PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]) | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    ? (PublicSchema["Tables"] & PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

/** @public */
export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

/** @public */
export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

/** @public */
export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
