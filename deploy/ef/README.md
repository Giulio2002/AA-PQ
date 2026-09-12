# EF deployment

Deployment layout for the dedicated Debian host:

- Application: `/opt/aa-pq/app`
- Node.js: `/opt/aa-pq/node-v22.23.2-linux-x64`
- Kurtosis enclave: `aa-pq`
- Configuration: `/opt/aa-pq/app/.env` (mode 600; not committed)
- Services: `aa-pq-wallet`, `aa-pq-explorer`, `aa-pq-network`
- Bundler container: `aa-devnet-alto`

The wallet runs on 3000 and the explorer on 3001 as `Giulio2002`. These units
use Node 22.23.2 without replacing Debian's system Node installation.

Install the units after creating the Kurtosis enclave and `.env`:

```sh
sudo cp deploy/ef/aa-pq-network.service deploy/ef/aa-pq-wallet.service deploy/ef/aa-pq-explorer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aa-pq-network aa-pq-wallet aa-pq-explorer
```

`protect-network.sh` restricts inbound traffic from `eth0` and `eth1` to
containers on the `bridge` and `kt-aa-pq` networks, and blocks non-loopback
access to port 4337. This assumes a dedicated Docker installation containing
only AA-PQ/Kurtosis. Adapt it before using a shared Docker host. Host firewall
policies and EF's Teleport/Vector configuration are not replaced.

Kurtosis service containers have `unless-stopped` restart policies. Container
volumes retain chain state. The firewall unit runs after Docker on boot and
on Docker service restarts. No host reboot was performed during deployment.

Health checks:

```sh
sudo kurtosis enclave inspect aa-pq
sudo systemctl status aa-pq-wallet aa-pq-explorer aa-pq-network
sudo docker logs --tail 30 aa-devnet-alto
curl http://127.0.0.1:3000/api/config
curl http://127.0.0.1:3001/api/overview
WALLET_URL=http://127.0.0.1:3000 /opt/aa-pq/node-v22.23.2-linux-x64/bin/node tests/verify-aa.mjs
```

The verification test deploys a disposable wallet and sends test ETH.
This is a fresh chain, independent of the previous deployment. Browser wallets
from a different origin are not automatically migrated. HTTP remains enabled;
HTTPS requires a domain and ingress configuration.
