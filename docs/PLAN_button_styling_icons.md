# Button Styling & Icons Enhancement Plan

## Overview
Update lead detail page buttons and action badges to have:
1. Text colors matching corresponding action colors
2. Better hover behavior for button appearance
3. Icons for visual clarity (X for dead, → for forward, ✓ for send)

## Changes Needed

### 1. Update Button Component Styling
**File: Lead Detail Page (`app/dashboard/leads/[id]/page.tsx`)**

**Primary Buttons (lines 104-106, 132-134):**
- Current: Default button styling with uniform colors
- New: Text color should match action type:
  - "Approve & Send" → green text (`#22c55e`)
  - "Confirm Dead" → red text (`#ef4444`)

**Button Hover Behavior:**
- Add subtle background color on hover (matching text color with low opacity)
- Scale slightly on hover (0.98)
- Smooth transition (0.15s ease)

**Example Styling:**
```tsx
// Approve button
<Button
  onClick={handleApprove}
  size="sm"
  style={{
    color: '#22c55e',
    borderColor: 'rgba(34,197,94,0.2)',
    transition: 'all 0.15s ease'
  }}
  className="hover:bg-[rgba(34,197,94,0.1)]"
>
  <Check className="h-4 w-4 mr-1.5" />
  Approve & Send
</Button>

// Confirm Dead button
<Button
  onClick={handleReject}
  size="sm"
  variant="outline"
  style={{
    color: '#ef4444',
    borderColor: 'rgba(239,68,68,0.2)',
    transition: 'all 0.15s ease'
  }}
  className="hover:bg-[rgba(239,68,68,0.1)]"
>
  <X className="h-4 w-4 mr-1.5" />
  Confirm Dead
</Button>
```

### 2. Add Icons to Buttons

**Import Icons from lucide-react:**
```tsx
import {
  Check,        // ✓ for Approve & Send
  X,            // ✗ for Confirm Dead / Reject
  ArrowRight,   // → for Forward actions
  RefreshCw     // ↻ for Reclassify
} from 'lucide-react';
```

**Icon Mapping:**
- **Approve & Send** → `<Check />` (green)
- **Confirm Dead** → `<X />` (red)
- **Forward to Support** → `<ArrowRight />` (blue)
- **Forward to AE** → `<ArrowRight />` (blue)
- **Reclassify** → `<RefreshCw />` (orange)
- **Override to Quality** → `<Check />` (green)

### 3. Update Dropdown Menu Items

**File: Lead Detail Page (`app/dashboard/leads/[id]/page.tsx`)**

**Dropdown menu items (lines 114-125, 142-169):**
- Add icons to each dropdown item
- Style text colors to match action type
- Add hover effects

**Example:**
```tsx
<DropdownMenuItem
  onClick={() => handleForward('support')}
  className="flex items-center gap-2"
>
  <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
  <span style={{ color: '#3b82f6' }}>Forward to Support</span>
</DropdownMenuItem>

<DropdownMenuItem
  onClick={handleReject}
  className="flex items-center gap-2"
>
  <X className="h-4 w-4" style={{ color: '#ef4444' }} />
  <span style={{ color: '#ef4444' }}>Reject</span>
</DropdownMenuItem>
```

### 4. Add Icons to ActionBadge Component

**File: `components/shared/ActionBadge.tsx`**

**Add icon to each action badge:**
```tsx
import { Check, X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

function getActionIcon(label: string): JSX.Element | null {
  switch (label) {
    case 'Review':
    case 'Sent':
      return <Check className="h-3 w-3" />;
    case 'Confirm Dead':
    case 'Dead':
      return <X className="h-3 w-3" />;
    case 'Forwarded':
    case 'Confirm Support':
    case 'Confirm Duplicate':
      return <ArrowRight className="h-3 w-3" />;
    case 'Processing':
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'Error':
      return <AlertCircle className="h-3 w-3" />;
    default:
      return null;
  }
}

// In ActionBadge component:
export function ActionBadge({ lead }: ActionBadgeProps) {
  const action = getActionForLead(lead);
  const icon = getActionIcon(action.label);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border"
      style={{
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: action.bg,
        color: action.text,
        borderColor: action.border,
        transition: 'all 0.15s ease'
      }}
    >
      {icon}
      {action.label}
    </span>
  );
}
```

### 5. Color Mapping Reference

| Action | Text Color | Background (Hover) | Icon |
|--------|-----------|-------------------|------|
| Approve & Send | `#22c55e` (green) | `rgba(34,197,94,0.1)` | `<Check />` |
| Confirm Dead | `#ef4444` (red) | `rgba(239,68,68,0.1)` | `<X />` |
| Forward to Support | `#3b82f6` (blue) | `rgba(59,130,246,0.1)` | `<ArrowRight />` |
| Forward to AE | `#3b82f6` (blue) | `rgba(59,130,246,0.1)` | `<ArrowRight />` |
| Reclassify | `#f59e0b` (orange) | `rgba(245,158,11,0.1)` | `<RefreshCw />` |
| Override to Quality | `#22c55e` (green) | `rgba(34,197,94,0.1)` | `<Check />` |

## Implementation Steps

1. **Import icons** from lucide-react in lead detail page
2. **Update primary buttons** with colored text and icons
3. **Update dropdown menu items** with icons and colored text
4. **Add icons to ActionBadge** component
5. **Add hover styles** to all buttons (background color on hover)
6. **Test** all button states and icon visibility

## Vercel Design Compliance

- ✅ 12px font size for badges (already implemented)
- ✅ Icons sized at 16px (h-4 w-4) for buttons, 12px (h-3 w-3) for badges
- ✅ Fast transitions (0.15s ease)
- ✅ Subtle hover effects (opacity-based backgrounds)
- ✅ Consistent border radius (6px / rounded-md)
- ✅ Icon spacing (1.5 gap between icon and text)

## Expected Result

**Lead Detail Page:**
- Buttons clearly indicate action type through color and icon
- Hover states provide visual feedback
- Icons improve scannability and recognition

**Leads Table:**
- Action badges have icons for quick visual scanning
- Processing state has animated spinner icon
- Consistent visual language across the app
