# Docker Swarm deployment

SISKA runs on `swarm-manager` and joins the existing external `front-tier` overlay. The shared ingress and Cloudflare Tunnel route `siska.pbjt.web.id` to `siska_frontend`; no host port or additional tunnel is required.

## Prepare

Place this `deploy/` directory at `/opt/siska/deploy`. Create `/opt/siska/deploy/backend.env` from `backend.env.example`, set the real secrets and external PostgreSQL URL, and keep it mode `0600`. The stack pulls immutable `linux/amd64` images from Docker Hub.

```bash
sudo install -d -o 10001 -g 10001 -m 0750 /opt/siska/uploads
sudo chmod 600 /opt/siska/deploy/backend.env
docker pull mizzcode/siska-backend:1.0.1
docker pull mizzcode/siska-frontend:1.0.1
docker image inspect mizzcode/siska-backend:1.0.1 --format '{{.Architecture}}'
docker image inspect mizzcode/siska-frontend:1.0.1 --format '{{.Architecture}}'
```

Both architecture checks must print `amd64`.

## Migrate and deploy

Back up the external database and `/opt/siska/uploads` first. Alembic runs as a one-off container before the stack update.

```bash
docker run --rm --env-file /opt/siska/deploy/backend.env \
  --network front-tier mizzcode/siska-backend:1.0.1 \
  python -m alembic upgrade head

cd /opt/siska
docker stack deploy --resolve-image always -c deploy/swarm.yml siska
docker stack services siska
```

Install `deploy/siska.pbjt.web.id.conf` under `/opt/priv-ingress/conf.d/`, validate it from the ingress container, then force-update `ingress_layer_nginx`.

## Verify

```bash
docker stack ps siska
curl -fsS -H 'Host: siska.pbjt.web.id' http://ingress_layer_nginx/health
curl -fsSI -H 'Host: siska.pbjt.web.id' http://ingress_layer_nginx/admin/users
curl -fsSI -H 'Host: siska.pbjt.web.id' http://ingress_layer_nginx/kampus.jpg
curl -fsS https://siska.pbjt.web.id/health
```

The SPA route must return `200`, and `/kampus.jpg` must return `image/jpeg`, not `text/html`. Confirm `/ws/attendance` is connected in browser developer tools and verify one uploaded file survives a backend task restart.

## Roll back

Change both image tags in `deploy/swarm.yml` to the previous known-good Docker Hub version, then redeploy with `--resolve-image always`. Do not automatically downgrade Alembic; restore the reviewed database backup if the schema is incompatible.
