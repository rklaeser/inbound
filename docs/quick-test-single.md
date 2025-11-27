# Quick Test Single Button Fix

**Date:** 2025-11-25
**Component:** `nextjs-app/components/customer/LeadForm.tsx`

---

## Problem

Individual Quick Test buttons (e.g., "Support", "Quality", "Quality (Apple)") did not include test metadata when submitting leads. As a result, leads submitted via these buttons did not show the "Expected/Got" classification comparison in Dev Mode on the All Leads table.

The "All" button worked correctly because it used a different submission path that included the metadata.

---

## Root Cause

The `fillTestData()` function (lines 81-90) only filled the form fields and triggered `form.handleSubmit()`:

```typescript
const fillTestData = (type: keyof typeof testData) => {
  const testCase = testData[type];
  form.setFieldValue('name', testCase.data.name);
  form.setFieldValue('email', testCase.data.email);
  form.setFieldValue('company', testCase.data.company);
  form.setFieldValue('message', testCase.data.message);

  // Auto-submit after filling fields
  setTimeout(() => form.handleSubmit(), 100);
};
```

The form's `onSubmit` handler (lines 52-78) submitted only the form values without any test metadata:

```typescript
body: JSON.stringify(value),  // No metadata included
```

In contrast, the `runTests()` action (used by the "All" button) explicitly included metadata:

```typescript
body: JSON.stringify({
  ...testCase.data,
  metadata: {
    isTestLead: true,
    testCase: key,
    expectedClassifications: testCase.expectedClassification,
  },
}),
```

---

## Solution

Changed `fillTestData()` to submit directly to the API with test metadata, matching the behavior of `runTests()`:

```typescript
const fillTestData = async (type: keyof typeof testData) => {
  const testCase = testData[type];

  // Fill form fields for visual feedback
  form.setFieldValue('name', testCase.data.name);
  form.setFieldValue('email', testCase.data.email);
  form.setFieldValue('company', testCase.data.company);
  form.setFieldValue('message', testCase.data.message);

  // Submit directly to API with test metadata (same as runTests)
  try {
    const response = await fetch('/api/leads/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testCase.data,
        metadata: {
          isTestLead: true,
          testCase: type,
          expectedClassifications: testCase.expectedClassification,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit test lead');
    }

    onSuccess({
      company: testCase.data.company,
      message: testCase.data.message,
    });

    form.reset();
  } catch (error) {
    console.error('Error submitting test lead:', error);
  }
};
```

---

## Related Files

- `nextjs-app/components/customer/LeadForm.tsx` - Fixed component
- `nextjs-app/actions/run-tests.ts` - Reference implementation (All button)
- `nextjs-app/lib/test-data.ts` - Test case definitions
- `nextjs-app/app/api/leads/submit/route.ts` - API endpoint that accepts metadata
- `nextjs-app/components/dashboard/AllLeads.tsx` - Displays Expected/Got in Dev Mode (lines 301-319)
