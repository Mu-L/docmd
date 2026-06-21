#!/bin/sh
# docmd Docker healthcheck
#
# The dev server may auto-increment its port (3000, 3001, ...) if the
# default port is in use, so we probe a small range instead of hard-
# coding a single port. Returns 0 as soon as any port responds.
for port in 3000 3001 3002 3003 3004 3005; do
  if curl -fs --connect-timeout 2 "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
    exit 0
  fi
done
exit 1