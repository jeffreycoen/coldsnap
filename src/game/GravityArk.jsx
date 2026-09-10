import { useEffect, useRef, useState, useCallback } from "react";

const cbrt2=Math.cbrt(2),W1=1/(2-cbrt2),W0=-cbrt2/(2-cbrt2);
const YC=[W1/2,(W0+W1)/2,(W0+W1)/2,W1/2],YD=[W1,W0,W1];
const C30=Math.cos(Math.PI/6),S30=.5,DT=1/60;
const GATE_R=36,VEL_SC=.28,MAX_V=110,SF=14,MAX_BURN=65,PICKUP_R=18;

const PCOLS=[{c:[45,55,78],h:[180,198,225]},{c:[92,48,40],h:[218,162,132]},{c:[38,65,60],h:[142,202,188]},{c:[72,50,82],h:[190,170,218]},{c:[82,68,38],h:[208,192,138]},{c:[50,75,52],h:[160,210,162]}];
const PREFIXES=["KEPLER","WOLF","HD","PROXIMA","ROSS","GLIESE","TRAPPIST","LUYTEN","SIRIUS","VEGA","ALTAIR","RIGEL"];
const SUFFIXES=["","b","c","α","β","RELAY","PRIME","DEEP"];
const BRIEFS=["Binary system. Strong tidal forces.","Dense asteroid field. Caution advised.","Massive central body. Deep gravity well.","Chaotic transfer zones detected.","Wide separation. Plan burns carefully.","Tight cluster. Thread the needle.","Asymmetric masses. Slingshot available.","Active debris field. Impacts expected.","Fuel conservation critical.","Multiple waypoints required."];
function sysName(n){const s=n*7919+3,r=i=>{let v=Math.sin(s+i*4967)*43758.5453;return v-Math.floor(v);};return PREFIXES[Math.floor(r(0)*PREFIXES.length)]+"-"+Math.floor(r(1)*900+100)+SUFFIXES[Math.floor(r(2)*SUFFIXES.length)];}
function sysBrief(n){return BRIEFS[n%BRIEFS.length];}

// Gravity power law: 1/r^2.3 (steeper than Newton — more local, less long-range perturbation)
function ga(x,z,b){let ax=0,az=0;for(let i=0;i<b.length;i++){const dx=b[i].x-x,dz=b[i].z-z,r2=dx*dx+dz*dz+SF*SF,rn=Math.pow(r2,1.65);ax+=b[i].G*b[i].mass*dx/rn;az+=b[i].G*b[i].mass*dz/rn;}return[ax,az];}
function ystep(x,z,vx,vz,b,dt){x+=YC[0]*vx*dt;z+=YC[0]*vz*dt;let[ax,az]=ga(x,z,b);vx+=YD[0]*ax*dt;vz+=YD[0]*az*dt;x+=YC[1]*vx*dt;z+=YC[1]*vz*dt;[ax,az]=ga(x,z,b);vx+=YD[1]*ax*dt;vz+=YD[1]*az*dt;x+=YC[2]*vx*dt;z+=YC[2]*vz*dt;[ax,az]=ga(x,z,b);vx+=YD[2]*ax*dt;vz+=YD[2]*az*dt;x+=YC[3]*vx*dt;z+=YC[3]*vz*dt;return[x,z,vx,vz];}
function pot(x,z,b){let p=0;for(let i=0;i<b.length;i++){const r2=(b[i].x-x)**2+(b[i].z-z)**2+SF*SF;p-=b[i].G*b[i].mass/(1.3*Math.pow(r2,.65));}return p;}
const SHIP_R=3;// ship collision radius
function hitAny(x,z,b){for(let i=0;i<b.length;i++){const cr=b[i].r+SHIP_R,d2=(x-b[i].x)**2+(z-b[i].z)**2;if(d2<cr*cr)return true;}return false;}
function s2sim(dx,dy,sc){return[.5*(dx/(C30*sc)+dy/(S30*sc)),.5*(dy/(S30*sc)-dx/(C30*sc))];}
function predict(x,z,vx,vz,b,planets,gate,n,half,stars){
  const pts=[];let minGate=Infinity,minGateIdx=0;
  const simP=planets.map(p=>({x:p.x,z:p.z,vx:p.vx||0,vz:p.vz||0,mass:p.mass,r:p.r,G:p.G}));
  // Stars as static kill zones (no orbital motion)
  const simStars=(stars||[]).map(st=>({x:st.x,z:st.z,r:st.killR||st.r,mass:st.mass,G:st.G}));
  const allSolid=[...simP,...simStars];// everything that kills you
  const ghosts=[];const ghostSet=new Set();
  for(const s2 of [100,250,450,Math.floor(n*.25),Math.floor(n*.5),Math.floor(n*.75)])ghostSet.add(s2);
  for(let i=0;i<n;i++){
    for(const p of simP){const weakOthers=simP.filter(q=>q!==p).map(q=>({...q,G:q.G*.01}));
      [p.x,p.z,p.vx,p.vz]=ystep(p.x,p.z,p.vx,p.vz,weakOthers,DT*2);}
    const curBodies=[...simP,...simStars,...b.slice(planets.length+(stars||[]).length)];
    [x,z,vx,vz]=ystep(x,z,vx,vz,curBodies,DT*2);
    // Danger from planets AND stars
    let danger=0;
    for(const p of simP){const d=Math.sqrt((x-p.x)**2+(z-p.z)**2);if(d<p.r*2.5)danger=Math.max(danger,1-(d-p.r)/(p.r*1.5));}
    for(const st of simStars){const d=Math.sqrt((x-st.x)**2+(z-st.z)**2);if(d<st.r*3)danger=Math.max(danger,1-(d-st.r)/(st.r*2));}
    const gd=Math.sqrt((x-gate.x)**2+(z-gate.z)**2);if(gd<minGate){minGate=gd;minGateIdx=pts.length;}const hg=gd<GATE_R;
    if(hitAny(x,z,allSolid)||Math.abs(x)>half*1.4||Math.abs(z)>half*1.4){pts.push({x,z,hit:true,danger,hitsGate:hg});break;}
    pts.push({x,z,danger,hitsGate:hg});if(hg)break;
    if(ghostSet.has(i)&&ghosts.length<3)ghosts.push(simP.map(p=>({x:p.x,z:p.z,r:p.r})));
  }
  return{pts,minGate,minGateIdx,ghosts};}

// Session seed — different levels each playthrough
let SESSION_SEED=Math.floor(Math.random()*100000);

