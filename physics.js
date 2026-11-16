// Swept point against an expanded vehicle box. Returning the first contact
// prevents lateral movement or a long frame from crossing solid geometry.
export const PLAYER_HALF_WIDTH = .36;
export const PLAYER_HALF_DEPTH = .29;
export const PLAYER_HEIGHT = 2.1;
export function vehicleSize(type) {
  return type === 'bus' ? { x:1.04, z:3.3, top:2.57 } : type === 'cross' ? { x:2.08, z:1.2, top:1.46 } : { x:1.2, z:2.08, top:1.46 };
}
export function sweepVehicle(from, to, vehicle) {
  const b=vehicleSize(vehicle.type), eps=1e-7;
  // Taking off from a roof moves away from the vehicle and is not a collision.
  if(from.y>=b.top-eps && to.y>from.y)return null;
  const start=[from.x-(vehicle.oldX??vehicle.x), from.y, -vehicle.oldZ];
  const end=[to.x-vehicle.x, to.y, -vehicle.z];
  const lo=[-b.x-PLAYER_HALF_WIDTH, -PLAYER_HEIGHT, -b.z-PLAYER_HALF_DEPTH];
  const hi=[ b.x+PLAYER_HALF_WIDTH, b.top, b.z+PLAYER_HALF_DEPTH];
  let enter=0, exit=1, axis=-1;
  for(let a=0;a<3;a++){
    const delta=end[a]-start[a];
    if(Math.abs(delta)<eps){if(start[a]<=lo[a]+eps || start[a]>=hi[a]-eps)return null;continue;}
    let first=(lo[a]-start[a])/delta, last=(hi[a]-start[a])/delta;
    if(first>last)[first,last]=[last,first];
    if(first>enter-eps){enter=first;axis=a;}
    exit=Math.min(exit,last);
    if(enter>exit+eps)return null;
  }
  if(exit<0 || enter>1 || enter< -eps)return null;
  return { fraction:Math.max(0,enter), roof:axis===1 && to.y<from.y && from.y>=b.top-eps, top:b.top, axis:axis===0?'x':'z', sign:axis===0?Math.sign(start[0]-end[0]):Math.sign(start[2]-end[2])||1 };
}
export function impactPlaneFor(vehicle,hit){
 const size=vehicleSize(vehicle.type),axis=hit.axis,sign=hit.sign;
 return {axis,sign,value:vehicle[axis]+sign*size[axis]};
}
export function onVehicleRoof(x,y,objects){
  return objects.find(o=>{
    if(o.type!=='bus' && o.type!=='car' && o.type!=='cross')return false;
    const size=vehicleSize(o.type);
    return Math.abs(y-size.top)<.0001 && Math.abs(x-o.x)<size.x && Math.abs(o.z)<size.z;
  });
}
