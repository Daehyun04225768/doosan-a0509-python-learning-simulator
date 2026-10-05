const PI = Math.PI;

function mul(a, b) {
  const out = Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) out[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return out;
}
function t(x = 0, y = 0, z = 0) { return [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]; }
function rx(a) { const c=Math.cos(a),s=Math.sin(a); return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]; }
function ry(a) { const c=Math.cos(a),s=Math.sin(a); return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]; }
function rz(a) { const c=Math.cos(a),s=Math.sin(a); return [c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]; }
function rpy(r,p,y) { return mul(mul(rz(y), ry(p)), rx(r)); }
function origin(x,y,z,r,p,yaw) { return mul(t(x,y,z), rpy(r,p,yaw)); }

function fk(q) {
  let m = Array.from({length:16},(_,i)=>i%5===0?1:0);
  m = mul(m, mul(origin(0,0,.156,0,0,0), rz(q[0])));
  m = mul(m, mul(origin(0,0,0,0,-1.571,-1.571), rz(q[1])));
  m = mul(m, mul(origin(.409,0,0,0,0,1.571), rz(q[2])));
  m = mul(m, mul(origin(0,-.367,0,1.571,0,0), rz(q[3])));
  m = mul(m, mul(origin(0,0,0,-1.571,0,0), rz(q[4])));
  m = mul(m, mul(origin(0,-.124,0,1.571,0,0), rz(q[5])));
  const urdf = [m[3],m[7],m[11]];
  return [urdf[0], urdf[2], -urdf[1]];
}

function toolAxes(q) {
  let m = Array.from({length:16},(_,i)=>i%5===0?1:0);
  m = mul(m, mul(origin(0,0,.156,0,0,0), rz(q[0])));
  m = mul(m, mul(origin(0,0,0,0,-1.571,-1.571), rz(q[1])));
  m = mul(m, mul(origin(.409,0,0,0,0,1.571), rz(q[2])));
  m = mul(m, mul(origin(0,-.367,0,1.571,0,0), rz(q[3])));
  m = mul(m, mul(origin(0,0,0,-1.571,0,0), rz(q[4])));
  m = mul(m, mul(origin(0,-.124,0,1.571,0,0), rz(q[5])));
  m = mul(m, origin(0,0,0,PI,-PI/2,0));
  const world = column => {
    const urdf = [m[column],m[4+column],m[8+column]];
    return [urdf[0],urdf[2],-urdf[1]];
  };
  return { x: world(0), y: world(1), z: world(2) };
}

function score(q,target,reference) {
  const p=fk(q);
  const e=(p[0]-target[0])**2+(p[1]-target[1])**2+(p[2]-target[2])**2;
  const posture=.00003*q.slice(0,5).reduce((s,v,i)=>s+(v-reference[i])**2,0);
  return e+posture;
}

function solve(target, reference) {
  let best=[...reference], bestScore=score(best,target,reference);
  for (let restart=0;restart<60;restart++) {
    let q=restart===0?[...reference]:reference.map((v,i)=>i===5?v:v+(Math.random()-.5)*(i===0?1.2:3));
    q[3]=0; q[5]=reference[5];
    let step=.5;
    for(let iter=0;iter<160;iter++) {
      let improved=false;
      for(const i of [0,1,2,4]) for(const dir of [-1,1]) {
        const candidate=[...q]; candidate[i]+=dir*step;
        if(i===2) candidate[i]=Math.max(-2.7925,Math.min(2.7925,candidate[i]));
        const candidateScore=score(candidate,target,reference);
        if(candidateScore<score(q,target,reference)){q=candidate;improved=true;}
      }
      if(!improved) step*=.62;
      if(step<1e-5) break;
    }
    const s=score(q,target,reference);
    if(s<bestScore){best=q;bestScore=s;}
  }
  return {q:best,position:fk(best),score:bestScore};
}

