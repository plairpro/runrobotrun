import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';

const buildings=['bldg_shop_brick_3st','bldg_shop_brick_6st','bldg_shop_stone_4st','bldg_apartments_5st','bldg_bank_3st','bldg_office_tower_10st'];

// Keep the kit's texture detail while shifting its colours to the conference palette.
const cityColors={mat_brick_yellow:'#b3a3d7',mat_brick_red:'#af83bd',mat_stone:'#c7bfdc',mat_concrete:'#aaa3c4',mat_roof:'#554468',mat_frame_white:'#eeeafa',mat_glass:'#3c526c',mat_glass_clear:'#72949e',mat_metal_dark:'#34263f',mat_metal:'#9388ab',mat_paint_sign:'#b8b0bf',mat_paint_green:'#639eaa',mat_paint_blue:'#6ec8d0',mat_leaves:'#6c9fa5',mat_bark:'#624c68',mat_wood:'#987ca1',mat_door:'#69557d',mat_light_warm:'#d8fff9'};
const neutralMaps=new WeakMap();
function neutralTexture(map){
 if(!map?.image||typeof document==='undefined')return map;
 if(neutralMaps.has(map))return neutralMaps.get(map);
 const canvas=document.createElement('canvas');canvas.width=map.image.width;canvas.height=map.image.height;
 const context=canvas.getContext('2d');if(!context||!canvas.width||!canvas.height)return map;
 context.filter='grayscale(1)';context.drawImage(map.image,0,0);context.filter='none';
 const neutral=map.clone();neutral.source=new T.TextureSource(canvas);neutral.needsUpdate=true;neutralMaps.set(map,neutral);return neutral;
}
export function applyCityPalette(root){root.traverse(o=>{
 if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=true;
 for(const material of (Array.isArray(o.material)?o.material:[o.material])){
  if(!material)continue;const color=cityColors[material.name];if(color){material.color.set(color);if(material.map)material.map=neutralTexture(material.map);}
  if(material.name==='mat_glass'){material.emissive?.set('#204750');material.emissiveIntensity=.24;}
  if(material.name==='mat_light_warm'){material.emissive?.set('#b5fff6');material.emissiveIntensity=.6;}
 }
});}

// Downtown City Kit by Greanapple Games. The packed assets share their 512px textures.
export async function loadCityAssets(){
 const data=globalThis.RUNNER_CITY_DATA||await (await fetch('./assets/city/city-kit.json')).json();
 T.Cache.enabled=true;const loader=new GLTFLoader(),entries=await Promise.all(Object.entries(data.models).map(async([name,source])=>{
  const gltf=structuredClone(source);for(const image of gltf.images||[])image.uri=data.textures[image.uri];
  const loaded=await loader.parseAsync(JSON.stringify(gltf),'');const unused=[];
  loaded.scene.traverse(o=>{if(o.name.includes('_col-colonly'))unused.push(o);});for(const o of unused)o.removeFromParent();
  applyCityPalette(loaded.scene);
  return [name,loaded.scene];
 }));return Object.fromEntries(entries);
}

export function installCityAssets(blocks,templates){
 const initialBounds={};for(const name of buildings){templates[name].updateMatrixWorld(true);initialBounds[name]=new T.Box3().setFromObject(templates[name]);}
 function building(parent,name,side){
  const obj=templates[name].clone(true),size=new T.Vector3();initialBounds[name].getSize(size);
  const scale=14.15/size.x;obj.scale.setScalar(scale);obj.rotation.y=side*Math.PI/2;obj.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(obj),front=side===1?bounds.min.x:bounds.max.x;
  obj.position.set(side*10.98-front,.155-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);obj.userData.cityKind='building';obj.userData.side=side;parent.add(obj);
 }
 function prop(parent,name,x,z,scale,rotation=0){const obj=templates[name].clone(true);obj.scale.setScalar(scale);obj.rotation.y=rotation;obj.position.set(x,.155,z);obj.userData.cityKind=name;parent.add(obj);}
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i],city=new T.Group();block.add(city);block.userData.cityObjects=city;
  for(const side of [-1,1]){
   const id=buildings[(i*5+(side===1?3:0))%buildings.length];building(city,id,side);
   prop(city,'prop_streetlight',side*7.05,4,.76,side*Math.PI/2);
   prop(city,'prop_trash_can',side*7.55,-3,.9);
   if(i%3===0)prop(city,'prop_tree',side*8.7,-5,.65);
   else if(i%6===2)prop(city,'prop_bench',side*9.6,-4,.85,side*Math.PI/2);
   else if(i%6===4)prop(city,'prop_bus_stop',side*9.55,-3,.72,side*Math.PI/2);
  }
 }
}

// Side-street buildings sit beyond the cross street and its sidewalks, leaving
// the full 12m roadway unobstructed for crossing traffic.
export function createIntersectionBackdrop(templates,variant=0){
 const group=new T.Group();group.name='intersection-buildings';
 for(const xSide of [-1,1])for(const zSide of [-1,1])for(let row=0;row<2;row++){
  const name=buildings[(variant+row*2+(xSide>0?1:0)+(zSide>0?3:0))%buildings.length],source=templates[name];
  source.updateMatrixWorld(true);const size=new T.Box3().setFromObject(source).getSize(new T.Vector3());
  const building=source.clone(true);building.scale.set(14.15/size.x,14.15/size.x,6.6/size.z);building.rotation.y=zSide<0?Math.PI:0;building.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(building),front=zSide>0?bounds.min.z:bounds.max.z;
  building.position.set(xSide*(18.5+row*14.4)-(bounds.min.x+bounds.max.x)/2,.155-bounds.min.y,zSide*9.1-front);
  building.userData.cityKind='intersection-building';building.userData.crossStreetSide=zSide;group.add(building);
 }
 return group;
}
