/* Meme Studio - dependency-free canvas editor for GitHub Pages. */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const state = { selected: null, character: null, id: 0, pointer: null, charRequest: 0, aspectRatio: '1:1' };
const aspectRatios = { '1:1': { width: 1080, height: 1080 }, '4:5': { width: 1080, height: 1350 }, '9:16': { width: 1080, height: 1920 } };

const TEMPLATE_STORE = {
  version: 1,
  max: 3,
  dirName: 'meme-studio-templates',
  key: 'meme-studio-templates-json-v1'
};

function templateFileName(slot){ return `template-${slot}.json`; }
function isValidSlot(slot){ return [1,2,3].includes(Number(slot)); }

async function getTemplateDirectory(){
  if(!navigator.storage?.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(TEMPLATE_STORE.dirName, {create:true});
}

function getLocalTemplateMap(){
  try{
    const raw=localStorage.getItem(TEMPLATE_STORE.key);
    if(!raw) return {};
    const parsed=JSON.parse(raw);
    return parsed && typeof parsed==='object' ? parsed : {};
  }catch(_){ return {}; }
}
function setLocalTemplateMap(map){ localStorage.setItem(TEMPLATE_STORE.key, JSON.stringify(map)); }

async function writeTemplateJson(template, options={}){
  const validationError=options.allowLegacy ? '' : getTemplateValidationError(template);
  if(validationError){ throw new Error(`저장 거부: ${validationError}`); }
  const json=JSON.stringify(template,null,2);
  const dir=await getTemplateDirectory();
  if(dir){
    const handle=await dir.getFileHandle(templateFileName(template.slot),{create:true});
    const writable=await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return {mode:'opfs',json};
  }
  const map=getLocalTemplateMap(); map[String(template.slot)]=json; setLocalTemplateMap(map);
  return {mode:'localStorage',json};
}

async function readTemplateJson(slot){
  if(!isValidSlot(slot)) return {status:'missing'};
  const dir=await getTemplateDirectory();
  if(dir){
    try{
      const handle=await dir.getFileHandle(templateFileName(slot));
      const file=await handle.getFile();
      const text=await file.text();
      if(!text.trim()) return {status:'corrupt',error:'JSON 파일이 비어 있습니다.'};
      try{
        const data=JSON.parse(text);
        const validation=getStoredTemplateStatus(data); return validation.status==='ok' ? {status:'ok',data,source:'opfs'} : {status:validation.status,data,error:validation.error};
      }catch(e){ return {status:'corrupt',error:'JSON 문법이 손상되었습니다.'}; }
    }catch(e){
      if(e.name==='NotFoundError') return {status:'missing'};
      throw e;
    }
  }
  const map=getLocalTemplateMap();
  const raw=map[String(slot)];
  if(!raw) return {status:'missing'};
  try{
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    const validation=getStoredTemplateStatus(data); return validation.status==='ok' ? {status:'ok',data,source:'localStorage'} : {status:validation.status,data,error:validation.error};
  }catch(e){ return {status:'corrupt',error:'JSON 문법이 손상되었습니다.'}; }
}

async function deleteTemplate(slot){
  const dir=await getTemplateDirectory();
  if(dir){
    try{ await dir.removeEntry(templateFileName(slot)); }catch(e){ if(e.name!=='NotFoundError') throw e; }
    return;
  }
  const map=getLocalTemplateMap(); delete map[String(slot)]; setLocalTemplateMap(map);
}

async function getTemplates(){
  const result=[];
  let mode='localStorage';
  try{ mode=await getTemplateDirectory()?'opfs':'localStorage'; }catch(_){ mode='localStorage'; }
  for(let slot=1;slot<=TEMPLATE_STORE.max;slot++){
    result.push({slot,...await readTemplateJson(slot)});
  }
  result.storageMode=mode;
  return result;
}

const TEMPLATE_SCHEMA_VERSION = 2;
const IMAGE_TYPES = new Set(['image','character']);
const PROVENANCE_CREATOR_TYPES = new Set(['self','third-party']);
const PROVENANCE_BASES = new Set(['license','terms','class-provided']);

function isImageMemeType(type){return IMAGE_TYPES.has(type);}
function isHttpUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='http:' || url.protocol==='https:';
  }catch(_){return false;}
}
function provenanceValidationError(rights,path='이미지 출처 정보'){
  if(!rights || typeof rights!=='object') return `${path}가 없습니다.`;
  if(!PROVENANCE_CREATOR_TYPES.has(rights.creatorType)) return `${path}의 제작자 구분이 필요합니다.`;
  if(!Number.isFinite(rights.recordedAt)) return `${path}의 기록 시각이 없습니다.`;
  if(rights.creatorType==='self') return '';
  if(typeof rights.sourceUrl!=='string' || !rights.sourceUrl.trim()) return `${path}에 원본 출처 URL을 입력해야 합니다.`;
  if(!isHttpUrl(rights.sourceUrl.trim())) return `${path}의 원본 출처 URL은 http:// 또는 https://로 시작해야 합니다.`;
  if(!PROVENANCE_BASES.has(rights.permissionBasis)) return `${path}의 사용 허가 근거를 선택해야 합니다.`;
  if(typeof rights.permissionEvidence!=='string' || !rights.permissionEvidence.trim()) return `${path}의 사용 허가 근거 내용을 입력해야 합니다.`;
  return '';
}
function objectValidationError(o,index,{strict=true}={}){
  const p=`요소 ${index+1}`;
  if(!o || typeof o!=='object') return `${p}가 올바른 객체가 아닙니다.`;
  if(!Number.isFinite(o.memeId)) return `${p}.memeId가 없습니다.`;
  if(typeof o.memeName!=='string') return `${p}.memeName이 없습니다.`;
  if(!['text','emoji','image','character'].includes(o.memeType)) return `${p}.memeType이 올바르지 않습니다.`;
  for(const key of ['left','top','width','height','scaleX','scaleY','angle','opacity']){
    if(!Number.isFinite(o[key])) return `${p}.${key}가 없습니다.`;
  }
  if(isImageMemeType(o.memeType)){
    if(typeof o.src!=='string' || !o.src.trim()) return `${p}.src가 없습니다.`;
    if(strict){
      const rightsError=provenanceValidationError(o.rights,`${p}.rights`);
      if(rightsError) return rightsError;
    }
  }else{
    if(typeof o.text!=='string') return `${p}.text가 없습니다.`;
    if(!Number.isFinite(o.fontSize) || o.fontSize<=0) return `${p}.fontSize가 없습니다.`;
    if(typeof o.fontFamily!=='string' || !o.fontFamily.trim()) return `${p}.fontFamily가 없습니다.`;
  }
  return '';
}
function getTemplateValidationError(data,{strict=true}={}){
  if(!data || typeof data!=='object') return 'JSON 최상위 값이 객체여야 합니다.';
  if(data.format!=='meme-studio-template') return 'format이 meme-studio-template이어야 합니다.';
  if(strict && data.version!==TEMPLATE_SCHEMA_VERSION) return `version ${TEMPLATE_SCHEMA_VERSION} 형식의 JSON이어야 합니다.`;
  if(!strict && ![1,TEMPLATE_SCHEMA_VERSION].includes(data.version)) return '지원하지 않는 템플릿 version입니다.';
  if(typeof data.name!=='string' || !data.name.trim()) return 'name이 없습니다.';
  if(!aspectRatios[data.aspectRatio]) return 'aspectRatio가 없습니다.';
  if(typeof data.backgroundColor!=='string' || !data.backgroundColor.trim()) return 'backgroundColor가 없습니다.';
  if(typeof data.thumbnail!=='string') return 'thumbnail이 없습니다.';
  if(!Array.isArray(data.objects)) return 'objects 배열이 없습니다.';
  if(!Number.isFinite(data.savedAt)) return 'savedAt이 없습니다.';
  for(let i=0;i<data.objects.length;i++){
    const err=objectValidationError(data.objects[i],i,{strict});
    if(err) return err;
  }
  return '';
}
function validateTemplateData(data){return getTemplateValidationError(data,{strict:true})==='';}
function getStoredTemplateStatus(data){
  const strictError=getTemplateValidationError(data,{strict:true});
  if(!strictError) return {status:'ok'};
  const legacyError=getTemplateValidationError(data,{strict:false});
  if(!legacyError && data.version===1){
    return {status:'needs-metadata',error:'기존 v1 템플릿입니다. 불러온 뒤 새 v2 JSON 형식으로 다시 저장해 주세요.'};
  }
  if(!legacyError) return {status:'ok'};
  return {status:'corrupt',error:strictError};
}

