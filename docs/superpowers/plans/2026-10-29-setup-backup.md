# Local Setup and Encrypted Backup Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare isolated local development and daily encrypted computer backups retained for 30 days.
**Architecture:** Node maintenance scripts and a current-user Windows Scheduled Task. Use existing PostgreSQL tools for consistent public-schema dumps and restore-compatible output. Download database-referenced uploads only from the configured HTTPS origin. Protect local credentials and encryption key using Windows DPAPI; never commit secrets or write unencrypted backup staging files.
**Tech Stack:** Node built-ins, existing Prisma client, PostgreSQL 18 tools, Windows PowerShell ScheduledTasks/DPAPI.
**Spec:** User-approved setup, daily local database/files backup, 30-day retention.

## Tasks
- [x] Test archive authentication, hashes, unsafe upload paths, failure handling and retention; implement encrypted archive and backup runner.
- [x] Implement isolated development setup and read-only checks; never reuse production environment or seed production data.
- [x] Implement DPAPI configuration, verify/extract commands and daily 18:00 task with missed-run handling.
- [x] Install task, create first production backup, verify it and test a database restore only in an isolated local database.
- [x] Document operation, limitations and recovery; review and run maintenance tests.

## Review Focus
Missing remote files must produce a partial status, not success. Failed runs must not prune old copies. A wrong key/tampered archive must fail authentication before extraction. Extraction must target a new local directory and reject traversal/symlinks. Production database must never be restored, migrated, reset or seeded by setup. Logs must not contain secrets.
