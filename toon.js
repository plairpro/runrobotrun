import * as T from './vendor/three.module.js';
const heatPoint=new T.Vector3(),heatView=new T.Vector3();
// Project a small region below each nozzle into the post-processing pass.
export function projectHeatRegion(pod,camera,out){
 heatPoint.set(0,-1.45,-.15);pod.localToWorld(heatPoint);heatView.copy(heatPoint).applyMatrix4(camera.matrixWorldInverse);
 const depth=-heatView.z;if(depth<=camera.near){out.set(0,0,0,0);return false;}
 heatPoint.project(camera);const vertical=.6/(2*depth*Math.tan(T.MathUtils.degToRad(camera.fov)*.5));
 out.set(heatPoint.x*.5+.5,heatPoint.y*.5+.5,vertical*.72/camera.aspect,vertical);return depth;
}
// Screen-space ink outlines preserve skinned animations and cover the whole city.
export function createInkRenderer(renderer,scene,camera){
 const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 const passScene=new T.Scene(),passCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{colorMap:{value:target.texture},depthMap:{value:target.depthTexture},size:{value:new T.Vector2(1,1)},near:{value:camera.near},far:{value:camera.far},heatA:{value:new T.Vector4()},heatB:{value:new T.Vector4()},heatDepth:{value:new T.Vector2()},heatTime:{value:0},heatStrength:{value:0}},vertexShader:`varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
  uniform sampler2D colorMap,depthMap;uniform vec2 size,heatDepth;uniform float near,far,heatTime,heatStrength;uniform vec4 heatA,heatB;varying vec2 uvScreen;
  float depthAt(vec2 uv){float z=texture2D(depthMap,uv).x*2.-1.;return 2.*near*far/(far+near-z*(far-near));}
  float heatMask(vec4 region){vec2 q=(uvScreen-region.xy)/max(region.zw,vec2(.00001));return 1.-smoothstep(.1,1.,dot(q,q));}
  void main(){vec3 color=texture2D(colorMap,uvScreen).rgb;float d=depthAt(uvScreen);vec2 texel=1.45/size;float depthEdge=0.,colorEdge=0.;
   for(int i=0;i<4;i++){vec2 dir=i==0?vec2(1.,0.):i==1?vec2(-1.,0.):i==2?vec2(0.,1.):vec2(0.,-1.);vec2 p=uvScreen+dir*texel;depthEdge=max(depthEdge,abs(depthAt(p)-d)/max(d,1.));colorEdge=max(colorEdge,length(texture2D(colorMap,p).rgb-color));}
   float edge=max(smoothstep(.012,.035,depthEdge),smoothstep(.24,.45,colorEdge)*.78);
   color=mix(color,vec3(.026,.014,.035),edge*.96);
   if(heatStrength>.001){float mask=max(heatMask(heatA)*smoothstep(heatDepth.x+.01,heatDepth.x+.15,d),heatMask(heatB)*smoothstep(heatDepth.y+.01,heatDepth.y+.15,d))*heatStrength;if(mask>.001){
    float wave=sin(uvScreen.y*size.y*.08-heatTime*9.)+0.45*sin(uvScreen.x*size.x*.11+heatTime*7.);
    vec2 shift=vec2(wave*2.1,sin(uvScreen.x*size.x*.07+heatTime*6.)*.8)*mask/size;
    vec2 blur=vec2(1.7)/size;vec2 p=clamp(uvScreen+shift,vec2(.001),vec2(.999));
    vec3 refracted=(texture2D(colorMap,p).rgb*2.+texture2D(colorMap,p+vec2(blur.x,0.)).rgb+texture2D(colorMap,p-vec2(blur.x,0.)).rgb+texture2D(colorMap,p+vec2(0.,blur.y)).rgb+texture2D(colorMap,p-vec2(0.,blur.y)).rgb)/6.;
    color=mix(color,refracted,mask*.7);
   }}
   gl_FragColor=vec4(color,1.);
   #include <colorspace_fragment>
  }`});
 passScene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
 function resize(){const v=new T.Vector2();renderer.getDrawingBufferSize(v);target.setSize(v.x,v.y);material.uniforms.size.value.copy(v);}
 function setHeatHaze(pods,active,time){material.uniforms.heatStrength.value=active&&pods?.length===2?1:0;if(!material.uniforms.heatStrength.value)return;camera.updateMatrixWorld();const a=projectHeatRegion(pods[0],camera,material.uniforms.heatA.value),b=projectHeatRegion(pods[1],camera,material.uniforms.heatB.value);material.uniforms.heatDepth.value.set(a||camera.far,b||camera.far);material.uniforms.heatTime.value=time;}
 resize();return {resize,setHeatHaze,render(){renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(passScene,passCamera);}};
}
