# Email Editing Logic - Review & Recommendations

This document summarizes findings from a review of the email editing architecture and provides prioritized recommendations for improvement.

## Architecture Overview

### Components Involved
- **RichTextEditor** (`components/ui/rich-text-editor.tsx`) - Tiptap-based editor with auto-save
- **PATCH `/api/leads/[id]/review/edit`** - Persists email edits to Firestore
- **Lead Detail Page** (`app/dashboard/leads/[id]/page.tsx`) - Renders editor for review

### Data Flow
1. Workflow generates email → stored in `lead.email.text`
2. SDR edits in RichTextEditor → debounced auto-save (1.5s)
3. PATCH endpoint updates Firestore with new HTML
4. Real-time listener updates UI

## Identified Issues

### Critical

#### 1. Case Studies Invisible During Edit
**Location:** `lib/email/classification-emails.ts:248-251`

Case studies are appended at **send time**, not stored in `email.text`. SDRs edit one version but a different email gets sent.

**Recommendation:** Include case studies in the stored `email.text` so what SDRs see matches what gets sent. Alternatively, show a preview at approval time.

---

#### 2. Race Condition on Rapid Edits
**Location:** `/api/leads/[id]/review/edit/route.ts`

No conflict detection - simultaneous PATCH requests can overwrite each other:
```
Edit 1 reads v1 → Edit 2 reads v1 → Edit 2 writes v2 → Edit 1 writes v1 (v2 lost!)
```

**Recommendation:** Use Firestore transactions or implement optimistic locking with version numbers.

---

#### 3. No Edit History / Versioning
Edits completely overwrite the previous version. No undo capability exists.

**Recommendation:** Store previous version before overwriting, or implement an edit history array.

---

#### 4. Hardcoded Attribution
**Location:** `route.ts:48`
```typescript
"email.lastEditedBy": "human", // TODO: Get actual user name when auth is added
```

**Recommendation:** Implement authentication to capture actual SDR name for audit trail.

---

### High Priority

#### 5. No HTML Sanitization
**Location:** `/api/leads/[id]/review/edit/route.ts`

Editor accepts any HTML and stores it directly. Potential XSS vector.

**Recommendation:** Sanitize HTML using DOMPurify or similar before storing.

---

#### 6. Reclassify Doesn't Reset Email Metadata
**Location:** `/api/leads/[id]/review/reclassify/route.ts:91-93`

When regenerating an email after reclassification, `lastEditedBy` from the previous version persists, making the timeline misleading.

**Recommendation:** Clear `lastEditedBy` and reset `editedAt` to match `createdAt` when regenerating.

---

### Medium Priority

#### 7. Unsaved Changes Lost on Tab Close
**Location:** `rich-text-editor.tsx:84-92`

Only saves on blur, not `beforeunload`. User can lose edits if they close the tab within the 1.5s debounce window.

**Recommendation:** Add `beforeunload` event handler to flush pending saves, or show unsaved changes warning.

---

#### 8. Confusing Timeline "Edited" Logic
**Location:** `page.tsx:977-980`

The logic for showing "Edited" in the timeline is complex and can be misleading:
```typescript
lead.email.lastEditedBy || (editedAt > createdAt)
```

**Recommendation:** Use an explicit `wasEdited` boolean or `editCount` field for clarity.

---

## Summary Table

| Issue | Severity | Effort | Impact |
|-------|----------|--------|--------|
| Case studies invisible during edit | Critical | Medium | High - SDR sees wrong content |
| Race condition on rapid edits | Critical | Medium | Medium - Data loss possible |
| No edit history | Critical | Medium | Medium - No recovery option |
| Hardcoded attribution | Critical | Low | Low - Audit trail incomplete |
| No HTML sanitization | High | Low | High - Security risk |
| Reclassify metadata reset | High | Low | Low - Misleading timeline |
| Unsaved changes on tab close | Medium | Low | Medium - UX issue |
| Confusing timeline logic | Medium | Low | Low - Minor confusion |

## Recommended Priority Order

1. **HTML sanitization** - Low effort, high security impact
2. **Case studies in stored email** - Ensures WYSIWYG editing
3. **Race condition fix** - Use Firestore transactions
4. **Reclassify metadata reset** - Simple fix, cleaner data
5. **Unsaved changes warning** - Better UX
6. **Edit history** - Enables recovery
7. **Authentication for attribution** - Depends on auth system
8. **Timeline logic cleanup** - Minor improvement
