# Recommendation: Remove Case Study Reordering Logic

## Summary

The `CaseStudyEditor` component (`nextjs-app/components/dashboard/CaseStudyEditor.tsx`) contains reordering functionality that is no longer needed since only one case study is being included per lead.

## What to Remove

### 1. Imports (line 4)

```diff
- import { ChevronUp, ChevronDown, X, Plus, GripVertical } from 'lucide-react';
+ import { X, Plus } from 'lucide-react';
```

### 2. Functions (lines 69-83)

Remove the `moveUp` and `moveDown` functions entirely:

```typescript
// DELETE these functions
const moveUp = (index: number) => {
  if (index === 0 || disabled) return;
  const newList = [...localCaseStudies];
  [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
  setLocalCaseStudies(newList);
  saveChanges(newList);
};

const moveDown = (index: number) => {
  if (index === localCaseStudies.length - 1 || disabled) return;
  const newList = [...localCaseStudies];
  [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
  setLocalCaseStudies(newList);
  saveChanges(newList);
};
```

### 3. UI Controls (lines 121-142)

Remove the reorder controls section inside the case study card:

```tsx
// DELETE this entire block
{!disabled && (
  <div className="flex flex-col items-center gap-0.5 pt-0.5">
    <button
      onClick={() => moveUp(index)}
      disabled={index === 0 || isSaving}
      className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Move up"
    >
      <ChevronUp className="h-4 w-4 text-[#666]" />
    </button>
    <GripVertical className="h-4 w-4 text-[#444]" />
    <button
      onClick={() => moveDown(index)}
      disabled={index === localCaseStudies.length - 1 || isSaving}
      className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Move down"
    >
      <ChevronDown className="h-4 w-4 text-[#666]" />
    </button>
  </div>
)}
```

## Rationale

- Only one case study is now included per lead
- Reordering a single item serves no purpose
- Removing this code simplifies the component and reduces visual clutter
- The add/remove functionality remains useful for swapping the selected case study

## Impact

- **UI**: The up/down arrows and grip handle will no longer appear next to case studies
- **Behavior**: No functional change since reordering a single item has no effect
- **Code**: ~35 lines removed, 3 fewer icon imports
