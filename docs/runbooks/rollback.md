# Rollback

Use this when a deploy has broken production.

The API ships as a container image (see [DEPLOYMENT.md](../DEPLOYMENT.md)). Until production hosting is live, there is nothing to roll back.

Once it is live:

1. Redeploy the previous image tag on the container platform.
2. Revert the bad change on `main` (`git revert <bad-commit-sha>`), open it as a pull request and merge once CI passes.
3. Financial records are append-only: never roll back data. Correct it with reversing entries through the application.

Afterwards, record what happened and the fix in the pull request that resolves the root cause.
