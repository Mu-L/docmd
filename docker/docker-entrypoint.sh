#!/bin/sh
# docmd Docker entrypoint
#
# Seeds the demo template into an empty /docs so the image is usable
# out of the box (the image's default CMD is `docmd dev`, which needs a
# config and source dir to start). If /docs already has content (e.g.
# the user mounted a volume with their own docs), it is left untouched.
set -e

# Only seed if /docs is completely empty. A mounted volume with the
# user's own markdown files would otherwise be silently overwritten.
if [ -d /docs ] && [ -z "$(ls -A /docs 2>/dev/null)" ] && [ -d /template ]; then
  echo "[docmd] /docs is empty — seeding demo template from /template"
  cp -a /template/. /docs/
fi

exec docmd "$@"