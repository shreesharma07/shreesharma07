# Security Policy

This repository holds my GitHub profile: the README, the SVG assets it shows, two GitHub Actions workflows that refresh the contribution graphics, and a small Node.js script in `tools/` that builds everything. It does not run a service or store anyone's data, so the attack surface is small. If you still spot a problem, I would like to hear about it.

## Supported versions

Only the latest commit on the `production` branch is maintained. Older commits and other branches do not get fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use one of these instead:

1. **Private report on GitHub.** Open the **Security** tab of this repository and choose **Report a vulnerability**. This keeps the details private between us.
2. **Email.** Write to [shrikumarsharma1998@gmail.com](mailto:shrikumarsharma1998@gmail.com) with "Security" in the subject line.

A useful report includes:

- what you found and where (file, workflow, link or asset)
- steps to reproduce it
- the impact you expect
- any logs, screenshots or proof of concept

## What happens next

I will reply within a few days to confirm I have your report, and I will keep you updated until it is resolved. If the issue is real, I will fix it and credit you in the commit or advisory, unless you would rather stay anonymous.

## Scope

In scope:

- the workflows in `.github/workflows/`
- the build script and its dependencies in `tools/`
- links or embedded images in the README that point somewhere unsafe

Out of scope:

- third-party services the README embeds, such as shields.io, skillicons.dev, WakaTime, GitHub Readme Stats and Streak Stats. Please report those to their maintainers.
- findings that need a compromised GitHub account or physical access to my machine

## Safe harbour

If you research in good faith, avoid privacy violations and data destruction, and give me reasonable time to fix an issue before you disclose it, I will not take legal action against you.

## How this repository is protected

- Two-factor authentication is on for my GitHub account.
- Secret scanning is enabled for the repository.
- `master` is a protected branch: changes need a pull request, an approving review, signed commits and linear history.
- The workflows request only the permissions they need and use pinned action versions.

There is no bug bounty programme, but every responsible report is appreciated.

---

<p align="center">
  <b>Thank you for helping keep this repository safe.</b>
  <br><br>
  <img src="Images/Background/thank-you-no-bg.png" alt="Thank you" height="150">
</p>