function serializableObject(o){
  const out={
    memeId:o.memeId,memeName:o.memeName,memeType:o.memeType,left:o.left,top:o.top,width:o.width,height:o.height,
    scaleX:o.scaleX,scaleY:o.scaleY,angle:o.angle||0,opacity:o.opacity??1,fill:o.fill||'#111827',stroke:o.stroke||'#fff',
    strokeWidth:o.strokeWidth??10,text:o.text||'',fontSize:o.fontSize||72,fontFamily:o.fontFamily||'Arial Black, Noto Sans KR, sans-serif',
    paintFirst:o.paintFirst||'stroke',src:o.src||''
  };
  if(isImageMemeType(o.memeType)) out.rights=o.rights||null;
  return out;
}

function buildTemplateSnapshot(name,thumbnail){
  return {
    slot:null,
    format:'meme-studio-template',
    version:TEMPLATE_SCHEMA_VERSION,
    name,
    thumbnail,
    aspectRatio:state.aspectRatio,
    backgroundColor:editor.backgroundColor,
    objects:editor.getObjects().map(serializableObject),
    savedAt:Date.now()
  };
}

async function makeTemplateThumbnail(){
  const active=editor.getActiveObject();
  if(active)editor.discardActiveObject();
  editor.render();
  const data=canvas.toDataURL('image/png',0.55);
  if(active)editor.setActiveObject(active);
  return data;
}

