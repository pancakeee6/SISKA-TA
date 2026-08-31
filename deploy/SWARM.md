# Docker Swarm deployment

SISKA runs on `swarm-manager` and joins the existing external `front-tier` overlay. The shared ingress and Cloudflare Tunnel route `siska.pbjt.web.id` to `siska_frontend`; no host port or additional tunnel is required.

## Prepare

Load both `linux/amd64` images into the manager, then place this `deploy/` directory at `/opt/siska/deploy`. Create `/opt/siska/deploy/backend.env` from `backend.env.example`, set the real secrets and external PostgreSQL URL, and keep it mode `0600`.

```bash
sudo install -d -o 10001 -g 10001 -m 0750 /opt/siska/uploads
sudo chmod 600 /opt/siska/deploy/backend.env
docker image inspect siska-backend:swarm --format '{{.Architecture}}'
docker image inspect siska-frontend:swarm --format '{{.Architecture}}'
```

Both architecture checks must print `amd64`.

## Migrate and deploy

Back up the external database and `/opt/siska/uploads` first. Alembic runs as a one-off container before the stack update.

```bash
docker run --rm --env-file /opt/siska/deploy/backend.env \
  --network front-tier siska-backend:swarm \
  python -m alembic upgrade head

cd /opt/siska
docker stack deploy --resolve-image never -c deploy/swarm.yml siska
docker service update --force siska_backend
docker service update --force siska_frontend
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

Retag the previous local images as `siska-backend:swarm` and `siska-frontend:swarm`, redeploy with `--resolve-image never`, then force-update both services as shown above. Do not automatically downgrade Alembic; restore the reviewed database backup if the schema is incompatible.