function genLevel(n){
  const seed=n*7919+1+SESSION_SEED;let ri=0;const rand=()=>{let v=Math.sin(seed+(ri++)*9973)*43758.5453;return v-Math.floor(v);};
  let numP,numA,baseG,fuelBudget,numGates,numPickups,forceStar=false,forceNeb=false;
  if(n===0){numP=2;numA=5;baseG=170;fuelBudget=350;numGates=1;numPickups=0;}
  else if(n===1){numP=1;numA=6;baseG=180;fuelBudget=320;numGates=1;numPickups=0;forceStar=true;}
  else if(n===2){numP=2;numA=8;baseG=180;fuelBudget=300;numGates=1;numPickups=0;forceNeb=true;}
  else if(n<5){numP=2;numA=12+n;baseG=190;fuelBudget=260;numGates=1;numPickups=0;}
  else if(n<8){numP=2;numA=15+n;baseG=200;fuelBudget=220;numGates=2;numPickups=0;}
  else if(n<12){numP=3;numA=20+Math.floor((n-8)*3);baseG=210;fuelBudget=200;numGates=2;numPickups=0;}
  else if(n<18){numP=3+Math.floor((n-12)/3);numA=25+Math.floor((n-12)*2);baseG=230+n;fuelBudget=180;numGates=2;numPickups=0;}
  else if(n<28){numP=Math.min(4+Math.floor((n-18)/5),5);numA=35+Math.floor((n-18)*2);baseG=250+n;fuelBudget=160;numGates=3;numPickups=0;}
  else{numP=5;numA=Math.min(50+Math.floor((n-28)*2),80);baseG=280+Math.min(n,50);fuelBudget=150;numGates=3;numPickups=0;}
  numP=Math.min(numP,5);

  // Ship and gate — opposite sides of the field
  let sx,sz,fx,fz;
  const minDist=420+Math.min(n*5,100);
  for(let t=0;t<80;t++){const a=rand()*Math.PI*2,d=210+rand()*60;sx=Math.cos(a)*d;sz=Math.sin(a)*d;
    const d2=210+rand()*60;fx=Math.cos(a+Math.PI+(.2*rand()-.1))*d2;fz=Math.sin(a+Math.PI+(.2*rand()-.1))*d2;
    // Reject if vertical screen separation is too small (gate would be edge-on)
    const vertSep=Math.abs((sx+sz)-(fx+fz));
    if(Math.sqrt((fx-sx)**2+(fz-sz)**2)>=minDist&&vertSep>minDist*.5)break;}
  // Ensure ship is screen-BOTTOM (larger x+z), gate is screen-TOP (smaller x+z)
  if((sx+sz)<(fx+fz)){const tx=sx,tz=sz;sx=fx;sz=fz;fx=tx;fz=tz;}

  // Place planets as BLOCKERS along the direct path (slalom style)
  const planets=[];
  const pathDx=fx-sx,pathDz=fz-sz,pathLen=Math.sqrt(pathDx**2+pathDz**2);
  const pathNx=pathDx/pathLen,pathNz=pathDz/pathLen;// unit vector along path
  const perpNx=-pathNz,perpNz=pathNx;// perpendicular

  for(let i=0;i<numP;i++){
    let x,z,placed=false;
    for(let attempt=0;attempt<40;attempt++){
      // Place along the path with slight jitter
      const along=(i+.5)/(numP+1)+(.12*rand()-.06);
      const baseX=sx+pathDx*along,baseZ=sz+pathDz*along;
      const perpOff=(rand()-.5)*70+(attempt>20?(rand()-.5)*80:0);// widen search after failures
      x=baseX+perpNx*perpOff;z=baseZ+perpNz*perpOff;
      // Check spacing from other planets (min distance = sum of radii + 60)
      let tooClose=false;
      for(const p of planets){if(Math.sqrt((x-p.x)**2+(z-p.z)**2)<p.r+110){tooClose=true;break;}}
      if(Math.sqrt((x-sx)**2+(z-sz)**2)<120)tooClose=true;
      if(Math.sqrt((x-fx)**2+(z-fz)**2)<120)tooClose=true;
      if(!tooClose){placed=true;break;}}
    if(!placed){// Fallback: place far from everything, verify distance
      for(let fb=0;fb<20;fb++){const a=rand()*Math.PI*2,d=180+rand()*100;
        x=(sx+fx)/2+Math.cos(a)*d;z=(sz+fz)/2+Math.sin(a)*d;
        if(Math.sqrt((x-sx)**2+(z-sz)**2)>=120&&Math.sqrt((x-fx)**2+(z-fz)**2)>=120)break;}}
    const mass=3500+rand()*5500,r=Math.max(14,8+Math.sqrt(mass)*.18),col=PCOLS[i%PCOLS.length];
    planets.push({x,z,vx:0,vz:0,mass,r,G:baseG,c:col.c,h:col.h});
  }
  // Give planets orbital velocities around center of mass
  const comX=planets.reduce((s2,p)=>s2+p.x*p.mass,0)/planets.reduce((s2,p)=>s2+p.mass,0);
  const comZ=planets.reduce((s2,p)=>s2+p.z*p.mass,0)/planets.reduce((s2,p)=>s2+p.mass,0);
  for(const p of planets){
    const dx=p.x-comX,dz=p.z-comZ,dist=Math.sqrt(dx*dx+dz*dz);
    if(dist<1)continue;
    // Sum gravity from all other planets at this position
    let otherMass=0;for(const q of planets)if(q!==p)otherMass+=q.mass;
    // Circular orbit velocity: v = sqrt(G * M_other / dist) scaled down for gentle drift
    // Circular orbit velocity with REDUCED mutual G (1%) — gives ~80 second orbital period
    const vCirc=Math.sqrt(p.G*.01*otherMass/Math.pow(dist,1.3));// circular orbit at 1% G with 1/r^2.3
    // Perpendicular to radius (tangent velocity)
    p.vx=-dz/dist*vCirc;p.vz=dx/dist*vCirc;
  }

  const asteroids=[];
  const totalMass=planets.reduce((s2,p)=>s2+p.mass,0);
  for(let i=0;i<numA;i++){
    const parentIdx=Math.floor(rand()*planets.length);
    const parent=planets[parentIdx];
    let nearestDist=999;
    for(const p of planets){if(p===parent)continue;nearestDist=Math.min(nearestDist,Math.sqrt((p.x-parent.x)**2+(p.z-parent.z)**2));}
    const otherMass=totalMass-parent.mass;
    const hillR=nearestDist*Math.pow(parent.mass/(3*Math.max(otherMass,1)),.333);
    const minOrbit=parent.r*2,maxOrbit=hillR*.4;

    if(maxOrbit>=minOrbit+5){
      // Stable orbit possible
      const orbitR=minOrbit+rand()*(maxOrbit-minOrbit);
      const orbitV=Math.sqrt(parent.G*parent.mass/Math.pow(orbitR,1.3));
      const angle=rand()*Math.PI*2;
      const x=parent.x+Math.cos(angle)*orbitR,z=parent.z+Math.sin(angle)*orbitR;
      let tooClose=false;for(const p of planets){if(p===parent)continue;if(Math.sqrt((x-p.x)**2+(z-p.z)**2)<hillR*.6){tooClose=true;break;}}
      if(!tooClose){const dir=parentIdx%2===0?1:-1;const eccF=.92+rand()*.16;
        asteroids.push({x,z,vx:-Math.sin(angle)*orbitV*eccF*dir,vz:Math.cos(angle)*orbitV*eccF*dir,mass:40+rand()*120,r:2+rand()*2,G:baseG*.001,alive:true});continue;}
    }
    // Fallback: free-drifting debris in open space (away from planet centers)
    for(let attempt=0;attempt<20;attempt++){
      const angle=rand()*Math.PI*2,dist2=200+rand()*150;
      const px=Math.cos(angle)*dist2,pz=Math.sin(angle)*dist2;
      let ok=true;for(const p of planets)if(Math.sqrt((px-p.x)**2+(pz-p.z)**2)<p.r+30){ok=false;break;}
      if(ok){asteroids.push({x:px,z:pz,vx:(rand()-.5)*5,vz:(rand()-.5)*5,mass:30+rand()*80,r:1.5+rand()*2,G:baseG,alive:true});break;}}
  }
  // Pre-simulation moved to loading phase (runs async with progress bar)
  // Just count initial asteroids for diagnostics
  const astSpawned=asteroids.length;
  const astSurvived=asteroids.length;

  // Comets — highly eccentric orbits that cross the field
  const comets=[];
  const numComets=Math.min(Math.floor(n/2)+1,4);// 1 from level 0, up to 4
  for(let i=0;i<numComets;i++){
    const parent=planets[Math.floor(rand()*planets.length)];
    const angle=rand()*Math.PI*2;
    const periR=parent.r*3+rand()*30;// close pass to parent
    const x=parent.x+Math.cos(angle)*periR;
    const z=parent.z+Math.sin(angle)*periR;
    // High velocity for eccentric orbit (1.4-1.8× circular)
    const vCirc=Math.sqrt(parent.G*parent.mass/Math.pow(periR,1.3));
    const eccBoost=1.4+rand()*.4;
    const dir=rand()>.5?1:-1;
    const vx=-Math.sin(angle)*vCirc*eccBoost*dir;
    const vz=Math.cos(angle)*vCirc*eccBoost*dir;
    comets.push({x,z,vx,vz,mass:20+rand()*40,r:2,G:baseG,alive:true,trail:[]});
  }

  // Stars — massive bodies with photosphere death zones
  const stars=[];
  if(forceStar||n>=3){
    const t2=.3+rand()*.4;
    let stX=sx+pathDx*t2+perpNx*(rand()-.5)*100;
    let stZ=sz+pathDz*t2+perpNz*(rand()-.5)*100;
    let ok=true;for(const p of planets)if(Math.sqrt((stX-p.x)**2+(stZ-p.z)**2)<p.r+60){ok=false;break;}
    if(!ok){stX=sx+pathDx*(.5+rand()*.3)+perpNx*(60+rand()*80)*(rand()>.5?1:-1);
      stZ=sz+pathDz*(.5+rand()*.3)+perpNz*(60+rand()*80)*(rand()>.5?1:-1);
      ok=true;for(const p of planets)if(Math.sqrt((stX-p.x)**2+(stZ-p.z)**2)<p.r+60){ok=false;break;}}
    if(ok){const stMass=15000+rand()*25000,stR=30+Math.sqrt(stMass)*.08;
      stars.push({x:stX,z:stZ,vx:0,vz:0,mass:stMass,r:stR,G:baseG,killR:stR*1.5,
        c:[255,200,80],h:[255,240,180]});}
  }

  // Nebulae — drag regions that slow the ship
  const nebulae=[];
  const numNeb=forceNeb?1:(n>=4?Math.min(Math.floor((n-3)/2),2):0);
  for(let i=0;i<numNeb;i++){
    const t2=.2+rand()*.6;
    const nbX=sx+pathDx*t2+perpNx*(80+rand()*60)*(rand()>.5?1:-1);
    const nbZ=sz+pathDz*t2+perpNz*(80+rand()*60)*(rand()>.5?1:-1);
    const nbR=50+rand()*40;// large radius
    nebulae.push({x:nbX,z:nbZ,r:nbR,drag:.015+rand()*.01,
      color:[120+Math.floor(rand()*60),80+Math.floor(rand()*80),180+Math.floor(rand()*60)]});
  }

  // Multi-gate: intermediates along path, LAST gate at destination (fx,fz)
  const gates=[];
  for(let gi=0;gi<numGates-1;gi++){
    const t2=(gi+1)/numGates;
    let gx=sx+pathDx*t2,gz=sz+pathDz*t2;
    for(let t=0;t<30;t++){let tooClose=false;
      for(const p of planets)if(Math.sqrt((gx-p.x)**2+(gz-p.z)**2)<p.r+55){
        gx+=perpNx*(40+rand()*30)*(rand()>.5?1:-1);gz+=perpNz*(40+rand()*30)*(rand()>.5?1:-1);tooClose=true;break;}
      if(!tooClose)break;}
    const prevX=gi===0?sx:gates[gi-1].x,prevZ=gi===0?sz:gates[gi-1].z;
    gates.push({x:gx,z:gz,ang:Math.atan2(prevZ-gz,prevX-gx),reached:false});
  }
  // Final gate at destination
  const lastPrevX=gates.length>0?gates[gates.length-1].x:sx;
  const lastPrevZ=gates.length>0?gates[gates.length-1].z:sz;
  gates.push({x:fx,z:fz,ang:Math.atan2(lastPrevZ-fz,lastPrevX-fx),reached:false});

  // Safety: remove any asteroid too close to ship, gates, or pickups
  for(const a of asteroids){if(!a.alive)continue;
    if(Math.sqrt((a.x-sx)**2+(a.z-sz)**2)<50)a.alive=false;
    for(const g of gates)if(Math.sqrt((a.x-g.x)**2+(a.z-g.z)**2)<45)a.alive=false;
  }

  // Fuel pickups — placed in navigable gaps, slightly off the direct path
  const pickups=[];
  for(let i=0;i<numPickups;i++){
    const t2=.2+rand()*.6;// middle 60% of path
    let px=sx+pathDx*t2+perpNx*(60+rand()*40)*(rand()>.5?1:-1);
    let pz=sz+pathDz*t2+perpNz*(60+rand()*40)*(rand()>.5?1:-1);
    for(const p of planets)if(Math.sqrt((px-p.x)**2+(pz-p.z)**2)<p.r+35){px+=perpNx*50;pz+=perpNz*50;}
    pickups.push({x:px,z:pz,fuel:35+Math.floor(rand()*25),alive:true});
  }

  // Verify spacing
  const astPreSim=asteroids.length;
  const astAlive=asteroids.filter(a=>a.alive).length;
  let minPP=Infinity;
  for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){
    const d=Math.sqrt((planets[i].x-planets[j].x)**2+(planets[i].z-planets[j].z)**2)-planets[i].r-planets[j].r;
    minPP=Math.min(minPP,d);}

  return{planets,asteroids,comets,stars,nebulae,ship:{x:sx,z:sz,vx:0,vz:0,ang:Math.atan2(fz-sz,fx-sx)},gates,pickups,fuelBudget,
    _diag:{astSpawned,astSurvived,astPreSimCulled:astSpawned-astSurvived,minPP:Math.floor(minPP),shipGateDist:Math.floor(Math.sqrt((fx-sx)**2+(fz-sz)**2))}};
}

const MAP_NODES=[];for(let i=0;i<60;i++){const a=i*.45+.5,r=35+i*4.2;MAP_NODES.push({x:Math.cos(a)*r,y:Math.sin(a)*r});}
function calcScale(W,H,points){let minSx=Infinity,maxSx=-Infinity,minSy=Infinity,maxSy=-Infinity;for(const p of points){const sx=(p.x-(p.z||0))*C30,sy=(p.x+(p.z||0))*S30;minSx=Math.min(minSx,sx);maxSx=Math.max(maxSx,sx);minSy=Math.min(minSy,sy);maxSy=Math.max(maxSy,sy);}const spanX=maxSx-minSx+160,spanY=maxSy-minSy+160;return Math.min(W*.9/spanX,H*.75/spanY,.95);}

