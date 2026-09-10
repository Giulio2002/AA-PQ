const {ethers}=require('./account-abstraction/node_modules/ethers');
const fs=require('fs');
async function main(){
if(!process.env.RPC_URL)throw new Error('Set RPC_URL to your local devnet RPC URL');
const provider=new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
if((await provider.getNetwork()).chainId!==1337)throw new Error('Refusing deployment: this script is for chain 1337 only');
const wallet=ethers.Wallet.fromMnemonic('test test test test test test test test test test test junk').connect(provider);
const proxy='0x4e59b44847b379578588920cA78FbF26c0B4956C';
if(await provider.getCode(proxy)==='0x'){
 await (await wallet.sendTransaction({to:'0x3fab184622dc19b6109349b94811493bf2a45362',value:ethers.utils.parseEther('0.01')})).wait();
 await (await provider.sendTransaction('0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222')).wait();
}
const entry=require('./account-abstraction/artifacts/contracts/core/EntryPoint.sol/EntryPoint.json');
const salt='0x7702864008ddeab30aa67b7adc3d2653bc8d162714b1fe8fe4582df814f3bf61';
const address=ethers.utils.getCreate2Address('0x4e59b44847b379578588920cA78FbF26c0B4956C',salt,ethers.utils.keccak256(entry.bytecode));
if(address.toLowerCase()!=='0x433709009b8330fda32311df1c2afa402ed8d009')throw new Error('Unexpected EntryPoint bytecode: use the pinned source/compiler in README');
if(await provider.getCode(address)==='0x')await (await wallet.sendTransaction({to:'0x4e59b44847b379578588920cA78FbF26c0B4956C',data:ethers.utils.hexConcat([salt,entry.bytecode]),gasLimit:7000000})).wait();
const a=require('./account-abstraction/artifacts/contracts/accounts/SimpleAccountFactory.sol/SimpleAccountFactory.json');
const factory=await new ethers.ContractFactory(a.abi,a.bytecode,wallet).deploy(address);await factory.deployed();
console.log(JSON.stringify({entryPoint:address,factory:factory.address}));
console.log(`export ENTRY_POINT=${address}\nexport FACTORY_ADDRESS=${factory.address}`);
}
main().catch(e=>{console.error(e.message);process.exit(1)});
