import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, fail, failValidation } from "@/lib/result";
import { submitBulkInquiry, submitContact } from "./leads";

/**
 * Unit tests for the lead-capture Server Actions. The service layer
 * (`@/lib/services/leads`) is mocked so these tests exercise the action's
 * FormData parsing, optional-field handling, and `ActionResult → LeadFormState`
 * mapping in isolation — without `server-only`/Prisma. The schemas themselves are
 * covered by `lib/validations/leads.test.ts`.
 */

const createBulkInquiry = vi.fn();
const createContactMessage = vi.fn();

// `vi.mock` is hoisted above the imports, so the static `./leads` import below
// already binds to this mocked service (its `server-only`/Prisma never load).
vi.mock("@/lib/services/leads", () => ({
  createBulkInquiry: (input: unknown) => createBulkInquiry(input),
  createContactMessage: (input: unknown) => createContactMessage(input),
}));

// The action now wraps the service with request-security (docs/16): per-IP rate
// limiting + Cloudflare Turnstile. Stub those collaborators so this suite stays
// focused on FormData mapping (rate-limit/turnstile have their own unit tests).
// `server-only` is neutralised (Turnstile module carries it); `next/headers`
// `headers()` has no request scope under Vitest, so it's stubbed too.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true, remaining: 99, retryAfterMs: 0 }),
  clientIp: () => "test-ip",
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: () => Promise.resolve(true),
}));

const EMPTY = { ok: false, message: "" };

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  createBulkInquiry.mockReset();
  createContactMessage.mockReset();
});

describe("submitBulkInquiry", () => {
  it("maps a full form to the service input and returns success", async () => {
    createBulkInquiry.mockResolvedValue(ok({ id: "bi_1" }));

    const state = await submitBulkInquiry(
      EMPTY,
      fd({
        name: "Rohan Mehta",
        company: "Acme Corp",
        phone: "+91 98765 43210",
        email: "rohan@example.com",
        productInterest: "Diwali hampers",
        quantity: "200",
        occasion: "Diwali",
        budget: "50000",
        deadline: "2026-10-01",
        message: "We need 200 branded Diwali hampers.",
        website: "",
      }),
    );

    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/received your inquiry/i);
    // budget is forwarded as `budgetRupees` (₹ → paise happens in the service).
    expect(createBulkInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Rohan Mehta",
        company: "Acme Corp",
        productInterest: "Diwali hampers",
        quantity: "200",
        occasion: "Diwali",
        budgetRupees: "50000",
        deadline: "2026-10-01",
        website: "",
      }),
    );
  });

  it("omits blank optional fields (sends undefined, not empty string)", async () => {
    createBulkInquiry.mockResolvedValue(ok({ id: "bi_2" }));

    await submitBulkInquiry(
      EMPTY,
      fd({
        name: "Meera",
        phone: "9876543210",
        email: "meera@example.com",
        message: "Looking for wedding favors.",
        // all optional fields blank:
        company: "",
        productInterest: "",
        quantity: "",
        occasion: "",
        budget: "",
        deadline: "",
        website: "",
      }),
    );

    const arg = createBulkInquiry.mock.calls[0][0];
    expect(arg.company).toBeUndefined();
    expect(arg.productInterest).toBeUndefined();
    expect(arg.quantity).toBeUndefined();
    expect(arg.occasion).toBeUndefined();
    expect(arg.budgetRupees).toBeUndefined();
    expect(arg.deadline).toBeUndefined();
    // honeypot still forwarded (empty) so the service can check it.
    expect(arg.website).toBe("");
  });

  it("propagates field errors from the service", async () => {
    createBulkInquiry.mockResolvedValue(
      failValidation({ email: ["Enter a valid email address."] }),
    );

    const state = await submitBulkInquiry(
      EMPTY,
      fd({ name: "X", phone: "1", email: "nope", message: "hi", website: "" }),
    );

    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.email).toEqual(["Enter a valid email address."]);
  });

  it("forwards a filled honeypot to the service (which soft-fails)", async () => {
    createBulkInquiry.mockResolvedValue(fail("Your submission could not be processed."));

    const state = await submitBulkInquiry(
      EMPTY,
      fd({
        name: "Bot",
        phone: "9876543210",
        email: "bot@example.com",
        message: "spam spam",
        website: "http://spam.example",
      }),
    );

    expect(createBulkInquiry.mock.calls[0][0].website).toBe("http://spam.example");
    expect(state.ok).toBe(false);
  });
});

describe("submitContact", () => {
  it("maps the form and returns success", async () => {
    createContactMessage.mockResolvedValue(ok({ id: "cm_1" }));

    const state = await submitContact(
      EMPTY,
      fd({
        name: "Aarohi",
        email: "aarohi@example.com",
        phone: "9876543210",
        subject: "Order question",
        message: "When will my order ship?",
        website: "",
      }),
    );

    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/reaching out/i);
    expect(createContactMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Aarohi",
        email: "aarohi@example.com",
        phone: "9876543210",
        subject: "Order question",
        message: "When will my order ship?",
        website: "",
      }),
    );
  });

  it("omits blank optional phone/subject", async () => {
    createContactMessage.mockResolvedValue(ok({ id: "cm_2" }));

    await submitContact(
      EMPTY,
      fd({
        name: "Aarohi",
        email: "aarohi@example.com",
        message: "Hello there team",
        phone: "",
        subject: "",
        website: "",
      }),
    );

    const arg = createContactMessage.mock.calls[0][0];
    expect(arg.phone).toBeUndefined();
    expect(arg.subject).toBeUndefined();
  });

  it("maps a service error to the failure state", async () => {
    createContactMessage.mockResolvedValue(
      failValidation({ message: ["Please add a short message."] }),
    );

    const state = await submitContact(
      EMPTY,
      fd({ name: "A", email: "a@b.com", message: "", website: "" }),
    );

    expect(state.ok).toBe(false);
    expect(state.fieldErrors?.message).toEqual(["Please add a short message."]);
  });
});
