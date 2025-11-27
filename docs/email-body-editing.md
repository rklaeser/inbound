# Email Body Editing Simplification

## Problem

Currently, `bot_text.highQualityText` and `bot_text.lowQualityText` store the **full assembled email** including:
- Greeting ("Hi Michael,")
- AI-generated body content
- Call-to-action
- Sign-off ("Best,\nRyan\nryan@vercel.com")

When a user edits an email, they can modify the entire thing - including template parts that should be consistent.

## Proposed Fix

Store only the **AI-generated body content** in `bot_text`, not the full assembled email.

### Changes Required

1. **workflow-services.ts** - Return only `object.body` instead of `fullBody`:
   - `generateEmailForLead()` - line 278-283
   - `generateLowValueEmail()` - line 341-346

2. **Lead detail page** - Assemble full email at display time using template + stored body:
   - Display: `greeting + bot_text + callToAction + signOff`
   - Edit: Only the `bot_text` portion is editable
   - Template parts shown as read-only context

3. **Email sending** - Assemble full email at send time using current template settings

### Benefits

- Users can only edit the personalized content
- Template changes in settings automatically apply to pending emails
- Simpler data model - `bot_text` is just the AI output
- Consistent email structure across all sends