export default function GravityArk({ onExit }){
  const cvs=useRef(null),sim=useRef(null),drg=useRef({active:false,sx:0,sy:0,cx:0,cy:0});
  const lock=useRef({on:false,vx:0,vz:0}),camRef=useRef({zoom:1,shakeX:0,shakeY:0,timeScale:1}),ffRef=useRef(false);
  const progress=useRef({scores:[],best:0,streak:0,totalScore:0,favorites:[]}),particles=useRef([]);
  const perf=useRef({fps:60,minFps:60,physMs:0,gridMs:0,trajMs:0,totalMs:0,particles:0,gridVerts:0,energy0:null,energyNow:0,energyDrift:0,frameTimes:[],levelLogs:[]});
  const[ui,setUi]=useState({phase:"loading",level:1,burns:0,vel:"0",score:0,fuel:300,danger:0,showMap:false,sysName:"",brief:"",copied:false,gateNum:0,gateTotal:1,showRate:false,ff:false});
  const[showTutorial,setShowTutorial]=useState(true);
  const[bp,setBp]=useState({});

  const mkLvl=useCallback(n=>{
    const gen=genLevel(n);camRef.current={zoom:1,shakeX:0,shakeY:0,timeScale:1};particles.current=[];
    const currentGate=gen.gates[0];
    // Default trajectory toward first gate
    const dx=currentGate.x-gen.ship.x,dz=currentGate.z-gen.ship.z;
    const dist=Math.sqrt(dx*dx+dz*dz)||1;const defaultV=Math.min(50,gen.fuelBudget*.5);
    lock.current={on:true,vx:dx/dist*defaultV,vz:dz/dist*defaultV};
    return{phase:"loading",level:n,...gen,gate:currentGate,gateIdx:0,trail:[],time:0,burns:0,flash:0,dist:0,
      flybys:gen.planets.map(()=>Infinity),startX:gen.ship.x,startZ:gen.ship.z,score:0,lastFlyby:"",
      fuel:gen.fuelBudget,maxFuel:gen.fuelBudget,impacts:[],freezeFrames:0,maxGforce:0,gateVel:0,
      _rated:false,_readyNext:false,paused:false,simStep:0,simTotal:60};
  },[]);

  const copyText=useCallback((text)=>{if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>setUi(u=>({...u,copied:true}))).catch(()=>{});}else{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);setUi(u=>({...u,copied:true}));}setTimeout(()=>setUi(u=>({...u,copied:false})),2000);},[]);

  const copyLogs=useCallback(()=>{
    const pf=perf.current,s=sim.current;
    // Compute layout diagnostics
    let layout=null;
    if(s){
      const sh=s.ship,g=s.gates[s.gates.length-1];
      const shipGateDist=Math.floor(Math.sqrt((g.x-s.startX)**2+(g.z-s.startZ)**2));
      // Screen positions (isometric)
      const shipScrX=Math.floor((s.startX-s.startZ)*.866);const shipScrY=Math.floor((s.startX+s.startZ)*.5);
      const gateScrX=Math.floor((g.x-g.z)*.866);const gateScrY=Math.floor((g.x+g.z)*.5);
      // Min distances
      let minPP=Infinity,minShipP=Infinity,minGateP=Infinity;
      for(let i=0;i<s.planets.length;i++){
        const p=s.planets[i];
        minShipP=Math.min(minShipP,Math.floor(Math.sqrt((s.startX-p.x)**2+(s.startZ-p.z)**2)-p.r));
        minGateP=Math.min(minGateP,Math.floor(Math.sqrt((g.x-p.x)**2+(g.z-p.z)**2)-p.r));
        for(let j=i+1;j<s.planets.length;j++){const q=s.planets[j];
          minPP=Math.min(minPP,Math.floor(Math.sqrt((p.x-q.x)**2+(p.z-q.z)**2)-p.r-q.r));}}
      const astAlive=s.asteroids.filter(a=>a.alive).length;
      layout={shipGateDist,shipScr:[shipScrX,shipScrY],gateScr:[gateScrX,gateScrY],
        minPlanetPlanet:minPP===Infinity?null:minPP,
        minShipToPlanet:minShipP===Infinity?null:minShipP,
        minGateToPlanet:minGateP===Infinity?null:minGateP,
        astAlive,astTotal:s.asteroids.length,
        spacing:minPP>50&&minShipP>60&&minGateP>50?"OK":"WARN"};}
    const log={device:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio,ua:navigator.userAgent.slice(0,80)},
      perf:{fps:pf.fps,minFps:pf.minFps,physMs:+pf.physMs.toFixed(2),gridMs:+pf.gridMs.toFixed(2),trajMs:+pf.trajMs.toFixed(2),totalMs:+pf.totalMs.toFixed(2),gridVerts:pf.gridVerts,particles:pf.particles,bodies:s?.planets?.length+(s?.asteroids?.filter(a=>a.alive)?.length||0)},
      physics:{energy:+pf.energyNow.toFixed(4),driftPct:+pf.energyDrift.toFixed(6)},
      layout,
      levelDiag:s?._diag||null,
      game:{level:s?.level,phase:s?.phase,planets:s?.planets?.length,asteroids:s?.asteroids?.filter(a=>a.alive)?.length,asteroidsTotal:s?.asteroids?.length,gates:s?.gates?.length,gateIdx:s?.gateIdx,streak:progress.current.streak,totalScore:progress.current.totalScore},
      history:pf.levelLogs.slice(-10)};
    copyText(JSON.stringify(log,null,2));
    setTimeout(()=>setUi(u=>({...u,copied:false})),2000);
  },[]);

  useEffect(()=>{
    const c=cvs.current,ctx=c.getContext("2d");sim.current=mkLvl(0);
    setUi(u=>({...u,sysName:sysName(0),brief:sysBrief(0),gateTotal:sim.current.gates.length}));
    const dpr=window.devicePixelRatio||1;
    const resize=()=>{c.width=window.innerWidth*dpr;c.height=window.innerHeight*dpr;c.style.width=window.innerWidth+'px';c.style.height=window.innerHeight+'px';};resize();window.addEventListener("resize",resize);
    const gP=e=>e.touches?[e.touches[0].clientX,e.touches[0].clientY]:[e.clientX,e.clientY];
    const onD=e=>{
      if(e.target!==c)return;// Don't steal touches from UI buttons
      const s=sim.current;
      // Map node tap — replay completed levels
      if(ui.showMap){e.preventDefault();const[x,y]=gP(e);const pr=progress.current;
        for(let i=0;i<MAP_NODES.length;i++){const nd=MAP_NODES[i],nx2=window.innerWidth/2+nd.x,ny2=window.innerHeight/2+nd.y;
          if(Math.sqrt((x-nx2)**2+(y-ny2)**2)<15&&i<pr.scores.length&&pr.scores[i]>0){
            const lvl=mkLvl(i);Object.assign(s,lvl);drg.current.active=false;
            setUi(u=>({...u,phase:"loading",level:i,burns:0,danger:0,sysName:sysName(i),brief:sysBrief(i),gateNum:0,gateTotal:lvl.gates.length,showMap:false}));return;}}
        return;}
      if(s.phase!=="aim"&&s.phase!=="plan")return;e.preventDefault();const[x,y]=gP(e);if(y>window.innerHeight-180)return;drg.current={active:true,sx:x,sy:y,cx:x,cy:y};};
    const onM=e=>{if(!drg.current.active)return;e.preventDefault();const[x,y]=gP(e);drg.current.cx=x;drg.current.cy=y;};
    const onU=e=>{if(!drg.current.active)return;e.preventDefault();const dr=drg.current,ddx=dr.cx-dr.sx,ddy=dr.cy-dr.sy,dist=Math.sqrt(ddx*ddx+ddy*ddy);
      const s=sim.current;
      if(dist<=12){
        // TAP (no drag) — launch in aim, pause/unpause in fly
        if(s.phase==="aim"&&lock.current.on){
          const vm=Math.sqrt(lock.current.vx**2+lock.current.vz**2);
          if(vm>0&&vm<=s.fuel){s.fuel-=vm;s.ship.vx=lock.current.vx;s.ship.vz=lock.current.vz;
            s.ship.ang=Math.atan2(lock.current.vz,lock.current.vx);s.phase="fly";
            lock.current={on:false,vx:0,vz:0};perf.current.energy0=null;
            setUi(u=>({...u,phase:"fly"}));}}
        else if(s.phase==="fly"){s.paused=!s.paused;setUi(u=>({...u}));}
        drg.current.active=false;return;}
      if(dist>12){const allPts=[{x:s.startX,z:s.startZ},{x:s.gate.x,z:s.gate.z},...s.planets];
        const dsc=calcScale(window.innerWidth,window.innerHeight,allPts);const[sdx,sdz]=s2sim(ddx,ddy,dsc);const mag=Math.sqrt(sdx*sdx+sdz*sdz);
        const maxV=s.phase==="plan"?Math.min(MAX_BURN,s.fuel,MAX_V):Math.min(MAX_V,s.fuel);
        let vel=Math.min(mag*VEL_SC,maxV),lvx=sdx/mag*vel,lvz=sdz/mag*vel;
        // Snap-to-gate: if near a good solution, nudge toward it
        const gravB2=[...s.planets,...s.asteroids.filter(a=>a.alive).map(a=>({x:a.x,z:a.z,mass:a.mass,r:a.r,G:a.G}))];
        const bvx=s.phase==="plan"?s.ship.vx+lvx:lvx,bvz=s.phase==="plan"?s.ship.vz+lvz:lvz;
        const test=predict(s.ship.x,s.ship.z,bvx,bvz,gravB2,s.planets,s.gate,400,300,s.stars);
        if(!test.pts.some(p=>p.hitsGate)&&test.minGate<80){
          // Try small angle adjustments to find a hit
          const ang0=Math.atan2(lvz,lvx);let bestAng=ang0,bestDist=test.minGate;
          for(let da=-0.12;da<=0.12;da+=0.03){const ta=ang0+da;
            const tvx=s.phase==="plan"?s.ship.vx+Math.cos(ta)*vel:Math.cos(ta)*vel;
            const tvz=s.phase==="plan"?s.ship.vz+Math.sin(ta)*vel:Math.sin(ta)*vel;
            const t2=predict(s.ship.x,s.ship.z,tvx,tvz,gravB2,s.planets,s.gate,400,300,s.stars);
            if(t2.minGate<bestDist){bestDist=t2.minGate;bestAng=ta;}
            if(t2.pts.some(p=>p.hitsGate)){bestAng=ta;break;}}
          if(bestAng!==ang0){lvx=Math.cos(bestAng)*vel;lvz=Math.sin(bestAng)*vel;}}
        lock.current={on:true,vx:lvx,vz:lvz};}drg.current.active=false;};
    c.addEventListener("mousedown",onD);c.addEventListener("mousemove",onM);c.addEventListener("mouseup",onU);
    c.addEventListener("touchstart",onD,{passive:false});c.addEventListener("touchmove",onM,{passive:false});
    c.addEventListener("touchend",onU,{passive:false});c.addEventListener("touchcancel",onU,{passive:false});

    let hf=0,anim;const iso=(sx,sz,d,cx,cy,sc)=>({x:cx+(sx-sz)*C30*sc,y:cy+(sx+sz)*S30*sc+d});
    const spawnP=(x,z,vx,vz,cnt,col,life,spr)=>{const arr=particles.current;for(let i=0;i<cnt;i++){const a=Math.random()*Math.PI*2,sp=spr*(.3+Math.random()*.7);arr.push({x,z,vx:vx+Math.cos(a)*sp,vz:vz+Math.sin(a)*sp,life,maxLife:life,color:col,r:1+Math.random()*2});}};
    const drawShip=(ctx,sx,sy,ang,sc,thrust)=>{const fd={x:Math.cos(ang),z:Math.sin(ang)},fs={x:(fd.x-fd.z)*C30,y:(fd.x+fd.z)*S30},fl=Math.sqrt(fs.x**2+fs.y**2)||1;const nx=fs.x/fl,ny=fs.y/fl,px=-ny,py=nx,L=12*sc,W2=3.5*sc;
      if(thrust){const pL=(14+Math.random()*7)*sc,ex=sx-nx*L*.75,ey=sy-ny*L*.75;const pg=ctx.createRadialGradient(ex,ey,0,ex-nx*pL*.3,ey-ny*pL*.3,pL*.5);pg.addColorStop(0,"rgba(200,220,255,.8)");pg.addColorStop(.3,"rgba(120,170,255,.3)");pg.addColorStop(1,"rgba(60,100,220,0)");ctx.fillStyle=pg;ctx.beginPath();ctx.arc(ex-nx*pL*.2,ey-ny*pL*.2,pL*.45,0,Math.PI*2);ctx.fill();}
      ctx.beginPath();ctx.arc(sx-nx*L*.65,sy-ny*L*.65,3*sc,0,Math.PI*2);ctx.fillStyle=thrust?"rgba(40,80,200,.3)":"rgba(40,60,120,.08)";ctx.fill();
      ctx.save();ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=6*sc;ctx.beginPath();ctx.moveTo(sx+nx*L,sy+ny*L);ctx.lineTo(sx-nx*L*.2+px*W2,sy-ny*L*.2+py*W2);ctx.lineTo(sx-nx*L*.65+px*W2*.7,sy-ny*L*.65+py*W2*.7);ctx.lineTo(sx-nx*L*.7,sy-ny*L*.7);ctx.lineTo(sx-nx*L*.65-px*W2*.7,sy-ny*L*.65-py*W2*.7);ctx.lineTo(sx-nx*L*.2-px*W2,sy-ny*L*.2-py*W2);ctx.closePath();ctx.fillStyle="#2a3448";ctx.fill();
      ctx.beginPath();ctx.moveTo(sx+nx*L,sy+ny*L);ctx.lineTo(sx-nx*L*.2+px*W2*.95,sy-ny*L*.2+py*W2*.95);ctx.strokeStyle="rgba(40,50,80,.4)";ctx.lineWidth=.8;ctx.stroke();
      ctx.beginPath();ctx.arc(sx+nx*L*.7,sy+ny*L*.7,1.5*sc,0,Math.PI*2);ctx.fillStyle="rgba(40,80,160,.6)";ctx.fill();ctx.restore();};

    const drawGate=(ctx,gate,gateIndex,totalGates,cmx,cmy,sc,time,isNext)=>{
      const gd2=(sx2,sz2)=>Math.min(Math.sqrt(Math.abs(pot(sx2,sz2,sim.current.planets)))*.28*sc/camRef.current.zoom,120*sc/camRef.current.zoom);
      const gAng=gate.ang||0,pulse=.5+.5*Math.sin(time*2.5),gW=GATE_R*1.1,gH=45*sc;
      const perpX=Math.cos(gAng+Math.PI/2),perpZ=Math.sin(gAng+Math.PI/2);
      const p1x=gate.x+perpX*gW,p1z=gate.z+perpZ*gW,p2x=gate.x-perpX*gW,p2z=gate.z-perpZ*gW;
      const gdep=gd2(gate.x,gate.z);
      const pb1=iso(p1x,p1z,gdep,cmx,cmy,sc),pb2=iso(p2x,p2z,gdep,cmx,cmy,sc);
      const pt1={x:pb1.x,y:pb1.y-gH},pt2={x:pb2.x,y:pb2.y-gH};
      const alpha=isNext?1:(gate.reached?.12:.2);const col="60,200,100";
      ctx.save();ctx.globalAlpha=alpha;
      ctx.shadowColor=`rgba(${col},${.2+pulse*.1})`;ctx.shadowBlur=20*sc;
      ctx.beginPath();ctx.moveTo(pb1.x,pb1.y);ctx.lineTo(pb2.x,pb2.y);ctx.strokeStyle=`rgba(${col},${.25+pulse*.1})`;ctx.lineWidth=2*sc;ctx.stroke();
      ctx.beginPath();ctx.moveTo(pb1.x,pb1.y);ctx.lineTo(pt1.x,pt1.y);ctx.lineTo(pt2.x,pt2.y);ctx.lineTo(pb2.x,pb2.y);ctx.closePath();
      ctx.fillStyle=`rgba(${col},${.06+pulse*.04})`;ctx.fill();ctx.strokeStyle=`rgba(${col},${.2+pulse*.1})`;ctx.lineWidth=1*sc;ctx.stroke();
      ctx.lineWidth=3*sc;ctx.strokeStyle=`rgba(${col},${.45+pulse*.2})`;
      ctx.beginPath();ctx.moveTo(pb1.x,pb1.y);ctx.lineTo(pt1.x,pt1.y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(pb2.x,pb2.y);ctx.lineTo(pt2.x,pt2.y);ctx.stroke();
      ctx.lineWidth=2.5*sc;ctx.strokeStyle=`rgba(${col},${.4+pulse*.2})`;ctx.beginPath();ctx.moveTo(pt1.x,pt1.y);ctx.lineTo(pt2.x,pt2.y);ctx.stroke();
      ctx.fillStyle=`rgba(${col},${.5+pulse*.2})`;ctx.beginPath();ctx.arc(pt1.x,pt1.y,2.5*sc,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(pt2.x,pt2.y,2.5*sc,0,Math.PI*2);ctx.fill();
      if(isNext){const entryDx=Math.cos(gAng),entryDz=Math.sin(gAng),eSx=(entryDx-entryDz)*C30*sc,eSy=(entryDx+entryDz)*S30*sc,el=Math.sqrt(eSx**2+eSy**2)||1,enx=eSx/el,eny=eSy/el;
        const gm={x:(pb1.x+pb2.x)/2,y:(pb1.y+pb2.y)/2-gH*.4};
        for(let ci=0;ci<3;ci++){const cd=22+ci*16;const ca=(.3+pulse*.15)*(1-ci*.25);const cx2=gm.x+enx*cd*sc,cy2=gm.y+eny*cd*sc,cS=6*sc;
          ctx.beginPath();ctx.moveTo(cx2+enx*cS-eny*cS*.6,cy2+eny*cS+enx*cS*.6);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2+enx*cS+eny*cS*.6,cy2+eny*cS-enx*cS*.6);ctx.strokeStyle=`rgba(${col},${ca})`;ctx.lineWidth=2*sc;ctx.stroke();}}
      if(gate.reached){ctx.fillStyle=`rgba(${col},.25)`;ctx.font=`700 ${9*sc}px -apple-system,sans-serif`;ctx.textAlign="center";ctx.fillText("✓",(pb1.x+pb2.x)/2,(pb1.y+pb2.y)/2-gH*.5);ctx.textAlign="left";}
      // Gate number label
      if(totalGates>1){ctx.font=`700 ${Math.max(10,11*sc)}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(${col},${isNext?.5:.2})`;ctx.textAlign="center";
        ctx.fillText(`${gateIndex+1}`,(pt1.x+pt2.x)/2,(pt1.y+pt2.y)/2+4*sc);ctx.textAlign="left";}
      ctx.restore();
      return{x:(pb1.x+pb2.x)/2,y:(pb1.y+pb2.y)/2-gH*.5};};

    const loop=()=>{
      const tFrameStart=performance.now(),W=c.width/dpr,H=c.height/dpr,s=sim.current,sh=s.ship,cam=camRef.current,pf=perf.current;
      ctx.setTransform(dpr,0,0,dpr,0,0);// retina scaling
      if(s.freezeFrames>0){s.freezeFrames--;anim=requestAnimationFrame(loop);return;}
      const ts=cam.timeScale;cam.timeScale+=(1-cam.timeScale)*.08;
      let tgtZ=1;if(s.phase==="fly")for(const p of s.planets){const d=Math.sqrt((sh.x-p.x)**2+(sh.z-p.z)**2);if(d<p.r*4)tgtZ=Math.max(tgtZ,1+.3*(1-d/(p.r*4)));}
      cam.zoom+=(tgtZ-cam.zoom)*.06;cam.shakeX*=.85;cam.shakeY*=.85;
      const allPts=[{x:s.startX,z:s.startZ},...s.gates,...s.planets];
      const baseSc=calcScale(W,H,allPts),sc=baseSc*cam.zoom;
      // Simple camera: center on midpoint of ship and gate, then shift UP
      // so ship appears in bottom third and gate in top third
      const midX=(s.startX+s.gates[s.gates.length-1].x)/2;
      const midZ=(s.startZ+s.gates[s.gates.length-1].z)/2;
      const tck=s.phase==="fly"?Math.min(.2,(cam.zoom-1)*1.2):0;
      const lookX=midX*(1-tck)+sh.x*tck,lookZ=midZ*(1-tck)+sh.z*tck;
      const cmx=W/2-(lookX-lookZ)*C30*sc+cam.shakeX;
      const cmy=H/2-(lookX+lookZ)*S30*sc+cam.shakeY;
      const gateGrav={x:s.gate.x,z:s.gate.z,mass:2500,r:GATE_R,G:s.planets[0]?.G||170};
      const gravBodies=[...s.planets,...(s.stars||[]).map(st=>({x:st.x,z:st.z,mass:st.mass,r:st.killR||st.r,G:st.G})),gateGrav,...s.asteroids.filter(a=>a.alive).map(a=>({x:a.x,z:a.z,mass:a.mass,r:a.r,G:a.G})),...(s.comets||[]).filter(c=>c.alive).map(c=>({x:c.x,z:c.z,mass:c.mass,r:c.r,G:c.G}))];
      const solidBodies=[...s.planets,...(s.stars||[]).map(st=>({x:st.x,z:st.z,r:st.killR||st.r})),...s.asteroids.filter(a=>a.alive),...(s.comets||[]).filter(c=>c.alive)];
      const getD=(sx2,sz2)=>Math.min(Math.sqrt(Math.abs(pot(sx2,sz2,gravBodies)))*.38*sc/cam.zoom,160*sc/cam.zoom);

      // === LOADING PHASE: brief system intro ===
      if(s.phase==="loading"){
        s.simStep+=4;
        ctx.fillStyle="#f5f4f0";ctx.fillRect(0,0,W,H);
        ctx.font="200 18px -apple-system,'SF Pro Display',sans-serif";ctx.fillStyle="rgba(0,0,0,.55)";
        ctx.textAlign="center";ctx.fillText(sysName(s.level),W/2,H/2-20);
        ctx.font="400 11px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.35)";
        ctx.fillText(sysBrief(s.level),W/2,H/2+5);
        ctx.textAlign="left";
        if(s.simStep>60){
          for(const a of s.asteroids){if(!a.alive)continue;
            if(Math.sqrt((a.x-s.startX)**2+(a.z-s.startZ)**2)<50)a.alive=false;
            for(const g of s.gates)if(Math.sqrt((a.x-g.x)**2+(a.z-g.z)**2)<45)a.alive=false;}
          s.phase="aim";setUi(u=>({...u,phase:"aim"}));}
        anim=requestAnimationFrame(loop);return;
      }

      // === PHYSICS ===
      const tPS=performance.now();
      // Planets orbit under REDUCED mutual gravity (1% of G for planet-planet, full G on ship)
      if(s.phase==="fly"&&!s.paused){
        const planetDt=DT*(ffRef.current?3:1);
        for(const p of s.planets){
          const weakOthers=s.planets.filter(q=>q!==p).map(q=>({...q,G:q.G*.01}));
          [p.x,p.z,p.vx,p.vz]=ystep(p.x,p.z,p.vx,p.vz,weakOthers,planetDt);}
      }
      if(s.phase==="fly"&&!s.paused){const ffMul=ffRef.current?3:1;const adt=DT*ts*ffMul,ppx=sh.x,ppz=sh.z;
        [sh.x,sh.z,sh.vx,sh.vz]=ystep(sh.x,sh.z,sh.vx,sh.vz,gravBodies,adt);sh.ang=Math.atan2(sh.vz,sh.vx);
        s.dist+=Math.sqrt((sh.x-ppx)**2+(sh.z-ppz)**2);s.trail.push({x:sh.x,z:sh.z});if(s.trail.length>600)s.trail.shift();
        // Track G-force (acceleration magnitude at ship position)
        const[gax,gaz]=ga(sh.x,sh.z,gravBodies);const gforce=Math.sqrt(gax*gax+gaz*gaz);
        s.maxGforce=Math.max(s.maxGforce,gforce);
        // Nebula drag — operator-split dissipative force
        let inNebula=false;
        for(const nb of (s.nebulae||[])){const nd=Math.sqrt((sh.x-nb.x)**2+(sh.z-nb.z)**2);
          if(nd<nb.r){const dragF=1-nb.drag*(1-nd/nb.r);sh.vx*=dragF;sh.vz*=dragF;inNebula=true;}}
        s._inNebula=inNebula;
        // Engine exhaust trail
        if(hf%2===0){const exColor=s._inNebula?"160,120,220":"100,140,200";
          particles.current.push({x:sh.x,z:sh.z,vx:-sh.vx*.02+(Math.random()-.5)*3,vz:-sh.vz*.02+(Math.random()-.5)*3,life:22,maxLife:22,color:exColor,r:.8+Math.random()*.6});}
        // Asteroids
        for(const a of s.asteroids){if(!a.alive)continue;[a.x,a.z,a.vx,a.vz]=ystep(a.x,a.z,a.vx,a.vz,s.planets,adt);
          for(const p of s.planets){if(Math.sqrt((a.x-p.x)**2+(a.z-p.z)**2)<p.r+a.r){a.alive=false;p.mass+=a.mass;p.r=Math.max(p.r,7+Math.sqrt(p.mass)*.22);spawnP(a.x,a.z,a.vx*.3,a.vz*.3,10,"140,120,90",80,30);s.impacts.push({x:a.x,z:a.z,t:s.time});cam.shakeX=(Math.random()-.5)*5;cam.shakeY=(Math.random()-.5)*5;pf.energy0=null;break;}}}
        // Comets — eccentric orbits with tails
        for(const cm of (s.comets||[])){if(!cm.alive)continue;
          [cm.x,cm.z,cm.vx,cm.vz]=ystep(cm.x,cm.z,cm.vx,cm.vz,s.planets,adt);
          cm.trail.push({x:cm.x,z:cm.z});if(cm.trail.length>80)cm.trail.shift();// long tail
          // Planet collision
          for(const p of s.planets){if(Math.sqrt((cm.x-p.x)**2+(cm.z-p.z)**2)<p.r+cm.r){
            cm.alive=false;spawnP(cm.x,cm.z,cm.vx*.2,cm.vz*.2,18,"180,220,255",50,35);
            cam.shakeX=(Math.random()-.5)*6;cam.shakeY=(Math.random()-.5)*6;break;}}
          // Out of bounds
          if(Math.abs(cm.x)>800||Math.abs(cm.z)>800)cm.alive=false;
        }
        // Fuel pickups
        for(const pk of s.pickups){if(!pk.alive)continue;if(Math.sqrt((sh.x-pk.x)**2+(sh.z-pk.z)**2)<PICKUP_R){pk.alive=false;s.fuel+=pk.fuel;spawnP(pk.x,pk.z,0,0,12,"50,220,220",35,20);}}
        // Gate check
        const gDist=Math.sqrt((sh.x-s.gate.x)**2+(sh.z-s.gate.z)**2);
        if(gDist<GATE_R){
          s.gate.reached=true;spawnP(s.gate.x,s.gate.z,0,0,20,"100,220,120",35,40);
          if(s.gateIdx<s.gates.length-1){// Advance to next gate
            s.gateIdx++;s.gate=s.gates[s.gateIdx];
            setUi(u=>({...u,gateNum:s.gateIdx}));
          }else{// All gates reached — WIN
            s.gateVel=Math.sqrt(sh.vx**2+sh.vz**2);
            let fb=0;const fbn=[];
            for(let i=0;i<s.planets.length;i++){const cl=s.flybys[i]-s.planets[i].r;if(cl<s.planets[i].r*2&&cl>0){const b=Math.floor(80/Math.max(cl/s.planets[i].r,.3));fb+=b;fbn.push(`+${b}`);}}
            // Score = G-force daring + gate speed + distance travelled + flyby bonuses - burn penalty
            const gScore=Math.floor(Math.min(s.maxGforce*50,500));// max 500 from G-force
            const vScore=Math.floor(Math.min(s.gateVel*2,300));// max 300 from velocity
            const dScore=Math.floor(Math.min(s.dist*.2,200));// max 200 from distance
            s.score=Math.max(50,gScore+vScore+dScore+fb-s.burns*40);
            s.lastFlyby=(fbn.length?`Flyby: ${fbn.join(" ")}  ·  `:"")
              +`G: ${s.maxGforce.toFixed(0)}  ·  v: ${s.gateVel.toFixed(0)}  ·  d: ${Math.floor(s.dist)}`;
            s.phase="win";s.flash=s.time;
            const pr=progress.current;pr.scores[s.level]=Math.max(pr.scores[s.level]||0,s.score);pr.best=Math.max(pr.best,s.score);pr.streak++;pr.totalScore+=s.score;
            setUi(u=>({...u,phase:"win",score:s.score}));}}
        // Danger + flyby + gravity assist detection
        let danger=0;for(let i=0;i<s.planets.length;i++){const d=Math.sqrt((sh.x-s.planets[i].x)**2+(sh.z-s.planets[i].z)**2);s.flybys[i]=Math.min(s.flybys[i],d);
          if(d<s.planets[i].r*3)danger=Math.max(danger,1-(d-s.planets[i].r)/(s.planets[i].r*2));
          if(d<s.planets[i].r*1.8&&d>s.planets[i].r){cam.timeScale=Math.min(cam.timeScale,.75);
            // Gravity assist notification
            if(!s._assistShown||s._assistShown!==i){s._assistShown=i;s._assistTime=s.time;
              spawnP(sh.x,sh.z,sh.vx*.1,sh.vz*.1,8,"180,220,255",25,12);}}}
        if(hitAny(sh.x,sh.z,solidBodies)){s.phase="crash";s.flash=s.time;s.freezeFrames=3;
          spawnP(sh.x,sh.z,sh.vx*.2,sh.vz*.2,28,"200,80,40",60,45);// main debris
          spawnP(sh.x,sh.z,0,0,12,"255,200,100",30,20);// bright core flash
          spawnP(sh.x,sh.z,sh.vx*.05,sh.vz*.05,8,"120,130,150",80,15);// slow drift debris
          cam.shakeX=(Math.random()-.5)*10;cam.shakeY=(Math.random()-.5)*10;progress.current.streak=0;setUi(u=>({...u,phase:"crash"}));}
        if(hf%4===0)setUi(u=>({...u,danger}));}
      if(s.phase==="fly"){const ke=.5*(sh.vx**2+sh.vz**2),pe=pot(sh.x,sh.z,s.planets);pf.energyNow=ke+pe;if(pf.energy0===null)pf.energy0=pf.energyNow;pf.energyDrift=pf.energy0!==0?Math.abs((pf.energyNow-pf.energy0)/pf.energy0)*100:0;}
      const tPE=performance.now();pf.physMs=tPE-tPS;
      const parts=particles.current;for(let i=parts.length-1;i>=0;i--){parts[i].x+=parts[i].vx*DT;parts[i].z+=parts[i].vz*DT;parts[i].life--;if(parts[i].life<=0)parts.splice(i,1);}pf.particles=parts.length;
      for(let i=s.impacts.length-1;i>=0;i--)if(s.time-s.impacts[i].t>1.5)s.impacts.splice(i,1);
      if(s.phase==="win"&&s._readyNext){
        const fb=s.flybys.map((f,i)=>Math.floor(f-(s.planets[i]?.r||0)));
        const pPos=s.planets.map(p=>({x:Math.floor(p.x),z:Math.floor(p.z),r:Math.floor(p.r),m:Math.floor(p.mass)}));
        pf.levelLogs.push({level:s.level,result:"win",score:s.score,burns:s.burns,gates:s.gates.length,dist:Math.floor(s.dist),time:Math.floor(s.time),flybys:fb,maxG:+s.maxGforce.toFixed(2),gateVel:+s.gateVel.toFixed(1),name:sysName(s.level),seed:s.level*7919+1,planets:pPos});
        pf.energy0=null;ffRef.current=false;const next=mkLvl(s.level+1);Object.assign(s,next);setUi(u=>({...u,phase:"loading",level:s.level+1,burns:0,danger:0,sysName:sysName(s.level),brief:sysBrief(s.level),gateNum:0,gateTotal:s.gates.length}));}
      if(s.phase==="crash"&&s.time-s.flash>2){
        pf.levelLogs.push({level:s.level,result:"crash",burns:s.burns,dist:Math.floor(s.dist),time:Math.floor(s.time),name:sysName(s.level),seed:s.level*7919+1,planets:s.planets.map(p=>({x:Math.floor(p.x),z:Math.floor(p.z),r:Math.floor(p.r)}))});
        pf.energy0=null;ffRef.current=false;const retry=mkLvl(s.level);Object.assign(s,retry);setUi(u=>({...u,phase:"loading",burns:0,danger:0,gateNum:0,gateTotal:s.gates.length}));}
      s.time+=DT*ts;hf++;if(hf%6===0)setUi(u=>({...u,vel:Math.sqrt(sh.vx**2+sh.vz**2).toFixed(1),burns:s.burns,fuel:Math.max(0,s.fuel).toFixed(0)}));

      // === RENDER ===
      if(ui.showMap){ctx.fillStyle="#eceae4";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(0,0,0,.06)";for(let i=0;i<100;i++)ctx.fillRect(((i*7919+37)%W),((i*4967+13)%H),1,1);ctx.save();ctx.globalAlpha=.035;for(let i=0;i<250;i++){const a=i*.14,r=18+i*2.3;ctx.fillStyle=`rgba(${80+i%40},${120+i%30},${200-i%20},.5)`;ctx.fillRect(W/2+Math.cos(a)*r+Math.random()*18-9,H/2+Math.sin(a)*r+Math.random()*18-9,2,2);}ctx.restore();const pr=progress.current;for(let i=0;i<MAP_NODES.length;i++){const nd=MAP_NODES[i],nx2=W/2+nd.x,ny2=H/2+nd.y,comp=i<pr.scores.length&&pr.scores[i]>0,cur=i===s.level;if(comp){ctx.save();ctx.shadowColor="rgba(240,190,50,.5)";ctx.shadowBlur=10;ctx.fillStyle="rgba(240,190,50,.75)";ctx.beginPath();ctx.arc(nx2,ny2,3.5,0,Math.PI*2);ctx.fill();ctx.restore();}else if(cur){const p=.5+.5*Math.sin(s.time*4);ctx.save();ctx.shadowColor=`rgba(100,200,255,${.4+p*.3})`;ctx.shadowBlur=14;ctx.fillStyle=`rgba(100,200,255,${.7+p*.3})`;ctx.beginPath();ctx.arc(nx2,ny2,5,0,Math.PI*2);ctx.fill();ctx.restore();}else{ctx.fillStyle="rgba(0,0,0,.06)";ctx.beginPath();ctx.arc(nx2,ny2,2,0,Math.PI*2);ctx.fill();}}ctx.font="200 20px -apple-system,'SF Pro Display',sans-serif";ctx.fillStyle="rgba(0,0,0,.3)";ctx.textAlign="center";ctx.fillText("SURVEY PROGRESS",W/2,45);ctx.font="500 11px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillText(`${pr.scores.filter(s2=>s2>0).length} systems · ${pr.totalScore} pts`,W/2,65);ctx.font="400 9px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.1)";ctx.fillText("Tap a gold system to replay it",W/2,80);ctx.textAlign="left";anim=requestAnimationFrame(loop);return;}
      const dim=s.phase==="plan"?.55:1;ctx.fillStyle=s.phase==="plan"?"#eceae4":"#f5f4f0";ctx.fillRect(0,0,W,H);
      if(ui.danger>.05&&s.phase==="fly"){const da=ui.danger*.35*(.7+.3*Math.sin(s.time*8));const dg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.7);dg.addColorStop(0,"rgba(200,40,25,0)");dg.addColorStop(1,`rgba(200,40,25,${da})`);ctx.fillStyle=dg;ctx.fillRect(0,0,W,H);}
      ctx.fillStyle="rgba(0,0,20,.008)";for(let i=0;i<60;i++)ctx.fillRect(Math.random()*W,Math.random()*H,1,1);
      // No nebula backdrop on white void theme
      // Starfield — white-blue dots at varying brightness
      for(let i=0;i<80;i++){const sx3=((i*7919+37)*3.7)%W,sy3=((i*4967+13)*2.3)%H;
        const bright=i%11===0?.15:i%5===0?.08:i%3===0?.04:.02;const sz3=i%11===0?1.5:1;
        ctx.fillStyle=`rgba(0,0,20,${bright})`;ctx.fillRect(sx3,sy3,sz3,sz3);}

      // Grid 110x110 with color gradient near wells
      const tGS=performance.now(),gN=75,gSp=9.5,halfG=gN*gSp/2;
      const gxa=new Float32Array((gN+1)**2),gya=new Float32Array((gN+1)**2);
      for(let ix=0;ix<=gN;ix++)for(let iz=0;iz<=gN;iz++){const sx2=ix*gSp-halfG,sz2=iz*gSp-halfG,d=getD(sx2,sz2),idx=ix*(gN+1)+iz;gxa[idx]=cmx+(sx2-sz2)*C30*sc;gya[idx]=cmy+(sx2+sz2)*S30*sc+d;}
      ctx.lineWidth=.7;
      for(let ix=0;ix<=gN;ix++){const sx2=ix*gSp-halfG,fade=Math.max(0,1-(Math.abs(sx2)/(halfG*.7))**3);let w=0,nearP=0;
        for(const p of s.planets){const pd=Math.abs(sx2-p.x);w=Math.max(w,Math.max(0,1-pd/110)*.3);nearP=Math.max(nearP,Math.max(0,1-pd/40));}
        const a=(fade*.2+w)*dim;if(a<.005)continue;ctx.beginPath();const b=ix*(gN+1);ctx.moveTo(gxa[b],gya[b]);for(let iz=1;iz<=gN;iz++)ctx.lineTo(gxa[b+iz],gya[b+iz]);
        const r=Math.floor(40+nearP*60),g=Math.floor(50+nearP*30),bl=Math.floor(70-nearP*30);
        ctx.strokeStyle=`rgba(${r},${g},${bl},${a})`;ctx.stroke();}
      for(let iz=0;iz<=gN;iz++){const sz2=iz*gSp-halfG,fade=Math.max(0,1-(Math.abs(sz2)/(halfG*.7))**3);let w=0,nearP=0;
        for(const p of s.planets){const pd=Math.abs(sz2-p.z);w=Math.max(w,Math.max(0,1-pd/110)*.3);nearP=Math.max(nearP,Math.max(0,1-pd/40));}
        const a=(fade*.2+w)*dim;if(a<.005)continue;ctx.beginPath();ctx.moveTo(gxa[iz],gya[iz]);for(let ix=1;ix<=gN;ix++)ctx.lineTo(gxa[ix*(gN+1)+iz],gya[ix*(gN+1)+iz]);
        const r=Math.floor(40+nearP*60),g=Math.floor(50+nearP*30),bl=Math.floor(70-nearP*30);
        ctx.strokeStyle=`rgba(${r},${g},${bl},${a})`;ctx.stroke();}
      const tGE=performance.now();pf.gridMs=tGE-tGS;pf.gridVerts=(gN+1)**2;

      for(const imp of s.impacts){const ip=iso(imp.x,imp.z,getD(imp.x,imp.z)*.5,cmx,cmy,sc);const age=s.time-imp.t,alpha=Math.max(0,1-age/1.5)*.4,ringR=age*60*sc;ctx.beginPath();ctx.arc(ip.x,ip.y,ringR,0,Math.PI*2);ctx.strokeStyle=`rgba(200,150,80,${alpha})`;ctx.lineWidth=2*sc;ctx.stroke();}
      // Nebulae — translucent drag clouds
      for(const nb of (s.nebulae||[])){const np=iso(nb.x,nb.z,0,cmx,cmy,sc),nR=nb.r*sc;
        const[nr,ng,nbl]=nb.color;
        // Outer glow
        const ng3=ctx.createRadialGradient(np.x,np.y,0,np.x,np.y,nR*1.3);
        ng3.addColorStop(0,`rgba(${nr},${ng},${nbl},.03)`);ng3.addColorStop(1,`rgba(${nr},${ng},${nbl},0)`);
        ctx.fillStyle=ng3;ctx.beginPath();ctx.arc(np.x,np.y,nR*1.3,0,Math.PI*2);ctx.fill();
        // Main cloud — VISIBLE
        const ng2=ctx.createRadialGradient(np.x,np.y,0,np.x,np.y,nR);
        ng2.addColorStop(0,`rgba(${nr},${ng},${nbl},.3)`);ng2.addColorStop(.4,`rgba(${nr},${ng},${nbl},.18)`);
        ng2.addColorStop(.8,`rgba(${nr},${ng},${nbl},.06)`);ng2.addColorStop(1,`rgba(${nr},${ng},${nbl},0)`);
        ctx.fillStyle=ng2;ctx.beginPath();ctx.arc(np.x,np.y,nR,0,Math.PI*2);ctx.fill();
        // Inner wisps
        for(let wi=0;wi<8;wi++){const wa=wi*.785+s.time*.08,wr=nR*(.15+wi*.1);
          const wx=np.x+Math.cos(wa)*wr*.4,wy=np.y+Math.sin(wa)*wr*.3;
          ctx.beginPath();ctx.arc(wx,wy,wr*.35,0,Math.PI*2);
          ctx.fillStyle=`rgba(${nr},${ng},${nbl},.08)`;ctx.fill();}
        // Border ring
        ctx.beginPath();ctx.arc(np.x,np.y,nR,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${nr},${ng},${nbl},.12)`;ctx.lineWidth=1;ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);
        // Label
        ctx.font=`600 ${Math.max(9,10*sc)}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(${nr},${ng},${nbl},.35)`;
        ctx.textAlign="center";ctx.fillText("NEBULA",np.x,np.y+nR+14*sc);
        ctx.font=`400 ${Math.max(7,8*sc)}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(${nr},${ng},${nbl},.2)`;
        ctx.fillText("drag zone",np.x,np.y+nR+25*sc);ctx.textAlign="left";}

      // Stars — massive glowing bodies
      for(const st of (s.stars||[])){const sp=iso(st.x,st.z,0,cmx,cmy,sc),sR=st.r*sc;
        ctx.save();
        // Outer corona
        const cg=ctx.createRadialGradient(sp.x,sp.y,sR*.5,sp.x,sp.y,sR*3);
        cg.addColorStop(0,"rgba(255,220,100,.25)");cg.addColorStop(.3,"rgba(255,180,60,.08)");cg.addColorStop(1,"rgba(255,140,30,0)");
        ctx.fillStyle=cg;ctx.beginPath();ctx.arc(sp.x,sp.y,sR*3,0,Math.PI*2);ctx.fill();
        // Photosphere
        ctx.shadowColor="rgba(255,200,80,.8)";ctx.shadowBlur=30*sc;
        const sg=ctx.createRadialGradient(sp.x-sR*.2,sp.y-sR*.2,sR*.1,sp.x,sp.y,sR);
        sg.addColorStop(0,"rgba(255,255,230,1)");sg.addColorStop(.4,"rgba(255,220,120,1)");sg.addColorStop(1,"rgba(255,160,40,1)");
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sp.x,sp.y,sR,0,Math.PI*2);ctx.fill();
        // Kill zone ring
        const kR=(st.killR||st.r)*sc;
        ctx.beginPath();ctx.arc(sp.x,sp.y,kR,0,Math.PI*2);
        ctx.strokeStyle="rgba(255,100,30,.15)";ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
        ctx.restore();}

      for(const pl of s.planets){const pp=iso(pl.x,pl.z,0,cmx,cmy,sc),pR=pl.r*sc;const[cr,cg,cb]=pl.c,[hr,hg,hb]=pl.h;ctx.save();
        // Atmosphere glow
        ctx.beginPath();ctx.arc(pp.x,pp.y,pR+22*sc,0,Math.PI*2);const at=ctx.createRadialGradient(pp.x,pp.y,pR*.7,pp.x,pp.y,pR+22*sc);at.addColorStop(0,`rgba(${cr},${cg},${cb},.2)`);at.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);ctx.fillStyle=at;ctx.fill();
        // Main body
        ctx.beginPath();ctx.arc(pp.x,pp.y,pR,0,Math.PI*2);const pg=ctx.createRadialGradient(pp.x-pR*.3,pp.y-pR*.3,pR*.05,pp.x+pR*.1,pp.y+pR*.1,pR);pg.addColorStop(0,`rgba(${cr+30},${cg+30},${cb+30},1)`);pg.addColorStop(.5,`rgba(${cr},${cg},${cb},1)`);pg.addColorStop(1,`rgba(${Math.max(0,cr-25)},${Math.max(0,cg-25)},${Math.max(0,cb-25)},1)`);ctx.fillStyle=pg;ctx.fill();
        // Concentric pressure rings (surface detail)
        for(let ri=0;ri<3;ri++){const rr=pR*(.35+ri*.22);ctx.beginPath();ctx.arc(pp.x,pp.y,rr,0,Math.PI*2);ctx.strokeStyle=`rgba(${hr},${hg},${hb},${.08-.02*ri})`;ctx.lineWidth=.7;ctx.stroke();}
        // Highlight crescent
        ctx.beginPath();ctx.arc(pp.x,pp.y,pR+.5,-.6,.6);ctx.strokeStyle=`rgba(${hr},${hg},${hb},.6)`;ctx.lineWidth=2.2*sc;ctx.stroke();
        // Terminator line (day/night divide)
        ctx.beginPath();ctx.arc(pp.x+pR*.15,pp.y+pR*.15,pR*.85,1.2,3.8);ctx.strokeStyle=`rgba(0,0,0,.06)`;ctx.lineWidth=1.5;ctx.stroke();
        ctx.restore();}
      for(const a of s.asteroids){if(!a.alive)continue;const ap=iso(a.x,a.z,getD(a.x,a.z)*.4,cmx,cmy,sc),aR=a.r*sc;ctx.fillStyle="rgba(100,110,130,.7)";ctx.beginPath();ctx.arc(ap.x,ap.y,aR,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(120,130,150,.35)";ctx.lineWidth=1.2*sc;ctx.beginPath();ctx.arc(ap.x,ap.y,aR+.5,-.4,.4);ctx.stroke();}

      // Comets — bright head with dramatic tail
      for(const cm of (s.comets||[])){if(!cm.alive)continue;
        if(cm.trail.length>3){
          // Wide outer glow tail
          ctx.beginPath();const t0=iso(cm.trail[0].x,cm.trail[0].z,0,cmx,cmy,sc);ctx.moveTo(t0.x,t0.y);
          for(let ti=1;ti<cm.trail.length;ti++){const tp=iso(cm.trail[ti].x,cm.trail[ti].z,0,cmx,cmy,sc);ctx.lineTo(tp.x,tp.y);}
          ctx.strokeStyle="rgba(100,160,255,.08)";ctx.lineWidth=8*sc;ctx.stroke();
          // Medium tail
          ctx.strokeStyle="rgba(140,180,255,.15)";ctx.lineWidth=4*sc;ctx.stroke();
          // Bright core tail
          ctx.strokeStyle="rgba(200,220,255,.3)";ctx.lineWidth=1.5*sc;ctx.stroke();}
        // Head — large bright glow
        const cp=iso(cm.x,cm.z,getD(cm.x,cm.z)*.3,cmx,cmy,sc),cR=Math.max(cm.r*sc*2,4);
        ctx.save();ctx.shadowColor="rgba(120,170,255,.8)";ctx.shadowBlur=18*sc;
        ctx.fillStyle="rgba(180,210,255,.9)";ctx.beginPath();ctx.arc(cp.x,cp.y,cR,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="rgba(255,255,255,.8)";ctx.beginPath();ctx.arc(cp.x,cp.y,cR*.4,0,Math.PI*2);ctx.fill();
        ctx.restore();}

      // Fuel pickups
      for(const pk of s.pickups){if(!pk.alive)continue;const pp=iso(pk.x,pk.z,getD(pk.x,pk.z)*.3,cmx,cmy,sc);const bob=Math.sin(s.time*3+pk.x)*.5;const pr2=8*sc;
        ctx.save();ctx.shadowColor="rgba(50,220,220,.4)";ctx.shadowBlur=12*sc;
        // Diamond shape
        ctx.beginPath();ctx.moveTo(pp.x,pp.y-pr2+bob);ctx.lineTo(pp.x+pr2*.6,pp.y+bob);ctx.lineTo(pp.x,pp.y+pr2+bob);ctx.lineTo(pp.x-pr2*.6,pp.y+bob);ctx.closePath();
        ctx.fillStyle=`rgba(50,220,220,${.25+.1*Math.sin(s.time*4)})`;ctx.fill();
        ctx.strokeStyle=`rgba(50,220,220,${.5+.15*Math.sin(s.time*4)})`;ctx.lineWidth=1.5*sc;ctx.stroke();
        ctx.font=`600 ${7*sc}px -apple-system,sans-serif`;ctx.fillStyle="rgba(50,220,220,.4)";ctx.textAlign="center";ctx.fillText(`+${pk.fuel}`,pp.x,pp.y+pr2+10*sc);ctx.textAlign="left";
        ctx.restore();}

      // Gates — draw all, highlight current, add number labels
      let gateScreenPos={x:W/2,y:H/2};
      for(let gi=0;gi<s.gates.length;gi++){
        const isNext=gi===s.gateIdx&&s.phase!=="win";
        const gsp=drawGate(ctx,s.gates[gi],gi,s.gates.length,cmx,cmy,sc,s.time,isNext);
        if(isNext)gateScreenPos=gsp;
        // Gate number label
        if(s.gates.length>1){
          ctx.font=`700 ${Math.max(10,11*sc)}px -apple-system,sans-serif`;
          ctx.textAlign="center";
          ctx.fillStyle=s.gates[gi].reached?`rgba(60,200,100,.25)`:isNext?`rgba(60,200,100,.5)`:`rgba(60,200,100,.15)`;
          ctx.fillText(`${gi+1}`,gsp.x,gsp.y+22*sc);
          ctx.textAlign="left";}}

      // Particles
      for(const p of parts){const pd=getD(p.x,p.z),pp=iso(p.x,p.z,pd*.4,cmx,cmy,sc);ctx.fillStyle=`rgba(${p.color},${(p.life/p.maxLife)*.6})`;ctx.beginPath();ctx.arc(pp.x,pp.y,p.r*sc,0,Math.PI*2);ctx.fill();}
      if(s.trail.length>4){
        const tLen=s.trail.length,step=Math.max(1,Math.floor(tLen/200));
        for(let i=step+1;i<tLen;i+=step){
          const t0=s.trail[i-step],t1=s.trail[i];
          const d0=getD(t0.x,t0.z),d1=getD(t1.x,t1.z);
          const p0=iso(t0.x,t0.z,d0,cmx,cmy,sc),p1=iso(t1.x,t1.z,d1,cmx,cmy,sc);
          const fade=i/tLen;
          ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);
          ctx.strokeStyle=`rgba(30,80,180,${fade*.25})`;ctx.lineWidth=.8+fade*2.2;ctx.stroke();}}

      // Trajectory
      const tTS=performance.now(),dr=drg.current,lk=lock.current;let showVx=0,showVz=0,hasTraj=false;
      if((s.phase==="aim"||s.phase==="plan")&&dr.active){const ddx=dr.cx-dr.sx,ddy=dr.cy-dr.sy,dist=Math.sqrt(ddx*ddx+ddy*ddy);if(dist>12){const[sdx,sdz]=s2sim(ddx,ddy,baseSc);const mag=Math.sqrt(sdx*sdx+sdz*sdz);const maxV=s.phase==="plan"?Math.min(MAX_BURN,s.fuel,MAX_V):Math.min(MAX_V,s.fuel);const vel=Math.min(mag*VEL_SC,maxV);showVx=sdx/mag*vel;showVz=sdz/mag*vel;hasTraj=true;}}
      else if((s.phase==="aim"||s.phase==="plan")&&lk.on){showVx=lk.vx;showVz=lk.vz;hasTraj=true;}

      const drawCT=(result)=>{const{pts,minGate,minGateIdx}=result;if(pts.length<3)return;const lp=pts[pts.length-1],hGA=pts.some(p=>p.hitsGate),hW=lp.hit&&!lp.hitsGate;ctx.save();
        for(let i=1;i<pts.length;i++){const p=pts[i],pv=pts[i-1],d1=getD(pv.x,pv.z),d2=getD(p.x,p.z),s1=iso(pv.x,pv.z,d1,cmx,cmy,sc),s2=iso(p.x,p.z,d2,cmx,cmy,sc),fade=Math.max(.12,1-i/pts.length);let col;
          if(p.hitsGate)col=`rgba(60,200,100,${fade*.7})`;else if(p.danger>.6)col=`rgba(220,55,35,${fade*.55})`;else if(p.danger>.2)col=`rgba(220,170,40,${fade*.5})`;else col=hGA?`rgba(60,200,100,${fade*.5})`:(hW?`rgba(220,55,35,${fade*.45})`:`rgba(80,190,110,${fade*.45})`);
          ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.strokeStyle=col;ctx.lineWidth=3;ctx.stroke();}
        const off=(s.time*40)%18;for(let i=Math.floor(off);i<pts.length;i+=18){const p=pts[i],d=getD(p.x,p.z),sp=iso(p.x,p.z,d,cmx,cmy,sc),fade=(1-i/pts.length)*.5;ctx.fillStyle=p.hitsGate?`rgba(60,200,100,${fade})`:p.danger>.5?`rgba(220,55,35,${fade})`:`rgba(80,190,110,${fade})`;ctx.beginPath();ctx.arc(sp.x,sp.y,2.5*sc,0,Math.PI*2);ctx.fill();}
        if(hW){const d2=getD(lp.x,lp.z),sp=iso(lp.x,lp.z,d2,cmx,cmy,sc);ctx.strokeStyle="rgba(220,50,30,.65)";ctx.lineWidth=2.5*sc;ctx.beginPath();ctx.moveTo(sp.x-7*sc,sp.y-7*sc);ctx.lineTo(sp.x+7*sc,sp.y+7*sc);ctx.stroke();ctx.beginPath();ctx.moveTo(sp.x+7*sc,sp.y-7*sc);ctx.lineTo(sp.x-7*sc,sp.y+7*sc);ctx.stroke();}
        if(hGA){const ghp=pts.find(p=>p.hitsGate);if(ghp){const d2=getD(ghp.x,ghp.z),sp=iso(ghp.x,ghp.z,d2,cmx,cmy,sc);ctx.save();ctx.shadowColor="rgba(60,200,100,.6)";ctx.shadowBlur=12*sc;ctx.fillStyle=`rgba(60,200,100,${.4+.2*Math.sin(s.time*5)})`;ctx.beginPath();ctx.arc(sp.x,sp.y,6*sc,0,Math.PI*2);ctx.fill();ctx.restore();}}
        if(!hGA&&minGate<120&&minGateIdx>0){const mp=pts[minGateIdx],d2=getD(mp.x,mp.z),sp=iso(mp.x,mp.z,d2,cmx,cmy,sc);ctx.font=`600 11px -apple-system,sans-serif`;ctx.fillStyle="rgba(220,170,40,.65)";ctx.fillText(`Miss: ${Math.floor(minGate-GATE_R)}`,sp.x+8,sp.y-8);ctx.beginPath();ctx.moveTo(sp.x,sp.y);ctx.lineTo(gateScreenPos.x,gateScreenPos.y);ctx.strokeStyle="rgba(220,170,40,.2)";ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);}
        ctx.restore();};
      // Draw ghost planets (future positions from trajectory prediction)
      const drawGhosts=(ghosts)=>{if(!ghosts||!ghosts.length)return;
        const tLabels=["T+10s","T+20s","T+30s"];
        for(let gi=0;gi<ghosts.length;gi++){const snap=ghosts[gi];const alpha=.2+gi*.08;
          for(let pi=0;pi<snap.length;pi++){const gp2=snap[pi];const gpp=iso(gp2.x,gp2.z,0,cmx,cmy,sc);const gR=Math.max(gp2.r*sc*1.2,6);
            // Connecting line from real planet to ghost
            const realP=s.planets[pi];if(realP){const rpp=iso(realP.x,realP.z,0,cmx,cmy,sc);
              ctx.beginPath();ctx.moveTo(rpp.x,rpp.y);ctx.lineTo(gpp.x,gpp.y);
              ctx.strokeStyle=`rgba(100,130,200,${alpha*.3})`;ctx.lineWidth=1;ctx.setLineDash([2,4]);ctx.stroke();ctx.setLineDash([]);}
            // Ghost fill — translucent but visible
            ctx.beginPath();ctx.arc(gpp.x,gpp.y,gR,0,Math.PI*2);
            ctx.fillStyle=`rgba(100,130,200,${alpha*.5})`;ctx.fill();
            ctx.strokeStyle=`rgba(80,110,180,${alpha*.8})`;ctx.lineWidth=1.5*sc;ctx.stroke();}
          // Time label
          if(snap[0]){const lp=iso(snap[0].x,snap[0].z,0,cmx,cmy,sc);
            ctx.font=`700 ${Math.max(9,10*sc)}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(80,110,180,${alpha})`;
            ctx.fillText(tLabels[gi]||"",lp.x+snap[0].r*sc+6,lp.y-6);}}};

      if(hasTraj){const bvx=s.phase==="plan"?sh.vx+showVx:showVx,bvz=s.phase==="plan"?sh.vz+showVz:showVz;
        const trajResult=predict(sh.x,sh.z,bvx,bvz,gravBodies,s.planets,s.gate,1200,halfG,s.stars);
        drawCT(trajResult);drawGhosts(trajResult.ghosts);
        const shipP=iso(sh.x,sh.z,getD(sh.x,sh.z),cmx,cmy,sc),vm=Math.sqrt(showVx**2+showVz**2);
        const sd2={x:(showVx-showVz)*C30,y:(showVx+showVz)*S30},sl=Math.sqrt(sd2.x**2+sd2.y**2)||1,aL=Math.min(vm*1.2*sc,160),adx=sd2.x/sl*aL,ady=sd2.y/sl*aL;
        const atMax=vm>=s.fuel-.5;const col=s.phase==="plan"?"70,150,255":"240,165,30";ctx.save();ctx.shadowColor=`rgba(${col},.4)`;ctx.shadowBlur=8;
        ctx.beginPath();ctx.moveTo(shipP.x,shipP.y);ctx.lineTo(shipP.x+adx,shipP.y+ady);ctx.strokeStyle=`rgba(${col},.7)`;ctx.lineWidth=3;ctx.stroke();
        ctx.fillStyle=`rgba(${col},.7)`;ctx.beginPath();ctx.arc(shipP.x+adx,shipP.y+ady,4.5,0,Math.PI*2);ctx.fill();
        if(atMax){ctx.beginPath();ctx.arc(shipP.x+adx,shipP.y+ady,7,0,Math.PI*2);ctx.strokeStyle="rgba(220,60,30,.5)";ctx.lineWidth=1.5;ctx.stroke();}
        ctx.font=`700 12px -apple-system,sans-serif`;ctx.fillStyle=atMax?`rgba(220,60,30,.7)`:`rgba(${col},.65)`;ctx.fillText(`Δv ${vm.toFixed(0)}${atMax?" MAX":""}`,shipP.x+adx+12,shipP.y+ady-8);ctx.restore();}
      if(s.phase==="fly"&&!hasTraj){const flyResult=predict(sh.x,sh.z,sh.vx,sh.vz,gravBodies,s.planets,s.gate,1200,halfG,s.stars);drawCT(flyResult);drawGhosts(flyResult.ghosts);}
      pf.trajMs=performance.now()-tTS;

      // Ship
      const sd=getD(sh.x,sh.z),sp2=iso(sh.x,sh.z,sd,cmx,cmy,sc);
      if(s.flash>0&&s.time-s.flash<.5&&s.phase==="fly"){ctx.save();ctx.globalCompositeOperation="lighter";const gs=(25+Math.random()*12)*sc;ctx.shadowColor="rgba(80,170,255,.8)";ctx.shadowBlur=30*sc;const tg=ctx.createRadialGradient(sp2.x,sp2.y,0,sp2.x,sp2.y,gs);tg.addColorStop(0,"rgba(100,180,255,.7)");tg.addColorStop(.4,"rgba(60,140,240,.25)");tg.addColorStop(1,"rgba(30,90,210,0)");ctx.fillStyle=tg;ctx.beginPath();ctx.arc(sp2.x,sp2.y,gs,0,Math.PI*2);ctx.fill();ctx.restore();}
      if(s.phase!=="crash"||s.time-s.flash<.1)drawShip(ctx,sp2.x,sp2.y,sh.ang,sc,s.phase==="fly"&&s.flash>0&&s.time-s.flash<.4);
      if(s.phase==="fly"){const vm=Math.sqrt(sh.vx**2+sh.vz**2);if(vm>.5){const v={x:(sh.vx-sh.vz)*C30,y:(sh.vx+sh.vz)*S30},vl=Math.sqrt(v.x**2+v.y**2)||1,al=Math.min(vm*.3*sc,45*sc);ctx.beginPath();ctx.moveTo(sp2.x,sp2.y);ctx.lineTo(sp2.x+v.x/vl*al,sp2.y+v.y/vl*al);ctx.strokeStyle="rgba(40,80,180,.4)";ctx.lineWidth=1.2;ctx.stroke();}}
      if(s.phase==="crash"&&s.time-s.flash<.4){ctx.fillStyle=`rgba(180,40,25,${(1-(s.time-s.flash)/.4)*.08})`;ctx.fillRect(0,0,W,H);}
      if(s.phase==="win"&&s.time-s.flash<.5){ctx.fillStyle=`rgba(60,200,100,${(1-(s.time-s.flash)/.5)*.05})`;ctx.fillRect(0,0,W,H);}
      // Gravity assist notification
      if(s._assistTime&&s.time-s._assistTime<1.5&&s.phase==="fly"){
        const aa=Math.max(0,1-(s.time-s._assistTime)/1.5);
        ctx.save();ctx.font=`300 14px -apple-system,'SF Pro Display',sans-serif`;ctx.fillStyle=`rgba(60,100,180,${aa*.4})`;
        ctx.textAlign="center";ctx.fillText("GRAVITY ASSIST",W/2,H*.18);ctx.textAlign="left";ctx.restore();}
      // Flight HUD — distance and velocity
      if(s.phase==="fly"&&!s.paused){
        const gDist2=Math.floor(Math.sqrt((sh.x-s.gate.x)**2+(sh.z-s.gate.z)**2));
        const vel2=Math.floor(Math.sqrt(sh.vx**2+sh.vz**2));
        ctx.font="300 10px -apple-system,'SF Pro Display',sans-serif";ctx.textAlign="center";
        ctx.fillStyle="rgba(0,0,0,.35)";ctx.fillText(`${gDist2}u to gate · ${vel2} m/s`,W/2,H-195);
        ctx.textAlign="left";}
      // Nebula tint when ship is inside
      if(s._inNebula&&s.phase==="fly"){ctx.fillStyle="rgba(140,100,200,.04)";ctx.fillRect(0,0,W,H);}
      const vr=Math.max(W,H)*.7,vig=ctx.createRadialGradient(W/2,H/2,vr*.4,W/2,H/2,vr);vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.04)");ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
      // Phase border glow
      const phaseCol=s.phase==="aim"?"rgba(220,180,50,":"rgba(60,130,220,";
      if(s.phase==="aim"||s.phase==="plan"){const bc=phaseCol+".08)";ctx.fillStyle=bc;ctx.fillRect(0,0,2,H);ctx.fillRect(W-2,0,2,H);ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);}
      // Pause hint — first flight only
      if(s.phase==="fly"&&!s.paused&&s.time>2&&s.time<4&&s.level<2&&!s._pauseHintShown){
        const ho=Math.max(0,1-(s.time-2)/2)*.2;
        ctx.font=`300 ${11}px -apple-system,sans-serif`;ctx.fillStyle=`rgba(0,0,0,${ho})`;ctx.textAlign="center";ctx.fillText("tap to pause",W/2,H/2+50);ctx.textAlign="left";
        if(s.time>3.5)s._pauseHintShown=true;}
      if(s.phase==="plan"){ctx.font=`600 11px -apple-system,sans-serif`;ctx.fillStyle="rgba(60,130,220,.5)";ctx.textAlign="center";ctx.fillText("TIME FROZEN — DRAG TO AIM BURN",W/2,24);ctx.textAlign="left";}
      if(s.paused&&s.phase==="fly"){ctx.fillStyle="rgba(10,20,34,.65)";ctx.fillRect(0,0,W,H);ctx.font="200 22px -apple-system,'SF Pro Display',sans-serif";ctx.fillStyle="rgba(0,0,0,.25)";ctx.textAlign="center";ctx.fillText("PAUSED",W/2,H/2);ctx.font="400 10px -apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillText("Tap to resume",W/2,H/2+22);ctx.textAlign="left";}
      // Perf
      const tFE=performance.now();pf.totalMs=tFE-tFrameStart;pf.frameTimes.push(pf.totalMs);if(pf.frameTimes.length>300)pf.frameTimes.shift();pf.fps=Math.round(1000/Math.max(pf.totalMs,.1));pf.minFps=Math.round(1000/Math.max(Math.max(...pf.frameTimes.slice(-300)),.1));
      ctx.font="600 9px 'Courier New',monospace";ctx.textAlign="right";ctx.fillStyle="rgba(0,0,0,.35)";
      const bodyCount=gravBodies.length;
      ctx.fillText(`${pf.fps}fps PHY${pf.physMs.toFixed(1)} GRD${pf.gridMs.toFixed(1)} TRJ${pf.trajMs.toFixed(1)} =${pf.totalMs.toFixed(1)}ms`,W-10,H-60);
      ctx.fillText(`${pf.gridVerts}v ${pf.particles}p ${bodyCount}bod ${s.asteroids.filter(a=>a.alive).length}ast`,W-10,H-48);
      if(pf.energy0!==null){ctx.fillStyle=pf.energyDrift<.1?"rgba(40,140,70,.2)":"rgba(200,50,30,.2)";ctx.fillText(`drift ${pf.energyDrift.toFixed(4)}%`,W-10,H-38);}
      ctx.textAlign="left";
      anim=requestAnimationFrame(loop);};
    anim=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(anim);window.removeEventListener("resize",resize);};
  },[mkLvl,ui.showMap]);

  const ff="-apple-system,'SF Pro Display','Helvetica Neue',sans-serif";const s=sim.current;const locked=lock.current.on;
  const noFuel=s&&locked?Math.sqrt(lock.current.vx**2+lock.current.vz**2)>(s?.fuel||0):false;
  const doLaunch=()=>{if(!s||s.phase!=="aim"||!lock.current.on)return;const vm=Math.sqrt(lock.current.vx**2+lock.current.vz**2);if(vm>s.fuel)return;s.fuel-=vm;s.ship.vx=lock.current.vx;s.ship.vz=lock.current.vz;s.ship.ang=Math.atan2(lock.current.vz,lock.current.vx);s.phase="fly";lock.current={on:false,vx:0,vz:0};drg.current.active=false;perf.current.energy0=null;setUi(u=>({...u,phase:"fly"}));};
  const doPlan=()=>{if(!s||s.phase!=="fly"||s.fuel<=0)return;s.phase="plan";lock.current={on:false,vx:0,vz:0};drg.current.active=false;setUi(u=>({...u,phase:"plan"}));};
  const doExec=()=>{if(!s||s.phase!=="plan"||!lock.current.on)return;const vm=Math.sqrt(lock.current.vx**2+lock.current.vz**2);if(vm>s.fuel)return;s.fuel-=vm;s.ship.vx+=lock.current.vx;s.ship.vz+=lock.current.vz;s.ship.ang=Math.atan2(s.ship.vz,s.ship.vx);s.burns++;s.flash=s.time;
    particles.current.push(...Array.from({length:15},()=>{const a=Math.random()*Math.PI*2;return{x:s.ship.x,z:s.ship.z,vx:-s.ship.vx*.1+Math.cos(a)*15,vz:-s.ship.vz*.1+Math.sin(a)*15,life:30,maxLife:30,color:"80,170,255",r:1+Math.random()*1.5};}));
    s.phase="fly";lock.current={on:false,vx:0,vz:0};drg.current.active=false;perf.current.energy0=null;setUi(u=>({...u,phase:"fly",burns:s.burns}));};
  const doCancel=()=>{if(!s)return;s.phase="fly";lock.current={on:false,vx:0,vz:0};drg.current.active=false;setUi(u=>({...u,phase:"fly"}));};
  const doRetry=()=>{if(!s)return;const retry=mkLvl(s.level);Object.assign(s,retry);drg.current.active=false;setUi(u=>({...u,phase:"loading",burns:0,danger:0,gateNum:0,gateTotal:s.gates.length}));};
  const toggleMap=()=>setUi(u=>({...u,showMap:!u.showMap}));
  const goToLevel=(n)=>{if(!sim.current)return;const lvl=mkLvl(n);Object.assign(sim.current,lvl);drg.current.active=false;
    setUi(u=>({...u,phase:"loading",level:n,burns:0,danger:0,sysName:sysName(n),brief:sysBrief(n),gateNum:0,gateTotal:lvl.gates.length,showMap:false}));};

  // Fine-tune controls: adjust locked vector
  const adjustAngle=(delta)=>{if(!lock.current.on)return;const lk=lock.current;
    const ang=Math.atan2(lk.vz,lk.vx)+delta;const mag=Math.sqrt(lk.vx**2+lk.vz**2);
    lock.current={on:true,vx:Math.cos(ang)*mag,vz:Math.sin(ang)*mag};setUi(u=>({...u}));};
  const adjustPower=(delta)=>{if(!lock.current.on||!s)return;const lk=lock.current;
    const ang=Math.atan2(lk.vz,lk.vx);let mag=Math.sqrt(lk.vx**2+lk.vz**2)+delta;
    const maxV=s.phase==="plan"?Math.min(MAX_BURN,s.fuel):MAX_V;
    mag=Math.max(2,Math.min(mag,maxV));
    lock.current={on:true,vx:Math.cos(ang)*mag,vz:Math.sin(ang)*mag};setUi(u=>({...u}));};

  // Level rating
  const rateLevel=(rating)=>{if(!s)return;
    const entry={level:s.level,seed:s.level*7919+1,score:s.score,burns:s.burns,rating,
      planets:s.planets.length,gates:s.gates.length,name:sysName(s.level),brief:sysBrief(s.level)};
    const pr=progress.current;
    pr.favorites=pr.favorites.filter(f=>f.level!==s.level);// replace if exists
    if(rating>=3)pr.favorites.push(entry);
    perf.current.levelLogs.push({...entry,result:"rated"});
    s._rated=true;s._rating=rating;s._readyNext=true;setUi(u=>({...u,showRate:false}));};
  const doNext=()=>{if(!s)return;s._readyNext=true;setUi(u=>({...u}));};

  // Export favorites as markdown
  const exportFavorites=()=>{
    const pr=progress.current;
    let md=`# Gravity Well — Curated Levels\n\nGenerated ${new Date().toISOString().slice(0,10)}\n\n`;
    md+=`## Stats\n\n- Systems charted: ${pr.scores.filter(s2=>s2>0).length}\n- Total score: ${pr.totalScore}\n- Best single: ${pr.best}\n- Favorites: ${pr.favorites.length}\n\n`;
    md+=`## Favorite Levels\n\n`;
    if(pr.favorites.length===0)md+=`No levels rated 3+ yet. Rate levels on the win screen!\n\n`;
    for(const f of pr.favorites){
      md+=`### Level ${f.level} — ${f.name}\n\n`;
      md+=`- **Brief:** ${f.brief}\n`;
      md+=`- **Seed:** \`${f.seed}\` · **Recreate:** \`genLevel(${f.level})\`\n`;
      md+=`- **Planets:** ${f.planets} | **Gates:** ${f.gates}\n`;
      md+=`- **Score:** ${f.score} | **Burns:** ${f.burns} | **Rating:** ${"★".repeat(f.rating)}${"☆".repeat(5-f.rating)}\n\n`;}
    md+=`## Full Play History\n\n`;
    md+=`| Level | Name | Result | Score | Burns | Gates | Dist | Planets | Seed |\n|---|---|---|---|---|---|---|---|---|\n`;
    for(const l of perf.current.levelLogs){
      if(l.result==="rated")continue;
      const pStr=Array.isArray(l.planets)?l.planets.length:(l.planets||"?");
      md+=`| ${l.level} | ${l.name||sysName(l.level)} | ${l.result} | ${l.score||"-"} | ${l.burns||0} | ${l.gates||1} | ${l.dist||"-"} | ${pStr} | ${l.seed} |\n`;}
    md+=`\n## How to Replay\n\nEvery level is deterministic. To replay level N:\n1. The seed is \`N × 7919 + 1\`\n2. Call \`genLevel(N)\` to regenerate the exact same field\n3. Or share the level number — anyone gets the same layout\n`;
    copyText(md);
  };
  const Btn=({label,icon,color,onClick,wide,disabled})=>{const k=label||icon;return(<div onMouseDown={()=>!disabled&&setBp(p=>({...p,[k]:true}))} onMouseUp={()=>{setBp(p=>({...p,[k]:false}));!disabled&&onClick();}} onMouseLeave={()=>setBp(p=>({...p,[k]:false}))} onTouchStart={e=>{e.preventDefault();!disabled&&setBp(p=>({...p,[k]:true}));}} onTouchEnd={e=>{e.preventDefault();setBp(p=>({...p,[k]:false}));!disabled&&onClick();}} onTouchCancel={e=>{e.preventDefault();setBp(p=>({...p,[k]:false}));}}
    style={{height:56,minWidth:wide?140:68,paddingLeft:15,paddingRight:15,borderRadius:15,display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:bp[k]?`rgba(${color},.2)`:`rgba(${color},.07)`,border:`1.5px solid rgba(${color},${bp[k]?.4:.15})`,opacity:disabled?.35:1,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",transform:bp[k]&&!disabled?"scale(.94)":"scale(1)",transition:"all .08s ease",cursor:disabled?"default":"pointer",userSelect:"none",WebkitUserSelect:"none",touchAction:"none"}}>
    {icon&&<span style={{fontSize:16,fontWeight:600,color:`rgba(${color},${bp[k]?.9:.55})`,lineHeight:1}}>{icon}</span>}
    {label&&<span style={{fontSize:11,fontWeight:700,letterSpacing:1.1,color:`rgba(${color},${bp[k]?.9:.55})`,textTransform:"uppercase"}}>{label}</span>}</div>);};
  return(
    <div style={{position:"fixed",inset:0,overflow:"hidden",background:"#f5f4f0",fontFamily:ff}}>
      <canvas ref={cvs} style={{display:"block",touchAction:"none"}}/>
      {showTutorial&&<div onClick={()=>setShowTutorial(false)} style={{position:"absolute",inset:0,background:"rgba(245,244,240,.97)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:40,zIndex:100,cursor:"pointer",touchAction:"none"}}>
        <div style={{fontSize:28,fontWeight:200,color:"rgba(200,215,240,.75)",letterSpacing:2,marginBottom:24}}>GRAVITY WELL</div>
        <div style={{fontSize:12,fontWeight:400,color:"rgba(200,215,240,.6)",lineHeight:2.2,textAlign:"center",maxWidth:280}}>
          Navigate through gravitational fields to reach the gate.
        </div>
        <div style={{marginTop:30,display:"flex",flexDirection:"column",gap:14,maxWidth:260}}>
          {[
            ["Drag","to aim your trajectory"],
            ["Tap Launch","to fire"],
            ["Tap screen","to pause during flight"],
            ["Plan Burn","for mid-course corrections"],
            ["Fly close","to planets for bonus points"],
            ["Rate every level","to help curate the best ones"]
          ].map(([a,b],i)=><div key={i} style={{display:"flex",gap:10,alignItems:"baseline"}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(0,0,0,.55)",minWidth:90,textAlign:"right"}}>{a}</div>
            <div style={{fontSize:12,fontWeight:400,color:"rgba(200,215,240,.55)"}}>{b}</div>
          </div>)}
        </div>
        <div style={{marginTop:40,fontSize:11,fontWeight:600,color:"rgba(0,0,0,.3)",letterSpacing:1.5}}>TAP ANYWHERE TO BEGIN</div>
      </div>}
      {!ui.showMap&&<>
        <div style={{position:"absolute",top:14,left:14,background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:14,padding:"10px 16px",border:"1px solid rgba(0,0,0,.06)",maxWidth:210}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:1.8,color:"rgba(0,0,0,.4)",marginBottom:2}}>{ui.sysName}</div>
          <div style={{fontSize:8,fontWeight:500,color:"rgba(0,0,0,.3)",marginBottom:6,lineHeight:1.3}}>{ui.brief}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {[["VEL",ui.vel],["BURNS",ui.burns],["FUEL",Math.floor(ui.fuel)]].map(([l,v])=>(
              <div key={l}><div style={{fontSize:7,fontWeight:700,letterSpacing:1.5,color:l==="FUEL"&&Number(ui.fuel)<50?"rgba(220,60,30,.7)":"rgba(0,0,0,.35)"}}>{l}</div>
              <div style={{fontSize:16,fontWeight:300,color:"rgba(0,0,0,.65)",fontVariantNumeric:"tabular-nums"}}>{v}</div></div>))}
          </div>
          {ui.gateTotal>1&&<div style={{fontSize:8,fontWeight:600,color:"rgba(40,160,80,.6)",marginTop:6,letterSpacing:1}}>GATE {ui.gateNum+1} / {ui.gateTotal}</div>}
        </div>
        <div style={{position:"absolute",top:14,right:14,display:"flex",gap:6}}>
          <div onClick={toggleMap} style={{background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:"1px solid rgba(0,0,0,.06)",cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:"rgba(0,0,0,.45)",letterSpacing:1}}>◈</span></div>
          <div onClick={copyLogs} style={{background:ui.copied?"rgba(40,140,70,.12)":"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:`1px solid ${ui.copied?"rgba(40,140,70,.2)":"rgba(0,0,0,.06)"}`,cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:ui.copied?"rgba(40,140,70,.6)":"rgba(0,0,0,.3)",letterSpacing:1}}>{ui.copied?"✓":"⊕"}</span></div>
          <div onClick={exportFavorites} style={{background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:"1px solid rgba(0,0,0,.06)",cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:"rgba(240,190,50,.5)",letterSpacing:1}}>★</span></div>
          {(ui.phase==="fly"||ui.phase==="plan")&&<div onClick={doRetry} style={{background:"rgba(245,244,240,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:10,padding:"8px 11px",border:"1px solid rgba(0,0,0,.06)",cursor:"pointer",userSelect:"none",touchAction:"none"}}><span style={{fontSize:10,fontWeight:600,color:"rgba(0,0,0,.45)"}}>↺</span></div>}
        </div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 16px 26px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,pointerEvents:"none"}}>
          {(ui.phase==="aim"||ui.phase==="plan")&&locked&&(
            <div style={{display:"flex",gap:8,pointerEvents:"auto",alignItems:"center"}}>
              <Btn icon="◀" color="60,80,140" onClick={()=>adjustAngle(-.03)}/>
              <Btn icon="−" color="60,80,140" onClick={()=>adjustPower(-3)}/>
              <div style={{padding:"4px 12px",borderRadius:10,background:"rgba(0,0,0,.04)",minWidth:50,textAlign:"center"}}>
                <span style={{fontSize:14,fontWeight:300,color:"rgba(0,0,0,.7)",fontVariantNumeric:"tabular-nums"}}>{Math.sqrt(lock.current.vx**2+lock.current.vz**2).toFixed(0)}</span>
                <span style={{fontSize:8,fontWeight:600,color:"rgba(0,0,0,.25)",marginLeft:3}}>Δv</span>
              </div>
              <Btn icon="+" color="60,80,140" onClick={()=>adjustPower(3)}/>
              <Btn icon="▶" color="60,80,140" onClick={()=>adjustAngle(.03)}/>
            </div>
          )}
          {ui.phase==="aim"&&<div style={{display:"flex",gap:12,pointerEvents:"auto"}}>
            <Btn icon="▸" label="Launch" color="220,130,20" onClick={doLaunch} wide disabled={!locked||noFuel}/>
          </div>}
          {ui.phase==="fly"&&<div style={{display:"flex",gap:12,pointerEvents:"auto"}}>
            <Btn icon="▸▸" label="Fast" color="100,100,100" onClick={()=>{ffRef.current=!ffRef.current;setUi(u=>({...u}));}}/>
            <Btn icon="◎" label="Plan Burn" color="60,130,220" onClick={doPlan} wide disabled={s?.fuel<=0}/>
          </div>}
          {ui.phase==="plan"&&<div style={{display:"flex",gap:12,pointerEvents:"auto"}}>
            <Btn label="Cancel" color="100,100,100" onClick={doCancel}/>
            <Btn icon="⚡" label="Execute" color="60,130,220" onClick={doExec} wide disabled={!locked||noFuel}/>
          </div>}
        </div>
        {ui.phase==="win"&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none",
          background:"rgba(245,244,240,.88)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:20,padding:"28px 36px",border:"1px solid rgba(60,200,100,.15)"}}>
          <div style={{fontSize:13,fontWeight:600,letterSpacing:3,color:"rgba(60,200,100,.6)",marginBottom:8}}>GATE REACHED</div>
          <div style={{fontSize:36,fontWeight:200,color:"rgba(0,0,0,.75)",fontVariantNumeric:"tabular-nums"}}>{ui.score} <span style={{fontSize:14,fontWeight:500,color:"rgba(0,0,0,.25)"}}>PTS</span></div>
          <div style={{fontSize:13,fontWeight:500,color:"rgba(0,0,0,.3)",marginTop:6}}>{ui.burns===0?"Perfect — zero burns":`${ui.burns} burn${ui.burns!==1?"s":""}`}{progress.current.streak>1?` · ×${progress.current.streak} streak`:""}</div>
          {s?.lastFlyby&&<div style={{fontSize:12,fontWeight:600,color:"rgba(200,110,20,.75)",marginTop:4}}>{s.lastFlyby}</div>}
          <div style={{fontSize:11,fontWeight:500,color:"rgba(0,0,0,.15)",marginTop:16,marginBottom:6}}>Rate this level</div>
          <div style={{display:"flex",justifyContent:"center",gap:12,pointerEvents:"auto"}}>
            {[1,2,3,4,5].map(r=>(
              <div key={r} onClick={()=>rateLevel(r)} style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:"pointer",color:r<=(s?._rating||0)?"rgba(240,190,50,.9)":"rgba(0,0,0,.1)",userSelect:"none",WebkitUserSelect:"none",touchAction:"none",transition:"all .15s"}}>★</div>
            ))}
          </div>
          <div style={{marginTop:16,pointerEvents:"auto"}}>
            {s?._rated
              ?<Btn icon="▸" label="Next System" color="60,200,100" onClick={doNext} wide/>
              :<div style={{fontSize:10,fontWeight:500,color:"rgba(0,0,0,.25)"}}>Rate to continue</div>}
          </div>
        </div>}
        {ui.phase==="crash"&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"auto"}} onClick={doRetry}>
          <div style={{fontSize:20,fontWeight:200,color:"rgba(200,50,35,.7)",letterSpacing:6}}>IMPACT</div>
          <div style={{fontSize:10,fontWeight:400,color:"rgba(0,0,0,.35)",letterSpacing:2,marginTop:12}}>tap to retry</div>
        </div>}
      </>}
      {onExit&&<button onClick={onExit} style={{position:"absolute",top:10,left:10,zIndex:40,pointerEvents:"auto",padding:"8px 14px",font:"inherit",fontSize:12,letterSpacing:1,background:"rgba(20,25,33,.85)",color:"#c2c9d6",border:"1px solid rgba(150,160,178,.4)",borderRadius:10,cursor:"pointer"}}>⏏ MENU</button>}
      {ui.showMap&&<div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",pointerEvents:"auto"}}><Btn icon="▸" label="Continue" color="100,180,255" onClick={toggleMap} wide/></div>}
    </div>);
}
