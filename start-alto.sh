#!/bin/sh
set -eu
: "${RPC_URL:?Set RPC_URL to your devnet RPC}"
AA_PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
docker run -d --name aa-devnet-alto --restart unless-stopped --network host -v "$AA_PROJECT_DIR/SafeValidator.js:/app/src/esm/rpc/validation/SafeValidator.js:ro" ghcr.io/pimlicolabs/alto@sha256:8420c602c1b4618d4e244e693f8d4cfd28fc86fd5808b74fdd185730f934e29e \
  --entrypoints "${ENTRY_POINT:-0x433709009B8330FDa32311DF1C2AFA402eD8D009}" \
  --executor-private-keys "${EXECUTOR_PRIVATE_KEY:-0xbcdf20249abf0ed6d944c0288fad489e33f66b3960d9e6229c1cd214ed3bbe31}" \
  --utility-private-key "${FAUCET_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}" \
  --min-entity-stake 0 --min-entity-unstake-delay 0 --rpc-url "$RPC_URL" \
  --port 4337 --block-time 2000 --enable-cors true --log-level warn
