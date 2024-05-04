declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN: string;
      OPENAI_API_KEY: string;
      X25519_PRIVATE_KEY: string;
      SUPABASE_KEY: string;
      SUPABASE_URL: string;
      NFT_CONTRACT_ADDRESS: string;
      NFT_MINTER_PRIVATE_KEY: string;
      UBIQUIBOT_APP_ID: string;
      UBIQUIBOT_APP_PRIVATE_KEY: string;
    }
  }
}

export {};
