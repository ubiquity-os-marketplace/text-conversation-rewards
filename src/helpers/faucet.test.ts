import { prefundWalletWithFaucet } from "./faucet";

describe("prefundWalletWithFaucet", () => {
  it("posts the beneficiary address to the faucet worker", async () => {
    const fetchMock = jest.fn().mockResolvedValue({} as Response);

    await prefundWalletWithFaucet("0xabc123", "https://example.test", fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBeInstanceOf(URL);
    expect(url.toString()).toBe("https://example.test/?address=0xabc123");
    expect(init).toEqual({ method: "POST" });
  });
});
