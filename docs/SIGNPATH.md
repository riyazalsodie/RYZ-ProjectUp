# Free Windows code signing with SignPath Foundation

This is the setup checklist for the free, publicly trusted code-signing route. It requires the repository owner because SignPath verifies the maintainer and requires MFA.

There is no free signing key that can be generated locally and trusted by Windows. A self-signed certificate is free, but Windows still treats it as an unknown publisher and SmartScreen can block it. SignPath Foundation is the free route that produces a publicly trusted Authenticode signature.

## What SignPath needs

- A public, actively maintained repository with an OSI-approved license: this repo uses MIT.
- At least one existing release: v0.4.2-beta.1 is published.
- A public code-signing policy on the project home page: see [CODE_SIGNING.md](../CODE_SIGNING.md).
- GitHub Actions as the trusted build system.
- MFA on GitHub and SignPath.
- A named approver for every signing request.

## Owner steps

These steps must be completed by the repository owner. Do not paste API tokens, PFX files, or passwords into this repository or into an issue.

1. **Apply to SignPath Foundation**
   - Open <https://signpath.org/apply.html>.
   - Use the project name `RYZ ProjectUp`.
   - Repository: `https://github.com/riyazalsodie/RYZ-ProjectUp`.
   - Download page: `https://github.com/riyazalsodie/RYZ-ProjectUp/releases`.
   - State that the project is MIT-licensed and that the Windows artifacts are an NSIS installer and a portable `.exe`.
   - Link the code-signing policy: `https://github.com/riyazalsodie/RYZ-ProjectUp/blob/main/CODE_SIGNING.md`.

2. **Enable MFA and install the SignPath GitHub App**
   - Enable MFA on the GitHub account.
   - Accept the SignPath organization invitation and enable MFA there.
   - Install the SignPath GitHub App for the `RYZ-ProjectUp` repository and allow it to read Actions artifacts.

3. **Create the SignPath configuration**
   - Create a project with the GitHub.com trusted build system.
   - Create a signing policy for Windows Authenticode.
   - Create an artifact configuration for:
     - `ryz-projectup.exe`
     - `RYZ.ProjectUp.*.Setup.exe`
   - Note the organization ID, project slug, and signing-policy slug. They are not secrets.

4. **Add repository secrets and variables**
   - Repository secret `SIGNPATH_API_TOKEN`.
   - Repository variable `SIGNPATH_ORGANIZATION_ID`.
   - Repository variable `SIGNPATH_PROJECT_SLUG`.
   - Repository variable `SIGNPATH_SIGNING_POLICY_SLUG`.

5. **Wire the signed-release workflow**
   - The workflow must build the artifacts on a GitHub-hosted Windows runner, upload them as a workflow artifact, and submit that artifact to SignPath.
   - SignPath's GitHub connector checks that the artifact came from this GitHub workflow, so a locally built zip cannot be substituted.
   - After approval, download the signed artifacts and verify them:

   ```powershell
   signtool verify /pa /v .\RYZ.ProjectUp.0.4.2-beta.1.exe
   signtool verify /pa /v .\RYZ.ProjectUp.0.4.2-beta.1.Setup.exe
   ```

6. **Publish signed assets**
   - Replace the unsigned release assets with the signed ones.
   - Update the release notes and checksums.
   - Confirm the release page says **Signed by SignPath Foundation**, not merely "signed" or "trusted."

## Current status

The v0.4.2-beta.1 artifacts on GitHub are unsigned while SignPath onboarding is pending. Signing must not be claimed until the SignPath-signed artifacts are attached and verified.

## References

- SignPath Foundation: <https://signpath.org/>
- SignPath OSS conditions: <https://signpath.org/terms.html>
- SignPath GitHub integration: <https://docs.signpath.io/trusted-build-systems/github>
- Microsoft code-signing options: <https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options>
