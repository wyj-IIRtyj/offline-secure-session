# Security Policy

## Reporting a security issue

Please do not publish exploitable security issues in a public GitHub issue before they are fixed.

Use GitHub's private vulnerability reporting feature for this repository when available, or contact the repository owner privately through GitHub.

Helpful reports should include:

- affected browser and version;
- exact reproduction steps;
- whether the issue exposes private key material, session key material, plaintext, or enables message forgery;
- a minimal proof of concept when safe to share.

## Security scope

The project is intended to protect message confidentiality and integrity for a temporary verified session established with ECDH and a human-verified safety code.

The project does not claim to protect against a compromised endpoint, malicious browser extensions, screen capture, clipboard monitoring, or an attacker who can control the user's operating system.
