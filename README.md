# AA-PQ — AA PQ testnet

An ERC-4337-only **wallet interface**, a vanilla Kurtosis Ethereum devnet, and
a read-only AA-aware explorer. Wallet on **3000**, explorer on **3001**.

The interface takes visual inspiration from
[Giulio2002/pq-eth-demo](https://github.com/Giulio2002/pq-eth-demo): a light
wallet dashboard and a navy/white explorer. It does **not** include that
project's PQ contracts, signature algorithms, swaps, or custom chain changes.

## Is it really AA?

Yes for the wallet's deployment and outgoing transfers:

```text
Browser owner key → signed UserOperation → Alto validation + UserOp mempool
                 → bundler handleOps transaction → EntryPoint → SimpleAccount.execute
```

- New users must create an AA smart account before accessing the dashboard.
- Wallet, Send, and Settings are separate hash-routed panels.
- There is no extension-wallet connection or ordinary wallet-send fallback.
- The wallet's `/rpc` proxy rejects `eth_sendTransaction` and
  `eth_sendRawTransaction`. Its `/bundler` endpoint accepts ERC-4337 methods.
- Creation and sends are confirmed using EntryPoint `UserOperationEvent` logs.
- A test faucet funds the smart account with ordinary ETH transfers. The
  bundler is an EOA sending an ordinary outer transaction to EntryPoint.
  Initial contract deployments are also ordinary transactions. That is normal
  for ERC-4337; claiming that *every chain transaction* is AA would be false.
- Vanilla Geth still supports ordinary Ethereum transactions through its own
  RPC port. This is an AA-only application, **not an AA-only consensus chain**.
- The owner is a browser-generated secp256k1 signer. The wallet address is a
  deployed smart contract, not that owner's EOA. **ECDSA is not post-quantum.**
  “AA PQ testnet” is the network name, not a cryptographic claim.

## Components

| Component | Implementation | Port |
| --- | --- | --- |
| Wallet / faucet / constrained RPC proxies | Node + ethers, plain browser JS | 3000 |
| Explorer | Node + ethers, live EntryPoint log indexing | 3001 |
| AA bundler and special UserOperation mempool | Alto v1.2.7, safe validation enabled | 4337 |
| Execution | Vanilla Geth in Kurtosis | dynamically assigned |
| Consensus | Lighthouse, four validators, 2-second slots | dynamically assigned |
| Smart account | eth-infinitism SimpleAccount, EntryPoint v0.9 | on chain |

No custom Geth mempool has been installed. The special mempool is Alto's
UserOperation pool, separate from Geth's ordinary transaction pool.

## Requirements

Use a **Linux Docker host** (the Alto launcher uses host networking), Node.js
22+, Git, Docker, and [Kurtosis](https://docs.kurtosis.com/install/).
The deployed host uses Kurtosis CLI 1.20.0. Allow several GB of free RAM and
disk space for Ethereum clients and contract compilation. Ports 3000, 3001,
and 4337 must be unused. Do not replace services already using those ports.

## Run a new devnet

### 1. Get the application

```sh
git clone https://github.com/Giulio2002/AA-PQ.git
cd AA-PQ
npm ci --prefix frontend
npm ci --prefix explorer
cp .env.example .env
```

For a private repository, authenticate with GitHub first. `.env` is ignored.
The keys in `.env.example` are **well-known disposable test keys**.

### 2. Start Geth and Lighthouse

```sh
kurtosis run --enclave aa-devnet github.com/ethpandaops/ethereum-package@c0db06b29b8266e65c9b80b64895e07058d28d0b --args-file network_params.yaml
kurtosis enclave inspect aa-devnet
kurtosis port print aa-devnet el-1-geth-lighthouse rpc
```

Set `RPC_URL` in `.env` to `http://` followed by the printed address. Example:
`RPC_URL=http://127.0.0.1:32773`. The port is not guaranteed to be 32773 on a
fresh host. `network_params.yaml` pins the client images and prefunds the
faucet/deployer and executor. Chain ID is 1337.

### 3. Compile the pinned contracts

```sh
git clone https://github.com/eth-infinitism/account-abstraction.git
git -C account-abstraction checkout 1c6b669d0eea734e09a87e095ba15e076151718a
cd account-abstraction
npx --yes yarn@1.22.22 install --frozen-lockfile
npx hardhat compile
cd ..
```

The pinned configuration uses Solidity 0.8.28, Cancun, viaIR, optimizer
1,000,000 runs. Do not alter the EntryPoint compiler settings: its bytecode
determines the canonical CREATE2 address.

### 4. Deploy EntryPoint and the account factory

```sh
set -a
. ./.env
set +a
node deploy-canonical.cjs
```

The deployment script refuses chains other than 1337. It bootstraps the
standard deterministic deployment proxy if absent, deploys canonical
EntryPoint v0.9, then deploys a SimpleAccountFactory. It prints `ENTRY_POINT`
and `FACTORY_ADDRESS`: copy these values into `.env`.

Expected EntryPoint: `0x433709009B8330FDa32311DF1C2AFA402eD8D009`.
**Factory addresses vary with deployer nonce. Do not use the live host's
factory address for a new chain.** Re-running this script deploys another
factory; it does not overwrite the previous one or migrate existing wallets.

If a new execution-client configuration rejects the deterministic proxy's
unprotected deployment transaction, enable `--rpc.allow-unprotected-txs`
for this disposable local Geth instance only, or use the upstream
hardhat-deploy deterministic-deployment workflow. Never apply that setting
to an unrelated or production node.

### 5. Start the AA bundler

```sh
set -a
. ./.env
set +a
sh start-alto.sh
docker logs --tail 50 aa-devnet-alto
```

The launcher uses the pinned Alto image digest and a read-only compatibility
override described below. It does not delete or replace an existing container
with that name. If one exists, inspect it before deciding whether to reuse it.

### 6. Start wallet and explorer in separate terminals

From the repository root:

```sh
sh scripts/run-wallet.sh
```

In another terminal:

```sh
sh scripts/run-explorer.sh
```

Open `http://localhost:3000` and `http://localhost:3001` (or the host IP).
Create the AA wallet, download its key backup, get test ETH, then use Send.
The two services have independent lifecycles. Explorer traffic is read-only.

## Explorer

- Live block height, indexed operation count, and AA deployment count.
- Latest blocks, latest confirmed UserOperations, and AA wallets.
- Search a block number, address, transaction hash, or UserOperation hash.
- Transaction detail distinguishes an AA bundle from an ordinary transaction.
- UserOperation detail includes the smart-account sender, nonce, success,
  actual gas cost, paymaster, and outer bundler transaction.
- Wallet activity links directly to explorer receipts.

The lightweight indexer scans EntryPoint events from genesis in 1,000-block
chunks, then re-reads a 12-block overlap to handle short reorganizations. It
rebuilds in memory after restart. This is a small-devnet explorer, not an
archive-scale indexer: deep reorgs require restart, lists are bounded (12
blocks, 20 operations, 100 wallets), and address pages show operations **from**
the account, not a complete incoming-transfer history. Pending operations are
not indexed; confirmed events are the source of truth. There are no fake USD
prices or claimed PQ statistics.

## Verification

```sh
WALLET_URL=http://localhost:3000 node tests/verify-aa.mjs
```

This test **writes to the disposable devnet**: creates a new wallet, funds it,
and sends 0.001 test ETH. It checks actual deployed code, EntryPoint receipts,
recipient balance change, wrong-owner signature rejection, replay rejection,
and rejection of ordinary sends through the wallet proxy. It prints hashes
you can inspect on port 3001. Browser tests also covered onboarding, sending,
settings, backup download, reload recovery, and mobile layout.

The full new-Kurtosis installation sequence is documented from the deployed
stack; it has not yet been replayed end-to-end on a completely clean host.
Wallet/explorer installs, live AA tests, and browser tests were run.

## Alto compatibility override

Alto v1.2.7's included Pimlico simulation returns `ValidationResult` normally,
but its SafeValidator attempts to decode the final *internal* revert frame as
the validation result. `SafeValidator.js` keeps the full `debug_traceCall`
and parses the simulation's top-level normal return using the same calldata
and state overrides. Signature, code-hash, opcode/storage, and validity checks
remain in place; safe mode is not disabled. Invalid signatures are rejected.

This is a devnet compatibility patch, **not an audited security upgrade**.
The separate trace and call can observe different latest blocks; this is not
suitable for a production bundler without further review and block pinning.
Preferred TypeScript source is in `bundler-source/`; see `THIRD_PARTY.md` and
the included GPL license for provenance and rebuilding.

## Existing server and systemd

The existing deployment is isolated in `/opt/kurtosis-aa-devnet`:

- Wallet: `http://157.180.109.133:3000`
- Explorer: `http://157.180.109.133:3001`
- Factory: `0x610178dA211FEF7D417bC0e6FeD39F05609AD788`
- Enclave: `aa-devnet`; container: `aa-devnet-alto`.

Example units are included for this path. On another host, edit the paths,
RPC port, EntryPoint and factory environment first. Install only these units:

```sh
sudo cp aa-devnet-frontend.service aa-devnet-explorer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aa-devnet-frontend aa-devnet-explorer
systemctl status aa-devnet-frontend aa-devnet-explorer
docker logs --tail 50 aa-devnet-alto
```

Do not run systemd and the foreground scripts on the same ports together.
No Caddy, Lantern, or unrelated host service configuration is needed.

## Safety and limitations

This is deliberately a toy testnet: public prefunded keys, unauthenticated
faucet, plain HTTP, unencrypted browser key storage, and no production abuse
controls. Never use real funds or valuable keys. A downloaded backup contains
the owner private key. There is no backup-import UI yet. Browser storage is
origin-specific; changing host/port does not transfer the wallet. Do not clear
browser data without a backup. The on-chain SimpleAccount also permits its
owner to call it directly; the **application** only uses the EntryPoint path.

For remote experiments restrict raw Geth and bundler ports with your host's
firewall, use TLS before handling any sensitive keys, and do not treat the
wallet RPC allowlist as a substitute for protecting the underlying node.
