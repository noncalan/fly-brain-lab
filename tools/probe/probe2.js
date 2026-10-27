// Sanity check against Shiu example.ipynb: right sugar GRNs (v630 IDs present in v783) at 100 Hz.
const path=require('path');
const src=require('fs').readFileSync(path.join(__dirname,'probe.js'),'utf8').split('// ---------- run ----------')[0];
eval(src);
const sm=loadShiu(); const map=new Map(sm.ids.map((id,i)=>[id,i]));
const sugar=['720575940624963786','720575940630233916','720575940637568838','720575940638202345','720575940617000768','720575940630797113','720575940632889389','720575940621754367','720575940621502051','720575940640649691','720575940639332736','720575940616885538','720575940639198653','720575940620900446','720575940617937543','720575940632425919','720575940633143833','720575940612670570','720575940628853239','720575940629176663','720575940611875570'].map(i=>map.get(i)).filter(i=>i!==undefined);
const mn9=['720575940660219265','720575940618238523'].map(i=>map.get(i));
for (const hz of [100,150]) { const c=runShiu(sm,sugar,hz,1000,1); console.log(hz,'Hz stim n',sugar.length,'active',c.reduce((a,x)=>a+(x>0),0),'MN9 Hz',mn9.map(i=>c[i])); }
const bitter=['720575940621778381','720575940602353632','720575940617094208','720575940619197093','720575940626287336','720575940618600651','720575940627692048','720575940630195909','720575940646212996','720575940610483162','720575940645743412','720575940627578156','720575940622298631','720575940621008895','720575940629146711','720575940610259370','720575940610481370','720575940619028208','720575940614281266','720575940613061118','720575940604027168'].map(i=>map.get(i)).filter(i=>i!==undefined);
let s=0; for (let t=1;t<=3;t++){const c=runShiu(sm,sugar.concat(bitter),150,1000,t); s+=mn9.reduce((a,i)=>a+c[i],0)/2/3;} console.log('sugar+bitter 150Hz MN9 mean Hz',s.toFixed(1),'bitter n',bitter.length);
let s2=0; for (let t=1;t<=3;t++){const c=runShiu(sm,sugar,150,1000,t); s2+=mn9.reduce((a,i)=>a+c[i],0)/2/3;} console.log('sugar alone 150Hz MN9 mean Hz',s2.toFixed(1));