async function migrateLegacyIndexedDbTemplates(){
  // One-time best-effort migration from older versions. Future saves/loads do not use IndexedDB.
  if(!('indexedDB' in window)) return;
  const marker='meme-studio-legacy-migrated-v1';
  if(localStorage.getItem(marker)) return;
  let request;
  try{ request=indexedDB.open('meme-studio-db',1); }catch(_){ localStorage.setItem(marker,'1'); return; }
  await new Promise(resolve=>{
    request.onerror=()=>resolve();
    request.onupgradeneeded=()=>resolve();
    request.onsuccess=async()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('templates')){db.close();resolve();return;}
      try{
        const tx=db.transaction('templates','readonly'),store=tx.objectStore('templates'),req=store.getAll();
        req.onsuccess=async()=>{
          try{
            const old=(req.result||[]).filter(x=>isValidSlot(x.slot));
            for(const t of old){
              if((await readTemplateJson(t.slot)).status==='missing'){
                await writeTemplateJson({slot:t.slot,format:'meme-studio-template',version:1,name:t.name||`템플릿 ${t.slot}`,thumbnail:t.thumbnail||'',aspectRatio:t.aspectRatio||'1:1',backgroundColor:t.backgroundColor||'#fff',objects:t.objects||[],savedAt:t.savedAt||Date.now()},{allowLegacy:true});
              }
            }
          }finally{db.close();resolve();}
        };
        req.onerror=()=>{db.close();resolve();};
      }catch(_){db.close();resolve();}
    };
  });
  localStorage.setItem(marker,'1');
}


