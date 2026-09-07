import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const privateConfig=JSON.parse(readFileSync('work/runtime-secrets.json','utf8'));
const forbidden=Object.entries(privateConfig).filter(([k])=>['AUTH_SECRET','ENCRYPTION_KEY','BOOTSTRAP_HASH'].includes(k));
function walk(dir){for(const item of readdirSync(dir)){const path=join(dir,item);if(statSync(path).isDirectory())walk(path);else{if(item.startsWith('.env')||item.startsWith('.dev.vars'))throw new Error('Private environment file present in build');const bytes=readFileSync(path);for(const[key,value]of forbidden)if(bytes.includes(Buffer.from(value)))throw new Error('Private configuration leaked in build: '+key);}}}
walk('dist');
const entry=readFileSync('dist/server/index.js','utf8');if(!/export/.test(entry))throw new Error('Worker module missing exports');
console.log('Build inspected: no runtime secrets or environment files.');
