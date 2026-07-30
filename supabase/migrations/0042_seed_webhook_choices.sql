-- =============================================================
-- Seed: Webhook Links choices (Dropdown Configuration page)
-- =============================================================
-- 76 webhook paths from the "Supporting Information - Webhook Path" CSV (a
-- ClickUp export), column 2 ("Task Name", which actually holds the URL), seeded
-- VERBATIM per the user's choice — INCLUDING the literal "No Path" placeholder
-- and the few API-endpoint (non-webhook) URLs (Circle space_members, GHL
-- locations/users/appointments). The CSV's Task ID column is NOT stored (this
-- table only holds the URL); per-automation linking (the Relationships junction)
-- comes later when the Per Website Webhook Links column is built.
--
-- Notes left null. DATA-ONLY seed (the table already exists).
--
-- Re-runnable: ON CONFLICT (url) DO NOTHING, so re-running only inserts URLs not
-- present yet and never overwrites a hand-edited row (e.g. a later Notes edit).
-- The url column is UNIQUE, so any exact-duplicate URL collapses to one row.
-- =============================================================

INSERT INTO "automation_webhook_choices" ("url") VALUES
  ('https://app.circle.so/api/v1/spaces/ai-insiders/space_members'),
  ('https://hooks.zapier.com/hooks/catch/14606520/20n2zwh/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/20n2inu/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/20n2u4q/'),
  ('https://services.leadconnectorhq.com/contacts/toNzEtAUhVb8WRhh8EBZ/appointments'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2guerfe/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2facdjv/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2fua95c/'),
  ('https://backend.leadconnectorhq.com/hooks/N6W24Fhx5bOKo4FFKAiv/webhook-trigger/ce51bdf5-0e43-4472-b16a-22fa2a89cd2e'),
  ('https://hook.us1.make.com/5punwbcpqu9ytk3q7abfakrg9nwxst17'),
  ('https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-54909443-42e8-4e21-857e-1ee58149ca78'),
  ('https://services.leadconnectorhq.com/hooks/FgaFLGYrbGZSBVprTkhR/webhook-trigger/e771ae3f-eaf4-49b2-9f67-f53fbc3e122f'),
  ('https://services.leadconnectorhq.com/locations/'),
  ('https://services.leadconnectorhq.com/users/'),
  ('No Path'),
  ('https://services.leadconnectorhq.com/hooks/N6W24Fhx5bOKo4FFKAiv/webhook-trigger/5487146e-98ce-452b-8916-9cc3f5ddb4d6'),
  ('https://services.leadconnectorhq.com/hooks/FgaFLGYrbGZSBVprTkhR/webhook-trigger/H4hykonSVnsQgUjKbvhF'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2x4umwm/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/3awdrfr/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2y2i71n/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2k10zbm/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2k1v4yf/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2k1vvl7/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2k9y5bn/'),
  ('https://hooks.zapier.com/hooks/catch/14606520/2bfzu4j/'),
  ('https://hook.us1.make.com/x2bxj146cjj2li8egr3p1lwabpzvubmq'),
  ('https://hook.us1.make.com/66co9j170jmddhj4jfejrfvfbnsep0d5'),
  ('https://hook.us1.make.com/7d5ffxrm70gikbbw75mx6y72jgxlokhl'),
  ('https://hook.us1.make.com/tljs17blguigxtic29mynspehajiczof'),
  ('https://hook.us1.make.com/kug9mlfmgkoijb31vx4ct5t8rgiz7mml'),
  ('https://hook.us1.make.com/3qathfu3dj3o0k6anhnlg7e1aph8cnae'),
  ('https://hook.us1.make.com/yfofcdv3kqpv3t5qehalfxcpfbgjmjvt'),
  ('https://hook.us1.make.com/a7gdlxekknokab2r3a7ndmo6f3obns28'),
  ('https://hook.us1.make.com/54lqmue1xleoyq6melwsb5sk3a4xkh18'),
  ('https://hook.us1.make.com/qf605b910trvxtey3inljdd967sfijiv'),
  ('https://hook.us1.make.com/4m6xpbmc05n0gypcfgfjanqu3pj1u0fv'),
  ('https://hook.us1.make.com/6szdwrp699zq7x6ceousivgmtdwfd7rc'),
  ('https://hook.us1.make.com/7x0ugsqh98z1vq2c69hgrjc2qoun7xh5'),
  ('https://hook.us1.make.com/lqiglfm37j9mm6jvb6jnsdpdfmbjewh4'),
  ('https://hook.us1.make.com/lsc4h3hhw9dmqplrtsndnd4j69xoditr'),
  ('https://hook.us1.make.com/fbhlfx16cvo4vie9lq2uu018wcq9goae'),
  ('https://hook.us1.make.com/ismfd1ay0t5wsu2x1ws72p5wp5uqtabo'),
  ('https://hook.us1.make.com/mq6qku3d7wb6kr9udu6h2ltsa8se3uq9'),
  ('https://hook.us1.make.com/3l3v0js5kuvhlvqucqq1kzf7cue9uanm'),
  ('https://hook.us1.make.com/gi89yqbjqe9pg0vz7ojr2uogw5whb0g9'),
  ('https://hook.us1.make.com/e50nw41fumvmg2umlbxhoskcdc0akjsw'),
  ('https://hook.us1.make.com/5vebshtkmdyxmm3c3k8w6mfofzc8bxw6'),
  ('https://hook.us1.make.com/e6l8h3bs6mbmuupazxq2df56jal3t8fz'),
  ('https://hook.us1.make.com/2aui1390jj6pcay9uardz4vhhico8nca'),
  ('https://hook.us1.make.com/1etw5qlurjp8edaxo6nononp2do8e3jd'),
  ('https://hook.us1.make.com/hcbu9k7igyy83tzabs4v06l9fht46ooo'),
  ('https://hook.us1.make.com/ejqurq65ismfau9tesrq2tueikc7igqk'),
  ('https://hook.us1.make.com/esjc9ttxaoivkemqkykta2aojadyfcv3'),
  ('https://hook.us1.make.com/r0kptk36b9ahlqae8asnbongaui3twwd'),
  ('https://hook.us1.make.com/70bek0ux5pfg7q35fjce05siofcfecth'),
  ('https://hook.us1.make.com/blk770wa6aio0kfavaas11lr7cdk93u2'),
  ('https://hook.us1.make.com/unlii5xr1kg55nda78zs22k7ho0eonpv'),
  ('https://hook.us1.make.com/dltbgp89s7uxvyn444xkell9emw8ea58'),
  ('https://hook.us1.make.com/3zjycskheuqj63qfmpmrecyx1tn4mru8'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/wf-11b-commands'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/drive-watch-renew'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/drive-file-change'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/test-query-interface'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/rb2b/visitor-alert'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook-test/publish-webhook'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/generate-webhook'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/transcribe-webhook'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/guestfit/send-email'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/705523ce-f249-4d5f-86db-76dc1bca593d'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/17c6eb8c-0a09-4685-a45e-ca778284b407'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/5e076323-dad5-4a50-9ef9-e24c31f72170/chat'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/fathom-summary-received'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/community-onboarding-scheduled'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/caio-kickoff-scheduled'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/client-onboarding-form'),
  ('https://chiefaiofficer.app.n8n.cloud/webhook/art17-erasure-e2e-2026-04-23')
ON CONFLICT ("url") DO NOTHING;
