import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./contact-form";

/**
 * Behavioural test for the contact form. The Server Action and `sonner` are
 * mocked. Verifies client-side validation gating, the honeypot, the
 * optional-phone fix (a blank phone must NOT block submit), and the success
 * toast + reset.
 */

const submitContact = vi.fn();
vi.mock("@/app/actions/leads", () => ({
  submitContact: (...args: unknown[]) => submitContact(...args),
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

beforeEach(() => {
  submitContact.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("ContactForm", () => {
  it("renders a hidden honeypot field named 'website'", () => {
    const { container } = render(<ContactForm />);
    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("blocks submit and shows errors when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(submitContact).not.toHaveBeenCalled();
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
  });

  it("submits successfully with a blank optional phone, then resets", async () => {
    submitContact.mockResolvedValue({
      ok: true,
      message: "Thanks for reaching out! We'll get back to you soon.",
    });
    const user = userEvent.setup();
    render(<ContactForm />);

    const name = screen.getByLabelText(/your name/i) as HTMLInputElement;
    await user.type(name, "Aarohi");
    await user.type(screen.getByLabelText(/email/i), "aarohi@example.com");
    // phone intentionally left blank (optional)
    await user.type(
      screen.getByLabelText(/message/i),
      "Hi! When will my order ship?",
    );

    await user.click(screen.getByRole("button", { name: /send message/i }));

    // Action was called despite the empty phone, and success toast fired.
    expect(await vi.waitFor(() => {
      expect(submitContact).toHaveBeenCalledTimes(1);
      return true;
    })).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();

    // FormData forwards an empty phone string (server normalises to null).
    const formData = submitContact.mock.calls[0][1] as FormData;
    expect(formData.get("phone")).toBe("");

    // Form resets on success.
    expect(name.value).toBe("");
  });
});
