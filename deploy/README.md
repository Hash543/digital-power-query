# Deployment (GitHub Actions → VPS)

Every push to `main` runs lint, type-check, tests and a production build. When those pass, the
release goes to the VPS. Pull requests run CI only.

```
GitHub Actions                                   VPS
──────────────                                   ───
npm ci → lint → tsc → test → build
package-release.sh → app-<sha>.tar.gz  ──scp──▶  /opt/digital-power-query/incoming/
                                       ──ssh──▶  bin/remote-deploy.sh <sha>
                                                   ├─ unpack → releases/<time>-<sha>/
                                                   ├─ current → new release (symlink)
                                                   ├─ systemctl restart digital-power-query
                                                   ├─ GET 127.0.0.1:18629/api/health == <sha>
                                                   └─ on failure: roll back to previous release
Apache :443 ──proxy──▶ node server.js (127.0.0.1:18629, systemd)
```

Layout on the VPS:

```
/opt/digital-power-query/
├── bin/remote-deploy.sh     uploaded by every deploy
├── incoming/                tarballs waiting to be unpacked
├── releases/<time>-<sha>/   last 5 releases are kept
├── current -> releases/…    what systemd runs
└── shared/.env              optional runtime env (not in git)
```

## One-time VPS setup

These steps assume Ubuntu or Debian on x86-64 (the build runs on `ubuntu-latest`), with root access.

1. **Install Node.js 24**, then check `which node` prints `/usr/bin/node`. If it doesn't, change `ExecStart` in the service file to match.

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Create the deploy user and app directory**:

   ```bash
   sudo adduser --system --group --shell /bin/bash --home /home/deploy deploy
   sudo mkdir -p /opt/digital-power-query/{bin,incoming,releases,shared}
   sudo chown -R deploy:deploy /opt/digital-power-query
   ```

3. **Allow the deploy user to restart only this service**. Check the path with `command -v systemctl`, then run `sudo visudo -f /etc/sudoers.d/digital-power-query` and add:

   ```
   deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart digital-power-query, /usr/bin/systemctl status digital-power-query *
   ```

4. **Install the systemd unit** from [`digital-power-query.service`](digital-power-query.service):

   ```bash
   sudo cp digital-power-query.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable digital-power-query
   ```

   It starts on the first deploy, once `current` exists.

5. **Create an SSH key for GitHub Actions**. Do this on your own machine, not on the VPS:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions-dpq" -f dpq_deploy
   ```

   Append `dpq_deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the VPS. Set permissions to 700 for `.ssh` and 600 for the file, both owned by `deploy`.

6. **Configure Apache**. [`apache-vhost.example.conf`](apache-vhost.example.conf) is a starting point. You need `a2enmod proxy proxy_http headers`. `flushpackets=on` keeps streamed pages from being buffered.

## GitHub configuration

In the repo, go to **Settings → Environments** and create an environment named `production`. Optionally add a required reviewer to approve each deploy. Then add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP |
| `VPS_PORT` | SSH port (optional, default 22) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | contents of the private key `dpq_deploy` |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -p <port> <host>`, checked against the VPS fingerprint (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the VPS). Only the key type and key are used, so it doesn't matter whether you scanned the IP or the domain name. The deploy log prints the pinned fingerprints. |

Finally, under **Settings → Secrets and variables → Actions → Variables**, add the repository variable `DEPLOY_ENABLED` = `true`. Until it is set, pushes run CI only and the deploy job is skipped.

## Port

The app listens on **127.0.0.1:18629** by default. That port is outside the common dev ports (3000, 5000, 8000, 8080), does not collide with other apps on this VPS (claw-monitor uses 18417, MySQL 3306), and is below the Linux ephemeral range (32768–60999). Before the first deploy, check that nothing else uses it:

```bash
sudo ss -ltnp | grep ':18629' || echo "18629 is free"
```

To use another port, set it in **one** place on the VPS:

- `Environment=PORT=…` in `/etc/systemd/system/digital-power-query.service`, then run `sudo systemctl daemon-reload`, **or**
- `PORT=…` in `/opt/digital-power-query/shared/.env`, which takes precedence.

Then change the Apache `ProxyPass` / `ProxyPassReverse` lines to match. Nothing in the repo or in GitHub needs to change, because `remote-deploy.sh` reads the port from `.env` or the systemd unit.

## Operations

```bash
sudo systemctl status digital-power-query        # service state
journalctl -u digital-power-query -f             # logs
curl http://127.0.0.1:18629/api/health            # running commit
ls -1t /opt/digital-power-query/releases         # available releases
```

**Manual rollback**: point `current` at an older release, then restart:

```bash
cd /opt/digital-power-query
ln -sfn releases/<older-release> current
sudo systemctl restart digital-power-query
```

**Re-deploy a commit**: re-run the workflow for that commit from the GitHub Actions tab.
