

# Multi-Deanery Support — Multi-Tenant Architecture

## Overview

Transform the platform into a multi-tenant system where each deanery operates within a shared application but sees only its own data. A super-admin can oversee all deaneries, while deanery-level admins manage their own.

## Database Changes

**New `deaneries` table:**
- `id`, `name` (e.g. "North West"), `short_name`, `slug` (e.g. "northwest"), `logo_url`, `color`, `is_active`, `created_at`

**Add `deanery_id` column to existing tables:**
- `specialties` — each specialty belongs to a deanery
- `contacts` — contacts scoped per deanery
- `announcements` — deanery-specific announcements
- `profiles` — each user belongs to a deanery
- `access_requests` — requests are deanery-scoped

**New `user_roles` adjustment:**
- Add optional `deanery_id` to `user_roles` so a user can be admin of one deanery but trainee in another
- A `super_admin` role (or a null `deanery_id` on an admin role) indicates cross-deanery access

**Migrate existing data:**
- Create a "North West" deanery record
- Set all existing rows' `deanery_id` to this record

## RLS Policy Updates

All affected tables get updated RLS policies that filter by the user's deanery. The `can_access_specialty` function gains a deanery check. Super-admins bypass deanery filtering.

## Application Changes

**Deanery context:**
- A React context (`DeaneryProvider`) stores the current user's active deanery
- Derived from the user's profile on login
- All data-fetching hooks pass `deanery_id` as a filter

**Landing/Login:**
- Landing page either auto-detects deanery from subdomain/path, or shows a deanery selector
- Two approaches (can decide later):
  - **Subdomain**: `northwest.yourdomain.com` vs `eastmidlands.yourdomain.com`
  - **Path prefix**: `/northwest/dashboard` vs `/eastmidlands/dashboard`

**Admin Panel:**
- Super-admins see a deanery switcher to manage any deanery
- Deanery admins only see their own deanery's data
- New admin section to create/manage deaneries (super-admin only)

**Sidebar & navigation:**
- Specialties list filtered by active deanery
- Community hub filtered by deanery

## Suggested Implementation Order

1. Create `deaneries` table and seed "North West" as the first deanery
2. Add `deanery_id` columns to `specialties`, `contacts`, `announcements`, `profiles`, `access_requests`
3. Backfill all existing data with the North West deanery ID
4. Update RLS policies to include deanery scoping
5. Add `DeaneryProvider` context and update all queries to filter by deanery
6. Add super-admin role and deanery management UI in admin panel
7. Update landing/login to support deanery selection

## Technical Notes

- The `deanery_id` columns will be nullable initially to avoid breaking existing data, then backfilled and made non-nullable
- The `super_admin` concept can be implemented as a new `app_role` enum value, or by having an admin role with `deanery_id = NULL` meaning "all deaneries"
- Subdomain-based routing would require custom domain configuration per deanery; path-based is simpler to start with
- This is a significant structural change — recommended to implement incrementally across several sessions

