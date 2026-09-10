import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const root = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.env.PORT || 3000);
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:18545";
const bundlerUrl = process.env.BUNDLER_URL || "http://127.0.0.1:4337";
const entryPoint = process.env.ENTRY_POINT || "";
const faucetKey = process.env.FAUCET_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const provider = new ethers.JsonRpcProvider(rpcUrl);
const faucet = new ethers.Wallet(faucetKey, provider);
const factoryAddress = process.env.FACTORY_ADDRESS || '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';
const factory = new ethers.Contract(factoryAddress, ['function getAddress(address,uint256) view returns(address)', 'function createAccount(address,uint256) returns(address)'], provider);
const packedType = '(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)';
const ep = new ethers.Contract(entryPoint, [`function getUserOpHash(${packedType}) view returns(bytes32)`, 'function getNonce(address,uint192) view returns(uint256)'], provider);

async function prepareWallet(req, res) {
  try {
    const {owner, salt = '0', recipient, amount} = await body(req);
    if (!ethers.isAddress(owner) || owner === ethers.ZeroAddress || !/^\d{1,30}$/.test(String(salt))) return json(res,400,{error:'Invalid owner or account number'});
    const sender = await factory['getAddress(address,uint256)'](owner, salt);
    const deployed = await provider.getCode(sender) !== '0x';
    const balance = ethers.formatEther(await provider.getBalance(sender));
    if(deployed && !recipient) return json(res,200,{sender,deployed,balance});
    if(recipient && (!deployed || !ethers.isAddress(recipient) || recipient === ethers.ZeroAddress || !/^\d{1,12}(\.\d{1,18})?$/.test(String(amount)) || ethers.parseEther(amount) <= 0n)) return json(res,400,{error:'Enter a valid recipient and positive ETH amount for a deployed wallet.'});
    const factoryData = factory.interface.encodeFunctionData('createAccount',[owner,salt]);
    const callData = new ethers.Interface(['function execute(address,uint256,bytes)']).encodeFunctionData('execute',[recipient || owner,recipient ? ethers.parseEther(amount) : 0,'0x']);
    const userOperation = {sender,nonce:ethers.toQuantity(await ep.getNonce(sender,0)),factory:factoryAddress,factoryData,callData,callGasLimit:'0x186a0',verificationGasLimit:'0xf4240',preVerificationGas:'0x186a0',maxFeePerGas:'0x3b9aca00',maxPriorityFeePerGas:'0x3b9aca00',signature:'0x'};
    if(deployed){delete userOperation.factory;delete userOperation.factoryData;}
    const packed = {...userOperation,initCode:deployed?'0x':ethers.concat([factoryAddress,factoryData]),accountGasLimits:ethers.concat([ethers.toBeHex(1000000,16),ethers.toBeHex(100000,16)]),gasFees:ethers.concat([ethers.toBeHex(1000000000,16),ethers.toBeHex(1000000000,16)]),paymasterAndData:'0x'};
    json(res,200,{sender,deployed,balance,userOperation,hash:await ep.getUserOpHash(packed)});
  }catch(error){json(res,500,{error:error.shortMessage || error.message});}
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  if (data.length > 2_000_000) throw new Error("request too large");
  return data ? JSON.parse(data) : {};
}

async function proxy(req, res, target) {
  try {
    const payload = await body(req);
    const allowed = target === bundlerUrl
      ? ['eth_sendUserOperation','eth_estimateUserOperationGas','eth_getUserOperationReceipt','eth_getUserOperationByHash','eth_supportedEntryPoints','eth_chainId']
      : ['eth_chainId','eth_blockNumber','eth_getBalance','eth_getCode','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getLogs','eth_call'];
    if (Array.isArray(payload) || !allowed.includes(payload.method)) return json(res,403,{error:'Method not allowed. Wallet transactions must use eth_sendUserOperation through the bundler.'});
    const upstream = await fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const text = await upstream.text();
    res.writeHead(upstream.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(text);
  } catch (error) {
    json(res, 502, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function faucetSend(req, res) {
  try {
    const payload = await body(req);
    if (!ethers.isAddress(payload.address)) return json(res, 400, { error: "invalid Ethereum address" });
    const amount = String(payload.amount || "1");
    if (!/^([0-9]{1,3})(\.[0-9]{1,18})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 10) {
      return json(res, 400, { error: "amount must be between 0 and 10 ETH" });
    }
    const tx = await faucet.sendTransaction({ to: payload.address, value: ethers.parseEther(amount) });
    json(res, 200, { hash: tx.hash, from: faucet.address, amount });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function config(res) {
  try {
    const network = await provider.getNetwork();
    json(res, 200, { chainId: Number(network.chainId), rpcUrl: "/rpc", bundlerUrl: "/bundler", entryPoint, faucet: faucet.address });
  } catch (error) {
    json(res, 503, { error: error instanceof Error ? error.message : String(error) });
  }
}

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if(req.method === 'POST' && url.pathname === '/api/aa/prepare') return prepareWallet(req,res);
  if(req.method === 'GET' && url.pathname === '/ethers.js') {
    res.writeHead(200,{'content-type':'text/javascript'});
    return res.end(await readFile(new URL('./node_modules/ethers/dist/ethers.min.js',import.meta.url)));
  }
  if (req.method === "POST" && url.pathname === "/rpc") return proxy(req, res, rpcUrl);
  if (req.method === "POST" && url.pathname === "/bundler") return proxy(req, res, bundlerUrl);
  if (req.method === "POST" && url.pathname === "/api/faucet") return faucetSend(req, res);
  if (req.method === "GET" && url.pathname === "/api/config") return config(res);
  if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });

  const relative = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) return json(res, 404, { error: "not found" });
  try {
    const content = await readFile(file);
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(content);
  } catch {
    json(res, 404, { error: "not found" });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`AA devnet frontend listening on http://0.0.0.0:${port}`));
