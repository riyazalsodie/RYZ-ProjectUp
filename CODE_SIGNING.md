# Code signing policy

**Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).**

RYZ ProjectUp is an MIT-licensed, local-first Windows desktop application. Windows release artifacts are signed only when they are built from this public repository by the approved GitHub Actions build and approved by a project maintainer.

## Project

- Repository: <https://github.com/riyazalsodie/RYZ-ProjectUp>
- Download page: <https://github.com/riyazalsodie/RYZ-ProjectUp/releases>
- License: [MIT](LICENSE)
- Signing scope: the Windows portable executable and the NSIS installer produced from this repository
- Publisher name on signed releases: SignPath Foundation

## Team and roles

RYZ ProjectUp is currently maintained by a single maintainer.

| Role | Member |
| --- | --- |
| Author / committer | [@riyazalsodie](https://github.com/riyazalsodie) |
| Reviewer | [@riyazalsodie](https://github.com/riyazalsodie) |
| Approver | [@riyazalsodie](https://github.com/riyazalsodie) |

Every signing request is manually reviewed and approved by the approver. A build is not signed merely because a tag exists.

## Build provenance

Signed artifacts must be produced by the Windows GitHub Actions workflow in this repository from the tagged source commit. Local developer builds and binaries downloaded from other sources are not signed by SignPath Foundation.

Until the SignPath onboarding is complete, the releases on GitHub are **unsigned**, and the release notes say so. Do not describe an unsigned or self-signed build as a SignPath-signed release.

## Privacy policy

RYZ ProjectUp is local-first and has no telemetry or RYZ-operated servers.

**This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.**

When the user explicitly connects Google Drive, the app sends project snapshots and vault metadata directly to that user's Google Drive account using the user's own OAuth client. Credentials remain on the local machine and are encrypted at rest on Windows with DPAPI. See [SECURITY.md](SECURITY.md) and [README.md#security--privacy](README.md#security--privacy) for details.

## Signing process

1. A maintainer triggers the signed-release workflow for a tag.
2. GitHub Actions builds the Windows artifacts from that tag.
3. The unsigned artifacts are uploaded as a GitHub Actions artifact.
4. A SignPath signing request is submitted for the project's signing policy.
5. The approver reviews the build and approves the signing request.
6. The signed artifacts are downloaded, verified, and attached to the GitHub release.

See [docs/SIGNPATH.md](docs/SIGNPATH.md) for the owner setup and verification checklist.
