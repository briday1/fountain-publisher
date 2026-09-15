import { afterEach, expect, it, vi } from "vitest";
import { connectAccount } from "../src/storage/cloud";

afterEach(() => vi.restoreAllMocks());

for (const provider of ["google", "github"] as const) {
  it(`opens ${provider} authorization directly from the initiating tap`, async () => {
    const close = vi.fn();
    const popup = { close, closed: false } as unknown as Window;
    const opened = vi.spyOn(window, "open").mockReturnValue(popup);
    const failure = new Error("draft persistence failed");
    const before = vi.fn().mockRejectedValue(failure);

    const connecting = connectAccount(
      provider,
      before,
      "https://api.fountain-publisher.com/beta/api",
    );

    expect(opened).toHaveBeenCalledOnce();
    const [target, name] = opened.mock.calls[0];
    const url = new URL(String(target));
    expect(url.pathname).toBe(`/beta/api/auth/${provider}/start`);
    expect(url.searchParams.get("returnOrigin")).toBe(location.origin);
    expect(name).toBe("fountain-account");
    expect(before).toHaveBeenCalledOnce();
    await expect(connecting).rejects.toBe(failure);
    expect(close).toHaveBeenCalledOnce();
  });
}
