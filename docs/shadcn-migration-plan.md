# shadcn/ui Migration Plan

Comprehensive UX review to identify custom components that can be replaced with shadcn/ui components.

---

## **HIGH PRIORITY** - Missing Components with Immediate Impact

### 1. **Slider Component** (Settings.tsx:95-110)
**Current:** Custom `<input type="range">` with inline gradient styling
**Replace with:** shadcn/ui [Slider](https://ui.shadcn.com/docs/components/slider)
**Impact:** High - Removes ~15 lines of custom inline styles
**Location:** `/app/components/dashboard/Settings.tsx:95-183`

```tsx
// Current custom implementation
<input type="range" className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
  style={{ background: `linear-gradient(...)` }} />
```

### 2. **Avatar Component** (Multiple locations)
**Current:** Custom inline `<div>` with initials
**Replace with:** shadcn/ui [Avatar](https://ui.shadcn.com/docs/components/avatar)
**Impact:** High - Used in 3+ locations
**Locations:**
- `/app/app/dashboard/layout.tsx:167-176` (user profile)
- `/app/components/dashboard/SearchableAuthorFilter.tsx:122-125` (author list)

```tsx
// Current: Custom div
<div className="h-6 w-6 rounded-full bg-[#333] flex items-center justify-center text-xs">
  {author.charAt(0).toUpperCase()}
</div>
```

### 3. **Command/Combobox Component** (SearchableAuthorFilter.tsx)
**Current:** Custom searchable dropdown using Popover + manual search logic
**Replace with:** shadcn/ui [Command](https://ui.shadcn.com/docs/components/command) or [Combobox](https://ui.shadcn.com/docs/components/combobox)
**Impact:** High - Removes ~100 lines of custom code
**Location:** `/app/components/dashboard/SearchableAuthorFilter.tsx`

The entire SearchableAuthorFilter component (143 lines) could be replaced with shadcn's Combobox which has built-in search, keyboard navigation, and proper accessibility.

### 4. **Toast/Sonner Notifications**
**Current:** Browser `alert()`/`confirm()` dialogs
**Replace with:** shadcn/ui [Toast](https://ui.shadcn.com/docs/components/toast) or [Sonner](https://ui.shadcn.com/docs/components/sonner)
**Impact:** High - Better UX than browser dialogs
**Usage:** Settings save feedback, error messages

### 5. **Separator Component**
**Current:** Custom borders with inline styles (`style={{ borderColor: 'var(--border-custom)' }}`)
**Replace with:** shadcn/ui [Separator](https://ui.shadcn.com/docs/components/separator)
**Impact:** Medium - Used throughout for visual separation
**Locations:**
- Settings.tsx:187 (button separator)
- Layout.tsx:225 (menu separator)

---

## **MEDIUM PRIORITY** - Standardization Opportunities

### 6. **Dialog/Modal Component**
**Current:** Not implemented (potential future need)
**Replace with:** shadcn/ui [Dialog](https://ui.shadcn.com/docs/components/dialog)
**Impact:** Medium - Add when needed instead of custom implementation

### 7. **Breadcrumb Component** (layout.tsx:66-109)
**Current:** Custom breadcrumb logic with manual routing
**Replace with:** shadcn/ui [Breadcrumb](https://ui.shadcn.com/docs/components/breadcrumb)
**Impact:** Medium - ~40 lines of code reduction
**Location:** `/app/app/dashboard/layout.tsx:66-158`

### 8. **Skeleton Loaders**
**Current:** Simple placeholder divs or "Loading..." text
**Replace with:** shadcn/ui [Skeleton](https://ui.shadcn.com/docs/components/skeleton)
**Impact:** Medium - Better loading UX
**Locations:**
- Settings.tsx:66-72
- SuccessMessage.tsx:120-156 (custom spinner)

### 9. **Switch/Toggle Component** (Dev Mode Toggle)
**Current:** Not implemented; could improve dev mode UI
**Replace with:** shadcn/ui [Switch](https://ui.shadcn.com/docs/components/switch)
**Impact:** Low-Medium - Visual improvement
**Location:** `/app/app/dashboard/layout.tsx:224-243`

### 10. **Tooltip Component**
**Current:** Not implemented (could enhance UX)
**Replace with:** shadcn/ui [Tooltip](https://ui.shadcn.com/docs/components/tooltip)
**Impact:** Medium - Add helpful hints for badges, icons, etc.

---

## **LOW PRIORITY** - Minor Improvements

### 11. **Custom Loading Spinner** (SuccessMessage.tsx:129-150)
**Current:** Custom SVG spinner with manual animations
**Replace with:** Use `lucide-react`'s `Loader2` icon (already used elsewhere)
**Impact:** Low - Consistency improvement
**Note:** You already use `Loader2` in LeadForm.tsx, so this would just be standardization

```tsx
// Current: Custom SVG (20 lines)
<svg className="animate-spin h-4 w-4">...</svg>

// Replace with: Lucide icon (1 line)
<Loader2 className="animate-spin h-4 w-4" />
```

### 12. **Custom Success Icon** (SuccessMessage.tsx:79-100)
**Current:** Custom SVG checkmark
**Replace with:** `lucide-react`'s `CheckCircle2` or `Check` icons
**Impact:** Low - Consistency (you already use these icons elsewhere)

### 13. **Navigation Menu Component**
**Current:** Custom tab navigation in layout
**Replace with:** shadcn/ui [Navigation Menu](https://ui.shadcn.com/docs/components/navigation-menu) or [Tabs](https://ui.shadcn.com/docs/components/tabs)
**Impact:** Low - Current implementation is fine, but could be more semantic
**Location:** `/app/app/dashboard/layout.tsx:252-281`

**Note:** You already have shadcn Tabs component installed, but not using it for navigation.

---

## **KEEP AS-IS** - Well-Implemented Custom Components

These custom components are well-crafted and don't have direct shadcn/ui replacements:

✅ **StatusBadge** - Domain-specific with dynamic colors from config
✅ **ActionBadge** - Complex logic for lead actions
✅ **Attribution** - Specific date/author formatting
✅ **AllLeads/ReviewQueue** - Complex data tables with real-time updates
✅ **LeadForm** - Uses `@tanstack/react-form`, well-structured with Field components

---

## **Implementation Priority Ranking**

1. **Slider** → Immediate visual/UX improvement, removes most inline styles
2. **Avatar** → Used in multiple places, standardizes user representation
3. **Command/Combobox** → Biggest code reduction, better accessibility
4. **Toast/Sonner** → Better feedback mechanism than browser alerts
5. **Separator** → Quick wins throughout the app
6. **Breadcrumb** → Standardizes navigation pattern
7. **Skeleton** → Better loading states
8. **Switch** → Nice-to-have for dev mode toggle
9. **Dialog/Modal** → Add when needed
10. **Tooltip** → Enhancement for future iterations

---

## **Estimated Impact**

- **Lines of code removed:** ~300-400 lines
- **Inline styles eliminated:** ~90%
- **Consistency improvement:** High (unified design system)
- **Accessibility:** Improved (Radix UI primitives come with ARIA support)
- **Maintenance:** Reduced (shadcn/ui handles updates)

---

## **Existing shadcn/ui Components**

Already installed and in use:
- Button
- Badge
- Card
- Table
- Tabs
- Input
- Textarea
- Label
- Select
- Dropdown Menu
- Checkbox
- Popover
- Calendar
- Date Range Picker
- Field (custom wrapper)
