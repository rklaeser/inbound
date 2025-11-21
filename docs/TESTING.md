# Testing Guide

## Overview

This document describes the in-app testing system for validating lead classification logic. The test system submits predefined test cases as leads and validates their classifications against expected results.

## Test System Architecture

### How It Works

1. **Test Data**: Predefined test cases in `app/components/customer/LeadForm.tsx` with expected classifications
2. **Auto-Submit**: Test leads are submitted via the normal form submission API
3. **Real Workflow**: Leads are processed through the actual workflow with real API calls
4. **Visual Results**: Pass/fail indicators appear in the leads table in developer mode

### Running Tests

1. Navigate to the lead form in **developer mode**
2. Ensure you have the desired configuration active
3. Click individual test buttons or the **"All"** button to submit test leads
4. Test leads will appear in the dashboard and be processed through the workflow
5. Review results in the leads table with ✅/❌ indicators as they complete

## Quick Fill Auto-Submit

In developer mode, all quick fill buttons automatically submit the form after populating fields. No need to click "Talk to Vercel" - just click a quick fill button and the lead is submitted immediately.

## Test Cases

### Expected Classifications

| Test Case | Expected Classification | Reasoning |
|-----------|------------------------|-----------|
| **Support Request** | `support` | Clear support request about password reset |
| **Fake Company** | `low-value` or `uncertain` | Non-existent company fails research verification |
| **Quality Lead** | `quality` | Legitimate company, high-value opportunity, clear intent, budget mentioned |
| **Weak Lead** | `low-value` | Fake company, low-effort message, no clear intent |
| **Duplicate Customer** | `duplicate` | Stripe exists in CRM database |
| **Apple COO (Quality)** | `quality` | High-profile company, C-level executive, enterprise-scale need |
| **Apple Researcher (Weak)** | `low-value` or `uncertain` | Personal/side project, not official business need |
| **Apple Employee (Ambiguous)** | `uncertain` | Vague role/identity, triggers AMBIGUOUS IDENTITY rules |

### Test Data Details

#### Support Request
```typescript
{
  name: 'Sarah Johnson',
  email: 'sarah.johnson@notion.so',
  company: 'Notion',
  message: 'I need help resetting my password and accessing my account...'
}
```
**Expected**: `support`
**Why**: Clear support request with no sales intent

---

#### Fake Company
```typescript
{
  name: 'John Doe',
  email: 'john.doe@nonexistentcompany123.com',
  company: 'NonExistent Corp',
  message: 'We are looking for enterprise deployment solutions...'
}
```
**Expected**: `low-value` or `uncertain`
**Why**: Company verification fails, no web presence. Per classification rules: "If a company has no web presence or appears fake → never classify as 'quality'"

---

#### Quality Lead
```typescript
{
  name: 'Jennifer Martinez',
  email: 'jennifer.martinez@shopify.com',
  company: 'Shopify',
  message: 'Our company is looking to implement an enterprise solution... Budget approved for $250K+ annually...'
}
```
**Expected**: `quality`
**Why**: Real company, high-value opportunity ($250K+), clear intent, executive involvement, specific needs

---

#### Weak Lead
```typescript
{
  name: 'Bob Smith',
  email: 'bob@fakecorp12345.com',
  company: 'FakeCorp12345 Ltd',
  message: 'Just checking out your product. Maybe interested.'
}
```
**Expected**: `low-value`
**Why**: Fake company, minimal effort message, no clear intent or buying signals

---

#### Duplicate Customer
```typescript
{
  name: 'Jessica Brown',
  email: 'jessica.brown@stripe.com',
  company: 'Stripe',
  message: 'We\'d like to expand our usage to include our European offices...'
}
```
**Expected**: `duplicate`
**Why**: Stripe exists in CRM database. Duplicate classification overrides all other classifications.

---

#### Apple COO (Quality)
```typescript
{
  name: 'Sabih Khan',
  email: 'sabih.khan@apple.com',
  company: 'Apple',
  message: 'I\'m the COO at Apple and we\'re exploring enterprise deployment solutions...'
}
```
**Expected**: `quality`
**Why**: High-profile company, C-level executive (COO), enterprise-scale need, clear business value. Should pass identity verification.

---

#### Apple Researcher (Weak)
```typescript
{
  name: 'Mattia Muller',
  email: 'mattia.muller@apple.com',
  company: 'Apple',
  message: 'I\'m a researcher at Apple working on a small project. Just exploring some options for a personal side project.'
}
```
**Expected**: `low-value` or `uncertain`
**Why**: Personal/side project (not official business need), low buying intent. Even though from Apple, the use case is weak.

---

#### Apple Employee (Ambiguous)
```typescript
{
  name: 'Michael Wu',
  email: 'michael.wu@apple.com',
  company: 'Apple',
  message: 'We\'re interested in learning more about your platform for potential use at Apple...'
}
```
**Expected**: `uncertain`
**Why**: Message sounds legitimate but identity/role is vague. Likely triggers "AMBIGUOUS IDENTITY" in research (multiple Michael Wu at Apple), which forces `uncertain` classification per the rules.

## Classification Logic

