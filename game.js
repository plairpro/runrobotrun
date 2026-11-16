import qrcode from './vendor/qrcode.js';
import * as T from './vendor/three.module.js';
import {sweepVehicle,onVehicleRoof,impactPlaneFor} from './physics.js';
import {CityAudio} from './audio.js';
import {loadCharacter} from './character.js';
import {DEFAULT_CHARACTER_ID, getCharacter} from './characters.js';
import {createInkRenderer} from './toon.js';
import {loadCityAssets,installCityAssets,createIntersectionBackdrop} from './city.js';
const sound=new CityAudio();
const $=id=>document.getElementById(id),canvas=$('game');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.NoToneMapping;renderer.toneMappingExposure=1;
const scene=new T.Scene();scene.background=new T.Color('#b6bdd6');scene.fog=new T.Fog('#b6bdd6',65,210);const camera=new T.PerspectiveCamera(54,1,.15,260);camera.position.set(0,3.2,6.8);camera.lookAt(0,1.1,-13);
const ambient=new T.HemisphereLight('#f2eaff','#9992ac',.75);scene.add(ambient,new T.AmbientLight('#e5d9ff',.7));const sun=new T.DirectionalLight('#f5edff',1.5);sun.position.set(-25,38,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-35,right:35,top:45,bottom:-35,near:1,far:120});sun.shadow.bias=-.00025;sun.shadow.normalBias=.04;sun.target.position.set(0,0,-22);scene.add(sun,sun.target);
const toonGradient=new T.DataTexture(new Uint8Array([110,190,255]),3,1,T.RedFormat);toonGradient.minFilter=T.NearestFilter;toonGradient.magFilter=T.NearestFilter;toonGradient.needsUpdate=true;
function mat(color,roughness=.7,metalness=0,extra={}){return new T.MeshToonMaterial({color,gradientMap:toonGradient,...extra})}const concrete=mat('#888397'),curb=mat('#c7bfd5'),metal=mat('#35263e',.4,.65),rubber=mat('#17111d'),glass=mat('#344e60',.19,.65),white=mat('#f1ecfa'),coinMaterial=mat('#fffafa',.24,.25,{emissive:'#fff5f5',emissiveIntensity:.3});const cube=new T.BoxGeometry(1,1,1);
function box(parent,x,y,z,w,h,d,m,shadow=true){let mesh=new T.Mesh(cube,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function texture(w,h,draw){let el=document.createElement('canvas');el.width=w;el.height=h;draw(el.getContext('2d'),w,h);let tx=new T.CanvasTexture(el);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return tx}
const cloudMap=texture(512,256,c=>{c.clearRect(0,0,512,256);c.fillStyle='#fbf6ff';c.strokeStyle='#362b44';c.lineWidth=5;c.beginPath();c.moveTo(70,185);c.bezierCurveTo(5,185,8,115,75,113);c.bezierCurveTo(60,52,155,23,190,84);c.bezierCurveTo(223,10,329,24,337,99);c.bezierCurveTo(402,64,455,102,448,133);c.bezierCurveTo(512,147,485,190,435,185);c.closePath();c.fill();c.stroke()});
for(const [x,y,z,w] of [[-40,42,-170,48],[42,55,-185,58]]){const cloud=new T.Sprite(new T.SpriteMaterial({map:cloudMap,depthWrite:false,transparent:true,fog:false}));cloud.position.set(x,y,z);cloud.scale.set(w,w/2,1);scene.add(cloud);}
const skyMap=texture(512,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#999cc9');g.addColorStop(.48,'#e5dcf7');g.addColorStop(.55,'#c9bdda');g.addColorStop(1,'#8d7e9f');c.fillStyle=g;c.fillRect(0,0,w,h)});skyMap.mapping=T.EquirectangularReflectionMapping;scene.environment=skyMap;scene.environmentIntensity=.6;
const asphalt=texture(64,64,(c,w,h)=>{c.fillStyle='#585264';c.fillRect(0,0,w,h)});asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping;asphalt.repeat.set(3,45);const roadmat=mat('#ffffff',.87,0,{map:asphalt});box(scene,0,-.28,-90,100,.25,220,concrete,false);box(scene,0,-.1,-90,12.6,.2,220,roadmat,false);
const marks=[];for(let z=8;z>-200;z-=6)for(let x of [-1.8,1.8])marks.push(box(scene,x,.003,z,.1,.012,2.8,white,false));for(let s of [-1,1])box(scene,s*6.05,.005,-90,.09,.01,220,white,false);
function sign(parent,text,x,y,z,w,h,color='#d9d9c5'){
 const lines=Array.isArray(text)?text:[text],width=lines.length>1?1024:512,height=lines.length>1?256:128;
 const draw=c=>{if(lines.length>1){const bg=c.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#21112f');bg.addColorStop(.55,'#4c1c42');bg.addColorStop(1,'#241329');c.fillStyle=bg;}else c.fillStyle='#24132e';c.fillRect(0,0,width,height);if(lines.length>1){c.strokeStyle='rgba(255,111,187,.55)';c.lineWidth=4;c.strokeRect(3,3,width-6,height-6);}c.font=lines.length>1?'800 78px Montserrat, Arial, sans-serif':'800 48px Montserrat, Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';lines.forEach((line,i)=>{const y=height/2+(i-(lines.length-1)/2)*90;if(lines.length>1){c.shadowColor='#ff3da2';c.shadowBlur=30;c.fillStyle='#ffb2dd';c.fillText(line,width/2,y);c.shadowBlur=9;}c.fillStyle=color;c.fillText(line,width/2,y);c.shadowBlur=0;});};
 const tx=texture(width,height,draw);
 document.fonts?.load('800 48px Montserrat').then(()=>{draw(tx.image.getContext('2d'));tx.needsUpdate=true;});
 return box(parent,x,y,z,w,h,.05,new T.MeshBasicMaterial({map:tx}),false);
}
const blocks=[];for(let i=0;i<16;i++){const block=new T.Group(),surface=new T.Group();block.add(surface);block.userData.surface=surface;block.position.z=10-i*15;for(const side of [-1,1]){box(surface,side*8.6,-.02,0,4.6,.35,15,concrete,false);box(surface,side*6.4,.12,0,.22,.35,15,curb,false);}scene.add(block);blocks.push(block)}
const robot=new T.Group();scene.add(robot);let character=null,assetReady=false,cityInstalled=false,intersectionBackdrops=[];
const contactMap=texture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(15,22,24,.65)');g.addColorStop(.35,'rgba(15,22,24,.3)');g.addColorStop(1,'rgba(15,22,24,0)');c.fillStyle=g;c.fillRect(0,0,64,64)});
const footShadows=Array.from({length:2},()=>{const shadow=new T.Mesh(new T.PlaneGeometry(.3,.42),new T.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,toneMapped:false}));shadow.rotation.x=-Math.PI/2;shadow.visible=false;scene.add(shadow);return shadow;});
let impactPlane=null;
const intersections=[];
let loadedCharacterId=null;
async function prepareCharacter(id=DEFAULT_CHARACTER_ID){
 $('start').disabled=true;$('quiz-back').disabled=true;
 try{const [loaded,city]=await Promise.all([loadedCharacterId===id?Promise.resolve(null):loadCharacter(id,globalThis.RUNNER_MODEL_URL),cityInstalled?Promise.resolve(null):loadCityAssets()]);if(city){installCityAssets(blocks,city);intersectionBackdrops=Array.from({length:3},(_,i)=>createIntersectionBackdrop(city,i));cityInstalled=true;}if(loaded){if(character)robot.remove(character.group);character=loaded;robot.add(character.group);loadedCharacterId=id;}assetReady=true;return true;}
 catch(error){console.error('Character loading failed',error);assetReady=false;return false;}
 finally{$('start').disabled=false;$('quiz-back').disabled=false;}
}

const wheelGeo=new T.CylinderGeometry(.35,.35,.22,16);wheelGeo.rotateZ(Math.PI/2);const hubGeo=new T.CylinderGeometry(.19,.19,.24,12);hubGeo.rotateZ(Math.PI/2);const vehicleMats=[mat('#57c1c8'),mat('#cf5c9d'),mat('#9f79d3'),mat('#7778bc')];const headlights=mat('#e9fffc',.2,.3,{emissive:'#bbfff5',emissiveIntensity:1.8});const rear=mat('#a92b71',.3,.3,{emissive:'#d9318b',emissiveIntensity:.6});
function vehicle(bus,index){const g=new T.Group(),wheels=[],paint=bus?mat('#aaa5bc'):vehicleMats[index%4],len=bus?6.6:4.1;box(g,0,.55,0,2,.65,len,paint);box(g,0,.27,0,1.8,.2,len+.05,metal);if(bus){box(g,0,1.6,0,2,1.75,len,paint);box(g,0,2.5,0,2.05,.14,len,white);box(g,0,1.93,len/2+.015,1.77,.78,.03,glass);box(g,0,1.2,len/2+.05,1.8,.08,.04,white);for(let side of [-1,1])for(let z=-2.55;z<2.8;z+=1.05)box(g,side*1.01,1.96,z,.025,.77,.87,glass);sign(g,'108',0,2.38,len/2+.04,1.65,.23,'#ddfff9')}else{box(g,0,1.03,-.22,1.76,.66,2.15,glass);box(g,0,1.39,-.3,1.65,.12,1.88,paint);for(let side of [-1,1]){box(g,side*.87,1.05,-.26,.07,.65,.08,paint);box(g,side*1.08,1.05,.6,.24,.16,.24,paint)}box(g,0,.86,1.27,1.94,.15,1.35,paint);box(g,0,.85,-1.65,1.92,.16,.65,paint)}for(let side of [-1,1]){for(let z of [-len*.32,len*.32]){let wheel=new T.Mesh(wheelGeo,rubber);wheel.position.set(side*.98,.38,z);g.add(wheel);wheels.push(wheel);let hub=new T.Mesh(hubGeo,metal);hub.position.copy(wheel.position);g.add(hub);wheels.push(hub)}box(g,side*.7,.72,len/2+.025,.43,.16,.05,headlights);box(g,side*.72,.72,-len/2-.025,.3,.18,.05,rear)}box(g,0,.5,len/2+.04,.65,.17,.03,white);box(g,0,.7,len/2+.04,.54,.13,.03,metal);g.userData={bus,len,wheels,height:bus?2.57:1.45};return g}
const carPool=Array.from({length:16},(_,i)=>vehicle(false,i)),busPool=Array.from({length:6},(_,i)=>vehicle(true,i));for(let g of [...carPool,...busPool]){g.visible=false;scene.add(g)}const coinGeo=new T.CylinderGeometry(.26,.26,.065,20);coinGeo.rotateX(Math.PI/2);const glowTexture=texture(128,128,c=>{let g=c.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'rgba(255,239,250,.95)');g.addColorStop(.28,'rgba(255,23,143,.68)');g.addColorStop(1,'rgba(192,29,192,0)');c.fillStyle=g;c.fillRect(0,0,128,128)});
const haloMaterial=new T.SpriteMaterial({map:glowTexture,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:.55});
const rimGeo=new T.TorusGeometry(.215,.025,6,24),rimMaterial=new T.MeshBasicMaterial({color:'#f6c9e7',toneMapped:false});
const coinMark=new T.MeshBasicMaterial({color:'#ae2677',toneMapped:false});
const coinPool=Array.from({length:120},()=>{let g=new T.Group(),disk=new T.Mesh(coinGeo,coinMaterial);g.add(disk);for(let side of [-1,1]){let rim=new T.Mesh(rimGeo,rimMaterial);rim.position.z=side*.038;g.add(rim);box(g,0,-.035,side*.042,.045,.20,.009,coinMark,false);box(g,0,.125,side*.042,.045,.045,.009,coinMark,false)}let halo=new T.Sprite(haloMaterial);halo.scale.set(1.55,1.55,1);g.add(halo);g.visible=false;scene.add(g);return g});
const sparks=Array.from({length:30},()=>{const sprite=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#fff0fa',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:0}));sprite.visible=false;scene.add(sprite);return {sprite,age:0,life:.42,vx:0,vy:0,vz:0};});
function coinBurst(x,y,z){for(let i=0;i<6;i++){const p=sparks.find(v=>!v.sprite.visible);if(!p)break;const angle=i*Math.PI/3;p.age=0;p.vx=Math.cos(angle)*1.7;p.vy=.8+Math.sin(angle)*1.4;p.vz=.7;p.sprite.position.set(x,y,z);p.sprite.scale.set(.32,.32,1);p.sprite.material.opacity=.9;p.sprite.visible=true;}}
// A glass-and-steel destination with a warm canopy; the facade also catches the sky environment.
const terminalReflection=texture(512,512,(c,w,h)=>{
 const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#c2b4ed');sky.addColorStop(.48,'#95d3d5');sky.addColorStop(1,'#605378');c.fillStyle=sky;c.fillRect(0,0,w,h);
 c.fillStyle='#8f82af';for(let i=0;i<8;i++){const x=i*74-20,roof=270+(i*53%110);c.fillRect(x,roof,56,512-roof);}
 c.fillStyle='rgba(231,255,252,.34)';for(let i=0;i<3;i++){c.beginPath();c.moveTo(-120+i*230,0);c.lineTo(-60+i*230,0);c.lineTo(220+i*230,512);c.lineTo(160+i*230,512);c.closePath();c.fill();}
});
const terminalSteel=new T.MeshStandardMaterial({color:'#b5adc7',metalness:.8,roughness:.3});
const terminalDarkSteel=new T.MeshStandardMaterial({color:'#655874',metalness:.72,roughness:.32});
const terminalGlass=new T.MeshStandardMaterial({color:'#e3e5f3',map:terminalReflection,metalness:.52,roughness:.18,envMapIntensity:1.2});
const terminalDoor=new T.MeshStandardMaterial({color:'#b8d4db',map:terminalReflection,metalness:.48,roughness:.18,envMapIntensity:1.2});
const canopyYellow=new T.MeshStandardMaterial({color:'#a676ef',roughness:.6,emissive:'#5f318d',emissiveIntensity:.18}),canopyEdge=mat('#6f49a1'),terminalLight=mat('#e9fffc',.3,0,{emissive:'#c9fff7',emissiveIntensity:.8});
const finish=new T.Group();
box(finish,0,.15,3,21,.3,10,concrete,false);
box(finish,0,5,0,20,10,4.2,terminalSteel);
box(finish,0,5.1,2.13,18.9,8.9,.12,terminalGlass,false);
for(let x=-9;x<=9;x+=3)box(finish,x,5.1,2.23,.12,9,.14,terminalSteel,false);
for(const y of [.7,4.8,9.5])box(finish,0,y,2.24,19,.13,.17,terminalSteel,false);
for(const side of [-1,1]){box(finish,side*9.7,5,2.2,.36,10,.4,terminalSteel);box(finish,side*9.25,9.9,1.5,.28,.4,1.7,terminalDarkSteel);}
box(finish,0,10.15,0,20.4,.3,4.8,terminalSteel);box(finish,0,10.35,0,16,.14,3.5,terminalDarkSteel);
// Recessed entrance doors, metal mullions and handles.
box(finish,0,2.35,2.34,5.5,4.5,.13,terminalDarkSteel,false);box(finish,0,2.35,2.43,5.05,4.2,.1,terminalDoor,false);
for(const x of [-2.55,0,2.55])box(finish,x,2.35,2.5,.1,4.25,.1,terminalSteel,false);
for(const x of [-.22,.22])box(finish,x,2.15,2.58,.045,.75,.06,terminalLight,false);
// Broad yellow canopy is the landmark of the entrance.
box(finish,0,4.88,4.05,10.7,.44,4.1,canopyYellow);box(finish,0,4.63,4.05,10.6,.08,4,terminalDarkSteel,false);
box(finish,0,4.88,6.12,10.7,.44,.13,canopyYellow,false);box(finish,0,4.63,6.14,10.7,.06,.14,canopyEdge,false);
for(const side of [-1,1]){box(finish,side*4.9,2.35,5.75,.18,4.65,.18,terminalSteel);box(finish,side*3.4,4.57,4.4,1.5,.07,.22,terminalLight,false);}
const signHalo=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#ff76ba',transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:.32}));signHalo.position.set(0,7.2,2.30);signHalo.scale.set(13.6,3.8,1);finish.add(signHalo);
sign(finish,['OpenScaler Day','Conference'],0,7.2,2.4,10.6,2.1,'#fff8fd');
scene.add(finish);finish.visible=false;
let nextIntersection=0;const intersectionTimes=[20,46,70];
let state='ready',time=0,distance=0,lane=0,px=0,lateralSpeed=0,height=0,velocity=0,coyoteRemaining=0,score=0,lives=1,nextSpawn=0,objects=[],coinFlash=0,rowCount=0,lastLaneTraffic=[-100,-100,-100];const duration=90,laneWidth=3.6,coyoteTime=.12,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const inkRenderer=createInkRenderer(renderer,scene,camera);
function resize(){let r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(camera.aspect<1?30:27))/Math.min(1,camera.aspect)));camera.updateProjectionMatrix();inkRenderer.resize()}addEventListener('resize',resize);resize();
function grounded(){return velocity<=0 && (height<=.001 || !!onVehicleRoof(px,height,objects));}
function reset(){if(!assetReady){prepareCharacter();return;}for(let o of objects)o.mesh.visible=false;objects=[];state='playing';document.body?.classList?.remove('game-won');time=0;distance=0;lane=0;px=0;lateralSpeed=0;height=0;velocity=0;coyoteRemaining=0;score=0;lives=1;nextSpawn=.7;rowCount=0;lastLaneTraffic=[-100,-100,-100];impactPlane=null;for(const p of sparks)p.sprite.visible=false;for(const m of intersections)scene.remove(m.group);intersections.length=0;for(const b of blocks){b.visible=true;b.userData.surface.visible=true;if(b.userData.cityObjects)b.userData.cityObjects.visible=true;}nextIntersection=0;finish.visible=false;robot.visible=true;robot.position.set(0,0,0);robot.rotation.set(0,Math.PI,0);$('modal').hidden=true;$('result').hidden=true;$('pause').textContent='Пауза';sound.start({restart:true});sync()}
function end(win){if(state!=='playing')return;state=win?'won':'lost';document.body?.classList?.toggle('game-won',win);if(!win)lives=0;win?sound.win():sound.crash();$('modal').hidden=false;$('caption').hidden=!win;$('caption').textContent=win?'Прибытие в терминал':'';$('title').textContent=win?'ДОБРАЛСЯ':'ПОТРАЧЕНО';$('result-coins').textContent=score;$('result').hidden=false;$('start').textContent='Новый забег';$('quiz').hidden=true;$('quiz-back').hidden=true;submitResult();sync()}
function jump(){if(state==='paused')togglePause();if(state!=='playing'||(!grounded()&&coyoteRemaining<=0))return;coyoteRemaining=0;velocity=9.9;sound.jump();}
function move(d){if(state==='playing')lane=Math.max(-1,Math.min(1,lane+d));}
// Critically damped steering starts from zero lateral speed rather than
// moving most of a lane in the first frame. Retargeting preserves momentum.
function advanceLane(dt){
 const destination=lane*laneWidth,smoothTime=.22,maxSpeed=10,omega=2/smoothTime;
 const offset=T.MathUtils.clamp(px-destination,-maxSpeed*smoothTime,maxSpeed*smoothTime);
 const virtualTarget=px-offset,decay=Math.exp(-omega*dt),step=(lateralSpeed+omega*offset)*dt;
 let next=virtualTarget+(offset+step)*decay;
 lateralSpeed=(lateralSpeed-omega*step)*decay;
 if((destination-px)*(destination-next)<0){next=destination;lateralSpeed=0;}
 if(Math.abs(destination-next)<.003&&Math.abs(lateralSpeed)<.035){next=destination;lateralSpeed=0;}
 px=next;
}
function togglePause(){if(state==='playing'){state='paused';sound.pause();$('pause').textContent='Продолжить'}else if(state==='paused'){state='playing';sound.start();$('pause').textContent='Пауза'}}
// Registration stays in memory until the run's result is saved.
const resultEndpoint='https://openscaler-run-results-26.timurfazullin.chatgpt.site';
let registration={alias:'',character:''},resultVersion=0,pendingResult=null,runToken=null,pairVersion=0;
function drawPairQR(url){const qr=qrcode(0,'M');qr.addData(url);qr.make();const n=qr.getModuleCount(),scale=5,margin=4,canvas=$('pair-qr');canvas.width=canvas.height=(n+margin*2)*scale;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#160c20';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);}
async function beginPair(){
 const version=++pairVersion;runToken=null;registration={alias:'',character:''};
 $('modal').hidden=false;$('result').hidden=true;$('caption').hidden=true;$('quiz').hidden=false;$('save-status').hidden=true;$('save-retry').hidden=true;$('quiz-error').hidden=true;
 $('telegram').hidden=true;$('quiz-label').hidden=true;$('quiz-options').hidden=true;$('quiz-character').hidden=true;$('quiz-back').hidden=true;$('pair-qr').hidden=true;$('pair-link').hidden=true;$('start').hidden=true;
 $('title').classList.remove('quiz-title');$('title').textContent='Беги, робот, беги!';$('quiz-step').textContent='Вход через Telegram';$('quiz-hint').textContent='Подключаем Telegram…';
 try{const response=await fetch(resultEndpoint+'/api/pair/create',{method:'POST',cache:'no-store'});const pair=await response.json();if(!response.ok||!pair.id||!pair.secret||!pair.bot)throw Error();if(version!==pairVersion)return;
 const url=`https://t.me/${pair.bot}?start=${pair.id}`;drawPairQR(url);$('pair-qr').hidden=false;$('pair-link').href=url;$('pair-link').hidden=false;$('quiz-hint').textContent='';
 async function poll(){if(version!==pairVersion)return;try{const response=await fetch(resultEndpoint+'/api/pair/status',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({id:pair.id,secret:pair.secret}),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error();if(version!==pairVersion)return;if(data.status==='expired'){beginPair();return;}if(data.status==='ready'&&data.alias&&data.character&&data.token){pairVersion++;registration={alias:data.alias,character:data.character};runToken=data.token;await initialScene;$('pair-qr').hidden=true;$('pair-link').hidden=true;$('quiz-step').textContent='Всё готово';$('title').classList.add('quiz-title');$('title').textContent='Робот готов к забегу';$('quiz-hint').textContent='@'+data.alias;$('quiz-character').textContent=getCharacter(data.character).name;$('quiz-character').hidden=false;$('start').hidden=false;$('start').disabled=true;$('start').textContent='Загружаем робота…';if(await prepareCharacter(data.character))$('start').textContent='Начать забег';else{$('start').textContent='Повторить загрузку';$('quiz-error').textContent='Не удалось загрузить робота. Попробуй ещё раз.';$('quiz-error').hidden=false;}return;}}catch{}setTimeout(poll,1400);}
 poll();
 }catch{if(version!==pairVersion)return;$('quiz-hint').textContent='Не удалось подключиться к Telegram. Проверь соединение и попробуй ещё раз.';$('start').hidden=false;$('start').disabled=false;$('start').textContent='Попробовать снова';}
}
async function advanceQuiz(){
 if(state==='won'||state==='lost'){resultVersion++;pendingResult=null;runToken=null;state='ready';sound.pause();for(const o of objects)o.mesh.visible=false;objects=[];for(const m of intersections)scene.remove(m.group);intersections.length=0;for(const b of blocks){b.visible=true;b.userData.surface.visible=true;if(b.userData.cityObjects)b.userData.cityObjects.visible=true;}for(const p of sparks)p.sprite.visible=false;finish.visible=false;time=distance=lane=px=lateralSpeed=height=velocity=score=0;robot.position.set(0,0,0);impactPlane=null;document.body.classList.remove('game-won');beginPair();return;}
 if(!runToken){beginPair();return;}if(!assetReady||loadedCharacterId!==registration.character){$('start').textContent='Загружаем робота…';if(!await prepareCharacter(registration.character)){$('quiz-error').textContent='Не удалось загрузить робота. Попробуй ещё раз.';$('quiz-error').hidden=false;$('start').textContent='Повторить загрузку';return;}}
 sound.init();if(sound.ctx?.state==='suspended')sound.ctx.resume();reset();
}
async function submitResult(){
 const version=++resultVersion;$('save-retry').hidden=true;
 if(!pendingResult)pendingResult={alias:registration.alias,score,token:runToken};
 const payload=JSON.stringify(pendingResult);
 $('save-status').textContent='Сохраняем результат…';$('save-status').hidden=false;
 try{
  const response=await fetch(resultEndpoint+'/api/result',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:payload});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error('Save failed');
  if(version!==resultVersion)return;$('save-status').hidden=true;
 }catch(error){if(version!==resultVersion)return;$('save-status').textContent='Не удалось подтвердить отправку результата. Проверь соединение и попробуй ещё раз.';$('save-status').hidden=false;$('save-retry').hidden=false;}
}
$('save-retry').onclick=submitResult;$('start').onclick=advanceQuiz;$('pause').onclick=togglePause;
$('mute').onclick=()=>{const muted=sound.toggle();$('mute').textContent=muted?'Звук: выкл.':'Звук: вкл.';$('mute').setAttribute('aria-pressed',String(muted));};$('volume').oninput=e=>sound.setVolume(Number(e.target.value)/100);
addEventListener('keydown',e=>{if(e.target?.matches?.('input'))return;if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();if(e.repeat)return;if(e.code==='KeyA'||e.key==='ArrowLeft')move(-1);if(e.code==='KeyD'||e.key==='ArrowRight')move(1);if(e.code==='Space'||e.key==='ArrowUp')jump();if(e.code==='KeyP')togglePause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state==='playing')togglePause();else sound.pauseMusic();}else if(state==='lost'||state==='won')sound.resumeMusic();});let touch=null;
function matchingTouch(list){return touch&&Array.from(list).find(t=>t.identifier===touch.id);}
function steerTouch(point){if(!touch||touch.used||!point)return;const dx=point.clientX-touch.x,dy=point.clientY-touch.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;touch.used=true;if(Math.abs(dx)>Math.abs(dy))move(Math.sign(dx));else if(dy<0)jump();}
canvas.addEventListener('touchstart',e=>{if(touch)return;const point=e.changedTouches[0];if(point)touch={id:point.identifier,x:point.clientX,y:point.clientY,used:false};},{passive:true});
canvas.addEventListener('touchmove',e=>steerTouch(matchingTouch(e.changedTouches)),{passive:true});
canvas.addEventListener('touchend',e=>{const point=matchingTouch(e.changedTouches);if(!point)return;steerTouch(point);if(!touch.used)jump();touch=null;},{passive:true});
canvas.addEventListener('touchcancel',e=>{if(matchingTouch(e.changedTouches))touch=null;},{passive:true});
// Standard gamepad controls use press edges so a held stick or button acts once.
const gamepadState=new Map();
function pollGamepads(){let pads;try{pads=globalThis.navigator?.getGamepads?.()||[];}catch{return;}const active=new Set();for(const pad of pads){if(!pad||pad.connected===false)continue;active.add(pad.index);const old=gamepadState.get(pad.index)||{x:0,up:false,button:false};const x=pad.axes?.[0]||0,y=pad.axes?.[1]||0,side=x>.55?1:x<-.55?-1:Math.abs(x)<.35?0:old.x,up=y<-.55,button=!!pad.buttons?.[0]?.pressed;if(side&&side!==old.x)move(side);if((up&&!old.up)||(button&&!old.button))jump();gamepadState.set(pad.index,{x:side,up,button});}for(const id of gamepadState.keys())if(!active.has(id))gamepadState.delete(id);}

