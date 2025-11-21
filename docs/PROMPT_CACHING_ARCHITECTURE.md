# Prompt Caching Architecture Problem

## Problem Statement

We discovered a disconnect between code updates and runtime behavior when updating AI prompts. Specifically:

1. We updated `EMAIL_GENERATION_PROMPT` in `lib/prompts.ts` to explicitly instruct the AI not to generate sign-offs
2. However, generated emails still contained sign-offs ("Best regards,") followed by placeholders
3. This led to duplicate sign-offs in the final email

## Root Cause

The system has two sources of truth for prompts:

### Code (prompts.ts)
```typescript
export const EMAIL_GENERATION_PROMPT = `...`;
export const CLASSIFICATION_PROMPT = `...`;
```

### Database (Firestore deployments)
```typescript
deployment {
  prompts: {
    classification: "...",
    emailGeneration: "..."
  }
}
```

### The Disconnect

1. Developers update prompts in `prompts.ts`
2. But `getDeploymentPrompts()` fetches prompts from the **active deployment in Firestore**
3. The active deployment has **old prompts** from when it was created
4. Deployments are **cached for 60 seconds** for performance
5. Result: Code changes don't take effect until deployment is manually updated

## Why This Is an Architectural Problem

This isn't just a bug - it reveals flawed assumptions:

1. **Code changes are not self-applying** - Updating code doesn't update runtime behavior
2. **No clear deployment workflow** - No process for "deploying" prompt changes
3. **Silent failures** - System appears to work but uses stale data
4. **Code smell workarounds** - We considered adding `trimSignOff()` to compensate

## Architectural Options

### Option 1: Code as Source of Truth for Default Deployment ⭐ **RECOMMENDED**

**Implementation:**
```typescript
export async function getDeploymentPrompts() {
  const deployment = await getActiveDeployment();

  // Default deployment always uses latest code prompts
  if (deployment.id === 'dpl_default') {
    return {
      classification: CLASSIFICATION_PROMPT,
      emailGeneration: EMAIL_GENERATION_PROMPT
    };
  }

  // Custom deployments can override
  return deployment.prompts;
}
```

**Pros:**
- ✅ Simple, minimal code change
- ✅ Code changes immediately apply for default deployment
- ✅ Maintains flexibility for custom deployments
- ✅ No migration or versioning needed
- ✅ Clear semantics: "default" = latest code

**Cons:**
- ⚠️ Two different behaviors (default vs custom deployments)
- ⚠️ Custom deployments still have stale prompt problem

**Best for:** Current phase - rapid iteration with occasional custom deployments

---

### Option 2: Prompts Always from Code (Remove from Deployments)

**Implementation:**
```typescript
// Remove prompts from Deployment type
export interface Deployment {
  settings: { ... };
  emailTemplate: { ... };
  // prompts: REMOVED
}

// Always use code prompts
export function getDeploymentPrompts() {
  return {
    classification: CLASSIFICATION_PROMPT,
    emailGeneration: EMAIL_GENERATION_PROMPT
  };
}
```

**Pros:**
- ✅ Simplest architecture - single source of truth
- ✅ Code changes always apply immediately
- ✅ No caching issues
- ✅ Easier to reason about

**Cons:**
- ❌ Loses ability to A/B test prompts
- ❌ Can't customize prompts per deployment
- ❌ Breaking change - requires migration

**Best for:** If we never need deployment-specific prompt customization

---

### Option 3: Prompt Versioning with Auto-Migration

**Implementation:**
```typescript
// Add version to prompts
export const PROMPT_VERSION = 3;
export const CLASSIFICATION_PROMPT = `...`;
export const EMAIL_GENERATION_PROMPT = `...`;

// On startup or deployment fetch
export async function getDeploymentPrompts() {
  const deployment = await getActiveDeployment();

  // Check if prompts are outdated
  if (deployment.promptVersion !== PROMPT_VERSION) {
    console.log('Updating deployment prompts to version', PROMPT_VERSION);
    await updateDeploymentPrompts(deployment.id, {
      classification: CLASSIFICATION_PROMPT,
      emailGeneration: EMAIL_GENERATION_PROMPT,
      promptVersion: PROMPT_VERSION
    });
  }

  return deployment.prompts;
}
```

