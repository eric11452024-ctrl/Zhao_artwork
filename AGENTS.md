# Git history preference

- The user requires a local Git commit after each completed website modification so they can roll back.
- Before editing, inspect Git status. Preserve any pre-existing user changes; do not include unrelated changes in commits.
- After completing and appropriately verifying each coherent change, stage only the files changed for this website task and create a descriptive local commit.
- Report the commit hash and a short description in the final response. If committing fails, report the reason explicitly.
- The Git repository root is the parent directory of this website. Do not stage unrelated files in that parent directory.
- Do not push to GitHub unless the user requests it or has explicitly authorized pushing in the conversation.
- For user-requested rollback, prefer a revert commit that preserves history; do not discard unrelated working tree changes.