function solveOriented(target, reference, desiredNormal = [0,-1,0]) {
  const orientedScore = q => {
    const p=fk(q), n=toolAxes(q).x;
    const positionError=(p[0]-target[0])**2+(p[1]-target[1])**2+(p[2]-target[2])**2;
    const orientationError=(n[0]-desiredNormal[0])**2+(n[1]-desiredNormal[1])**2+(n[2]-desiredNormal[2])**2;
    const posture=.000001*q.slice(0,5).reduce((s,v,i)=>s+(v-reference[i])**2,0);
    return positionError + .3*orientationError + posture;
  };
  let best=[...reference], bestScore=orientedScore(best);
  for(let restart=0;restart<160;restart++) {
    let q=reference.map((v,i)=>i===5?v:v+(Math.random()-.5)*5.5);
    q[5]=reference[5];
    let step=.8, qScore=orientedScore(q);
    for(let iter=0;iter<220;iter++) {
      let improved=false;
      for(const i of [0,1,2,3,4]) for(const dir of [-1,1]) {
        const candidate=[...q]; candidate[i]+=dir*step;
        candidate[i]=Math.max(i===2?-2.7925:-2*PI,Math.min(i===2?2.7925:2*PI,candidate[i]));
        const candidateScore=orientedScore(candidate);
        if(candidateScore<qScore){q=candidate;qScore=candidateScore;improved=true;}
      }
      if(!improved) step*=.62;
      if(step<1e-6) break;
    }
    if(qScore<bestScore){best=q;bestScore=qScore;}
  }
  return {q:best,position:fk(best),normal:toolAxes(best).x,score:bestScore};
}

const pickReference=[-.30565,.3222,1.9396,0,-2.2588,.30555];
const placeReference=[.191118,.79607,1.14197,0,-1.93348,-.191892];
const pickApproachReference=[-.3055,.0936,1.6645,0,-1.7538,.3060];
const placeApproachReference=[.191,.7108,.7858,0,-1.4919,-.1899];
const orientedPickPose=[-.3057704,.4789727,2.053232,.000712,.6091736,.30555];
const orientedPlacePose=[.191328,.8966775,1.2286536,.00048,1.016046,-.191892];
// SCHUNK Co-act EGP-C 40-N-N-M1013 CAD 기준 TCP 초기값.
// STEP의 플랜지 장착면(-123.3 mm)부터 핑거 끝(+12.15 mm)까지의 길이를 사용한다.
const GRIPPER_TCP_OFFSET=.13545;
const GRIPPER_APPROACH_CLEARANCE=.18;
const cubeCenterY=.004;
const flangePickY=cubeCenterY+GRIPPER_TCP_OFFSET;
const flangeApproachY=flangePickY+GRIPPER_APPROACH_CLEARANCE;
console.log(JSON.stringify({
  directions: {
    home: toolAxes([0,0,0,0,0,0]),
    homeJ6Pi: toolAxes([0,0,0,0,0,PI]),
    homeJ5Pi: toolAxes([0,0,0,0,PI,0]),
    ready: toolAxes([0,.4216,1.5845,0,-2.0013,0]),
    pick: toolAxes(pickReference),
    place: toolAxes(placeReference),
  },
  referencePick: fk(pickReference),
  pick: solve([.38,.094,.12],pickReference),
  place: solve([.62,.094,-.12],placeReference),
  orientedPick: solveOriented([.38,.094,.12],pickReference),
  orientedPlace: solveOriented([.62,.094,-.12],placeReference),
  orientedPickApproach: solveOriented([.38,.34,.12],pickApproachReference),
  orientedPlaceApproach: solveOriented([.62,.34,-.12],placeApproachReference),
  smoothPickApproach: solveOriented([.38,.34,.12],orientedPickPose),
  smoothPlaceApproach: solveOriented([.62,.34,-.12],orientedPlacePose),
  orientedReady: solveOriented([.45,.5,0],[0,.4216,1.5845,0,-2.0013,0]),
  egpc40Pick: solveOriented([.38,flangePickY,.12],orientedPickPose),
  egpc40Place: solveOriented([.62,flangePickY,-.12],orientedPlacePose),
  egpc40PickApproach: solveOriented([.38,flangeApproachY,.12],orientedPickPose),
  egpc40PlaceApproach: solveOriented([.62,flangeApproachY,-.12],orientedPlacePose),
},null,2));
