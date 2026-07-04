const DEFAULT_FAUCET_URL = "https://ubq-faucet.workers.dev";

export async function prefundWalletWithFaucet(
  address: string,
  faucetBaseUrl: string = process.env.FAUCET_URL ?? DEFAULT_FAUCET_URL,
  fetchImpl: typeof fetch = fetch
) {
  const faucetUrl = new URL("/", faucetBaseUrl);
  faucetUrl.searchParams.set("address", address);

  return fetchImpl(faucetUrl, { method: "POST" });
}
