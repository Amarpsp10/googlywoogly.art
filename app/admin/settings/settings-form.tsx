"use client";

import * as React from "react";
import { FormField, AdminInput, AdminTextarea } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { Panel } from "@/components/admin/panel";
import { INDIAN_STATES } from "@/lib/constants";
import {
  ActionForm,
  useFieldError,
} from "../content/_components/action-form";
import { SwitchField } from "../content/_components/switch-field";
import { updateSiteSettings } from "./actions";

/**
 * `SettingsForm` — the single sectioned `SiteSetting` editor (doc 15 §4.7). All
 * fields post in one form; the Server Action assembles the nested JSON blocks,
 * validates (WhatsApp, GSTIN, `%s` template, money ≥ 0), and saves the singleton.
 * Money inputs are entered in ₹ and persisted as paise.
 */

export interface SettingsFormData {
  storeName: string;
  contactEmail: string;
  whatsappNumber: string;
  logoId?: string;
  gstin?: string;
  social: { instagram?: string; facebook?: string; pinterest?: string; youtube?: string; whatsapp?: string };
  shipping: { flatRateRupees: string; freeShipRupees: string; codEnabled: boolean };
  seo: { titleTemplate?: string; defaultDescription?: string; ogImageId?: string; twitterHandle?: string };
  announcement: { enabled: boolean; text: string; href?: string };
  address: { legalName?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
}

/** Bound text field for the settings form. */
function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  const error = useFieldError(name);
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <AdminInput
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
      />
    </FormField>
  );
}

export function SettingsForm({ data }: { data: SettingsFormData }) {
  return (
    <ActionForm action={updateSiteSettings} successToast="Settings saved.">
      <div className="space-y-4">
        {/* Store & Brand */}
        <Panel title="Store & Brand" description="Drives the footer, structured data, and invoices.">
          <div className="space-y-4">
            <Field name="storeName" label="Store name" defaultValue={data.storeName} required />
            <Field name="logoId" label="Logo media ID" defaultValue={data.logoId} hint="A MediaAsset id for your logo." />
            <Field name="legalName" label="Legal name" defaultValue={data.address.legalName} hint="Used on invoices and the Organization schema." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="addressLine1" label="Address line 1" defaultValue={data.address.line1} />
              <Field name="addressLine2" label="Address line 2" defaultValue={data.address.line2} />
              <Field name="city" label="City" defaultValue={data.address.city} />
              <StateField defaultValue={data.address.state} />
              <Field name="pincode" label="Pincode" defaultValue={data.address.pincode} />
            </div>
          </div>
        </Panel>

        {/* Contact & Social */}
        <Panel title="Contact & Social" description="Drives WhatsApp links, the footer, and Organization schema.">
          <div className="space-y-4">
            <Field name="contactEmail" label="Contact email" defaultValue={data.contactEmail} required type="email" />
            <Field
              name="whatsappNumber"
              label="WhatsApp number"
              defaultValue={data.whatsappNumber}
              required
              placeholder="9876543210"
              hint="10-digit Indian mobile. Powers every wa.me link — an invalid number blocks saving."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="instagram" label="Instagram URL" defaultValue={data.social.instagram} placeholder="https://instagram.com/…" />
              <Field name="facebook" label="Facebook URL" defaultValue={data.social.facebook} placeholder="https://facebook.com/…" />
              <Field name="pinterest" label="Pinterest URL" defaultValue={data.social.pinterest} placeholder="https://pinterest.com/…" />
              <Field name="youtube" label="YouTube URL" defaultValue={data.social.youtube} placeholder="https://youtube.com/…" />
            </div>
          </div>
        </Panel>

        {/* Shipping */}
        <Panel title="Shipping" description="Drives cart, checkout, and the trust strip. Amounts in ₹.">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="flatRate" label="Flat shipping rate (₹)" defaultValue={data.shipping.flatRateRupees} type="text" placeholder="49" />
              <Field name="freeShippingThreshold" label="Free shipping over (₹)" defaultValue={data.shipping.freeShipRupees} type="text" placeholder="1500" />
            </div>
            <SwitchField name="codEnabled" label="Cash on delivery" description="Allow COD at checkout." defaultChecked={data.shipping.codEnabled} />
          </div>
        </Panel>

        {/* Tax / Legal */}
        <Panel title="Tax / Legal" description="Setting a GSTIN turns on GST on new invoices.">
          <Field
            name="gstin"
            label="GSTIN"
            defaultValue={data.gstin}
            placeholder="22AAAAA0000A1Z5"
            hint="15-character GSTIN. Leave blank to keep GST off."
          />
        </Panel>

        {/* SEO Defaults */}
        <Panel title="SEO Defaults" description="Root metadata fallback for pages without their own.">
          <div className="space-y-4">
            <Field
              name="titleTemplate"
              label="Title template"
              defaultValue={data.seo.titleTemplate}
              placeholder="%s · GooglyWoogly Art"
              hint='Must contain "%s" (the page title slot).'
            />
            <SeoDescriptionField defaultValue={data.seo.defaultDescription} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="ogImageId" label="OG image media ID" defaultValue={data.seo.ogImageId} />
              <Field name="twitterHandle" label="Twitter/X handle" defaultValue={data.seo.twitterHandle} placeholder="@googlywoogly" />
            </div>
          </div>
        </Panel>

        {/* Announcement Bar */}
        <Panel title="Announcement Bar" description="A thin strip shown at the top of your store pages. (The home page's scrolling marquee is separate — manage it under Content → Banners.)">
          <div className="space-y-4">
            <SwitchField name="announcementEnabled" label="Enabled" defaultChecked={data.announcement.enabled} />
            <Field name="announcementText" label="Text" defaultValue={data.announcement.text} placeholder="Free shipping over ₹1500 ✦ Handmade in Jaipur" />
            <Field name="announcementHref" label="Link" defaultValue={data.announcement.href} placeholder="/collections/bestsellers" hint="Optional path or https URL." />
          </div>
        </Panel>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-2 flex justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

function StateField({ defaultValue }: { defaultValue?: string }) {
  const error = useFieldError("state");
  return (
    <FormField label="State" error={error}>
      <select
        name="state"
        defaultValue={defaultValue ?? ""}
        className="h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      >
        <option value="">Select a state</option>
        {INDIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function SeoDescriptionField({ defaultValue }: { defaultValue?: string }) {
  const error = useFieldError("defaultDescription");
  const [value, setValue] = React.useState(defaultValue ?? "");
  return (
    <FormField label="Default description" error={error} hint={`${value.length}/300 characters.`}>
      <AdminTextarea
        name="defaultDescription"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={300}
      />
    </FormField>
  );
}
