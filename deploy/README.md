# SISKA Docker Compose deployment

This guide deploys SISKA to one Ubuntu VM with Docker Compose and immutable images from GitHub Container Registry (GHCR). Nginx serves the frontend and proxies `/api/` and `/ws/` to the backend. The backend has no public host port.

PostgreSQL is external, such as Aiven PostgreSQL. `compose.yml` does not run a database container.

This guide is not for Docker Swarm or the PBJT environment. Use [SWARM.md](SWARM.md) for that deployment.

## Prerequisites

Build host:

- WSL 2 with Docker Engine or Docker Desktop WSL integration
- Docker Buildx
- A checkout of this repository
- A GHCR token allowed to push packages

Ubuntu VM:

- An AMD64 Ubuntu host with Docker Engine and the Compose plugin
- Access to the external PostgreSQL service
- A GHCR token allowed to pull the private images
- A DNS name and HTTPS reverse proxy or load balancer for production access

Run `docker info` and `docker compose version` before continuing. The examples use `ghcr.io/OWNER` and the immutable release tag `2026.08.30-1`. Replace them with your registry namespace and release tag. Don't deploy `latest`, and don't reuse a tag for different image contents.

## 1. Build and push from WSL

Run these commands from the repository root in WSL. Define the registry login variables in this shell before calling `docker login`.

```bash
export REGISTRY=ghcr.io/OWNER
export VERSION=2026.08.30-1
export REGISTRY_USER=OWNER
export REGISTRY_TOKEN=REPLACE_WITH_GHCR_PUSH_TOKEN

printf '%s' "$REGISTRY_TOKEN" | docker login ghcr.io \
  --username "$REGISTRY_USER" --password-stdin

docker buildx inspect siska-builder >/dev/null 2>&1 \
  && docker buildx use siska-builder \
  || docker buildx create --name siska-builder --driver docker-container --use
docker buildx inspect --bootstrap

docker buildx build --platform linux/amd64 \
  --tag "$REGISTRY/siska-backend:$VERSION" --push ./backend
docker buildx build --platform linux/amd64 \
  --tag "$REGISTRY/siska-frontend:$VERSION" --push ./frontend
```

The backend image runs as UID and GID `10001`. The frontend image contains the Vite build and Nginx proxy configuration.

## 2. Prepare the Ubuntu VM

Create the deployment directories. The deployment administrator owns the Compose files, while the backend container owns uploads.

```bash
sudo install -d -o "$USER" -g "$(id -gn)" -m 0755 /opt/siska
install -d -m 0755 /opt/siska/deploy
sudo install -d -o 10001 -g 10001 -m 0750 /opt/siska/uploads
```

From the repository root in WSL, copy only the deployment files to the VM:

```bash
scp compose.yml deploy/backend.env.example VM_USER@VM_HOST:/opt/siska/
ssh VM_USER@VM_HOST \
  'mv /opt/siska/backend.env.example /opt/siska/deploy/backend.env.example'
```

Replace `VM_USER` and `VM_HOST`. The VM does not need the source tree.

The resulting layout is:

```text
/opt/siska/
├── compose.yml
├── .env
├── deploy/
│   ├── backend.env.example
│   └── backend.env
└── uploads/
```

Log in to GHCR on the VM with a pull-capable token. Define both login variables in the VM shell before the login command.

```bash
export REGISTRY_USER=OWNER
export REGISTRY_TOKEN=REPLACE_WITH_GHCR_PULL_TOKEN

printf '%s' "$REGISTRY_TOKEN" | docker login ghcr.io \
  --username "$REGISTRY_USER" --password-stdin
```

Create `/opt/siska/.env` for non-secret Compose settings. Compose reads this file automatically when commands run from `/opt/siska`.

```bash
cd /opt/siska
cat > .env <<'EOF'
REGISTRY=ghcr.io/OWNER
VERSION=2026.08.30-1
HTTP_PORT=80
UPLOADS_DIR=/opt/siska/uploads
EOF
chmod 0644 .env
```

Create the backend environment file from the supplied template, edit it only on the VM, and restrict it to the current administrator account.

```bash
cd /opt/siska
test -e deploy/backend.env || install -m 0600 deploy/backend.env.example deploy/backend.env
chmod 0600 deploy/backend.env
```

Set these values in `deploy/backend.env`:

- `DATABASE_URL`: the external PostgreSQL or Aiven connection URL, including the required TLS option
- `SECRET_KEY`: a new, long random value
- `DEVICE_ID` and `DEVICE_TOKEN`: ML API device credentials
- `ML_ADMIN_USERNAME` and `ML_ADMIN_PASSWORD`: ML API administrator credentials
- `CORS_ORIGINS`: a JSON array containing the public HTTPS origin, for example `https://siska.example.com` as `CORS_ORIGINS=["https://siska.example.com"]`

The public `AI_API_URL` from the example can stay unchanged when that service is used. Keep real secrets only in `/opt/siska/deploy/backend.env`. Never place them in `.env`, copy them back to a workstation, or commit them.

The uploads bind mount maps `/opt/siska/uploads` to `/app/uploads`. Keep it owned by UID and GID `10001` so the non-root backend process can write to it:

```bash
sudo chown -R 10001:10001 /opt/siska/uploads
sudo chmod 0750 /opt/siska/uploads
```

## 3. First deployment

Before the first deployment, confirm the external database exists and accepts connections from the VM. Take a provider snapshot or backup if it already contains data.

Pull both application images and the migration image, verify their architecture, run Alembic explicitly, then start the services:

