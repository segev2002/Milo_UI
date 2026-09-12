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

BUCKET="milo-ui"
DISTRIBUTION="EZ8CULA3OUM6A"
SITE="https://app.milo-agent-sigal.com"

cd "$(dirname "$0")"

if [ "${1:-}" != "--no-build" ]; then
    echo "→ building"
    npm run build
fi

[ -f dist/index.html ] || { echo "dist/index.html is missing — run without --no-build" >&2; exit 1; }

# Hashed filenames, so they can be cached forever. index.html cannot: it is the
# file that names the new hashes, and a stale copy pins the browser to the old
# bundle until the cache expires.
echo "→ uploading assets"
aws s3 sync dist/ "s3://${BUCKET}/" \
    --delete \
    --exclude index.html \
    --cache-control "public,max-age=31536000,immutable"

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
