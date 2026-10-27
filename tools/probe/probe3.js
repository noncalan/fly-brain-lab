// Same Shiu port, but drop connections with < MIN synapses (as in the Codex connections file the fork uses).
const path=require('path'),fs=require('fs');
const src=fs.readFileSync(path.join(__dirname,'probe.js'),'utf8').split('// ---------- run ----------')[0];
eval(src);
const MIN=+process.argv[2]||5;
const full=loadShiu();
const keep=[];for(let i=0;i<full.N;i++)for(let j=full.rowPtr[i];j<full.rowPtr[i+1];j++)if(Math.abs(full.w[j])>=MIN)keep.push(j);
const rowPtr=new Uint32Array(full.N+1),col=new Uint32Array(keep.length),w=new Float32Array(keep.length);
let k=0;for(let i=0;i<full.N;i++){for(let j=full.rowPtr[i];j<full.rowPtr[i+1];j++)if(Math.abs(full.w[j])>=MIN){col[k]=full.col[j];w[k]=full.w[j];k++;}rowPtr[i+1]=k;}
const sm={N:full.N,rowPtr,col,w,ids:full.ids};console.log('min syn',MIN,'edges',k);
const map=new Map(sm.ids.map((id,i)=>[id,i]));
const zlib=require("zlib"),FORK="C:/Users/53/Desktop/fly-brain-lab",sets=JSON.parse(fs.readFileSync(path.join(__dirname,"sets_idx.json")));
const forkOrder=zlib.gunzipSync(fs.readFileSync(FORK+'/data/neurons.csv.gz')).toString().split('\n').slice(1).map(l=>l.split(',')[0]).filter(Boolean);
const toS=idx=>idx.map(i=>map.get(forkOrder[i])).filter(i=>i!==undefined);
const sugarShiu=['720575940624963786','720575940630233916','720575940637568838','720575940638202345','720575940617000768','720575940630797113','720575940632889389','720575940621754367','720575940621502051','720575940640649691','720575940639332736','720575940616885538','720575940639198653','720575940620900446','720575940617937543','720575940632425919','720575940633143833','720575940612670570','720575940628853239','720575940629176663','720575940611875570'].map(i=>map.get(i)).filter(i=>i!==undefined);
const R=Object.fromEntries(Object.entries(sets.read).map(([r,ri])=>[r,toS(ri)]));
const cases={sugarShiu:sugarShiu,looming:toS(sets.stim.looming),jo_wind:toS(sets.stim.jo_wind)};
for(const [n,si] of Object.entries(cases)){const c=runShiu(sm,si,150,1000,1);const o={};for(const r of ['MN9','GF','aDN1','aBN1'])o[r]=R[r].reduce((a,i)=>a+c[i],0)/R[r].length;console.log(n,'active',c.reduce((a,x)=>a+(x>0),0),JSON.stringify(o));}
