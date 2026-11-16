import * as T from './vendor/three.module.js';

// Stan's compact back-mounted turbines follow the animated chest bone.
export function createThrusters(model,definition){
 if(definition.id!=='stan')return null;
 const chest=model.getObjectByName('Chest');if(!chest)return null;
 const ink=new T.MeshToonMaterial({color:'#35283f'}),shell=new T.MeshToonMaterial({color:'#f5f1ff',emissive:'#f5f1ff',emissiveIntensity:.16}),accent=new T.MeshToonMaterial({color:'#ac84e5'}),nozzle=new T.MeshToonMaterial({color:'#807790'});
 const assembly=new T.Group(),pods=[],particles=[],plumes=[];
 function part(parent,geometry,material,x,y,z){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
 const brace=new T.Mesh(new T.BoxGeometry(1.55,.15,.18),ink);brace.position.set(0,4.37,-.87);assembly.add(brace);
 // Soft, uneven grey-white puffs overlap and drift apart like steam.
 const size=32,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(x+0.5-size/2)/(size/2),dy=(y+0.5-size/2)/(size/2),r=Math.sqrt(dx*dx+dy*dy),angle=Math.atan2(dy,dx),radius=.78+.1*Math.sin(3*angle+.4)+.07*Math.cos(5*angle-.6),i=(y*size+x)*4,shade=Math.round(234-38*Math.min(r,1));data[i]=shade;data[i+1]=shade;data[i+2]=shade;data[i+3]=Math.round(255*Math.pow(Math.max(0,1-(r/radius)**2),1.5));}
 const puffMap=new T.DataTexture(data,size,size,T.RGBAFormat);puffMap.needsUpdate=true;
 for(const side of [-1,1]){
  const pod=new T.Group();pod.position.set(side*.87,4.15,-1.08);assembly.add(pod);pods.push(pod);
  part(pod,new T.CylinderGeometry(.23,.27,.72,12),shell,0,0,0);
  part(pod,new T.CylinderGeometry(.25,.25,.11,12),ink,0,.29,0);
  part(pod,new T.CylinderGeometry(.17,.24,.18,12),nozzle,0,-.43,0);
  part(pod,new T.CylinderGeometry(.225,.225,.075,12),accent,0,-.30,0);
  const top=part(pod,new T.SphereGeometry(.23,12,8),shell,0,.36,0);top.scale.y=.45;
  const outlet=part(pod,new T.CircleGeometry(.155,16),ink,0,-.525,0);outlet.rotation.x=Math.PI/2;
  const plume=new T.Sprite(new T.SpriteMaterial({map:puffMap,color:'#ffffff',transparent:true,opacity:0,depthWrite:false}));
  plume.position.set(0,-.9,-.1);plume.scale.set(.55,.95,1);plume.visible=false;pod.add(plume);plumes.push(plume);
  for(let i=0;i<16;i++){
   const sprite=new T.Sprite(new T.SpriteMaterial({map:puffMap,color:'#ffffff',transparent:true,opacity:0,depthWrite:false}));sprite.visible=false;pod.add(sprite);
   particles.push({sprite,side,age:1,life:.56});
  }
 }
 model.add(assembly);model.updateMatrixWorld(true);chest.attach(assembly);
 let emitting=false,elapsed=0,serial=0,phase=0;
 function release(){for(const side of [-1,1]){const puff=particles.find(p=>p.side===side&&!p.sprite.visible);if(!puff)continue;const n=serial++%7;puff.age=0;puff.life=.68+n*.04;puff.drift=(n-3)*.22;puff.wobble=n*.9;puff.sprite.position.set((n-3)*.18,-.54,-.08);puff.sprite.scale.set(.55,.60,1);puff.sprite.material.rotation=n*.9;puff.sprite.material.opacity=.2;puff.sprite.visible=true;}}
 function update(dt,active){
  if(!active){emitting=false;elapsed=0;for(const p of particles){p.sprite.visible=false;p.sprite.material.opacity=0;}for(const p of plumes)p.visible=false;return;}
  if(!emitting){emitting=true;elapsed=0;release();}
  phase+=dt;for(const plume of plumes){plume.visible=true;plume.material.opacity=.24+.05*Math.sin(phase*8);}
  elapsed+=Math.min(dt,.1);while(elapsed>=.13){elapsed-=.13;release();}
  for(const p of particles){if(!p.sprite.visible)continue;p.age+=dt;const t=p.age/p.life;if(t>=1){p.sprite.visible=false;continue;}p.sprite.position.y-=dt*(2.6+t*.6);p.sprite.position.x+=(p.side*1.1+p.drift+.22*Math.sin(phase*5+p.wobble))*dt;p.sprite.position.z-=dt*.4;const scale=.88+t*.8;p.sprite.scale.set(scale,scale*(1.05+.12*Math.sin(p.wobble)),1);p.sprite.material.rotation+=p.drift*dt*.3;p.sprite.material.opacity=.62*Math.sin(Math.PI*t);}
 }
 return {assembly,pods,particles,plumes,update};
}
