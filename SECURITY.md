# Security Policy

## Supported versions

The current `master` branch is the supported development line.

## Reporting a vulnerability

Please report security issues through GitHub private vulnerability reporting if it is enabled for the repository. If that is unavailable, open a GitHub issue with a short summary and avoid attaching private source images, credentials, tokens, or other sensitive files.

Good reports include:

- What can go wrong.
- How to reproduce it without private data.
- Browser, operating system, and Node.js version.
- Whether the issue affects local-only use, hosted deployments, or both.

## Project security goals

- Source images should stay local to the browser session.
- Development caches, temporary files, and QA artifacts should remain under the D-drive project paths documented in the README.
- Hosted modified versions should publish corresponding source code under the AGPL-3.0-or-later license.
