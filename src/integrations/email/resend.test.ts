import { afterEach, describe, expect, test, vi } from "vitest";
import { authCodeEmail, changeEmailCodeEmail, createResendSender } from "./resend";

const config = { apiKey: "re_synthetic_key_not_real", from: "Neffi <auth@example.test>" };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Resend sender", () => {
  test("notification mail supplies reply-to and a stable idempotency key", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    await createResendSender(config)({ to: "owner@example.test", subject: "Message", text: "Body", replyTo: "visitor@example.test", idempotencyKey: "form-submission-synthetic" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("form-submission-synthetic");
    expect(JSON.parse(init.body as string).reply_to).toEqual(["visitor@example.test"]);
  });
  test("posts plain-text mail with bearer auth and a fresh idempotency key per send", async () => {
    const fetchMock = stubFetch(new Response('{"id":"x"}', { status: 200 }));
    const send = createResendSender(config);
    await send({ to: "person@example.test", subject: "Hi", text: "Body" });
    await send({ to: "person@example.test", subject: "Hi", text: "Body" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${config.apiKey}`);
    expect(JSON.parse(init.body as string)).toEqual({
      from: config.from,
      to: ["person@example.test"],
      subject: "Hi",
      text: "Body",
    });

    const keys = fetchMock.mock.calls.map((call) => ((call as unknown as [string, RequestInit])[1].headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  test("a delivery failure leaks neither the provider response nor the message", async () => {
    stubFetch(new Response('{"message":"invalid to person@example.test key re_synthetic_key_not_real"}', { status: 422 }));
    const send = createResendSender(config);
    const error = await send({ to: "person@example.test", subject: "Code", text: "123456" }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Email delivery failed");
    expect(String((error as Error).stack)).not.toMatch(/123456|person@example\.test|re_synthetic/);
  });

  test("a network failure is reported the same generic way", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connect ECONNREFUSED 10.0.0.1"); }));
    const send = createResendSender(config);
    await expect(send({ to: "a@example.test", subject: "s", text: "t" })).rejects.toThrow("Email delivery failed");
  });
});

describe("auth code email", () => {
  test("email change explains the new sign-in address, expiry and single use without links", () => {
    const mail = changeEmailCodeEmail("482913", 5);
    expect(mail.subject).toBe("Confirm your new Neffi sign-in email");
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("use this address for signing in");
    expect(mail.text).toContain("5 minutes and works once");
    expect(mail.text).not.toMatch(/https?:\/\//);
  });
  test("states the code and its lifetime, with no links", () => {
    const mail = authCodeEmail("482913", 5);
    expect(mail.subject).toBe("Your Neffi sign-in code");
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("5 minutes");
    expect(mail.text).not.toMatch(/https?:\/\//);
  });
});
