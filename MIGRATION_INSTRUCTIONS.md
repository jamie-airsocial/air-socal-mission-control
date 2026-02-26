# Database Migration: Add Assignee to Contract Line Items

## Migration File
`supabase/migrations/20260226_add_assignee_to_line_items.sql`

## What it does
Adds an `assignee_id` column to the `contract_line_items` table to track which delivery person is responsible for each billing item.

## To apply the migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20260226_add_assignee_to_line_items.sql`
4. Paste and run in the SQL Editor

### Option 2: Via Supabase CLI
```bash
# Link your project (if not already linked)
npx supabase link --project-ref your-project-ref

# Push the migration
npx supabase db push
```

## What's changed

### Database
- New column: `contract_line_items.assignee_id` (uuid, nullable, references app_users.id)
- Index added for performance on assignee lookups

### API Endpoints
- `GET /api/clients/[id]/contracts` - Now includes assignee data (joined from app_users)
- `POST /api/clients/[id]/contracts` - Now accepts `assignee_id` in request body
- `PATCH /api/contracts/[id]` - Now accepts `assignee_id` for updates

### UI Components
- **Client detail page**: Line item form now has a "Delivery person" dropdown
- **Teams page**: 
  - Added 6-month forecast chart (currency mode)
  - Team members are now clickable
  - Click opens drill-down sheet showing their assignments
- **Delivery page**: 
  - Added 6-month forecast chart (percentage mode)
  - Team members are now clickable
  - Click opens drill-down sheet showing capacity usage

### New Components
- `src/components/forecast-chart.tsx` - Reusable CSS-only forecast chart
- `src/components/member-drill-down-sheet.tsx` - Member assignment details sheet

## Testing checklist
- [ ] Migration applied successfully
- [ ] Line items can be created with assignee
- [ ] Existing line items display correctly (assignee shows as "Unassigned")
- [ ] Assignee can be edited on existing line items
- [ ] Forecast charts display on Teams page
- [ ] Forecast charts display on Delivery page (percentage mode)
- [ ] Clicking team members opens drill-down sheet
- [ ] Drill-down shows correct billing/capacity data