### Classification Categories
- `quality` - High-value leads from verified companies with clear intent
- `support` - Support requests, not sales opportunities
- `low-value` - Spam, fake companies, low-effort inquiries
- `uncertain` - Ambiguous identity, unclear intent, needs human review
- `duplicate` - Existing customers (found in CRM)
- `dead` - No response, bounced emails, etc.

### Decision Rules

1. **Duplicate Detection (Highest Priority)**
   - If CRM search finds matching customer → always `duplicate`
   - Overrides all other classifications

2. **Company Verification**
   - No web presence → never `quality`, classify as `uncertain` or `low-value`
   - Fake/non-existent companies:
     - Spam/low-effort → `low-value` (confidence 0.6-0.8)
     - Legitimate-looking → `uncertain` (confidence 0.5-0.7)

3. **Person Identity Verification**
   - "AMBIGUOUS IDENTITY" in research → always `uncertain`
   - Multiple people with same name → `uncertain`
   - Only classify as `quality` if identity clearly verified

4. **Default Behavior**
   - "When in doubt, classify as 'uncertain' to ensure human review"

### Status Flow

```typescript
if (classification === 'duplicate') {
  status = 'forwarded'  // Route to Account Team
} else if (classification === 'low-value' && confidence >= autoRejectThreshold) {
  status = 'rejected'   // Auto-reject
} else {
  status = 'review'     // Default to human review
}
```

## Coverage

The test suite ensures coverage across all classification categories:

- ✅ **quality**: Quality Lead, Apple COO
- ✅ **support**: Support Request
- ✅ **low-value**: Weak Lead
- ✅ **uncertain**: Apple Employee (Ambiguous), Fake Company (acceptable), Apple Researcher (acceptable)
- ✅ **duplicate**: Duplicate Customer (Stripe)
- ❌ **dead**: Not currently tested (requires email bounce/no response scenarios)

## Interpreting Results

### In the Leads Table (Dev Mode)

Each test lead displays a result indicator (visible only when developer mode is enabled):

- ✅ **Green Checkmark**: Classification matches expected result
- ❌ **Red X**: Classification doesn't match expected result
- **Tooltip**: Shows "Expected: quality, Got: uncertain" on hover

### Processing Status

Test leads go through the same workflow as real leads:
1. **processing** - Workflow is running (research, qualification, email generation)
2. **review** - Ready for human review (most test leads end here)
3. **sent** - Email approved and sent (manual action required)
4. **forwarded** - Duplicate customer routed to Account Team
5. **rejected** - Auto-rejected low-value lead

### Why Tests Might Fail

1. **API Variability**: Real APIs (Exa, OpenAI) may return different results over time
2. **Research Results**: Web research findings may change (LinkedIn profiles, company info)
3. **Confidence Thresholds**: Borderline cases may flip between classifications
4. **External Data Changes**: Company websites, LinkedIn profiles, news articles may update

### Acceptable Variations

Some test cases have multiple acceptable outcomes:
- **Fake Company**: `low-value` OR `uncertain` (both acceptable)
- **Apple Researcher**: `low-value` OR `uncertain` (both acceptable)

## Configuration

Tests use whatever configuration is currently active in the system. Make sure you have the desired configuration set up before running tests.

**Recommended Test Configuration:**
- Auto-reject threshold: 0.9
- Quality lead threshold: 0.7
- Standard email template

This ensures consistent test results across runs.

## Mock CRM Data

For duplicate detection testing, the mock CRM includes:

| Company | Email | Account Team | Type | Annual Value |
|---------|-------|--------------|------|--------------|
| GlobalTech Industries | alex.thompson@globaltech.com | Sarah Chen | Enterprise | $480K |
| CloudStartup | maria@cloudstartup.io | James Park | Mid-Market | $85K |
| DesignCo | david@designco.com | Michelle Wong | SMB | $12K |
| Stripe | jessica.brown@stripe.com | Robert Martinez | Enterprise | $650K |

## Troubleshooting

### All Tests Failing to Submit
- Check that the server is running
- Verify API endpoints are accessible
- Check browser console for errors

### Tests Submit but Never Process
- Check server logs for workflow errors
- Verify OpenAI and Exa API keys are configured
- Check rate limits on external APIs

### Specific Test Failing Classification
- Review the actual classification reasoning in the lead details
- Check if research results changed (company info, LinkedIn profiles)
- Verify the expected classification is still appropriate

### Tests Taking Too Long
- Each test is processed independently through the full workflow
- Research + qualification + email generation = 30-60 seconds per lead
- 8 tests running concurrently should complete in 1-2 minutes
- Sequential processing would take 4-8 minutes total

## Implementation Details

### Test Lead Metadata

Test leads are marked with metadata:
```typescript
{
  isTestLead: true,
  testCase: 'support' | 'fake' | 'quality' | ...,
  expectedClassifications: ['support'] | ['low-value', 'uncertain'] | ...
}
```

### Test Runner Process

1. **POST** `/api/leads/submit` × 8 - Submit each test case with metadata
2. Leads process through normal workflow using active configuration
3. Pass/fail indicators appear in leads table based on metadata comparison

## Future Enhancements

- [ ] Add `dead` lead test case
- [ ] Add integration tests for status transitions
- [ ] Add tests for email quality validation
- [ ] Add tests for configuration threshold edge cases
- [ ] Add performance benchmarks
- [ ] Add automated regression testing (scheduled runs)
- [ ] Add test result history/tracking over time
