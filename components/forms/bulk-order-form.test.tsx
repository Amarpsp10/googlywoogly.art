import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkOrderForm } from "./bulk-order-form";

/**
 * Behavioural test for the bulk inquiry form. The Server Action and `sonner` are
 * mocked so we can assert the client behaviour deterministically:
 *  - required fields validate client-side (no action call when invalid),
 *  - a successful submit swaps to the thank-you card with a WhatsApp
 *    "Continue on WhatsApp" deep-link prefilled with the inquiry summary,
 *  - the honeypot is rendered but hidden from assistive tech.
 */

const submitBulkInquiry = vi.fn();
vi.mock("@/app/actions/leads", () => ({
  submitBulkInquiry: (...args: unknown[]) => submitBulkInquiry(...args),
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

const WA_NUMBER = "+91 63678 51899";

beforeEach(() => {
  submitBulkInquiry.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), "Rohan Mehta");
  await user.type(screen.getByLabelText(/phone/i), "9876543210");
  await user.type(screen.getByLabelText(/email/i), "rohan@example.com");
  await user.type(
    screen.getByLabelText(/tell us what you need/i),
    "We need 200 branded Diwali hampers for our team.",
  );
}

describe("BulkOrderForm", () => {
  it("renders a hidden honeypot field named 'website'", () => {
    const { container } = render(<BulkOrderForm whatsappNumber={WA_NUMBER} />);
    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    // It lives inside an aria-hidden wrapper and is removed from the tab order.
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("does not call the action when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<BulkOrderForm whatsappNumber={WA_NUMBER} />);

    await user.click(screen.getByRole("button", { name: /send my inquiry/i }));

    expect(submitBulkInquiry).not.toHaveBeenCalled();
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
  });

  it("shows the thank-you card with a prefilled WhatsApp link on success", async () => {
    submitBulkInquiry.mockResolvedValue({
      ok: true,
      message: "Thanks! We've received your inquiry and will reply within 1 business day.",
    });
    const user = userEvent.setup();
    render(<BulkOrderForm whatsappNumber={WA_NUMBER} />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /send my inquiry/i }));

    // Thank-you heading appears (form is replaced).
    expect(await screen.findByText(/thanks, rohan mehta/i)).toBeInTheDocument();
    expect(submitBulkInquiry).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalled();

    // The Continue-on-WhatsApp link points at wa.me with the digits + summary.
    const waLink = screen.getByRole("link", { name: /continue on whatsapp/i });
    const href = waLink.getAttribute("href") ?? "";
    expect(href).toContain("https://wa.me/916367851899");
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("Name: Rohan Mehta");
    expect(decoded).toContain("bulk / corporate gifting inquiry");
  });

  it("forwards budget as ₹ (FormData 'budget' field) when provided", async () => {
    submitBulkInquiry.mockResolvedValue({ ok: true, message: "ok" });
    const user = userEvent.setup();
    render(<BulkOrderForm whatsappNumber={WA_NUMBER} />);

    await fillRequired(user);
    await user.type(screen.getByLabelText(/budget/i), "50000");
    await user.click(screen.getByRole("button", { name: /send my inquiry/i }));

    await screen.findByText(/thanks, rohan mehta/i);
    const formData = submitBulkInquiry.mock.calls[0][1] as FormData;
    expect(formData.get("budget")).toBe("50000");
  });
});