**Pros:**
- ✅ Automatic updates when code changes
- ✅ Maintains deployment flexibility
- ✅ Version tracking for debugging
- ✅ Can track which deployments use which prompts

**Cons:**
- ❌ More complex implementation
- ❌ Requires database writes on every version change
- ❌ Need migration system
- ❌ What if admin intentionally customized prompt?

**Best for:** Production system with many custom deployments

---

### Option 4: Explicit Prompt Management in UI

**Implementation:**
- Prompts stored ONLY in deployments (no hardcoded defaults)
- UI has "Reset to defaults" button that pulls from code
- Clear indication when prompt differs from default
- Version tracking shows "based on v3" vs "customized"

**Pros:**
- ✅ Explicit, visible to admins
- ✅ Clear when using custom vs default
- ✅ Full control and transparency

**Cons:**
- ❌ Requires UI work
- ❌ Requires manual action to update
- ❌ No prompts on fresh install (needs seed)

**Best for:** Product with admin users managing multiple deployments

---

## Recommendation: Option 1

### Why Option 1?

Given the current state of the system:

1. **We're in rapid iteration phase** - Need code changes to apply quickly
2. **Default deployment is primary use case** - Most testing uses `dpl_default`
3. **Minimal disruption** - Small code change, no migration needed
4. **Preserves future flexibility** - Can still create custom deployments later
5. **Clear upgrade path** - Can move to Option 3 later if needed

### Implementation Plan

**File: `lib/deployment-helpers.ts`**

```typescript
/**
 * Get deployment prompts
 * NOTE: Default deployment always uses latest code prompts to ensure
 * code changes apply immediately during development
 */
export async function getDeploymentPrompts() {
  const deployment = await getActiveDeployment();

  // Default deployment uses latest prompts from code
  if (deployment.id === 'dpl_default') {
    const { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT } = await import('./prompts');
    return {
      classification: CLASSIFICATION_PROMPT,
      emailGeneration: EMAIL_GENERATION_PROMPT
    };
  }

  // Custom deployments use their stored prompts
  return deployment.prompts;
}
```

### Alternative: Environment-Based Behavior

Could also make this configurable:

```typescript
const USE_CODE_PROMPTS = process.env.NODE_ENV === 'development';

export async function getDeploymentPrompts() {
  const deployment = await getActiveDeployment();

  if (USE_CODE_PROMPTS) {
    const { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT } = await import('./prompts');
    return {
      classification: CLASSIFICATION_PROMPT,
      emailGeneration: EMAIL_GENERATION_PROMPT
    };
  }

  return deployment.prompts;
}
```

This way:
- **Development:** Always uses code (fast iteration)
- **Production:** Uses deployment prompts (stable, testable)

## What About trimSignOff()?

Once we implement Option 1:

1. **Remove `trimSignOff()` function** - It's a band-aid we don't need
2. **Trust the AI prompt** - If sign-offs still appear, fix the prompt
3. **Simpler, clearer code** - One solution, not two

The existence of `trimSignOff()` was a code smell indicating this architectural problem.

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-XX | Use Option 1 | Balances simplicity with flexibility during development phase |

## Future Considerations

As the system matures, consider:

1. **Moving to Option 3** if we have many custom deployments
2. **Adding UI prompt editor** (Option 4) for non-technical admins
3. **Prompt versioning** for A/B testing and rollback capability
4. **Audit logging** of prompt changes for compliance

---

## Related Files

- `app/lib/prompts.ts` - Hardcoded prompt definitions
- `app/lib/deployment-helpers.ts` - Deployment fetching and caching
- `app/lib/workflow-services.ts` - Uses `getDeploymentPrompts()`
- `app/app/api/deployments/route.ts` - Creates deployments with prompts
