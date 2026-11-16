// Self-contained spatial soundscape; no downloads, autoplay or background timers.
export class CityAudio {
  constructor(){this.ctx=null;this.level=.55;this.muted=false;this.running=false;this.voices=[];this.lastFoot=null;this.hornIn=9;this.lastCoin=-1;this.jumpCount=0;this.music=null;this.musicStarted=false;}
  init(){
    if(this.ctx)return;
    const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
    const a=this.ctx=new AC({latencyHint:'interactive'});
    this.master=a.createGain();this.master.gain.value=this.level*.7;
    this.compressor=a.createDynamicsCompressor();Object.assign(this.compressor.threshold,{value:-14});this.compressor.knee.value=14;this.compressor.ratio.value=5;this.compressor.attack.value=.003;this.compressor.release.value=.18;
    this.master.connect(this.compressor);this.compressor.connect(a.destination);
    this.stage=a.createGain();this.stage.gain.value=0;this.stage.connect(this.master);
    this.noise=a.createBuffer(2,a.sampleRate*6,a.sampleRate);
    for(let ch=0;ch<2;ch++){let data=this.noise.getChannelData(ch),brown=0;for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.02)/1.02;data[i]=brown*3.5;}}
    this.steps={road:[],roof:[]};for(let i=0;i<6;i++)for(let surface of ['road','roof'])this.steps[surface].push(this.makeStep(surface,i));this.jumpBuffer=this.makeJump();
    const ambient=a.createBufferSource();ambient.buffer=this.noise;ambient.loop=true;
    const low=a.createBiquadFilter();low.type='lowpass';low.frequency.value=750;
    const bed=a.createGain();bed.gain.value=.19;ambient.connect(low);low.connect(bed);bed.connect(this.stage);ambient.start();
    // A small, quiet stereo reflection tail puts impacts between the buildings.
    const impulse=a.createBuffer(2,Math.floor(a.sampleRate*.38),a.sampleRate);
    for(let ch=0;ch<2;ch++){let d=impulse.getChannelData(ch);for(let i=0;i<d.length;i++){let t=i/a.sampleRate;d[i]=(Math.random()*2-1)*Math.exp(-t*19)*.08;if(i===Math.floor(a.sampleRate*(.052+ch*.013)))d[i]+=.18;}}
    this.reverb=a.createConvolver();this.reverb.buffer=impulse;const wet=a.createGain();wet.gain.value=.13;this.reverb.connect(wet);wet.connect(this.stage);
    for(let i=0;i<4;i++)this.voices.push(this.makeVehicleVoice(i));
  }
  makeStep(surface,variant){let a=this.ctx,b=a.createBuffer(1,Math.floor(a.sampleRate*.2),a.sampleRate),d=b.getChannelData(0),smooth=0;for(let i=0;i<d.length;i++){let t=i/a.sampleRate,noise=Math.random()*2-1;smooth=smooth*.55+noise*.45;let envelope=(1-Math.exp(-t*1800))*Math.exp(-t*(surface==='roof'?30:38));d[i]=(Math.sin(2*Math.PI*(76+variant*3)*t)*.42+smooth*.48)*envelope;if(surface==='roof')d[i]+=(Math.sin(t*2*Math.PI*610)+Math.sin(t*2*Math.PI*1043))*.1*Math.exp(-t*25);else d[i]+=noise*.1*Math.exp(-Math.pow((t-.04)/.025,2));}return b;}
  // A warm turbine exhale: gentle onset, low pressure rumble and a longer soft hiss.
  makeJump(){
    const a=this.ctx,rate=a.sampleRate,duration=.72,b=a.createBuffer(2,Math.floor(rate*duration),rate);
    const upper=Math.exp(-2*Math.PI*1150/rate),lower=Math.exp(-2*Math.PI*130/rate),sub=Math.exp(-2*Math.PI*95/rate);
    for(let ch=0;ch<2;ch++){
      const out=b.getChannelData(ch);let fast=0,slow=0,low=0,seed=27183+ch*103;
      for(let i=0;i<out.length;i++){
        const t=i/rate;seed=(1664525*seed+1013904223)>>>0;const noise=seed/2147483648-1;
        fast=upper*fast+(1-upper)*noise;slow=lower*slow+(1-lower)*noise;low=sub*low+(1-sub)*noise;
        const attack=1-Math.exp(-t/0.042),decay=Math.exp(-t*3.9),fade=Math.min(1,(duration-t)/.10);
        const turbulence=(fast-slow)*.78,rumble=low*1.5+Math.sin(2*Math.PI*(76*t-10*t*t))*.095;
        out[i]=(turbulence+rumble)*attack*decay*fade;
      }
    }
    return b;
  }
  makeVehicleVoice(i){const a=this.ctx,gain=a.createGain(),pan=a.createStereoPanner(),filter=a.createBiquadFilter();gain.gain.value=0;filter.type='lowpass';filter.frequency.value=700;filter.Q.value=.3;filter.connect(gain);gain.connect(pan);pan.connect(this.stage);
    let engine=a.createOscillator(),harmonic=a.createOscillator(),eg=a.createGain(),hg=a.createGain();engine.type='triangle';engine.frequency.value=52+i*4;eg.gain.value=.5;harmonic.type='sine';harmonic.frequency.value=104+i*8;hg.gain.value=.22;engine.connect(eg);eg.connect(filter);harmonic.connect(hg);hg.connect(filter);engine.start();harmonic.start();
    const tires=a.createBufferSource(),tg=a.createGain(),tf=a.createBiquadFilter();tires.buffer=this.noise;tires.loop=true;tf.type='highpass';tf.frequency.value=250;tg.gain.value=1.3;tires.connect(tf);tf.connect(tg);tg.connect(filter);tires.start(0,i*.6);
    return {gain,pan,filter,engine,harmonic};
  }
  async start({restart=false}={}){
    try{
      this.init();
      if(!this.music&&typeof Audio!=='undefined'){this.music=new Audio(globalThis.RUNNER_MUSIC_URL||'./assets/background.m4a');this.music.preload='auto';this.music.loop=false;this.applyVolume();}
      if(restart&&this.music){this.music.pause();this.music.currentTime=0;this.musicStarted=true;}
      if(this.musicStarted&&!globalThis.document?.hidden)this.resumeMusic();
      this.running=true;if(this.ctx?.state==='suspended')await this.ctx.resume();
      if(!this.running)return;this.lastFoot=null;this.hornIn=8;this.stage?.gain.setTargetAtTime(1,this.ctx.currentTime,.08);
    }catch{this.running=false;}
  }
  pause({keepMusic=false}={}){this.running=false;if(this.ctx)this.stage.gain.setTargetAtTime(0,this.ctx.currentTime,.035);if(!keepMusic)this.pauseMusic();}
  pauseMusic(){this.music?.pause();}
  resumeMusic(){if(this.musicStarted&&this.music&&!this.music.ended&&!globalThis.document?.hidden){const play=this.music.play();play?.catch(()=>{});}}

  setVolume(value){this.level=Math.max(0,Math.min(1,value));this.applyVolume();}
  toggle(){this.muted=!this.muted;this.applyVolume();return this.muted;}
  applyVolume(){if(this.ctx)this.master.gain.setTargetAtTime(this.muted?0:this.level*.7,this.ctx.currentTime,.025);if(this.music)this.music.volume=this.muted?0:this.level*.12;}
  foot(surface='road',side=0,strength=1){if(!this.running||!this.ctx)return;const a=this.ctx,src=a.createBufferSource(),gain=a.createGain(),pan=a.createStereoPanner();src.buffer=this.steps[surface][Math.floor(Math.random()*6)];src.playbackRate.value=.96+Math.random()*.08;gain.gain.value=(surface==='road'?.3:.55)*strength;pan.pan.value=side*.14;let filter=null;if(surface==='road'){filter=a.createBiquadFilter();filter.type='lowpass';filter.frequency.value=220;filter.Q.value=.45;src.connect(filter);filter.connect(gain);}else src.connect(gain);gain.connect(pan);pan.connect(this.stage);gain.connect(this.reverb);src.start();src.onended=()=>{src.disconnect();filter?.disconnect();gain.disconnect();pan.disconnect();};}
  jump(){if(!this.running||!this.ctx||!this.jumpBuffer)return;const a=this.ctx,src=a.createBufferSource(),gain=a.createGain(),wet=a.createGain();src.buffer=this.jumpBuffer;src.playbackRate.value=.98+(this.jumpCount++%3)*.02;gain.gain.value=.65;wet.gain.value=.1;src.connect(gain);gain.connect(this.stage);gain.connect(wet);wet.connect(this.reverb);src.start();src.onended=()=>{src.disconnect();gain.disconnect();wet.disconnect();};}
  tone(freq,duration,gain=.1,pan=0){if(!this.ctx)return;const a=this.ctx,o=a.createOscillator(),g=a.createGain(),p=a.createStereoPanner(),now=a.currentTime;o.type='sine';o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(freq*.94,now+duration);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+.007);g.gain.exponentialRampToValueAtTime(.0001,now+duration);p.pan.value=pan;o.connect(g);g.connect(p);p.connect(this.master);o.start();o.stop(now+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};}
  coin(){if(!this.ctx||this.ctx.currentTime-this.lastCoin<.075)return;this.lastCoin=this.ctx.currentTime;this.tone(1318,.16,.085);this.tone(1975,.13,.045);this.tone(2637,.09,.018);}
  crash(){this.pause({keepMusic:true});if(!this.ctx)return;const a=this.ctx,n=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain(),now=a.currentTime;n.buffer=this.noise;f.type='lowpass';f.frequency.setValueAtTime(1600,now);f.frequency.exponentialRampToValueAtTime(100,now+.4);g.gain.setValueAtTime(.7,now);g.gain.exponentialRampToValueAtTime(.001,now+.55);n.connect(f);f.connect(g);g.connect(this.master);n.start();n.stop(now+.6);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();};this.tone(90,.4,.3);}
  win(){this.pause({keepMusic:true});this.tone(660,.35,.07);this.tone(880,.5,.05);}
  beatPosition(fallbackTime=0){const t=this.musicStarted&&this.music&&!this.music.paused&&!this.music.ended?this.music.currentTime:fallbackTime;return (t-.304)*170/60;}
  update(objects,playerX,playerHeight,grounded,time,dt){if(!this.ctx||!this.running)return;const now=this.ctx.currentTime;let cars=objects.filter(o=>o.type!=='coin'&&o.z>-65&&o.z<12).sort((a,b)=>Math.abs(a.z)-Math.abs(b.z)).slice(0,4);
    this.voices.forEach((v,i)=>{const o=cars[i];if(!o){v.gain.gain.setTargetAtTime(0,now,.15);return;}let dx=o.x-playerX,dist=Math.hypot(o.z,dx,playerHeight+1),near=1/(1+Math.pow(dist/8,2)),doppler=1-.14*Math.tanh(o.z/5),base=o.type==='bus'?43:62;v.gain.gain.setTargetAtTime(near*.23,now,.05);v.pan.pan.setTargetAtTime(Math.max(-.95,Math.min(.95,dx/5)),now,.06);v.filter.frequency.setTargetAtTime(350+near*1700,now,.08);v.engine.frequency.setTargetAtTime(base*doppler,now,.07);v.harmonic.frequency.setTargetAtTime(base*2.01*doppler,now,.07);});
    const foot=Math.floor(this.beatPosition(time));if(this.lastFoot===null)this.lastFoot=foot;else if(foot!==this.lastFoot){this.lastFoot=foot;if(grounded)this.foot(playerHeight>1?'roof':'road',Math.abs(foot%2)?1:-1);}
    this.hornIn-=dt;if(this.hornIn<=0){this.hornIn=12+Math.random()*13;const side=Math.random()<.5?-.8:.8;this.tone(330,.35,.014,side);this.tone(415,.3,.009,side);}
  }
}
