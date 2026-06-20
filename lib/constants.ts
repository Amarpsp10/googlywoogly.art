/**
 * Shared domain constants & labels. Status → label/tone maps return a *semantic*
 * tone (not a raw color) so the UI maps tones onto the existing theme tokens —
 * never hard-code brand colors here.
 */
import type {
  OrderStatus,
  PaymentStatus,
  InquiryStatus,
  ContactStatus,
  ReviewStatus,
} from "@prisma/client";
import type { InventoryState } from "./inventory";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  pending_confirmation: { label: "Pending confirmation", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "info" },
  in_production: { label: "In production", tone: "info" },
  ready_to_ship: { label: "Ready to ship", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  on_hold: { label: "On hold", tone: "warning" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  awaiting_payment: { label: "Awaiting payment", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  partially_paid: { label: "Partially paid", tone: "warning" },
  refunded: { label: "Refunded", tone: "danger" },
};

export const INVENTORY_STATE: Record<InventoryState, StatusMeta> = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
  made_to_order: { label: "Made to order", tone: "info" },
};

export const INQUIRY_STATUS: Record<InquiryStatus, StatusMeta> = {
  new: { label: "New", tone: "info" },
  contacted: { label: "Contacted", tone: "neutral" },
  quoted: { label: "Quoted", tone: "info" },
  won: { label: "Won", tone: "success" },
  lost: { label: "Lost", tone: "danger" },
  closed: { label: "Closed", tone: "neutral" },
};

export const CONTACT_STATUS: Record<ContactStatus, StatusMeta> = {
  new: { label: "New", tone: "info" },
  read: { label: "Read", tone: "neutral" },
  replied: { label: "Replied", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export const REVIEW_STATUS: Record<ReviewStatus, StatusMeta> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

/**
 * Allowed fulfillment-status transitions (CANON §7 state machine). Terminal
 * states (`delivered`, `cancelled`) have no outgoing edges.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ["confirmed", "cancelled", "on_hold"],
  confirmed: ["in_production", "ready_to_ship", "on_hold", "cancelled"],
  in_production: ["ready_to_ship", "on_hold", "cancelled"],
  ready_to_ship: ["shipped", "on_hold", "cancelled"],
  shipped: ["delivered"],
  on_hold: ["confirmed", "in_production", "ready_to_ship", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Occasions used for collections, filtering, and SEO (CANON §11). */
export const OCCASIONS = [
  "Diwali",
  "Raksha Bandhan",
  "Holi",
  "Karwa Chauth",
  "Wedding",
  "Anniversary",
  "Birthday",
  "Housewarming",
  "Corporate Gifting",
] as const;

/** Indian States & Union Territories for address forms. */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;