// Reserve the intersection before it appears instead of removing traffic already on screen.
function pendingIntersectionConflict(o){
 if(nextIntersection>=intersectionTimes.length)return false;
 const untilJunction=intersectionTimes[nextIntersection]-time;
 if(untilJunction<0)return true;
 const arrival=-o.z/(23+(o.relativeSpeed||0));
 return Math.abs(arrival-(untilJunction+120/23))<1.7;
}
// Reserve sufficient space along the visible road for every moving vehicle and coin.
function pathsOverlap(a,b,horizon=8.5){if(Math.abs(a.x-b.x)>.1)return false;const dz=a.z-b.z,dv=(a.relativeSpeed||0)-(b.relativeSpeed||0),end=dz+dv*horizon;const bothVehicles=a.type!=='coin'&&b.type!=='coin';const clearance=bothVehicles?((a.type==='bus'?3.3:2.08)+(b.type==='bus'?3.3:2.08)+2):(a.type==='bus'||b.type==='bus'?4.3:3.1);return Math.min(Math.abs(dz),Math.abs(end),dz*end<=0?0:Infinity)<clearance;}
function addVehicle(l,bus,z=-135,preferredSpeed=null){if(objects.some(o=>o.type==='cross'&&Math.abs(o.z-z)<65))return;let mesh=(bus?busPool:carPool).find(m=>!m.visible);if(!mesh)return;mesh.visible=true;mesh.scale.setScalar(1);mesh.rotation.y=0;mesh.position.set(l*laneWidth,0,z);const vehicle={type:bus?'bus':'car',x:l*laneWidth,z,oldZ:z,mesh,relativeSpeed:0};let safe=false;const speeds=[1.5,3.5,5.5],start=Math.floor(Math.random()*speeds.length);const candidates=preferredSpeed===null?speeds.map((_,i)=>speeds[(start+i)%speeds.length]):[preferredSpeed];for(const speed of candidates){vehicle.relativeSpeed=speed;if(!pendingIntersectionConflict(vehicle)&&!objects.some(o=>pathsOverlap(vehicle,o))){safe=true;break;}}if(!safe){mesh.visible=false;return;}objects.push(vehicle);return vehicle;}
function addCoin(l,z,h=1,host=null){if(objects.some(o=>o.type==='cross'&&Math.abs(o.z-z)<55))return;const candidate={type:'coin',x:l*laneWidth,z,h,host,relativeSpeed:host?.relativeSpeed||0};if(pendingIntersectionConflict(candidate)||objects.some(o=>o.type!=='coin'&&o!==host&&pathsOverlap(candidate,o)))return;let mesh=coinPool.find(m=>!m.visible);if(!mesh)return;mesh.visible=true;mesh.position.set(l*laneWidth,h,z);objects.push({...candidate,oldZ:z,mesh});}
// A marked junction reserves the road and brings one perpendicular car across it.
function spawnIntersection(direction=nextIntersection%2?1:-1){
 const z=-120,mesh=carPool.find(m=>!m.visible);if(!mesh)return false;
 const group=new T.Group();for(const side of [-1,1])for(let x=-5.5;x<=5.5;x+=1.1)box(group,x,.015,side*4,.72,.025,1.1,white,false);
 const crossRoad=mat('#585264');for(const side of [-1,1]){box(group,side*25.5,-.1,0,39,.2,12,crossRoad,false);for(let x=8;x<45;x+=4)box(group,side*x,.012,0,2,.024,.11,white,false);for(const edge of [-5.7,5.7])box(group,side*25.5,.01,edge,39,.02,.1,white,false);for(const edge of [-1,1])box(group,side*25.5,-.02,edge*7.55,39,.35,3.1,concrete,false);box(group,side*6.7,1.1,-7,.12,2.2,.12,metal);box(group,side*6.7,2.05,-7,.65,.65,.12,mat('#a676ef'));}
 if(intersectionBackdrops[nextIntersection])group.add(intersectionBackdrops[nextIntersection]);
 group.position.z=z;scene.add(group);intersections.push({group,z});
 const x=direction*z*9/19;
 mesh.visible=true;mesh.scale.setScalar(1);mesh.rotation.y=direction*Math.PI/2;mesh.position.set(x,0,z);
 objects.push({type:'cross',x,oldX:x,z,oldZ:z,mesh,relativeSpeed:0,direction});return true;
}
// Reserve a lane through nearby arrival times, including time to change lanes.
function arrivalWindow(vehicle){const speed=23+vehicle.relativeSpeed,halfLength=vehicle.type==='bus'?3.3:2.08;return {center:-vehicle.z/speed,half:(halfLength+.29)/speed+.4};}
function addRowVehicle(l,bus,z=-135,preferredSpeed=null){
 const vehicle=addVehicle(l,bus,z,preferredSpeed);if(!vehicle)return;
 const road=objects.filter(o=>o.type==='car'||o.type==='bus');
 for(const reference of road){const window=arrivalWindow(reference),blocked=new Set();for(const other of road){const otherWindow=arrivalWindow(other);if(Math.abs(window.center-otherWindow.center)<window.half+otherWindow.half)blocked.add(other.x);}
  if(blocked.size===3){vehicle.mesh.visible=false;objects.splice(objects.indexOf(vehicle),1);return;}}
 return vehicle;
}
// Traffic builds throughout the run, leaving a short clear stretch at the finish.
function trafficPhase(t){if(t<18)return {interval:1.65,doubleEvery:3};if(t<45)return {interval:1.35,doubleEvery:2};if(t<70)return {interval:1.05,doubleEvery:3};return {interval:.8,doubleEvery:3};}
function spawnRow(){
 rowCount++;const first=Math.floor(Math.random()*3)-1,lanes=[first,...[-1,0,1].filter(n=>n!==first)].sort((a,b)=>lastLaneTraffic[a+1]-lastLaneTraffic[b+1]),bus=Math.random()<.4;
 const makePair=bus&&time>8&&time<76&&rowCount%3===0;let host,l;
 for(const candidate of lanes){host=addRowVehicle(candidate,bus,-135,makePair?1.5:null);if(host){l=candidate;lastLaneTraffic[l+1]=time;break;}}
 let blocked=host?[l]:[],phase=trafficPhase(time);
 if(phase.doubleEvery&&rowCount%phase.doubleEvery===0)for(const candidate of lanes){if(blocked.includes(candidate))continue;if(addRowVehicle(candidate,false)){blocked.push(candidate);lastLaneTraffic[candidate+1]=time;break;}}
 if(rowCount%3===1){let free=[-1,0,1].filter(n=>!blocked.includes(n)),cl=free[Math.floor(Math.random()*free.length)];for(let i=0;i<4;i++)addCoin(cl,-135-i*2.4);}
 if(host&&bus){for(const offset of [-2,0,2])addCoin(l,host.z+offset,3.15,host);if(makePair){const separation=(23+host.relativeSpeed)*(2*9.9/15)+(3.3+(23+host.relativeSpeed)*coyoteTime)/2;const following=addRowVehicle(l,true,host.z-separation,host.relativeSpeed);if(following)for(const offset of [-2,0,2])addCoin(l,following.z+offset,3.15,following);}}
}

