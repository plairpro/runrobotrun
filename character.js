import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {getCharacter,DEFAULT_CHARACTER_ID} from './characters.js';
import {createThrusters} from './thrusters.js?v=2';

// Animated Mech Pack (March 2021), supplied by the user. Quaternius, CC0 1.0.
// Skeleton and authored clips are preserved; only materials and game scale change.
export function createCharacter(gltf,definition=getCharacter()){
 const group=new T.Group(), contactRoot=new T.Group(), lean=new T.Group(), model=gltf.scene;
 group.add(contactRoot);contactRoot.add(lean);lean.add(model);
 const gradient=new T.DataTexture(new Uint8Array([100,185,255]),3,1,T.RedFormat);gradient.minFilter=T.NearestFilter;gradient.magFilter=T.NearestFilter;gradient.needsUpdate=true;
 const materials=new Map();model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const convert=m=>{if(!materials.has(m)){const color=definition.palette[m.name]||'#d6e0dd';const intensity={Main:.38,Accent:.08,Grey:.05,LightGrey:.12,Black:0,Eye:.55}[m.name]??.05;const toon=new T.MeshToonMaterial({name:m.name,color,gradientMap:gradient,emissive:color,emissiveIntensity:intensity});materials.set(m,toon);}return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}});
 const mixer=new T.AnimationMixer(model),actions={};
 for(const [name,role] of Object.entries({Idle:'idle',Running:'run',Jump:'jump',Death:'death',ThumbsUp:'win'})){const clip=gltf.animations.find(c=>c.name===definition.clips[role]);if(!clip)throw new Error(`Missing ${role} animation for ${definition.name}`);actions[name]=mixer.clipAction(clip);}
 actions.Idle.play();mixer.update(0);model.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(model,true),scale=definition.height/(bounds.max.y-bounds.min.y);
 model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale+.015;
 const baseY=model.position.y,feetBounds=new T.Box3(),origin=new T.Vector3(),point=new T.Vector3(),offset=new T.Vector3();
 const contacts=[new T.Vector3(),new T.Vector3()],meshes=[];
 model.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes,side=new Int8Array(a.position.count).fill(-1);
  if(mesh.isSkinnedMesh)for(let i=0;i<side.length;i++)for(let j=0;j<4;j++){
   const bone=mesh.skeleton.bones[a.skinIndex.getComponent(i,j)];
   if(a.skinWeight.getComponent(i,j)>.5&&/^(LowerLeg|Foot|Toe)/.test(bone.name)){if(/L$/.test(bone.name))side[i]=0;if(/R$/.test(bone.name))side[i]=1;}
  }
  meshes.push({mesh,side});
 });
 const thrusters=createThrusters(model,definition);
 // Measure the deformed mesh, not its bind-pose box. Reuse all scratch data.
 function measure(){
  group.updateWorldMatrix(true,false);group.updateMatrixWorld(true);feetBounds.makeEmpty();for(const foot of contacts)foot.set(0,Infinity,0);
  for(const {mesh,side} of meshes)for(let i=0;i<side.length;i++){
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);feetBounds.expandByPoint(point);
   if(side[i]>=0&&point.y<contacts[side[i]].y)contacts[side[i]].copy(point);
  }
 }
 let current='Idle',airTime=0;
 function play(name,fade=.14){if(name===current)return;let previous=actions[current],next=actions[name];if(!next)return;next.reset();next.enabled=true;next.clampWhenFinished=['Death','Jump','ThumbsUp'].includes(name);next.setLoop(next.clampWhenFinished?T.LoopOnce:T.LoopRepeat,Infinity);next.setEffectiveWeight(1);next.setEffectiveTimeScale(name==='Running'?definition.runSpeed:1);next.play();if(previous)next.crossFadeFrom(previous,fade,false);current=name;if(name==='Jump')airTime=0;}
 function update(dt,{state,air,velocity,turn=0,impactPlane=null,beat=null}){
  const name=state==='lost'?'Death':state==='won'?'ThumbsUp':state==='playing'?(air?'Jump':'Running'):'Idle';play(name);
  // The physics owns height. Use the authored jump pose, but hold it in flight.
  if(current==='Jump'){airTime+=dt;const clip=actions.Jump.getClip();actions.Jump.timeScale=airTime<.28?1:0;actions.Jump.time=Math.min(airTime,clip.duration*.48);}
  if(current==='Running')actions.Running.setEffectiveTimeScale(definition.runSpeed);
  mixer.update(dt);
  // The run cycle has two steps; lock its contact phases to the track beats.
  if(current==='Running'&&Number.isFinite(beat)){const cycle=((beat%2)+2)%2;actions.Running.time=cycle*.5*actions.Running.getClip().duration;mixer.update(0);}
  lean.rotation.z=T.MathUtils.damp(lean.rotation.z,state==='playing'&&!air?turn*.18:0,10,dt);
  model.position.y=baseY;contactRoot.position.set(0,0,0);group.position.set(0,0,0);
  measure();group.getWorldPosition(origin);
  // Physics supplies the surface/flight height; every pose rests on that plane.
  // Apply the correction above the leaning model, so banking cannot lift a foot.
  const lift=origin.y+.004-feetBounds.min.y;contactRoot.position.y=lift;
  feetBounds.min.y+=lift;feetBounds.max.y+=lift;for(const foot of contacts)foot.y+=lift;
  // The death clip has forward root motion. Keep its actual silhouette outside
  // the vehicle face after the gameplay collider has stopped the runner.
  if(state==='lost'&&impactPlane){
   const {axis,sign,value}=impactPlane;
   const edge=sign>0?feetBounds.min[axis]:feetBounds.max[axis];
   const push=Math.max(0,sign*(value-edge)+.025)*sign;
   offset.set(0,0,0);offset[axis]=push;for(const foot of contacts)foot.add(offset);
   offset.add(origin);if(group.parent)group.parent.worldToLocal(offset);group.position.copy(offset);
  }
  thrusters?.update(dt,state==='playing'&&air);
  group.updateMatrixWorld(true);
 }
 return {group,model,mixer,actions,update,play,definition,contacts,thrusters,get stepRate(){return 2*actions.Running.getEffectiveTimeScale()/actions.Running.getClip().duration;},get current(){return current;}};
}
export async function loadCharacter(id=DEFAULT_CHARACTER_ID,overrideUrl){const definition=getCharacter(id);return createCharacter(await new GLTFLoader().loadAsync(overrideUrl||definition.url),definition);}
