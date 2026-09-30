/* Meme Studio - dependency-free canvas editor for GitHub Pages. */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const state = { selected: null, character: null, id: 0, pointer: null, charRequest: 0, aspectRatio: '1:1' };
const aspectRatios = { '1:1': { width: 1080, height: 1080 }, '4:5': { width: 1080, height: 1350 }, '9:16': { width: 1080, height: 1920 } };

const assets = [
  ['기본','assets/character-neutral.svg'],['웃음','assets/character-happy.svg'],['당황','assets/character-shock.svg'],
  ['화남','assets/character-angry.svg'],['울음','assets/character-sad.svg'],['졸림','assets/character-sleepy.svg'],
  ['사랑','assets/character-love.svg'],['부끄러움','assets/character-embarrassed.svg'],['안도','assets/character-relieved.svg'],
  ['각오','assets/character-determined.svg'],['멍함','assets/character-dazed.svg'],['뿌듯','assets/character-proud.svg']
];
const emojis = ['😂','😭','😡','😱','🥹','😎','🤡','💀','😵‍💫','🤦','👍','🔥','❤️','✨','💸','💤'];
const phrases = ['오늘은 진짜 한다','일단 누워있자','내일부터 해야지','이게 왜 안 되지?','나만 그런 거 아니지?','퇴근하고 싶다','아무튼 성공','계획은 완벽했다'];
const resourcePhrases = ['나 진짜 몰랐음','잠깐만 생각해볼게','이건 좀 아닌데?','일단 해보자','생각보다 괜찮은데?','망했다','살려주세요','왜 나만 이러지?','오늘도 평화롭다','이게 맞아?','일은 하기 싫다','과제 제출 완료'];
const stickerAssets = [
  ['ㅋㅋ 눈물','assets/emojis/laugh-tears.svg'],['울음','assets/emojis/cry.svg'],['분노','assets/emojis/angry.svg'],['충격','assets/emojis/shock.svg'],
  ['사랑','assets/emojis/love.svg'],['멋짐','assets/emojis/cool.svg'],['광대','assets/emojis/clown.svg'],['멘붕','assets/emojis/skull.svg'],
  ['어질어질','assets/emojis/dizzy.svg'],['식은땀','assets/emojis/sweat.svg'],['불타는 중','assets/emojis/fire.svg'],['하트','assets/emojis/heart.svg'],
  ['반짝','assets/emojis/sparkles.svg'],['돈','assets/emojis/money.svg'],['졸림','assets/emojis/sleep.svg'],['궁금','assets/emojis/question.svg'],
  ['당황','assets/emojis/exclaim.svg'],['완료','assets/emojis/check.svg'],['상처','assets/emojis/broken-heart.svg'],['축하','assets/emojis/party.svg']
];
const backgrounds = ['#ffffff','#f8f4ed','#eef6ff','#fff0f0','#f3f0ff','#eaf8ee','#fff9c4','#111827'];

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1800)}
function nextId(){ return ++state.id; }
function setAspectRatio(key){
  const next=aspectRatios[key];
  if(!next) return;
  const oldH=canvas.height;
  if(canvas.width===next.width && oldH===next.height){
    state.aspectRatio=key;
    updateRatioUI();
    return;
  }
  // Width remains 1080. Extra vertical space is distributed above/below the existing composition
  // so images and text keep their current size and relative placement.
  const deltaY=(next.height-oldH)/2;
  editor.getObjects().forEach(o=>{o.top+=deltaY;});
  canvas.width=next.width;
  canvas.height=next.height;
  state.aspectRatio=key;
  editor.render();
  updateRatioUI();
  updateInspector();
}
function updateRatioUI(){
  document.querySelectorAll('.ratio-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.ratio===state.aspectRatio));
  const size=aspectRatios[state.aspectRatio];
  const label=$('canvasSizeLabel');
  if(label) label.textContent=`${size.width} × ${size.height}`;
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function makeObject(props){return Object.assign({memeId:nextId(),memeName:'요소',memeType:'image',left:540,top:540,width:200,height:200,scaleX:1,scaleY:1,angle:0,opacity:1,fill:'#111827',stroke:'#fff',strokeWidth:10,text:'',fontSize:72,fontFamily:'Arial Black, Noto Sans KR, sans-serif',paintFirst:'stroke',src:'',image:null},props);}

class Editor {
  constructor(el){
    this.el=el; this.objects=[]; this.active=null; this.backgroundColor='#fff'; this.listeners={};
    this.render(); this.bindPointer();
  }
  on(name,fn){(this.listeners[name] ||= []).push(fn)}
  emit(name,payload){(this.listeners[name]||[]).forEach(fn=>fn(payload))}
  add(o){this.objects.push(o);this.emit('objects:changed');this.render();return o}
  remove(o){const i=this.objects.indexOf(o);if(i>=0)this.objects.splice(i,1);if(this.active===o)this.discardActiveObject();this.emit('objects:changed');this.render()}
  clear(){this.objects=[];this.discardActiveObject();this.emit('objects:changed');this.render()}
  getObjects(){return this.objects}
  getActiveObject(){return this.active}
  setActiveObject(o){if(!o)return;this.active=o;this.emit('selection:created',o);this.render()}
  discardActiveObject(){const had=!!this.active;this.active=null;if(had)this.emit('selection:cleared');this.render()}
  bringToFront(o){const i=this.objects.indexOf(o);if(i>=0)this.objects.splice(i,1);this.objects.push(o);this.emit('objects:changed');this.render()}
  sendToBack(o){const i=this.objects.indexOf(o);if(i>=0)this.objects.splice(i,1);this.objects.unshift(o);this.emit('objects:changed');this.render()}
  set backgroundColorValue(v){this.backgroundColor=v;this.render()}
  render(){
    ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=this.backgroundColor;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
    this.objects.forEach(o=>drawObject(o));
    if(this.active) drawSelection(this.active);
  }
  toDataURL(){this.discardActiveObject();this.render();return canvas.toDataURL('image/png',1)}
  bindPointer(){
    const pointFromEvent = e => { const r=this.el.getBoundingClientRect(); return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}; };
    this.el.addEventListener('pointerdown', e=>{
      const p=pointFromEvent(e); const o=this.active; let mode='move';
      if(o){const h=hitHandle(o,p);if(h)mode=h; else if(!containsPoint(o,p))this.discardActiveObject();}
      if(!this.active){const hit=hitObject(this.objects,p);if(hit){this.setActiveObject(hit);mode='move'}else return;}
      e.preventDefault(); this.el.setPointerCapture?.(e.pointerId); const obj=this.active;
      state.pointer={mode,startX:p.x,startY:p.y,origX:obj.left,origY:obj.top,origW:obj.width*obj.scaleX,origH:obj.height*obj.scaleY,origAngle:obj.angle||0};
    });
    this.el.addEventListener('pointermove', e=>{
      if(!state.pointer||!this.active)return; const p=pointFromEvent(e), d=state.pointer, o=this.active;
      if(d.mode==='move'){o.left=d.origX+(p.x-d.startX);o.top=d.origY+(p.y-d.startY)}
      else if(d.mode==='rotate'){o.angle=Math.atan2(p.y-o.top,p.x-o.left)*180/Math.PI+90}
      else if(d.mode==='resize'){const rad=-(o.angle||0)*Math.PI/180, dx=p.x-o.left,dy=p.y-o.top;const lx=dx*Math.cos(rad)-dy*Math.sin(rad), ly=dx*Math.sin(rad)+dy*Math.cos(rad);o.scaleX=Math.max(.05,Math.abs(lx*2)/(o.width||1));o.scaleY=Math.max(.05,Math.abs(ly*2)/(o.height||1));}
      o.setCoords?.(); this.emit('object:modified',o); this.render();
    });
    const end=()=>{if(state.pointer){state.pointer=null;this.emit('objects:changed');this.render()}};
    this.el.addEventListener('pointerup',end);this.el.addEventListener('pointercancel',end);
    this.el.addEventListener('dblclick',e=>{const p=pointFromEvent(e),o=hitObject(this.objects,p);if(o&&(o.memeType==='text'||o.memeType==='emoji')){const v=prompt('문구를 입력하세요.',o.text);if(v!==null){o.text=v;measureObject(o);this.setActiveObject(o);this.render();this.emit('objects:changed')}}});
  }
}

const editor = new Editor(canvas);

function rect(o){return {w:o.width*o.scaleX,h:o.height*o.scaleY};}
function localPoint(o,p){const a=-(o.angle||0)*Math.PI/180,dx=p.x-o.left,dy=p.y-o.top;return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)}}
function containsPoint(o,p){const q=localPoint(o,p),r=rect(o);return Math.abs(q.x)<=r.w/2&&Math.abs(q.y)<=r.h/2}
function corners(o){const r=rect(o), a=(o.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-r.w/2,-r.h/2],[r.w/2,-r.h/2],[r.w/2,r.h/2],[-r.w/2,r.h/2]].map(([x,y])=>({x:o.left+x*c-y*s,y:o.top+x*s+y*c}))}
function hitHandle(o,p){const cs=corners(o);for(let i=0;i<4;i++){if(Math.hypot(p.x-cs[i].x,p.y-cs[i].y)<24)return 'resize'}const rad=(o.angle||0)*Math.PI/180,r=rect(o);const hx=o.left+Math.sin(rad)*(r.h/2+42),hy=o.top-Math.cos(rad)*(r.h/2+42);if(Math.hypot(p.x-hx,p.y-hy)<26)return 'rotate';return null}
function hitObject(objs,p){for(let i=objs.length-1;i>=0;i--)if(containsPoint(objs[i],p))return objs[i];return null}
function drawObject(o){
  ctx.save();ctx.globalAlpha=o.opacity??1;ctx.translate(o.left,o.top);ctx.rotate((o.angle||0)*Math.PI/180);ctx.scale(o.scaleX||1,o.scaleY||1);
  if(o.memeType==='text'||o.memeType==='emoji'){
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${o.memeType==='emoji'?'normal ':''}${o.fontWeight||900} ${o.fontSize}px ${o.fontFamily}`;
    if(o.memeType==='text'&&o.strokeWidth){ctx.lineJoin='round';ctx.strokeStyle=o.stroke||'#fff';ctx.lineWidth=o.strokeWidth*2;ctx.strokeText(o.text,0,0)}
    ctx.fillStyle=o.fill||'#111827';ctx.fillText(o.text,0,0);
  }else if(o.image&&o.image.complete){
    const r=rect({width:o.width,height:o.height,scaleX:1,scaleY:1});ctx.drawImage(o.image,-r.w/2,-r.h/2,r.w,r.h);
    if(o.tint&&o.fill){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=o.fill;ctx.globalAlpha=(o.opacity??1)*.65;ctx.fillRect(-r.w/2,-r.h/2,r.w,r.h)}
  }
  ctx.restore();
}
function drawSelection(o){
  const r=rect(o), rad=(o.angle||0)*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);ctx.save();ctx.translate(o.left,o.top);ctx.rotate(rad);ctx.strokeStyle='#5b5ce2';ctx.lineWidth=3;ctx.setLineDash([8,6]);ctx.strokeRect(-r.w/2,-r.h/2,r.w,r.h);ctx.setLineDash([]);
  const hs=12;ctx.fillStyle='#fff';ctx.strokeStyle='#5b5ce2';ctx.lineWidth=3;[[-r.w/2,-r.h/2],[r.w/2,-r.h/2],[r.w/2,r.h/2],[-r.w/2,r.h/2]].forEach(([x,y])=>{ctx.beginPath();ctx.rect(x-hs/2,y-hs/2,hs,hs);ctx.fill();ctx.stroke()});ctx.beginPath();ctx.moveTo(0,-r.h/2);ctx.lineTo(0,-r.h/2-42);ctx.stroke();ctx.beginPath();ctx.arc(0,-r.h/2-42,9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
}
function measureObject(o){
  if(o.memeType!=='text'&&o.memeType!=='emoji')return;
  ctx.save();ctx.font=`${o.memeType==='emoji'?'normal ':''}${o.fontWeight||900} ${o.fontSize}px ${o.fontFamily}`;o.width=Math.max(40,ctx.measureText(o.text||' ').width);o.height=o.fontSize*1.25;ctx.restore();
}
function addMeta(obj,name,type){obj.memeName=name;obj.memeType=type;return obj}
function loadImage(src,done){const img=new Image();img.onload=()=>done(img);img.onerror=()=>toast('이미지를 불러오지 못했습니다.');img.src=src;}
function addCharacter(url,label='기본'){
  const req=++state.charRequest;const old=state.character;
  loadImage(url,img=>{if(req!==state.charRequest)return;const obj=old?old:makeObject({memeName:'캐릭터 · '+label,memeType:'character'});
    if(old){obj.memeName='캐릭터 · '+label;obj.src=url;obj.image=img;obj.width=img.naturalWidth||img.width;obj.height=img.naturalHeight||img.height;state.character=obj;editor.render();editor.emit('objects:changed');updateLayers();updateInspector();return;}
    obj.src=url;obj.image=img;obj.width=img.naturalWidth||700;obj.height=img.naturalHeight||700;obj.scaleX=.68;obj.scaleY=.68;obj.left=540;obj.top=590;state.character=obj;editor.add(obj);editor.sendToBack(obj);editor.setActiveObject(obj);updateLayers();updateInspector();
  });
}
function addText(text='오늘은 진짜 한다'){const o=makeObject({memeName:'문구',memeType:'text',left:540,top:150,text,fontSize:72,fill:'#111827',stroke:'#fff',strokeWidth:10,fontWeight:900,fontFamily:'Arial Black, Noto Sans KR, sans-serif'});measureObject(o);editor.add(o);editor.setActiveObject(o);updateLayers();updateInspector()}
function addEmoji(emoji='😂'){const o=makeObject({memeName:'이모지 '+emoji,memeType:'emoji',left:820,top:260,text:emoji,fontSize:120,fill:'#111827',fontWeight:900,fontFamily:'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'});measureObject(o);editor.add(o);editor.setActiveObject(o);updateLayers();updateInspector()}
function addImageObject(src,name,type='image',left=540,top=540,max=500){loadImage(src,img=>{const nw=img.naturalWidth||img.width,nh=img.naturalHeight||img.height,s=Math.min(1,max/nw,max/nh);const o=makeObject({memeName:name,memeType:type,left,top,width:nw,height:nh,scaleX:s,scaleY:s,src,image:img,tint:false});editor.add(o);editor.setActiveObject(o);updateLayers();updateInspector()})}
function addUploaded(src,name){addImageObject(src,name,'image',540,540,500)}
function addSvgSticker(url,label){addImageObject(url,'감정 · '+label,'image',800,760,280)}

function updateLayers(){const box=$('layers');box.innerHTML='';const objs=editor.getObjects().slice().reverse();const count=$('layerCount');if(count)count.textContent=objs.length;objs.forEach(o=>{const row=document.createElement('div');row.className='layer'+(o===editor.getActiveObject()?' active':'');row.innerHTML=`<span class="layer-icon">${o.memeType==='character'?'🐱':o.memeType==='emoji'?'😊':o.memeType==='text'?'T':'🖼️'}</span><span class="layer-name">${escapeHtml(o.memeName||'요소')}</span>`;row.onclick=()=>{editor.setActiveObject(o);updateLayers();updateInspector()};box.appendChild(row)})}
function updateInspector(){const o=editor.getActiveObject();state.selected=o;$('emptyInspector').classList.toggle('hidden',!o);$('inspectorControls').classList.toggle('hidden',!o);if(!o)return;$('objectName').value=o.memeName||'';$('posX').value=Math.round(o.left);$('posY').value=Math.round(o.top);$('objWidth').value=Math.round(o.width*o.scaleX);$('objHeight').value=Math.round(o.height*o.scaleY);$('objAngle').value=Math.round(o.angle||0);$('objOpacity').value=Math.round((o.opacity??1)*100);const color=$('objColor');color.value=normalizeColor(o.fill||'#111827');$('colorControl').classList.toggle('hidden',!(o.memeType==='text'||o.memeType==='emoji'||o.memeType==='image'||o.memeType==='character'))}
function normalizeColor(v){if(/^#[0-9a-f]{6}$/i.test(v))return v;return '#111827'}
function applyGeometry(){const o=state.selected;if(!o)return;o.left=+$('posX').value||0;o.top=+$('posY').value||0;o.angle=+$('objAngle').value||0;o.opacity=Math.max(0,Math.min(1,(+$('objOpacity').value||0)/100));const w=Math.max(1,+$('objWidth').value||1),h=Math.max(1,+$('objHeight').value||1);o.scaleX=w/(o.width||1);o.scaleY=h/(o.height||1);editor.render();updateLayers()}

$('addTextBtn').onclick=()=>addText();$('addEmojiBtn').onclick=()=>addEmoji();$('deleteBtn').onclick=()=>{const o=state.selected;if(o&&o.memeType!=='character'){editor.remove(o);updateLayers();updateInspector()}else if(o){toast('캐릭터는 삭제할 수 없어요. 표정만 바꿔보세요.')}};
$('duplicateBtn').onclick=()=>{const o=state.selected;if(!o)return;const c=makeObject(Object.assign({},o,{memeId:nextId(),left:o.left+30,top:o.top+30,memeName:(o.memeName||'요소')+' 복사'}));if(o.image){c.image=o.image;c.src=o.src}editor.add(c);editor.setActiveObject(c);updateLayers();updateInspector()};
$('frontBtn').onclick=()=>{if(state.selected){editor.bringToFront(state.selected);updateLayers()}};$('backBtn').onclick=()=>{if(state.selected){editor.sendToBack(state.selected);if(state.character)editor.sendToBack(state.character);updateLayers()}};
$('objectName').oninput=e=>{if(state.selected){state.selected.memeName=e.target.value;updateLayers()}};['posX','posY','objWidth','objHeight','objAngle'].forEach(id=>$(id).onchange=applyGeometry);$('objOpacity').oninput=applyGeometry;
$('objColor').oninput=e=>{const o=state.selected;if(!o)return;o.fill=e.target.value;if(o.memeType==='image'||o.memeType==='character')o.tint=true;editor.render()};
function getFileExtension(name){const i=name.lastIndexOf('.');return i>0?name.slice(i+1).toLowerCase():''}
function validateUploadFile(file){
  const ext=getFileExtension(file.name);
  const allowedExt=new Set(['png','jpg','jpeg','svg']);
  const allowedMime=new Set(['image/png','image/jpeg','image/jpg','image/svg+xml']);
  if(!allowedExt.has(ext)){
    return `지원하지 않는 파일 형식입니다. '${file.name}' (${ext?ext.toUpperCase():'확장자 없음'})은 업로드할 수 없습니다. PNG, JPEG, SVG만 지원합니다.`;
  }
  if(file.type && !allowedMime.has(file.type.toLowerCase())){
    return `파일 형식이 올바르지 않습니다. '${file.name}'의 브라우저 형식(${file.type})은 PNG, JPEG, SVG 업로드 형식과 일치하지 않습니다.`;
  }
  return '';
}
function showUploadStatus(message,isError=false){
  const el=$('uploadStatus');
  if(!el)return;
  el.textContent=message;
  el.classList.toggle('error',isError);
}
$('imageUpload').onchange=e=>{
  const files=[...e.target.files];
  if(!files.length)return;
  const rejected=[];
  let acceptedCount=0;
  files.forEach(file=>{
    const reason=validateUploadFile(file);
    if(reason){rejected.push(reason);return;}
    acceptedCount++;
    const reader=new FileReader();
    reader.onload=ev=>addUploaded(ev.target.result,file.name);
    reader.onerror=()=>{
      rejected.push(`'${file.name}'을(를) 읽지 못했습니다. 파일이 손상되었거나 브라우저에서 읽을 수 없는 파일입니다.`);
      showUploadStatus(rejected.join(' '),true);
    };
    reader.readAsDataURL(file);
  });
  if(rejected.length){
    showUploadStatus(`${acceptedCount}개 파일은 업로드했고, ${rejected.length}개 파일은 거부했습니다. ${rejected.join(' ')}`,true);
    toast(rejected[0]);
  }else{
    showUploadStatus(`${acceptedCount}개 파일을 업로드했습니다.`,false);
    toast(`${acceptedCount}개 파일을 추가했습니다.`);
  }
  e.target.value='';
};
$('newBtn').onclick=()=>{if(confirm('현재 밈을 지우고 새로 시작할까요?')){editor.clear();editor.backgroundColor='#fff';state.character=null;state.charRequest=0;addCharacter('assets/character-neutral.svg','기본')}};
$('downloadBtn').onclick=()=>{const data=editor.toDataURL();const a=document.createElement('a');a.href=data;a.download='meme-'+Date.now()+'.png';a.click();updateInspector();toast('PNG로 저장했습니다.')};

editor.on('selection:created',()=>{updateInspector();updateLayers()});editor.on('selection:cleared',()=>{updateInspector();updateLayers()});editor.on('object:modified',()=>{updateInspector();updateLayers()});editor.on('objects:changed',updateLayers);

assets.forEach(([label,url],i)=>{const b=document.createElement('button');b.className='char-btn';b.title=label;b.innerHTML=`<img src="${url}" alt="${label}">`;b.onclick=()=>{document.querySelectorAll('.char-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');addCharacter(url,label)};$('characterGrid').appendChild(b);if(i===0)b.classList.add('active')});
emojis.forEach(e=>{const b=document.createElement('button');b.className='emoji-btn';b.textContent=e;b.title='이모지 추가';b.onclick=()=>addEmoji(e);$('emojiRow').appendChild(b)});
backgrounds.forEach(c=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.title=c;b.onclick=()=>{editor.backgroundColor=c;editor.render()};$('backgroundSwatches').appendChild(b)});
phrases.forEach(p=>{const b=document.createElement('button');b.className='chip';b.textContent=p;b.onclick=()=>addText(p);$('phraseChips').appendChild(b)});
stickerAssets.forEach(([label,url])=>{const b=document.createElement('button');b.className='sticker-btn';b.title=label;b.innerHTML=`<img src="${url}" alt="${label}"><span>${escapeHtml(label)}</span>`;b.onclick=()=>addSvgSticker(url,label);$('stickerGrid').appendChild(b)});
resourcePhrases.forEach(p=>{const b=document.createElement('button');b.className='chip resource-chip';b.textContent=p;b.onclick=()=>addText(p);$('resourcePhraseChips').appendChild(b)});

document.querySelectorAll('.ratio-btn').forEach(btn=>{btn.onclick=()=>setAspectRatio(btn.dataset.ratio)});
updateRatioUI();

editor.backgroundColor='#fff';addCharacter('assets/character-neutral.svg','기본');
window.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&state.selected&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&state.selected.memeType!=='character')$('deleteBtn').click();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();$('duplicateBtn').click()}});
