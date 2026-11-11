#!/usr/bin/env bash
# =============================================================================
# Build the console and publish it to S3 behind CloudFront.
# =============================================================================
#   ./deploy.sh              build, upload, invalidate
#   ./deploy.sh --no-build   upload whatever is already in dist/
#
# The bucket is private. CloudFront reads it through an Origin Access Control,
# and the distribution serves /agent/* and /health from the ALB instead, so the
# browser only ever sees one origin and the API needs no CORS headers.
# =============================================================================
set -euo pipefail

# Production by default; the GitHub workflow overrides these for development.
BUCKET="${BUCKET:-milo-ui}"
DISTRIBUTION="${DISTRIBUTION:-EZ8CULA3OUM6A}"
SITE="${SITE:-https://app.milo-agent-sigal.com}"

cd "$(dirname "$0")"

if [ "${1:-}" != "--no-build" ]; then
    echo "→ building"
    npm run build
fi

[ -f dist/index.html ] || { echo "dist/index.html is missing — run without --no-build" >&2; exit 1; }

# Vite's hashed files (dist/assets/) can be cached forever: a change is a new
# name. Everything else keeps its name across deploys (favicon.ico, milo.png,
# logos, chat.html), so it is cached for an hour — cached forever, an old
# favicon stayed in browsers after it was replaced. index.html cannot be cached
# at all: it is the file that names the new hashes.
echo "→ uploading assets"
aws s3 sync dist/assets/ "s3://${BUCKET}/assets/" \
    --delete \
    --cache-control "public,max-age=31536000,immutable"

echo "→ uploading public files"
aws s3 sync dist/ "s3://${BUCKET}/" \
    --delete \
    --exclude index.html \
    --exclude "assets/*" \
    --cache-control "public,max-age=3600"

echo "→ uploading index.html"
aws s3 cp dist/index.html "s3://${BUCKET}/index.html" \
    --cache-control "no-cache,must-revalidate" \
    --content-type "text/html; charset=utf-8"

# Only the entry point needs purging; the hashed assets are new paths, and
# every extra path in an invalidation is billable beyond the monthly free tier.
echo "→ invalidating"
ID=$(aws cloudfront create-invalidation \
        --distribution-id "$DISTRIBUTION" \
        --paths / /index.html \
        --query 'Invalidation.Id' --output text)

echo "✓ deployed — invalidation ${ID}"
echo "  ${SITE}"