function sync(){$('coins').textContent=score;$('progress').value=time;const inRun=state==='playing'||state==='paused';$('hud').hidden=!inRun;$('route').hidden=!inRun;}
function update(dt){
 if(state!=='playing')return;
 const from={x:px,y:height},wasGrounded=grounded(),speed=23,step=speed*dt;
 time+=dt;distance+=step;
 // Keep steering responsive during the jump as well as on the road.
 advanceLane(dt);
 if(velocity>0||!wasGrounded){velocity-=15*dt;height+=velocity*dt;}
 for(let o of objects){o.oldZ=o.z;o.oldX=o.x;o.z+=(speed+(o.relativeSpeed||0))*dt;if(o.type==='cross')o.x=o.direction*o.z*9/19;}
 for(const m of intersections){m.z+=step;m.group.position.z=m.z;if(m.z>31)m.group.visible=false;}
 if(wasGrounded&&height>0&&!onVehicleRoof(px,height,objects)){velocity-=15*dt;height+=velocity*dt;}
 height=Math.max(0,height);if(height===0&&velocity<0)velocity=0;
 let to={x:px,y:height},first=null;
 for(let o of objects){if(o.type==='coin')continue;let hit=sweepVehicle(from,to,o);if(hit&&(!first||hit.fraction<first.hit.fraction))first={o,hit};}
 if(first){let {o,hit}=first;if(hit.roof){height=hit.top;velocity=0;sound.foot('roof',0,1.25);}
 else{const f=Math.max(0,hit.fraction-.0001);px=from.x+(px-from.x)*f;height=from.y+(height-from.y)*f;for(let item of objects){item.z=item.oldZ+(item.z-item.oldZ)*f;if(item.type==='cross')item.x=item.oldX+(item.x-item.oldX)*f;item.mesh.position.z=item.z;item.mesh.position.x=item.x;}impactPlane=impactPlaneFor(o,hit);velocity=Math.min(0,velocity);robot.position.set(px,height,0);end(false);return;}}
 // Briefly preserve the right to jump after leaving a roof, but consume it on takeoff.
 coyoteRemaining=grounded()?coyoteTime:Math.max(0,coyoteRemaining-dt);
 if(!wasGrounded&&height===0)sound.foot('road',0,1.2);
 for(let o of objects){o.mesh.position.z=o.z;o.mesh.position.x=o.x;if(o.type!=='coin')for(const wheel of o.mesh.userData.wheels)wheel.rotation.x+=(o.type==='cross'?speed*9/19:(o.relativeSpeed||0))*dt/.35;if(o.type==='coin'){o.mesh.rotation.y+=dt*3;if(Math.abs(o.z)<1&&Math.abs(px-o.x)<.9&&height<=o.h+.3 && height+1.6>=o.h-.3){score++;coinFlash=.25;coinBurst(o.x,o.h,o.z);o.remove=true;o.mesh.visible=false;sound.coin();}}}
 objects=objects.filter(o=>{if(o.remove||o.z>(o.type==='cross'?25:12)){o.mesh.visible=false;return false}return true});
 if(nextIntersection<intersectionTimes.length&&time>=intersectionTimes[nextIntersection]){if(spawnIntersection())nextIntersection++;}
 nextSpawn-=dt;if(nextSpawn<=0&&time<83){spawnRow();nextSpawn=trafficPhase(time).interval;}
 for(let m of marks){m.position.z+=step;if(m.position.z>12)m.position.z-=216}for(let b of blocks){b.position.z+=step;if(b.position.z>25)b.position.z-=240;b.userData.surface.visible=!intersections.some(m=>m.group.visible&&Math.abs(b.position.z-m.z)<14);if(b.userData.cityObjects)b.userData.cityObjects.visible=!intersections.some(m=>m.group.visible&&Math.abs(b.position.z-m.z)<23);}asphalt.offset.y-=step/220*45;coinFlash=Math.max(0,coinFlash-dt);
 if(time>82){finish.visible=true;finish.position.z=-Math.max(24,(90-time)*speed+24)}if(time>=90)end(true);sync();
}
function animate(dt,clock){
 for(const p of sparks){if(!p.sprite.visible)continue;p.age+=dt;if(p.age>=p.life){p.sprite.visible=false;continue;}p.sprite.position.x+=p.vx*dt;p.sprite.position.y+=p.vy*dt;p.sprite.position.z+=p.vz*dt;p.sprite.material.opacity=.9*(1-p.age/p.life);const size=.32*(1+p.age);p.sprite.scale.set(size,size,1);}
 if($('coins').style)$('coins').style.transform=`scale(${1+coinFlash*1.2})`;
 if(state==='lost'&&height>0){velocity-=22*dt;height=Math.max(0,height+velocity*dt);}
 robot.position.set(px,height,0);
 const turning=state==='playing'?lateralSpeed:0;
 if(state!=='lost')robot.rotation.y=T.MathUtils.damp(robot.rotation.y,state==='ready'?.28:Math.PI-Math.atan2(turning,23),12,dt);
 if(character){character.update(dt,{state,air:!grounded(),velocity,turn:turning/10,impactPlane,beat:sound.beatPosition(time)});
  const surface=grounded()?height:0;for(let i=0;i<footShadows.length;i++){const foot=character.contacts[i],shadow=footShadows[i],gap=foot.y-surface;shadow.visible=state!=='lost'&&Number.isFinite(gap)&&gap<.3;shadow.position.set(foot.x,surface+.006,foot.z);shadow.material.opacity=Math.max(0,1-gap/.3);}
 }
 camera.position.x=T.MathUtils.damp(camera.position.x,px*.25,4,dt);camera.position.y=T.MathUtils.damp(camera.position.y,3.2+height*.22,5,dt);camera.lookAt(px*.2,1.2+height*.1,-12);
}
let previous=0;function frame(now){requestAnimationFrame(frame);let dt=Math.min(.05,(now-previous)/1000||0);previous=now;pollGamepads();if(state==='playing'){let n=Math.ceil(dt/(1/120));for(let i=0;i<n&&state==='playing';i++)update(dt/n);sound.update(objects,px,height,grounded(),time,dt);}if(state!=='paused')animate(dt,now/1000);inkRenderer.setHeatHaze(character?.thrusters?.pods,(state==='playing'||state==='paused')&&!grounded(),time);inkRenderer.render()}requestAnimationFrame(frame);
const initialScene=prepareCharacter();
beginPair();
export {update,reset,scene,renderer,objects,coinPool};