const assets = [
  ['기본','assets/character-neutral.svg'],['웃음','assets/character-happy.svg'],['당황','assets/character-shock.svg'],
  ['화남','assets/character-angry.svg'],['울음','assets/character-sad.svg'],['졸림','assets/character-sleepy.svg'],
  ['사랑','assets/character-love.svg'],['부끄러움','assets/character-embarrassed.svg'],['안도','assets/character-relieved.svg'],
  ['각오','assets/character-determined.svg'],['멍함','assets/character-dazed.svg'],['뿌듯','assets/character-proud.svg']
];
const emojis = ['😂','😭','😡','😱','🥹','😎','🤡','💀','😵‍💫','🤦','👍','🔥','❤️','✨','💸','💤'];
const phrases = [
  {text:'쿠궁', fill:'#7c3aed', stroke:'#fff', strokeWidth:14, fontSize:92, angle:-5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'ㅠㅠ', fill:'#3b82f6', stroke:'#fff', strokeWidth:12, fontSize:96, angle:4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'ㅎㅎ', fill:'#f59e0b', stroke:'#fff', strokeWidth:12, fontSize:86, angle:-3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'ㅋㅋ', fill:'#ef4444', stroke:'#fff', strokeWidth:12, fontSize:88, angle:3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'짱이지?', fill:'#ec4899', stroke:'#fff', strokeWidth:12, fontSize:78, angle:-4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'ㄹㅇ', fill:'#111827', stroke:'#fff', strokeWidth:12, fontSize:88, angle:5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'ㄷㄷ', fill:'#0f766e', stroke:'#fff', strokeWidth:12, fontSize:88, angle:-5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'어라?', fill:'#2563eb', stroke:'#fff', strokeWidth:12, fontSize:78, angle:4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'헉', fill:'#dc2626', stroke:'#fff', strokeWidth:14, fontSize:98, angle:-6, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'엥?', fill:'#7c2d12', stroke:'#fff', strokeWidth:12, fontSize:86, angle:3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'실화냐', fill:'#111827', stroke:'#facc15', strokeWidth:10, fontSize:76, angle:-3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'킹받네', fill:'#be123c', stroke:'#fff', strokeWidth:12, fontSize:76, angle:5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'}
];
const resourcePhrases = [
  {text:'아ㅋㅋ', fill:'#111827', stroke:'#fff', strokeWidth:12, fontSize:86, angle:-4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'뭐임?', fill:'#2563eb', stroke:'#fff', strokeWidth:12, fontSize:82, angle:4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'잠시만', fill:'#7c3aed', stroke:'#fff', strokeWidth:12, fontSize:78, angle:-2, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'가보자고', fill:'#16a34a', stroke:'#fff', strokeWidth:12, fontSize:72, angle:3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'머쓱', fill:'#92400e', stroke:'#fff', strokeWidth:12, fontSize:82, angle:-5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'흠...', fill:'#475569', stroke:'#fff', strokeWidth:12, fontSize:82, angle:4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'나만 그래?', fill:'#db2777', stroke:'#fff', strokeWidth:12, fontSize:70, angle:-3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'끝났다', fill:'#dc2626', stroke:'#fff', strokeWidth:14, fontSize:84, angle:5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'오...?', fill:'#0891b2', stroke:'#fff', strokeWidth:12, fontSize:78, angle:-4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'납득완', fill:'#166534', stroke:'#fff', strokeWidth:12, fontSize:78, angle:4, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'아닌가', fill:'#334155', stroke:'#fff', strokeWidth:12, fontSize:76, angle:-3, fontFamily:'Arial Black, Noto Sans KR, sans-serif'},
  {text:'ㄱㄱ', fill:'#ea580c', stroke:'#fff', strokeWidth:12, fontSize:90, angle:5, fontFamily:'Arial Black, Noto Sans KR, sans-serif'}
];
const stickerAssets = [
  ['하트','assets/emojis/heart.svg'],['엄지척','assets/emojis/thumbsup.svg'],['분노','assets/emojis/anger.svg'],['땀방울','assets/emojis/sweat.svg'],
  ['눈물','assets/emojis/tears.svg'],['반짝','assets/emojis/sparkle.svg'],['불타는 중','assets/emojis/fire.svg'],['번개','assets/emojis/lightning.svg'],
  ['궁금','assets/emojis/question.svg'],['주의','assets/emojis/exclaim.svg'],['100점','assets/emojis/onehundred.svg']
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
    if(old){obj.memeName='캐릭터 · '+label;obj.src=url;obj.image=img;obj.rights=null;obj.width=img.naturalWidth||img.width;obj.height=img.naturalHeight||img.height;state.character=obj;editor.render();editor.emit('objects:changed');updateLayers();updateInspector();return;}
    obj.src=url;obj.image=img;obj.rights=null;obj.width=img.naturalWidth||700;obj.height=img.naturalHeight||700;obj.scaleX=.68;obj.scaleY=.68;obj.left=540;obj.top=590;state.character=obj;editor.add(obj);editor.sendToBack(obj);editor.setActiveObject(obj);updateLayers();updateInspector();
  });
}
function addText(preset='쿠궁'){
  const p=typeof preset==='string'?{text:preset}:preset;
  const o=makeObject({
    memeName:'문구 · '+p.text, memeType:'text', left:540, top:150, text:p.text,
    fontSize:p.fontSize||76, fill:p.fill||'#111827', stroke:p.stroke||'#fff',
    strokeWidth:p.strokeWidth ?? 12, fontWeight:900, fontFamily:p.fontFamily||'Arial Black, Noto Sans KR, sans-serif',
    angle:p.angle||0
  });
  measureObject(o);editor.add(o);editor.setActiveObject(o);updateLayers();updateInspector();
}
function addEmoji(emoji='😂'){const o=makeObject({memeName:'이모지 '+emoji,memeType:'emoji',left:820,top:260,text:emoji,fontSize:120,fill:'#111827',fontWeight:900,fontFamily:'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'});measureObject(o);editor.add(o);editor.setActiveObject(o);updateLayers();updateInspector()}
function addImageObject(src,name,type='image',left=540,top=540,max=500){loadImage(src,img=>{const nw=img.naturalWidth||img.width,nh=img.naturalHeight||img.height,s=Math.min(1,max/nw,max/nh);const o=makeObject({memeName:name,memeType:type,left,top,width:nw,height:nh,scaleX:s,scaleY:s,src,image:img,tint:false,rights:null});editor.add(o);editor.setActiveObject(o);updateLayers();updateInspector()})}
function addUploaded(src,name){addImageObject(src,name,'image',540,540,500)}
function addSvgSticker(url,label){addImageObject(url,'감정 · '+label,'image',800,760,280)}