```bash
cd /opt/siska
docker compose --profile tools pull

set -a
. ./.env
set +a
docker image inspect "$REGISTRY/siska-backend:$VERSION" --format '{{.Architecture}}'
docker image inspect "$REGISTRY/siska-frontend:$VERSION" --format '{{.Architecture}}'

docker compose --profile tools run --rm migrate
docker compose up -d backend frontend
docker compose ps
```

Both architecture checks must print `amd64`. The migration command must exit successfully before the application starts. The frontend starts after the backend health check passes.

## 4. Verify the deployment

Run the HTTP checks on the VM. `/health` on the public port is served by Nginx, so it checks the frontend container. The second command checks FastAPI inside the backend container.

```bash
cd /opt/siska
set -a
. ./.env
set +a

curl -fsS "http://127.0.0.1:${HTTP_PORT:-80}/health"
docker compose exec backend python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
curl -fsSI "http://127.0.0.1:${HTTP_PORT:-80}/admin/users"
curl -fsSI "http://127.0.0.1:${HTTP_PORT:-80}/kampus.jpg" \
  | grep -i '^content-type: image/jpeg'
curl -sS -o /dev/null -w '%{http_code}\n' \
  "http://127.0.0.1:${HTTP_PORT:-80}/api/v1/users/"
docker compose exec backend sh -c 'test -w /app/uploads'
```

Expected results:

- Frontend `/health` returns `ok`.
- Internal backend `/health` returns `{"status":"healthy"}`.
- The direct SPA route `/admin/users` returns HTTP `200`.
- `/kampus.jpg` reports `Content-Type: image/jpeg`, not `text/html`.
- `/api/v1/users/` returns HTTP `401` without an access token. This expected denial proves the API proxy reaches the protected backend route.
- The uploads write test exits with status `0`.

Open the public HTTPS site in a browser and confirm `/ws/attendance` reaches status `101 Switching Protocols` in developer tools. Create or update one face image through the normal admin workflow and note its `/api/v1/uploads/` URL. Confirm a file appears under `/opt/siska/uploads`, recreate the backend, then reload the noted URL and confirm it still returns the image:

```bash
cd /opt/siska
find /opt/siska/uploads -type f
docker compose up -d --force-recreate backend
docker compose ps
```

## 5. Routine upgrade

Build and push a new immutable tag from WSL as described above. On the VM, back up the database and uploads, change only `VERSION` in `/opt/siska/.env`, then deploy the new release:

```bash
cd /opt/siska
BACKUP_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
UPLOAD_BACKUP="/opt/siska-uploads-$BACKUP_TIMESTAMP.tar.gz"
sudo tar -C /opt/siska -czf "$UPLOAD_BACKUP" uploads
sudo gzip -t "$UPLOAD_BACKUP"
sudo sha256sum "$UPLOAD_BACKUP" | sudo tee "$UPLOAD_BACKUP.sha256"
sed -i 's/^VERSION=.*/VERSION=2026.08.30-2/' .env

docker compose --profile tools pull
docker compose --profile tools run --rm migrate
docker compose up -d backend frontend
docker compose ps
```

Run the full verification section after every upgrade. Never put Alembic migration in an automatic container startup path.

## Backups

Treat the external database and `/opt/siska/uploads` as one release backup set.

- Use the PostgreSQL provider's snapshot or backup process before every migration.
- Record the database backup identifier, deployed `VERSION`, and upload archive name together.
- Store upload archives outside `/opt/siska/uploads` and copy them to protected backup storage.
- Periodically test both database and upload restores in a non-production environment.

Create an upload archive manually with:

```bash
BACKUP_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
UPLOAD_BACKUP="/opt/siska-uploads-$BACKUP_TIMESTAMP.tar.gz"
sudo tar -C /opt/siska -czf "$UPLOAD_BACKUP" uploads
sudo gzip -t "$UPLOAD_BACKUP"
sudo sha256sum "$UPLOAD_BACKUP" | sudo tee "$UPLOAD_BACKUP.sha256"
```

Keep the checksum beside the archive and verify it with `sha256sum -c` before a restore. Confirm the external database snapshot reports a successful, restorable state before running Alembic.

## Logs and troubleshooting

```bash
cd /opt/siska
docker compose ps
docker compose logs --tail=200 frontend
docker compose logs --tail=200 backend
docker compose logs -f backend frontend
docker compose config
```

Common checks:

- If the frontend stays pending, inspect backend health and logs first.
- If the backend cannot start, check the external `DATABASE_URL`, Aiven allowlist, TLS settings, and database availability.
- If image pulls fail, define `REGISTRY_USER` and `REGISTRY_TOKEN` again, repeat `docker login ghcr.io`, and confirm the token can read the package.
- If uploads fail, run `sudo chown -R 10001:10001 /opt/siska/uploads` and check free disk space.
- If a SPA asset returns HTML, confirm the full frontend image was built and that the requested asset exists in the Vite output.
- If the API works but browser requests fail, confirm `CORS_ORIGINS` contains the exact public HTTPS origin and valid JSON.
- If a migration fails, don't start the new application version. Read the one-off container output and fix the database or release before retrying.

## Rollback

Set `VERSION` to the previous immutable image tag, pull it, and recreate both services:

```bash
cd /opt/siska
sed -i 's/^VERSION=.*/VERSION=PREVIOUS_IMMUTABLE_TAG/' .env
docker compose pull backend frontend
docker compose up -d backend frontend
docker compose ps
```

Run the verification section again. Don't run an automatic Alembic downgrade. If the failed release applied a schema change that is incompatible with the previous images, stop the application and restore the reviewed external PostgreSQL backup according to the provider's procedure. Restore the matching upload archive only if upload data changed or was damaged.
