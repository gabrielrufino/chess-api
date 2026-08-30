---
name: update-packages
description: >-
  Safely updates all outdated packages in the project (patch and minor only),
  ensuring tests pass, auditing vulnerabilities, and enforcing security checks 
  like doubtful origin verification. (Minimum lifetime is handled by npm).
---

# Safe Package Update Skill

This skill provides a rigorous and secure workflow for updating dependencies.
When asked to safely update packages, strictly follow these steps:

## 1. Identify Outdated Packages

Run `npm outdated` to list packages with available updates.
Target **only** `patch` and `minor` updates. Do not update `major` versions unless explicitly requested by the user.

## 2. Security Checks (Doubtful Origin)

Before installing any new package version, verify its safety:

- **Doubtful Origin/Provenance:** Use `npm view <package_name>@<target_version>` to verify the repository, maintainers, and if it has provenance linked (especially when `target_version` is not `latest`, so checks apply to the version being installed). Be wary of packages that have suddenly changed owners or lack a repository link.
  _(Note: Minimum release age is already configured in `.npmrc` as `min-release-age=7`, so `npm install` will automatically block packages newer than 7 days)._

## 3. Capture Audit Baseline & Apply Updates

Before updating, capture an audit baseline:

- Run `npm audit --json` to record any pre-existing advisories.

For the packages that passed the security checks, update them:

- Update `package.json` with the exact versions.
- Run `npm install <package_name>@<target_version>`.

## 4. Audit & Vulnerabilities

- Run `npm audit --json` and compare the findings against the baseline (check advisory IDs and affected dependency nodes).
- If a new version introduces a vulnerability that did not exist before the update, **rollback** that specific package update immediately.

## 5. Ensure Lockfile is Updated

Run `npm install` to ensure that `package-lock.json` is perfectly synchronized with `package.json`.

## 6. Run Test Suite

Run the project's tests to ensure no regressions were introduced.

- `npm run test`
- `npm run test:e2e` (if available)
  If any test fails after the updates, identify the problematic package, revert it to its previous version, and rerun tests to confirm.

## 7. Reporting

Summarize your actions for the user:

- List the packages updated, their old and new versions.
- Mention any packages that were skipped due to failed provenance checks, failed audit, or failing tests.
- Confirm that tests are passing and the lockfile was successfully updated.
