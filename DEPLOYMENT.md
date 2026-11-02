# Deployment

## Web (GitHub Pages)

`.github/workflows/pages.yml` runs on every push to `main`:

1. `npm ci --include=optional`
2. `npm test` — the rules/generator suite must pass
3. `npm run build`
4. copies the build to `dist/play/` so the arcade can link to `/play/`
5. publishes `dist/` to GitHub Pages

`public/CNAME` contains `hexodus.littlejoyarcade.site`, and the repository's Pages
custom domain is set to the same host. GitHub issues the certificate after the DNS
record exists; until it does, the host only serves the `*.github.io` certificate
and HTTPS fails.

### DNS

One record, at the registrar (GoDaddy), leaving every other record alone:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `hexodus` | `jd4rider.github.io` | 600 |

Then set the Pages custom domain:

```bash
gh api -X PUT repos/jd4rider/hexodus/pages -f cname=hexodus.littlejoyarcade.site
```

Verify:

```bash
dig +short hexodus.littlejoyarcade.site CNAME
curl -sI https://hexodus.littlejoyarcade.site/play/ | head -3
curl -s https://hexodus.littlejoyarcade.site/play/ | grep -o '<title>[^<]*</title>'
```

## Desktop installers

`npm run dist:mac`, `dist:win` and `dist:linux` build locally. In CI, push a tag:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The **Release apps** workflow builds a macOS DMG (arm64 + x64), a Windows NSIS
installer and a Linux AppImage, then attaches them to the GitHub release. Electron
runs with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`,
and the game has no preload bridge or privileged IPC.

## Rollback

Pages keeps the previous deployment: re-run a successful workflow from the Actions
tab, or revert the commit on `main`. DNS never changes for a code rollback.
