import {findCases} from '../assets/native-components/api.mjs';
const args=process.argv.slice(2),f={};
for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(k==='--role')f.role=v;if(k==='--relation')f.relation=v;if(k==='--count')f.itemCount=Number(v);if(k==='--mode')f.contentMode=v;if(k==='--type')f.typeId=v;if(k==='--layout')f.layout=v;}
console.log(JSON.stringify(findCases(f),null,2));
