# Live verification — 2026-09-10

Ran `WALLET_URL=http://157.180.109.133:3000 node tests/verify-aa.mjs`.

- Smart account: `0xC7556aaF273Eb209d9F1611F596B39b3878FdeD1`.
- Creation UserOperation:
  `0x43ed1fca20e99d98722cc1d22e6920f4261789abd9de1d6158ac9fd82e1c9efa`.
- Creation transaction:
  `0x05fb47e094de928ab114ea22a0d258e310fb9d1921eed2b8d75ef7d2217c5722`.
- Transfer UserOperation:
  `0x0434d4e1369d545ffcfdcf044831ef6b366a1bead8519dba8a7c4c260134163c`.
- [Transfer receipt in the live explorer](http://157.180.109.133:3001/#tx/0x38c65af41d5e016bfa7f74a7d1a0b562c4ab14ced7150412d1d7cf96437875a8).

Both outer transactions target canonical EntryPoint
`0x433709009B8330FDa32311DF1C2AFA402eD8D009`, selector `0x765e827f` (`handleOps`).
Both emit successful `UserOperationEvent` logs for the smart-account sender.
The test checks code at the deployed address and a recipient balance increase
of exactly 0.001 ETH. Wrong-owner signature, replay, and ordinary transaction
submission via the frontend `/rpc` proxy are rejected.

Explorer browser checks: live statistics, UserOperation detail, AA bundle
receipt, block search, AA address lookup, desktop and mobile screenshots.
No page JavaScript errors; tested mobile receipt width 390px without overflow.
Wallet browser checks: mandatory creation, AA sends, panel switching,
settings backup, and reload recovery. No extension wallet was used.

Fresh npm installs of wallet/explorer at ethers 6.17.0 reported zero known
vulnerabilities. This does not audit the contracts, Alto, or application.
See README for the clean-host test limitation and security caveats.

These hashes refer to this particular chain and will disappear after a devnet
reset. The test script generates fresh proof on another deployment.
