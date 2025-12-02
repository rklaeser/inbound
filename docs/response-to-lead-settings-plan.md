# Plan: Response to Lead Settings for Non-High-Quality Classifications

## Summary
Add per-classification "Response to Lead" settings for low-quality, support, and duplicate leads. These will be OFF by default, meaning no customer-facing email is sent. For low-quality leads, display a "Confirm Low Quality" button instead of the email section. For support/duplicate, keep internal forwarding but hide customer email.

## Files to Modify

1. `/nextjs-app/lib/types.ts` - Add `responseToLead` to Configuration interface
2. `/nextjs-app/lib/settings-defaults.ts` - Add default values (all false)
3. `/nextjs-app/app/dashboard/leads/[id]/page.tsx` - Conditional rendering + confirm buttons
4. `/nextjs-app/lib/email/classification-emails.ts` - Add `skipCustomerEmail` option + internal email for duplicate
5. `/nextjs-app/app/api/leads/[id]/review/approve/route.ts` - Conditional email sending
6. `/nextjs-app/app/dashboard/settings/page.tsx` - Add toggle UI in Emails section

---

## Implementation Details

### 1. Configuration Types (`/nextjs-app/lib/types.ts:344-430`)

Add to `Configuration` interface after `experimental`:

```typescript
// Response to lead toggles - when false, no customer email is sent for these classifications
responseToLead: {
  lowQuality: boolean;    // default: false - no generic email to customer
  support: boolean;       // default: false - no acknowledgment to customer (still forwards internally)
  duplicate: boolean;     // default: false - no acknowledgment to customer (still forwards internally)
};
```

### 2. Default Configuration (`/nextjs-app/lib/settings-defaults.ts:53-146`)

Add after `experimental`:

```typescript
responseToLead: {
  lowQuality: false,
  support: false,
  duplicate: false,
},
```

### 3. Lead Detail Page (`/nextjs-app/app/dashboard/leads/[id]/page.tsx`)

**A. Add helper to check if customer email should be shown (~line 196):**

```typescript
const shouldShowCustomerEmail = (): boolean => {
  if (!lead || !configuration) return false;
  const classification = getCurrentClassification(lead);
  if (classification === 'high-quality') return true;
  if (classification === 'low-quality') return configuration.responseToLead?.lowQuality ?? false;
  if (classification === 'support') return configuration.responseToLead?.support ?? false;
  if (classification === 'duplicate') return configuration.responseToLead?.duplicate ?? false;
  return false;
};
```

**B. Update Email section rendering (~line 601-698):**

Replace the condition `{getCurrentClassification(lead) && configuration && (` with logic that:
- For high-quality: Show email section (unchanged)
- For low-quality with response OFF: Show a simple section with "Confirm Low Quality" button
- For support/duplicate with response OFF: Hide customer email section entirely
- For any classification with response ON: Show email section as before

**C. New UI for low-quality without email (~line 601):**

When `classification === 'low-quality' && !shouldShowCustomerEmail()`:
- Show a Section with title "Confirm Classification"
- Display a "Confirm Low Quality" button (gray color to match classification)
- Button calls a new `handleConfirmWithoutEmail()` function

**D. Update button text helper (~line 198-205):**

```typescript
const getReplyButtonText = (): string => {
  if (!lead || !configuration) return 'Reply';
  const classification = getCurrentClassification(lead);

  // When customer email is disabled, just forward internally
  if (classification === 'support' && !configuration.responseToLead?.support) {
    return 'Forward to Support';
  }
  if (classification === 'duplicate' && !configuration.responseToLead?.duplicate) {
    return 'Forward to Account Team';
  }

  // Original logic
  if (classification === 'support' || classification === 'duplicate') {
    return 'Reply & Forward';
  }
  return 'Reply';
};
```

**E. Internal Email section for support/duplicate (~line 720-760):**

When `!shouldShowCustomerEmail()`, move the action button to the Internal Email section instead:
- Replace "Pending" badge with the "Forward to Support/Account Team" button
- This allows approving from the internal email section

### 4. Email Functions (`/nextjs-app/lib/email/classification-emails.ts`)

**A. Add `skipCustomerEmail` option to `sendSupportEmail` (~line 95-162):**

```typescript
export async function sendSupportEmail(
  params: EmailParams & { skipCustomerEmail?: boolean }
): Promise<ClassificationEmailResult> {
  const { lead, config, testModeEmail, skipCustomerEmail } = params;
  // ...
  // Only send customer email if not skipped
  if (!skipCustomerEmail) {
    const result = await sendEmail({ to: lead.submission.email, ... });
    if (!result.success) return { success: false, ... };
  }
  // Always send internal notification
  await sendEmail({ to: config.supportTeam.email, ... });
  // ...
}
```

**B. Add `skipCustomerEmail` option to `sendDuplicateEmail` (~line 170-216):**

Currently `sendDuplicateEmail` only sends customer email. Need to:
1. Add internal notification sending (similar to support)
2. Add `skipCustomerEmail` option

```typescript
export async function sendDuplicateEmail(
  params: EmailParams & { skipCustomerEmail?: boolean }
): Promise<ClassificationEmailResult> {
  const { lead, config, testModeEmail, skipCustomerEmail } = params;
  // ...
  // Only send customer email if not skipped
  if (!skipCustomerEmail) {
    const result = await sendEmail({ to: lead.submission.email, ... });
    if (!result.success) return { success: false, ... };
  }
  // Always send internal notification to account team (using duplicateInternal template)
  const internalTemplate = config.emailTemplates.duplicateInternal;
  await sendEmail({ to: accountTeamEmail, ... });
  // ...
}
```

