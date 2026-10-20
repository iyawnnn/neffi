import { afterEach, describe, expect, test, vi } from "vitest";
import { renderEmail } from "./layout";
import { authCodeEmail, changeEmailCodeEmail, createResendSender } from "./resend";

const config = { apiKey: "re_synthetic_key_not_real", from: "Neffi <auth@example.test>", origin: "https://app.example.test" };
const message = { subject: "Hi", heading: "Hello", paragraphs: ["Body"] };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Resend sender", () => {
  test("notification mail supplies reply-to and a stable idempotency key", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    await createResendSender(config)({ to: "owner@example.test", ...message, replyTo: "visitor@example.test", idempotencyKey: "form-submission-synthetic" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("form-submission-synthetic");
    expect(JSON.parse(init.body as string).reply_to).toEqual(["visitor@example.test"]);
  });
  test("posts HTML with a plain-text alternative, bearer auth and a fresh idempotency key per send", async () => {
    const fetchMock = stubFetch(new Response('{"id":"x"}', { status: 200 }));
    const send = createResendSender(config);
    await send({ to: "person@example.test", ...message });
    await send({ to: "person@example.test", ...message });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${config.apiKey}`);
    expect(JSON.parse(init.body as string)).toEqual({
      from: config.from,
      to: ["person@example.test"],
      ...renderEmail(message, config.origin),
    });

    const keys = fetchMock.mock.calls.map((call) => ((call as unknown as [string, RequestInit])[1].headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  test("a delivery failure leaks neither the provider response nor the message", async () => {
    stubFetch(new Response('{"message":"invalid to person@example.test key re_synthetic_key_not_real"}', { status: 422 }));
    const send = createResendSender(config);
    const error = await send({ to: "person@example.test", ...message, subject: "Code", code: "123456" }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Email delivery failed");
    expect(String((error as Error).stack)).not.toMatch(/123456|person@example\.test|re_synthetic/);
  });

  test("a network failure is reported the same generic way", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connect ECONNREFUSED 10.0.0.1"); }));
    const send = createResendSender(config);
    await expect(send({ to: "a@example.test", ...message })).rejects.toThrow("Email delivery failed");
  });
});

describe("auth code email", () => {
  test("email change explains the new sign-in address, expiry and single use without links", () => {
    const mail = renderEmail(changeEmailCodeEmail("482913", 5), config.origin);
    expect(mail.subject).toBe("Confirm your new Neffi email");
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("start signing in with this address");
    expect(mail.text).toContain("5 minutes and works once");
    expect(mail.text.replace(config.origin, "")).not.toMatch(/https?:\/\//);
  });
  test("states the code and its lifetime, with no links beyond support", () => {
    const mail = renderEmail(authCodeEmail("482913", 5), config.origin);
    expect(mail.subject).toBe("Your Neffi sign-in code");
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("5 minutes");
    expect(mail.text.match(/https?:\/\/\S+/g)).toEqual([`${config.origin}/support`]);
  });
});
