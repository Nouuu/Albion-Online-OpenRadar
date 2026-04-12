# Rollback Cheatsheet for Bump Plan

If a bump task breaks the baseline, roll back immediately with one of these:

## Revert last commit (keep working tree)

    git reset --soft HEAD~1

## Revert last commit (discard working tree)

    git reset --hard HEAD~1

## Revert a specific file

    git checkout HEAD~1 -- <path>

## Revert go.mod and go.sum

    git checkout HEAD~1 -- go.mod go.sum
    go mod tidy

## Revert package.json and lockfile

    git checkout HEAD~1 -- package.json package-lock.json
    npm ci

## Revert the Docker base

    git checkout HEAD~1 -- Dockerfile.build

After a rollback, rerun the Quick baseline to confirm the tree is clean before retrying with a different version target.
