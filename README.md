# AA-PQ

An Ethereum account-abstraction devnet with a browser wallet and block explorer.
The network runs Geth and Lighthouse through Kurtosis, with Alto handling
ERC-4337 UserOperations through EntryPoint v0.9.

The wallet creates a SimpleAccount, requests test ETH, and sends transfers
through the bundler. The explorer indexes blocks, smart accounts, and
EntryPoint events. Wallet keys are generated and stored in the browser.

The current implementation uses ECDSA signatures. Post-quantum signing is not
implemented.

| Service | Port |
| --- | --- |
| Wallet | 3000 |
| Explorer | 3001 |
| Alto bundler | 4337 |
| Geth RPC | Assigned by Kurtosis |

## Requirements

- Linux with Docker; the bundler uses host networking
- Node.js 22 or later
- Git
- [Kurtosis](https://docs.kurtosis.com/install/) (tested with CLI 1.20.0)
- Available ports 3000, 3001, and 4337

## Installation

```sh
git clone https://github.com/Giulio2002/AA-PQ.git
cd AA-PQ
npm ci --prefix frontend
npm ci --prefix explorer
cp .env.example .env
```

### Start the network

```sh
kurtosis run --enclave aa-devnet github.com/ethpandaops/ethereum-package@c0db06b29b8266e65c9b80b64895e07058d28d0b --args-file network_params.yaml
kurtosis port print aa-devnet el-1-geth-lighthouse rpc
```

Set `RPC_URL` in `.env` to the printed address, including the `http://` prefix:

```sh
RPC_URL=http://127.0.0.1:32773
```

The actual port depends on the host. The network uses chain ID **1337**, four
validators, and two-second slots. Client images are pinned in
`network_params.yaml`, which also funds the deployment and bundler accounts.

### Compile and deploy the contracts

From the repository root:

```sh
git clone https://github.com/eth-infinitism/account-abstraction.git
git -C account-abstraction checkout 1c6b669d0eea734e09a87e095ba15e076151718a
cd account-abstraction
npx --yes yarn@1.22.22 install --frozen-lockfile
npx hardhat compile
cd ..

set -a
. ./.env
set +a
node deploy-canonical.cjs
```

Copy the printed `ENTRY_POINT` and `FACTORY_ADDRESS` values into `.env`.
The factory address is specific to your deployment. Running the deployment
script again creates another factory.

The expected EntryPoint address is
`0x433709009B8330FDa32311DF1C2AFA402eD8D009`. Keep the pinned compiler settings:
Solidity 0.8.28, Cancun, viaIR, and 1,000,000 optimizer runs. Changing the
bytecode changes its CREATE2 address.

### Start the bundler

Reload the updated configuration, then start Alto:

```sh
set -a
. ./.env
set +a
sh start-alto.sh
docker logs --tail 50 aa-devnet-alto
```

The container is named `aa-devnet-alto`. The launcher uses a pinned image and
mounts `SafeValidator.js` as a compatibility override. It does not replace an
existing container with the same name.

### Start the wallet and explorer

Run each command in a separate terminal from the repository root:

```sh
sh scripts/run-wallet.sh
```

```sh
sh scripts/run-explorer.sh
```

Open [the wallet](http://localhost:3000) and
[the explorer](http://localhost:3001). For a remote deployment, use the host IP
instead of `localhost`.

## Usage

1. Select **Create AA wallet** to generate a key and deploy the smart account.
2. Download a key backup from **Settings**.
3. Select **Get test ETH** to fund the account.
4. Open **Send**, enter a recipient and amount, and submit the transfer.
5. Follow the explorer link in the confirmation modal or activity list to view
   the receipt.

The explorer supports searches by address, block number, transaction hash, and
UserOperation hash. Account pages show outgoing UserOperations; transaction
pages show the associated EntryPoint events.

## Tests

With the services running:

```sh
WALLET_URL=http://localhost:3000 node tests/verify-aa.mjs
```

The test creates a disposable account and transfers 0.001 test ETH. It checks
deployment, EntryPoint receipts, recipient balance changes, invalid-signature
rejection, replay rejection, and the wallet RPC method restrictions.

Recorded results and test coverage are in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Operations

Inspect the network and bundler:

```sh
kurtosis enclave inspect aa-devnet
docker logs --tail 50 aa-devnet-alto
```

Systemd units are provided for `/opt/kurtosis-aa-devnet`. Update their paths,
RPC URL, EntryPoint, and factory address before installing them on another host:

```sh
sudo cp aa-devnet-frontend.service aa-devnet-explorer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aa-devnet-frontend aa-devnet-explorer
```

Stop foreground instances before starting the systemd services on the same ports.
Deployment troubleshooting and implementation notes are in
[docs/OPERATIONS.md](docs/OPERATIONS.md).

## Development notes

Wallet creation and transfers use ERC-4337. Faucet funding and the bundler's
outer transactions use standard Ethereum transactions. Geth remains unmodified;
the UserOperation mempool is managed by Alto.

This setup is for test ETH only. Funding keys are public, the faucet is
unauthenticated, and browser keys are stored unencrypted. Backups contain the
private key. Do not use real funds or production keys.

The UI is inspired by [pq-eth-demo](https://github.com/Giulio2002/pq-eth-demo).
Third-party source and license details are in [THIRD_PARTY.md](THIRD_PARTY.md).