### 5. Approve API (`/nextjs-app/app/api/leads/[id]/review/approve/route.ts`)

**A. Add helper to check responseToLead settings (~line 33):**

```typescript
const shouldSendCustomerEmail = (classification: string): boolean => {
  if (classification === 'high-quality') return true;
  if (classification === 'low-quality') return config.responseToLead?.lowQuality ?? false;
  if (classification === 'support') return config.responseToLead?.support ?? false;
  if (classification === 'duplicate') return config.responseToLead?.duplicate ?? false;
  return false;
};
```

**B. Modify email sending logic (~line 44-65):**

```typescript
if (currentClassification === "low-quality") {
  if (shouldSendCustomerEmail("low-quality")) {
    const result = await sendLowQualityEmail({ lead, config, testModeEmail });
    emailSent = result.success;
    sentEmailContent = result.sentContent;
  } else {
    // No email sent, but still mark as done
    emailSent = true;
    sentEmailContent = null;
  }
} else if (currentClassification === "support") {
  const skipCustomer = !shouldSendCustomerEmail("support");
  const result = await sendSupportEmail({ lead, config, testModeEmail, skipCustomerEmail: skipCustomer });
  emailSent = result.success;
  sentEmailContent = skipCustomer ? null : result.sentContent;
} else if (currentClassification === "duplicate") {
  const skipCustomer = !shouldSendCustomerEmail("duplicate");
  const result = await sendDuplicateEmail({ lead, config, testModeEmail, skipCustomerEmail: skipCustomer });
  emailSent = result.success;
  sentEmailContent = skipCustomer ? null : result.sentContent;
}
```

### 6. Settings Page (`/nextjs-app/app/dashboard/settings/page.tsx`)

**Note:** The settings page now uses theme-aware Tailwind classes instead of hardcoded colors. Toggle buttons use `bg-info` when active and `bg-secondary` when inactive.

**A. Add state for new toggles (~line 48):**

```typescript
const [responseToLeadLowQuality, setResponseToLeadLowQuality] = useState(false);
const [responseToLeadSupport, setResponseToLeadSupport] = useState(false);
const [responseToLeadDuplicate, setResponseToLeadDuplicate] = useState(false);
```

**B. Load from config (~line 103):**

```typescript
setResponseToLeadLowQuality(data.configuration.responseToLead?.lowQuality ?? false);
setResponseToLeadSupport(data.configuration.responseToLead?.support ?? false);
setResponseToLeadDuplicate(data.configuration.responseToLead?.duplicate ?? false);
```

**C. Save to config (~line 154):**

```typescript
responseToLead: {
  lowQuality: responseToLeadLowQuality,
  support: responseToLeadSupport,
  duplicate: responseToLeadDuplicate,
},
```

**D. Add new Settings Card in Emails section (~line 386):**

Add before or after "Experimental Features" card. Use theme-aware toggle pattern:

```tsx
<SettingsCard
  title="Response to Lead"
  description="Control whether customer-facing emails are sent for each classification type. Internal forwarding still occurs for support and duplicate leads."
>
  <div className="space-y-4">
    {/* Low Quality Toggle */}
    <div className="flex items-center justify-between">
      <div>
        <label className="block text-xs font-medium text-foreground">
          Low Quality Response
        </label>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[400px]">
          Send generic sales email to low-quality leads
        </p>
      </div>
      <button
        onClick={() => setResponseToLeadLowQuality(!responseToLeadLowQuality)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${responseToLeadLowQuality ? 'bg-info' : 'bg-secondary'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${responseToLeadLowQuality ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
    {/* Support Toggle */}
    <div className="flex items-center justify-between">
      <div>
        <label className="block text-xs font-medium text-foreground">
          Support Acknowledgment
        </label>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[400px]">
          Send acknowledgment email to support leads (internal forward always sent)
        </p>
      </div>
      <button
        onClick={() => setResponseToLeadSupport(!responseToLeadSupport)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${responseToLeadSupport ? 'bg-info' : 'bg-secondary'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${responseToLeadSupport ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
    {/* Duplicate Toggle */}
    <div className="flex items-center justify-between">
      <div>
        <label className="block text-xs font-medium text-foreground">
          Duplicate Acknowledgment
        </label>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[400px]">
          Send acknowledgment email to duplicate leads (internal forward always sent)
        </p>
      </div>
      <button
        onClick={() => setResponseToLeadDuplicate(!responseToLeadDuplicate)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${responseToLeadDuplicate ? 'bg-info' : 'bg-secondary'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${responseToLeadDuplicate ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  </div>
</SettingsCard>
```

**Note on Emails Section Structure:**
- Auto-send thresholds have been moved from Classification to Emails section
- Low Quality Email card now includes the auto-send threshold slider
- Support Email card now includes the auto-forward threshold slider
- High-quality auto-send controls have been removed from the UI

---

## UI Behavior Summary

| Classification | Response Setting | Customer Email Section | Internal Email Section | Action Button |
|---------------|------------------|------------------------|------------------------|---------------|
| high-quality | N/A (always on) | Shown | N/A | "Reply" |
| low-quality | OFF (default) | Hidden | N/A | "Confirm Low Quality" |
| low-quality | ON | Shown | N/A | "Reply" |
| support | OFF (default) | Hidden | Shown + button | "Forward to Support" |
| support | ON | Shown | Shown | "Reply & Forward" |
| duplicate | OFF (default) | Hidden | Shown + button | "Forward to Account Team" |
| duplicate | ON | Shown | Shown | "Reply & Forward" |
