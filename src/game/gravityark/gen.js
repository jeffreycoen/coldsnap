// gravityark/gen.js — the ark's seeded system generator, carved whole:
// names, briefs, palettes, and genLevel. The session seed is a
// parameter now — the one signature change, so the generator is pure
// and hashable: same numbers in, same system out.
const PCOLS=[{c:[45,55,78],h:[180,198,225]},{c:[92,48,40],h:[218,162,132]},{c:[38,65,60],h:[142,202,188]},{c:[72,50,82],h:[190,170,218]},{c:[82,68,38],h:[208,192,138]},{c:[50,75,52],h:[160,210,162]}];
const PREFIXES=["KEPLER","WOLF","HD","PROXIMA","ROSS","GLIESE","TRAPPIST","LUYTEN","SIRIUS","VEGA","ALTAIR","RIGEL"];
const SUFFIXES=["","b","c","α","β","RELAY","PRIME","DEEP"];
const BRIEFS=["Binary system. Strong tidal forces.","Dense asteroid field. Caution advised.","Massive central body. Deep gravity well.","Chaotic transfer zones detected.","Wide separation. Plan burns carefully.","Tight cluster. Thread the needle.","Asymmetric masses. Slingshot available.","Active debris field. Impacts expected.","Fuel conservation critical.","Multiple waypoints required."];
export function sysName(n){const s=n*7919+3,r=i=>{let v=Math.sin(s+i*4967)*43758.5453;return v-Math.floor(v);};return PREFIXES[Math.floor(r(0)*PREFIXES.length)]+"-"+Math.floor(r(1)*900+100)+SUFFIXES[Math.floor(r(2)*SUFFIXES.length)];}
export function sysBrief(n){return BRIEFS[n%BRIEFS.length];}
export function genLevel(n,sessionSeed){
  const seed=n*7919+1+(sessionSeed||0);let ri=0;const rand=()=>{let v=Math.sin(seed+(ri++)*9973)*43758.5453;return v-Math.floor(v);};
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