let quickHelpTimer=null;
let quickHelpCard=null;
function hideQuickHelp(){
  clearTimeout(quickHelpTimer);
  quickHelpTimer=null;
  quickHelpCard=null;
  const el=$('quickHelp');
  if(!el)return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden','true');
}
function showQuickHelp(card){
  const el=$('quickHelp');
  if(!el || !card || !document.documentElement.contains(card))return;
  quickHelpCard=card;
  el.classList.add('show');
  el.setAttribute('aria-hidden','false');
}
function armQuickHelp(card){
  clearTimeout(quickHelpTimer);
  quickHelpTimer=setTimeout(()=>{
    // Only show if this exact template card is still hovered after 3 seconds.
    if(quickHelpCard===card && document.documentElement.contains(card) && card.matches(':hover')){
      showQuickHelp(card);
    }
  },3000);
}
function bindQuickHelp(card){
  const enter=()=>{
    hideQuickHelp();
    quickHelpCard=card;
    armQuickHelp(card);
  };
  const leave=()=>{
    if(quickHelpCard===card) hideQuickHelp();
  };
  card.addEventListener('pointerenter',enter);
  card.addEventListener('pointerleave',leave);
  // Fallback for browsers/input modes that do not expose pointer events reliably.
  card.addEventListener('mouseenter',enter);
  card.addEventListener('mouseleave',leave);
}
window.addEventListener('scroll',hideQuickHelp,{passive:true});
window.addEventListener('blur',hideQuickHelp);
document.addEventListener('pointerdown',e=>{
  if(quickHelpCard && !quickHelpCard.contains(e.target)) hideQuickHelp();
},{passive:true});
document.addEventListener('pointermove',e=>{
  if(quickHelpCard && !quickHelpCard.contains(e.target)) hideQuickHelp();
},{passive:true});

