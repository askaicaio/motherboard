-- =============================================================
-- Seed: GHL Forms choices (Dropdown Configuration page)
-- =============================================================
-- 44 forms imported from the ops CSV
-- ("Supporting Information - Automation Forms TRIMMED.csv"). Task Name -> value
-- (exact case preserved); the Task ID column is IGNORED (not stored). Every row
-- is seeded with Status 'Unknown' and empty Notes (NULL), per the import spec.
--
-- GHL Forms is a Form / Status / Notes table mirroring GHL Tags. The status +
-- notes columns already exist on automation_dropdown_choices (migration 0031),
-- so this is a DATA-ONLY seed, no schema change.
--
-- Re-runnable: ON CONFLICT DO NOTHING, so re-running only inserts forms that are
-- not present yet and NEVER overwrites a row. (Chosen over DO UPDATE because the
-- seed's Status/Notes are placeholders the user will edit; DO UPDATE would reset
-- those edits to Unknown/empty on a re-run.)
-- =============================================================

INSERT INTO "automation_dropdown_choices" ("column_key", "value", "status", "notes") VALUES
  ('ghl_forms', 'Terms and Conditions', 'Unknown', NULL),
  ('ghl_forms', '3 Day Challenge Form - Exit Pop', 'Unknown', NULL),
  ('ghl_forms', 'Cary Optin Test', 'Unknown', NULL),
  ('ghl_forms', 'OPTIN - EOS Conference', 'Unknown', NULL),
  ('ghl_forms', 'CAIO lead form 1', 'Unknown', NULL),
  ('ghl_forms', 'OPTIN - Expert Summit Conference', 'Unknown', NULL),
  ('ghl_forms', 'Adam Challenge - 2', 'Unknown', NULL),
  ('ghl_forms', 'Adam Challenge - FB', 'Unknown', NULL),
  ('ghl_forms', 'Adam Challenge', 'Unknown', NULL),
  ('ghl_forms', 'CHALLENGE - AI Authority Event Page Form', 'Unknown', NULL),
  ('ghl_forms', 'SLO + Quiz Funnel', 'Unknown', NULL),
  ('ghl_forms', 'AM01. Affiliate Signup', 'Unknown', NULL),
  ('ghl_forms', 'New Hire Form Submission', 'Unknown', NULL),
  ('ghl_forms', 'CAIO: Manual Enrollment', 'Unknown', NULL),
  ('ghl_forms', 'CAIO Magic Funnel', 'Unknown', NULL),
  ('ghl_forms', 'Subaccount creation', 'Unknown', NULL),
  ('ghl_forms', 'AM02. Affiliate Onboarding', 'Unknown', NULL),
  ('ghl_forms', 'Sponsorship-Form', 'Unknown', NULL),
  ('ghl_forms', 'Podcast: Using AI at Work', 'Unknown', NULL),
  ('ghl_forms', 'Using AI at Work - Podcast Interview', 'Unknown', NULL),
  ('ghl_forms', 'FORM - AI Authority Close', 'Unknown', NULL),
  ('ghl_forms', '3 Day Challenge Form', 'Unknown', NULL),
  ('ghl_forms', 'Podcast - Contact Us', 'Unknown', NULL),
  ('ghl_forms', 'Executive Certification Future Pathway', 'Unknown', NULL),
  ('ghl_forms', 'Client Onboarding Form (Sales Team)', 'Unknown', NULL),
  ('ghl_forms', 'Vistage - Chicago 09/11/25*', 'Unknown', NULL),
  ('ghl_forms', 'Roadshow - Contact Us', 'Unknown', NULL),
  ('ghl_forms', 'Practical AI Assessment', 'Unknown', NULL),
  ('ghl_forms', 'Practical AI Assessment (No Pricing) - Kansas City', 'Unknown', NULL),
  ('ghl_forms', 'Vistage Check-in ~ Kansas City 10/16/25', 'Unknown', NULL),
  ('ghl_forms', 'White Paper - SG&A', 'Unknown', NULL),
  ('ghl_forms', 'White Paper - Industry Specific', 'Unknown', NULL),
  ('ghl_forms', 'White Paper - Practical Guide', 'Unknown', NULL),
  ('ghl_forms', 'White Paper - ROI', 'Unknown', NULL),
  ('ghl_forms', 'My workspace / CAIO Certificate | Book a Call', 'Unknown', NULL),
  ('ghl_forms', 'My workspace / ChiefAIOfficerCalendar.com | AI Chatbot', 'Unknown', NULL),
  ('ghl_forms', 'My workspace / CAIO Certificate | Book an Interview', 'Unknown', NULL),
  ('ghl_forms', 'Find Caio to Lead Connector', 'Unknown', NULL),
  ('ghl_forms', 'The Chief List', 'Unknown', NULL),
  ('ghl_forms', 'become a caio', 'Unknown', NULL),
  ('ghl_forms', 'Newsletter', 'Unknown', NULL),
  ('ghl_forms', 'Contact Form', 'Unknown', NULL),
  ('ghl_forms', 'Webinar Template Form', 'Unknown', NULL),
  ('ghl_forms', 'Mona Lisa - New - Copy', 'Unknown', NULL)
ON CONFLICT ("column_key", "value") DO NOTHING;
