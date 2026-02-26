# Delivery Capacity Feature - Setup Instructions

## ✅ What's Been Built

### 1. **Delivery Page** (`/delivery`)
- Shows team capacity as **percentages only** — NO pound signs anywhere
- Color-coded capacity indicators:
  - 🟢 Green (<80%) = Healthy capacity
  - 🟠 Amber (80-95%) = Busy, close to capacity
  - 🔴 Red (>95%) = Over-capacity
- Monthly view (current + next month) with capacity changes
- Per-service capacity breakdown with expandable client lists
- Client list shows names only (no billing amounts)
- Same card layout as Teams page

### 2. **Admin Capacity Settings** (`/admin/capacity`)
- Configure monthly billing targets for each service:
  - Paid Advertising
  - SEO
  - Social Media
  - Creative
- Set team total target (auto-calculated or manual override)
- Matches existing admin page design

### 3. **Enhanced Teams Page**
- Added capacity % indicator below billing total
- Small progress bar with color-coded percentage
- Shows alongside existing £ figures (Teams page is for admins)

### 4. **API Route** (`/api/admin/capacity`)
- GET: Returns capacity targets
- PUT: Updates capacity targets (admin only)

### 5. **Sidebar Navigation**
- Added "Delivery" nav item with BarChart3 icon
- Placed after Teams, uses same permissions

## 🚀 Setup Required (ONE-TIME)

### Step 1: Create Database Table

**You need to run the SQL in Supabase Studio before using the feature.**

1. Go to [Supabase Studio](https://supabase.com/dashboard/project/vnexjslcyvsjqllttwpi/editor)
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of `SETUP_CAPACITY_TABLE.sql` (root of project)
5. Paste and click "Run"
6. Verify: You should see 5 rows in the `capacity_targets` table

**Default targets:**
- Paid Advertising: £15,000/month
- SEO: £10,000/month
- Social Media: £12,000/month
- Creative: £5,000/month
- Team Total: £45,000/month

### Step 2: Test the Feature

1. Build succeeded ✅ (already verified, zero errors)
2. After running the SQL:
   - Visit `/admin/capacity` — Should load with default targets
   - Visit `/delivery` — Should show team capacity percentages
   - Visit `/teams` — Should show capacity indicators below billing totals

### Step 3: Configure Targets (Optional)

- Go to Admin → Capacity
- Update the monthly targets to match your actual team goals
- Click "Save Targets"

## 📊 How It Works

**Capacity Calculation:**
```
Capacity % = (Actual Monthly Billing / Target) × 100
```

**Example:**
- Paid Advertising target: £15,000
- Actual billing: £13,050
- Capacity: 87%
- Status: 🟢 Healthy (room for more work)

**Per-Team Capacity:**
- Calculated from all services within that team
- Shown on both Delivery and Teams pages
- Updates in real-time as billing changes

## 🎨 Design Details

- **Text sizes:** text-[13px] for body, text-[11px] for labels
- **No emojis** in the actual UI
- **Semantic Tailwind** tokens throughout
- **Color coding:** Emerald/Amber/Red based on capacity thresholds
- **Matches existing patterns** exactly (cards, admin layout, sidebar)

## 🔒 Permissions

- **Delivery page:** Uses `permKey: 'teams'` — same as Teams page
- **Admin capacity:** Admin-only (like other admin pages)
- **API route:** No auth check (relies on RLS policies)

## 📁 Files Changed

**New files:**
- `src/app/delivery/page.tsx` (572 lines)
- `src/app/admin/capacity/page.tsx` (258 lines)
- `src/app/api/admin/capacity/route.ts` (77 lines)
- `supabase/migrations/20260226131247_create_capacity_targets.sql`
- `SETUP_CAPACITY_TABLE.sql` (manual setup script)
- `scripts/setup-capacity-table.ts` (reference script)

**Modified files:**
- `src/app/admin/layout.tsx` (added Capacity tab)
- `src/app/teams/page.tsx` (added capacity indicators)
- `src/components/layout/sidebar.tsx` (added Delivery nav item)

## ✅ Build Verification

```
✓ Compiled successfully
✓ TypeScript check passed
✓ All routes generated:
  - ○ /delivery
  - ○ /admin/capacity
  - ƒ /api/admin/capacity
✓ Zero errors
```

## 🎯 Next Steps

1. **Run the SQL** (see Step 1 above) — REQUIRED
2. Test the pages
3. Configure actual targets in Admin → Capacity
4. Share `/delivery` link with delivery team members

## 📝 Notes

- The `capacity_targets` table stores targets persistently
- Default targets are set in the SQL script (you can adjust them)
- Team total can be auto-calculated or manually set
- Capacity percentages update automatically based on contract line items
- Works with both recurring and project billing (pro-rated by date)

---

**Status:** Ready for QA after SQL setup
**Commit:** `ddc93fd` - feat: Add delivery capacity page with admin settings
**DO NOT PUSH** (as requested — you'll push after QA)