async function exportTemplateJson(slot){
  const result=await readTemplateJson(slot);
  if(result.status!=='ok'){toast('출처 정보가 완성된 정상 템플릿 JSON만 내보낼 수 있습니다.');return;}
  const blob=new Blob([JSON.stringify(result.data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=templateFileName(slot);a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`템플릿 ${slot}번 JSON을 내보냈습니다.`);
}
async function restoreTemplateJsonFile(file,slot){
  if(!file)return;
  try{
    const text=await file.text();
    let data;
    try{data=JSON.parse(text);}catch(_){throw new Error('JSON 문법이 올바르지 않습니다.');}
    const validationError=getTemplateValidationError(data,{strict:true});
    if(validationError) throw new Error(validationError);
    data.slot=slot;
    await writeTemplateJson(data);
    await renderTemplateSlots();
    toast(`템플릿 ${slot}번을 JSON으로 복원했습니다.`);
  }catch(e){toast(`JSON 복원 실패: ${e.message||'잘못된 JSON 파일입니다.'}`)}
}
async function promptRestoreSlot(slot){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=()=>restoreTemplateJsonFile(input.files?.[0],slot);input.click();
}

async function renderTemplateSlots(){
  const box=$('templateSlots');
  if(!box)return;
  try{
    hideQuickHelp();
    const templates=await getTemplates();
    const count=$('templateCount');
    const occupied=templates.filter(t=>t.status!=='missing').length;
    if(count)count.textContent=`${occupied}/3`;
    const mode=$('templateStorageMode');
    if(mode)mode.textContent=templates.storageMode==='opfs'?'JSON 파일 저장':'JSON 데이터 저장(브라우저 호환 모드)';
    box.innerHTML='';
    for(let slot=1;slot<=TEMPLATE_STORE.max;slot++){
      const t=templates.find(x=>x.slot===slot);
      const card=document.createElement('div');card.className='template-slot';
      if(!t || t.status==='missing'){
        card.classList.add('empty');
        card.innerHTML=`<div><strong>슬롯 ${slot}</strong><div>비어 있음</div><button class="restore-slot">JSON으로 복원</button></div>`;
        card.querySelector('.restore-slot').onclick=()=>promptRestoreSlot(slot);
        box.appendChild(card);continue;
      }
      if(t.status==='needs-metadata'){
        const data=t.data;
        card.classList.add('needs-metadata');
        card.innerHTML=`<div class="template-preview"><img src="${data.thumbnail||''}" alt="${escapeHtml(data.name)} 미리보기"></div><div class="template-meta"><span class="template-name">${escapeHtml(data.name)}</span><span class="panel-count">${slot}</span></div><div class="template-error">${escapeHtml(t.error||'이미지 출처 정보가 필요합니다.')}</div><div class="template-actions"><button class="load-template">불러오기</button><button class="delete-template">삭제</button></div><div class="template-actions single"><button class="export-template">JSON 내보내기</button><button class="restore-slot">JSON 복원</button></div>`;
        card.querySelector('.load-template').onclick=()=>loadTemplate(slot);
        card.querySelector('.export-template').onclick=()=>toast('출처 정보가 없는 구버전 템플릿은 내보낼 수 없습니다. 불러온 뒤 새로 저장해 주세요.');
        card.querySelector('.restore-slot').onclick=()=>promptRestoreSlot(slot);
        card.querySelector('.delete-template').onclick=async()=>{if(!confirm(`'${data.name}' 템플릿을 삭제할까요?`))return;try{await deleteTemplate(slot);hideQuickHelp();await renderTemplateSlots();toast('템플릿을 삭제했습니다.')}catch(e){toast(e.message)}};
        bindQuickHelp(card);box.appendChild(card);continue;
      }
      if(t.status==='corrupt'){
        card.classList.add('corrupt');
        card.innerHTML=`<div><strong>슬롯 ${slot} · 손상됨</strong><div class="template-error">${escapeHtml(t.error||'템플릿 JSON을 읽을 수 없습니다.')}</div><div class="template-actions single"><button class="restore-slot">정상 JSON으로 복원</button><button class="delete-template">삭제</button></div></div>`;
        card.querySelector('.restore-slot').onclick=()=>promptRestoreSlot(slot);
        card.querySelector('.delete-template').onclick=async()=>{if(!confirm(`손상된 슬롯 ${slot}을 삭제할까요?`))return;try{await deleteTemplate(slot);hideQuickHelp();await renderTemplateSlots();toast('템플릿을 삭제했습니다.')}catch(e){toast(e.message)}};
        bindQuickHelp(card);box.appendChild(card);continue;
      }
      const data=t.data;
      card.innerHTML=`<div class="template-preview"><img src="${data.thumbnail||''}" alt="${escapeHtml(data.name)} 미리보기"></div><div class="template-meta"><span class="template-name">${escapeHtml(data.name)}</span><span class="panel-count">${slot}</span></div><div class="template-actions"><button class="load-template">불러오기</button><button class="delete-template">삭제</button><button class="export-template">JSON 내보내기</button><button class="restore-slot">JSON 복원</button></div>`;
      card.querySelector('.load-template').onclick=()=>loadTemplate(slot);
      card.querySelector('.export-template').onclick=()=>exportTemplateJson(slot);
      card.querySelector('.restore-slot').onclick=()=>promptRestoreSlot(slot);
      card.querySelector('.delete-template').onclick=async()=>{if(!confirm(`'${data.name}' 템플릿을 삭제할까요?`))return;try{await deleteTemplate(slot);hideQuickHelp();await renderTemplateSlots();toast('템플릿을 삭제했습니다.')}catch(e){toast(e.message)}};
      bindQuickHelp(card);
      box.appendChild(card);
    }
  }catch(e){
    const count=$('templateCount');if(count)count.textContent='저장 불가';
    box.innerHTML='<div class="template-slot empty">JSON 저장소를 사용할 수 없습니다.</div>';
  }
}
function provenanceLabel(rights){
  if(rights?.creatorType==='self') return '본인 제작';
  const map={license:'라이선스',terms:'이용약관', 'class-provided':'수업 제공 표기'};
  return map[rights?.permissionBasis]||'출처 정보 필요';
}
function getImagesNeedingProvenance(objects){
  return objects.filter(o=>isImageMemeType(o.memeType) && (!o.rights || provenanceValidationError(o.rights))); 
}
function openProvenanceDialog(objects){
  const targets=getImagesNeedingProvenance(objects);
  if(!targets.length) return Promise.resolve(true);
  return new Promise(resolve=>{
    const overlay=$('provenanceModal');
    const list=$('provenanceList');
    const cancel=$('provenanceCancel');
    const confirmBtn=$('provenanceConfirm');
    if(!overlay||!list||!cancel||!confirmBtn){resolve(false);return;}
    list.innerHTML='';
    targets.forEach((o,index)=>{
      const row=document.createElement('div');row.className='provenance-row';row.dataset.index=index;
      const creator=o.rights?.creatorType||'self';
      const basis=o.rights?.permissionBasis||'license';
      const thumb=o.src?`<img src="${o.src}" alt="">`:'';
      row.innerHTML=`<div class="provenance-head"><div class="provenance-thumb">${thumb}</div><div><strong>${escapeHtml(o.memeName||'이미지')}</strong><div class="provenance-help">템플릿 JSON에 저장할 제작/출처 정보</div></div></div>
        <label>제작자 구분<select class="provenance-creator"><option value="self" ${creator==='self'?'selected':''}>본인 제작</option><option value="third-party" ${creator==='third-party'?'selected':''}>본인 제작 아님</option></select></label>
        <div class="third-party-fields ${creator==='third-party'?'':'hidden'}">
          <label>원본 출처 URL<input class="provenance-url" type="url" placeholder="https://example.com/source" value="${escapeHtml(o.rights?.sourceUrl||'')}"></label>
          <label>사용 허가 근거<select class="provenance-basis">
            <option value="license" ${basis==='license'?'selected':''}>라이선스명</option>
            <option value="terms" ${basis==='terms'?'selected':''}>이용약관</option>
            <option value="class-provided" ${basis==='class-provided'?'selected':''}>수업 제공 표기</option>
          </select></label>
          <label class="provenance-evidence-label">허가 근거 내용<input class="provenance-evidence" type="text" placeholder="예: CC BY 4.0 / 이용약관 제5조 / 수업 제공 이미지" value="${escapeHtml(o.rights?.permissionEvidence||'')}"></label>
        </div>`;
      const creatorEl=row.querySelector('.provenance-creator');
      const fields=row.querySelector('.third-party-fields');
      creatorEl.onchange=()=>fields.classList.toggle('hidden',creatorEl.value!=='third-party');
      list.appendChild(row);
    });
    overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');
    const close=(ok)=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');resolve(ok)};
    cancel.onclick=()=>close(false);
    confirmBtn.onclick=()=>{
      const errors=[];
      [...list.querySelectorAll('.provenance-row')].forEach((row,i)=>{
        const o=targets[i];
        const creator=row.querySelector('.provenance-creator').value;
        if(creator==='self'){
          o.rights={creatorType:'self',sourceUrl:'',permissionBasis:'',permissionEvidence:'',recordedAt:Date.now()};
        }else{
          o.rights={creatorType:'third-party',sourceUrl:row.querySelector('.provenance-url').value.trim(),permissionBasis:row.querySelector('.provenance-basis').value,permissionEvidence:row.querySelector('.provenance-evidence').value.trim(),recordedAt:Date.now()};
        }
        const err=provenanceValidationError(o.rights,`${o.memeName||'이미지'} 출처 정보`);if(err)errors.push(err);
      });
      if(errors.length){toast(errors[0]);return;}
      close(true);
    };
  });
}

async function saveTemplate(){
  const name=(prompt('템플릿 이름을 입력하세요.','내 밈')||'').trim();
  if(!name)return;
  try{
    const templates=await getTemplates();
    const occupied=new Set(templates.filter(t=>t.status!=='missing').map(t=>t.slot));
    let slot=[1,2,3].find(n=>!occupied.has(n));
    if(!slot){
      const answer=prompt('저장할 슬롯을 골라주세요. 1, 2, 3 중 하나를 입력하면 해당 JSON 파일을 덮어씁니다.');
      slot=Number(answer);
      if(!isValidSlot(slot)){toast('저장이 취소되었습니다.');return;}
      const existing=templates.find(t=>t.slot===slot);
      const existingName=existing?.data?.name||`슬롯 ${slot}`;
      if(existing&&!confirm(`슬롯 ${slot}의 '${existingName}' JSON 파일을 덮어쓸까요?`))return;
    }
    const thumbnail=await makeTemplateThumbnail();
    const snapshot=buildTemplateSnapshot(name,thumbnail);
    const needs=getImagesNeedingProvenance(snapshot.objects);
    if(needs.length){
      const ok=await openProvenanceDialog(snapshot.objects);
      if(!ok){toast('출처 정보 입력이 취소되어 기존 템플릿을 유지했습니다.');return;}
    }
    snapshot.slot=slot;
    const validationError=getTemplateValidationError(snapshot,{strict:true});
    if(validationError){toast(`저장 거부: ${validationError}`);return;}
    // writeTemplateJson validates again before touching the existing file, so an invalid snapshot cannot overwrite it.
    await writeTemplateJson(snapshot);
    await renderTemplateSlots();
    toast(`템플릿 ${slot}번 JSON 파일에 저장했습니다.`);
  }catch(e){toast(e.message||'템플릿 저장에 실패했습니다.')}
}

function loadImageData(src){
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('저장된 이미지를 불러오지 못했습니다.'));img.src=src;});
}
async function loadTemplate(slot){
  try{
    const result=await readTemplateJson(slot);
    if(result.status==='missing'){toast('비어 있는 슬롯입니다.');return;}
    if(result.status==='corrupt'){toast(`템플릿 ${slot}번이 손상되었습니다. 정상 JSON으로 복원해 주세요.`);return;}
    if(result.status==='needs-metadata'){toast('기존 템플릿입니다. 불러온 뒤 이미지 출처 정보를 입력하고 새로 저장해 주세요.');}
    const t=result.data;
    state.charRequest++;
    editor.clear();
    editor.backgroundColor=t.backgroundColor||'#fff';
    const size=aspectRatios[t.aspectRatio]||aspectRatios['1:1'];
    canvas.width=size.width;canvas.height=size.height;state.aspectRatio=t.aspectRatio||'1:1';updateRatioUI();
    state.id=0;state.character=null;
    const restored=[];
    for(const raw of (t.objects||[])){
      const o=makeObject({...raw,memeId:raw.memeId||nextId()});
      if(o.memeId>state.id)state.id=o.memeId;
      if(o.src){o.image=await loadImageData(o.src);}
      restored.push(o);
    }
    restored.forEach(o=>editor.add(o));
    state.character=restored.find(o=>o.memeType==='character')||null;
    editor.discardActiveObject();editor.render();updateLayers();updateInspector();
    document.querySelectorAll('.char-btn').forEach(b=>b.classList.remove('active'));
    toast(`'${t.name}' 템플릿을 불러왔습니다.`);
  }catch(e){toast(e.message||'템플릿을 불러오지 못했습니다.')}
}

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
  const allowedExt=new Set(['png','jpg','jpeg','webp','svg']);
  const allowedMime=new Set(['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']);
  if(!allowedExt.has(ext)){
    return `지원하지 않는 형식의 파일입니다. '${file.name}'은 지원되지 않습니다. PNG, JPEG, WEBP, SVG만 추가할 수 있습니다.`;
  }
  if(file.type && !allowedMime.has(file.type.toLowerCase())){
    return `지원하지 않는 형식의 파일입니다. '${file.name}'의 파일 형식(${file.type})은 PNG, JPEG, WEBP, SVG만 지원합니다.`;
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
      rejected.push(`지원하지 않는 형식의 파일입니다. '${file.name}'을(를) 브라우저에서 읽을 수 없습니다.`);
      showUploadStatus(`파일 추가 실패: ${rejected.join(' ')}`,true);
    };
    reader.readAsDataURL(file);
  });
  if(rejected.length){
    const successText=acceptedCount?`${acceptedCount}개 파일은 추가했습니다. `:'';
    showUploadStatus(`${successText}${rejected.length}개 파일은 추가하지 않았습니다. ${rejected.join(' ')}`,true);
    toast(rejected[0]);
  }else{
    showUploadStatus(`${acceptedCount}개 파일을 업로드했습니다.`,false);
    toast(`${acceptedCount}개 파일을 추가했습니다.`);
  }
  e.target.value='';
};
$('templateJsonImport').onchange=async e=>{
  const file=e.target.files?.[0];
  e.target.value='';
  if(!file)return;
  const slot=Number(prompt('복원할 템플릿 슬롯을 입력하세요. 1, 2, 3','1'));
  if(!isValidSlot(slot)){toast('복원이 취소되었습니다. 슬롯은 1, 2, 3 중 하나여야 합니다.');return;}
  await restoreTemplateJsonFile(file,slot);
};

