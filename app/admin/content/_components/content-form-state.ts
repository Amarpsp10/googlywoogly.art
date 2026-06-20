/**
 * Shared, serialisable form-state shape for the content/settings editors driven
 * by React 19 `useActionState`. Server Actions return this flat object so the
 * client leaves can render field errors + a success toast with a "View live"
 * deep link, without leaking server-only modules into the client bundle.
 */

export interface ContentFormState {
  /** `undefined` before first submit; `true`/`false` after. */
  ok?: boolean;
  /** Toast/banner copy. */
  message?: string;
  /** Per-field server validation errors, keyed by schema field name. */
  fieldErrors?: Record<string, string[]>;
  /** Optional storefront URL to surface as a "View live →" link on success. */
  viewLive?: string;
  /** Bumped each submit so client effects (toast/close) fire even on repeats. */
  ts?: number;
}

export const EMPTY_FORM_STATE: ContentFormState = {};
