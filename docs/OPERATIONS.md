# Operations

## Deployment proxy

`deploy-canonical.cjs` bootstraps the standard deterministic deployment proxy
and only runs on chain 1337. If Geth rejects the proxy's unprotected deployment
transaction, enable `--rpc.allow-unprotected-txs` on the disposable devnet node.
Do not enable it on an unrelated or production node.

## Alto compatibility patch

The Pimlico simulation included with Alto v1.2.7 returns `ValidationResult`
normally. Its SafeValidator instead attempts to decode the final internal
revert frame. The override in `SafeValidator.js` decodes the top-level return
with the same calldata and state overrides, retaining the validation trace,
signature, code-hash, opcode/storage, and validity checks.

The trace and simulation call can observe different latest blocks. Production
use requires block pinning and security review. Editable TypeScript source is
in `bundler-source/`; provenance and licensing are in `THIRD_PARTY.md`.

## Explorer indexing

The explorer indexes EntryPoint logs from genesis in 1,000-block chunks and
re-reads a 12-block overlap on each update. The index is held in memory and
rebuilt after restart. Restart after a deeper reorganization.

Lists are limited to 12 recent blocks, 20 confirmed operations, and 100 wallet
deployments. Address pages show up to 100 outgoing operations, not a complete
incoming-transfer history. Pending operations are not indexed.

## Browser storage and network access

Wallet storage is tied to the browser origin. Changing the hostname or port
does not move the wallet. Download a backup before clearing browser data.
There is no backup-import interface yet.

The wallet RPC proxy blocks ordinary transaction submission, but the underlying
Geth RPC still accepts Ethereum transactions. SimpleAccount also permits direct
owner calls; the browser application uses the EntryPoint path.

Restrict Geth and bundler ports with a firewall for remote deployments. The
included HTTP services, public funding keys, unencrypted key storage, and
unauthenticated faucet are intended for disposable testnets.

## Validation scope

Wallet and explorer dependency installation, live AA transactions, and browser
flows have been tested. The complete Kurtosis setup sequence has not been
replayed on a clean host. See `docs/VERIFICATION.md` for recorded results.