$('newBtn').onclick=()=>{if(confirm('현재 밈을 지우고 새로 시작할까요?')){editor.clear();editor.backgroundColor='#fff';state.character=null;state.charRequest=0;addCharacter('assets/character-neutral.svg','기본')}};
$('saveTemplateBtn').onclick=saveTemplate;
$('downloadBtn').onclick=()=>{const data=editor.toDataURL();const a=document.createElement('a');a.href=data;a.download='meme-'+Date.now()+'.png';a.click();updateInspector();toast('PNG로 저장했습니다.')};

editor.on('selection:created',()=>{updateInspector();updateLayers()});editor.on('selection:cleared',()=>{updateInspector();updateLayers()});editor.on('object:modified',()=>{updateInspector();updateLayers()});editor.on('objects:changed',updateLayers);

assets.forEach(([label,url],i)=>{const b=document.createElement('button');b.className='char-btn';b.title=label;b.innerHTML=`<img src="${url}" alt="${label}">`;b.onclick=()=>{document.querySelectorAll('.char-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');addCharacter(url,label)};$('characterGrid').appendChild(b);if(i===0)b.classList.add('active')});
emojis.forEach(e=>{const b=document.createElement('button');b.className='emoji-btn';b.textContent=e;b.title='이모지 추가';b.onclick=()=>addEmoji(e);$('emojiRow').appendChild(b)});
backgrounds.forEach(c=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.title=c;b.onclick=()=>{editor.backgroundColor=c;editor.render()};$('backgroundSwatches').appendChild(b)});
phrases.forEach(p=>{const b=document.createElement('button');b.className='chip phrase-chip';b.textContent=p.text;b.style.setProperty('--phrase-fill',p.fill||'#111827');b.style.setProperty('--phrase-rotate',((p.angle||0)/2)+'deg');b.onclick=()=>addText(p);$('phraseChips').appendChild(b)});
stickerAssets.forEach(([label,url])=>{const b=document.createElement('button');b.className='sticker-btn';b.title=label;b.innerHTML=`<img src="${url}" alt="${label}"><span>${escapeHtml(label)}</span>`;b.onclick=()=>addSvgSticker(url,label);$('stickerGrid').appendChild(b)});
resourcePhrases.forEach(p=>{const b=document.createElement('button');b.className='chip resource-chip phrase-chip';b.textContent=p.text;b.style.setProperty('--phrase-fill',p.fill||'#111827');b.style.setProperty('--phrase-rotate',((p.angle||0)/2)+'deg');b.onclick=()=>addText(p);$('resourcePhraseChips').appendChild(b)});

document.querySelectorAll('.ratio-btn').forEach(btn=>{btn.onclick=()=>setAspectRatio(btn.dataset.ratio)});
updateRatioUI();

editor.backgroundColor='#fff';addCharacter('assets/character-neutral.svg','기본');
migrateLegacyIndexedDbTemplates().finally(()=>renderTemplateSlots());
window.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&state.selected&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&state.selected.memeType!=='character')$('deleteBtn').click();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();$('duplicateBtn').click()}});
