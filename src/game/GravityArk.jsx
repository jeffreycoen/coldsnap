import { useEffect, useRef, useState, useCallback } from "react";

import { DT, GATE_R, VEL_SC, MAX_V, MAX_BURN, PICKUP_R, ga, ystep, pot, hitAny, predict } from "./gravityark/phys.js";
import { sysName, sysBrief, genLevel } from "./gravityark/gen.js";
import { makeDraw } from "./gravityark/draw.js";
const C30=Math.cos(Math.PI/6),S30=.5;


function s2sim(dx,dy,sc){return[.5*(dx/(C30*sc)+dy/(S30*sc)),.5*(dy/(S30*sc)-dx/(C30*sc))];}
// Session seed — different levels each playthrough
let SESSION_SEED=Math.floor(Math.random()*100000);

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
    const gen=genLevel(n,SESSION_SEED);camRef.current={zoom:1,shakeX:0,shakeY:0,timeScale:1};particles.current=[];
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

    let hf=0,anim;
    const D=makeDraw({ C30, S30, MAP_NODES, sim, camRef, particles, progress, drg, lock, s2sim });
    const iso=D.iso, drawShip=D.drawShip, drawGate=D.drawGate;
    const spawnP=(x,z,vx,vz,cnt,col,life,spr)=>{const arr=particles.current;for(let i=0;i<cnt;i++){const a=Math.random()*Math.PI*2,sp=spr*(.3+Math.random()*.7);arr.push({x,z,vx:vx+Math.cos(a)*sp,vz:vz+Math.sin(a)*sp,life,maxLife:life,color:col,r:1+Math.random()*2});}};
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
          if(Math.abs(cm.x)>1600||Math.abs(cm.z)>1600)cm.alive=false;
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
      const mapUp=D.drawFrame({ctx,W,H,s,sh,cam,pf,parts,cmx,cmy,sc,baseSc,getD,gravBodies,ui,tFrameStart});
      if(mapUp){anim=requestAnimationFrame(loop);return;}
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
