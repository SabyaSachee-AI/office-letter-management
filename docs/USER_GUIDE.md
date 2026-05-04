# Office Letter Management — User Guide

This guide is for **people using the web application** day to day. For installing servers, Docker, and developer commands, see the **[README](../README.md)** in the project root.

---

## Signing in

1. Open the application URL your administrator gave you (often `http://localhost:3000` when testing locally).
2. Enter your **email** and **password**.
3. If login fails, confirm caps lock, reset password with an admin (if your deployment supports it), or ask an admin to check your account is **active**.

**First-time setup (developers):** after seeding the database, you can use the default admin account listed in the README.

---

## What you see depends on your role

The **sidebar** only shows sections your account is allowed to use.

| Role | What you typically do |
|------|------------------------|
| **Admin** | Manage users, roles, departments; access security-related areas; full oversight. |
| **Receiving Officer** | Register **new letters** (receive workflow), browse letters in your department. |
| **Approval Head** | Work the **approval queue**: approve, reject, return for correction, or route letters. |
| **Team Leader** | **Assign consultants** to letters; help with **closure** after consultant work. |
| **Consultant** | Open **your assignments**, update progress, add notes and solution files. |

If something is missing from the menu, your account may need an extra role or a **department** assignment—ask an admin.

---

## End-to-end workflow (simple picture)

```
Register letter → Approval decision → Assign consultant → Consultant resolves
       → Review solution → Close letter → Reports / exports (as allowed)
```

**In practice:**

1. **Someone registers an incoming letter** with attachment and basic details.
2. **Approvers** decide: approve, reject, send back for fixes, or send to another department.
3. **A team leader** picks a **consultant** and sets a deadline.
4. The **consultant** does the work, updates status, and may upload a solution document.
5. **Leaders / approvers** **review** the solution and **close** the letter when everything is complete.
6. **Reports** help track volumes and outcomes (who can open them depends on role and department).

Exact button labels follow the sidebar: **Letters**, **Approval**, **Assignment**, **Consultant**, **Closure**, **Reports**.

---

## Tips for each stage

### Letters & receiving

- Use clear **subjects** and **sender** names—they drive search and filters later.
- Attach the official file (PDF or allowed types your organization uses).

### Approval queue

- Read the letter context before **Approve** or **Reject**; comments are usually stored for audit.
- **Route** when the letter belongs with another department.

### Assignment

- Choose a consultant in the **same department** as the letter (the system enforces this).
- Set a realistic **deadline**.

### Consultant work

- Keep status up to date so managers see progress.
- Add a **resolution note** or **upload** the solution file before closure can finish.

### Closure

- Formal closure usually requires that the solution was **reviewed** first—follow on-screen errors if something is missing.

---

## Troubleshooting (users)

| Problem | What to try |
|---------|-------------|
| Page keeps sending me to login | Session expired or token invalid—sign in again. |
| “Insufficient permissions” | Your role does not allow this action—contact an admin. |
| I don’t see letters I expect | Letters may be limited by **department**; confirm you’re in the right unit. |
| Upload failed | File type or size may not be allowed—try PDF or ask admin for limits. |
| Blank page or errors after upgrade | Clear browser cache; if it persists, tell support the **time** and **page** you used. |

For **installation**, **database**, **Docker**, and **API URL** issues, see **[README.md — Troubleshooting](../README.md#troubleshooting)**.
