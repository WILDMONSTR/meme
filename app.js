const fabricCanvas = new fabric.Canvas('canvas', { preserveObjectStacking:true, selection:true, backgroundColor:'#fff' });
fabricCanvas.setDimensions({width:1080,height:1080});

const $ = id => document.getElementById(id);
const state = { selected:null, character:null, id:0 };
const assets = [
  ['기본','assets/character-neutral.svg'],['웃음','assets/character-happy.svg'],['당황','assets/character-shock.svg'],
  ['화남','assets/character-angry.svg'],['울음','assets/character-sad.svg'],['졸림','assets/character-sleepy.svg'],
  ['사랑','assets/character-love.svg'],['부끄러움','assets/character-embarrassed.svg'],['안도','assets/character-relieved.svg'],
  ['각오','assets/character-determined.svg'],['멍함','assets/character-dazed.svg'],['뿌듯','assets/character-proud.svg']
];
const emojis=['😂','😭','😡','😱','🥹','😎','🤡','💀','😵‍💫','🤦','👍','🔥','❤️','✨','💸','💤'];
const phrases=['오늘은 진짜 한다','일단 누워있자','내일부터 해야지','이게 왜 안 되지?','나만 그런 거 아니지?','퇴근하고 싶다','아무튼 성공','계획은 완벽했다'];
const resourcePhrases=['나 진짜 몰랐음','잠깐만 생각해볼게','이건 좀 아닌데?','일단 해보자','생각보다 괜찮은데?','망했다','살려주세요','왜 나만 이러지?','오늘도 평화롭다','이게 맞아?','일은 하기 싫다','과제 제출 완료'];
const stickerAssets=[
  ['ㅋㅋ 눈물','assets/emojis/laugh-tears.svg'],['울음','assets/emojis/cry.svg'],['분노','assets/emojis/angry.svg'],['충격','assets/emojis/shock.svg'],
  ['사랑','assets/emojis/love.svg'],['멋짐','assets/emojis/cool.svg'],['광대','assets/emojis/clown.svg'],['멘붕','assets/emojis/skull.svg'],
  ['어질어질','assets/emojis/dizzy.svg'],['식은땀','assets/emojis/sweat.svg'],['불타는 중','assets/emojis/fire.svg'],['하트','assets/emojis/heart.svg'],
  ['반짝','assets/emojis/sparkles.svg'],['돈','assets/emojis/money.svg'],['졸림','assets/emojis/sleep.svg'],['궁금','assets/emojis/question.svg'],
  ['당황','assets/emojis/exclaim.svg'],['완료','assets/emojis/check.svg'],['상처','assets/emojis/broken-heart.svg'],['축하','assets/emojis/party.svg']
];
const backgrounds=['#ffffff','#f8f4ed','#eef6ff','#fff0f0','#f3f0ff','#eaf8ee','#fff9c4','#111827'];

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1800)}
function nextId(){return ++state.id}
function addMeta(obj,name,type){obj.memeName=name;obj.memeType=type;obj.memeId=nextId();return obj}

function addCharacter(url,label='기본'){
  fabric.Image.fromURL(url,(img)=>{
    img.set({left:540,top:590,originX:'center',originY:'center',scaleX:.68,scaleY:.68,selectable:true});
    addMeta(img,'캐릭터 · '+label,'character');
    if(state.character) fabricCanvas.remove(state.character);
    state.character=img;fabricCanvas.add(img);fabricCanvas.sendToBack(img);fabricCanvas.setActiveObject(img);fabricCanvas.renderAll();updateLayers();updateInspector();
  },{crossOrigin:'anonymous'});
}

function addText(text='오늘은 진짜 한다'){
  const o=addMeta(new fabric.IText(text,{left:540,top:150,originX:'center',fontFamily:'Arial Black, Noto Sans KR, sans-serif',fontSize:72,fontWeight:'900',fill:'#111827',stroke:'#fff',strokeWidth:10,paintFirst:'stroke',textAlign:'center'}),'문구','text');
  fabricCanvas.add(o);fabricCanvas.setActiveObject(o);fabricCanvas.renderAll();updateLayers();updateInspector();o.enterEditing();o.selectAll();
}
function addEmoji(emoji='😂'){
  const o=addMeta(new fabric.IText(emoji,{left:820,top:260,originX:'center',fontFamily:'Apple Color Emoji, Segoe UI Emoji, sans-serif',fontSize:120,fill:'#111827'}),'이모지 '+emoji,'emoji');
  fabricCanvas.add(o);fabricCanvas.setActiveObject(o);fabricCanvas.renderAll();updateLayers();updateInspector();
}
function addUploaded(src,name){fabric.Image.fromURL(src,(img)=>{const max=500;const s=Math.min(1,max/img.width,max/img.height);img.set({left:540,top:540,originX:'center',originY:'center',scaleX:s,scaleY:s});addMeta(img,name,'image');fabricCanvas.add(img);fabricCanvas.setActiveObject(img);fabricCanvas.renderAll();updateLayers();updateInspector();},{crossOrigin:'anonymous'})}
function addSvgSticker(url,label){fabric.Image.fromURL(url,(img)=>{const max=280;const s=Math.min(1,max/img.width,max/img.height);img.set({left:800,top:760,originX:'center',originY:'center',scaleX:s,scaleY:s});addMeta(img,'감정 · '+label,'image');fabricCanvas.add(img);fabricCanvas.setActiveObject(img);fabricCanvas.renderAll();updateLayers();updateInspector();},{crossOrigin:'anonymous'})}

function updateLayers(){const box=$('layers');box.innerHTML='';const objs=fabricCanvas.getObjects().slice().reverse();objs.forEach((o,i)=>{const row=document.createElement('div');row.className='layer'+(o===fabricCanvas.getActiveObject()?' active':'');row.innerHTML=`<span class="layer-icon">${o.memeType==='character'?'🐱':o.memeType==='emoji'?'😊':o.memeType==='text'?'T':'🖼️'}</span><span class="layer-name">${escapeHtml(o.memeName||'요소')}</span>`;row.onclick=()=>{fabricCanvas.setActiveObject(o);fabricCanvas.renderAll();updateLayers();updateInspector()};box.appendChild(row)})}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function updateInspector(){const o=fabricCanvas.getActiveObject();state.selected=o;$('emptyInspector').classList.toggle('hidden',!o);$('inspectorControls').classList.toggle('hidden',!o);if(!o)return;$('objectName').value=o.memeName||'';$('posX').value=Math.round(o.left);$('posY').value=Math.round(o.top);$('objWidth').value=Math.round(o.getScaledWidth());$('objHeight').value=Math.round(o.getScaledHeight());$('objAngle').value=Math.round(o.angle||0);$('objOpacity').value=Math.round((o.opacity??1)*100);const color=$('objColor');let fill=o.fill;if(typeof fill==='string'&&fill.startsWith('#'))color.value=fill;else if(o.memeType==='text'||o.memeType==='emoji')color.value='#111827';$('colorControl').classList.toggle('hidden',!(o.memeType==='text'||o.memeType==='emoji'||o.memeType==='image'))}
function applyGeometry(){const o=state.selected;if(!o)return;o.set({left:+$('posX').value||0,top:+$('posY').value||0,angle:+$('objAngle').value||0,opacity:(+$('objOpacity').value||0)/100});const w=Math.max(1,+$('objWidth').value||1),h=Math.max(1,+$('objHeight').value||1);o.scaleX=w/(o.width||1);o.scaleY=h/(o.height||1);o.setCoords();fabricCanvas.renderAll();updateLayers()}

$('addTextBtn').onclick=()=>addText();$('addEmojiBtn').onclick=()=>addEmoji();$('deleteBtn').onclick=()=>{const o=state.selected;if(o&&o.memeType!=='character'){fabricCanvas.remove(o);fabricCanvas.discardActiveObject();fabricCanvas.renderAll();updateLayers();updateInspector()}else if(o){toast('캐릭터는 삭제할 수 없어요. 표정만 바꿔보세요.')}};$('duplicateBtn').onclick=()=>{const o=state.selected;if(!o)return;o.clone(clone=>{clone.set({left:o.left+30,top:o.top+30});addMeta(clone,(o.memeName||'요소')+' 복사',o.memeType);fabricCanvas.add(clone);fabricCanvas.setActiveObject(clone);fabricCanvas.renderAll();updateLayers();updateInspector()})};$('frontBtn').onclick=()=>{if(state.selected){fabricCanvas.bringToFront(state.selected);fabricCanvas.renderAll();updateLayers()}};$('backBtn').onclick=()=>{if(state.selected){fabricCanvas.sendToBack(state.selected);if(state.character)fabricCanvas.sendToBack(state.character);fabricCanvas.renderAll();updateLayers()}};
$('objectName').oninput=e=>{if(state.selected){state.selected.memeName=e.target.value;updateLayers()}};['posX','posY','objWidth','objHeight','objAngle'].forEach(id=>$(id).onchange=applyGeometry);$('objOpacity').oninput=applyGeometry;$('objColor').oninput=e=>{const o=state.selected;if(!o)return;const c=e.target.value;if(o.memeType==='text'||o.memeType==='emoji'){o.set('fill',c)}else if(o.memeType==='image'){o.filters=(o.filters||[]).filter(f=>!(f instanceof fabric.Image.filters.Tint));o.filters.push(new fabric.Image.filters.Tint({color:c,opacity:.65}));o.applyFilters()}fabricCanvas.renderAll()};

$('imageUpload').onchange=e=>{[...e.target.files].forEach(file=>{const reader=new FileReader();reader.onload=ev=>addUploaded(ev.target.result,file.name);reader.readAsDataURL(file)});e.target.value=''};
$('newBtn').onclick=()=>{if(confirm('현재 밈을 지우고 새로 시작할까요?')){fabricCanvas.clear();fabricCanvas.backgroundColor='#fff';state.character=null;addCharacter('assets/character-neutral.svg','기본')}};
$('downloadBtn').onclick=()=>{fabricCanvas.discardActiveObject();fabricCanvas.renderAll();const data=fabricCanvas.toDataURL({format:'png',quality:1,multiplier:1});const a=document.createElement('a');a.href=data;a.download='meme-'+Date.now()+'.png';a.click();updateInspector();toast('PNG로 저장했습니다.')};

fabricCanvas.on('selection:created',updateInspector);fabricCanvas.on('selection:updated',updateInspector);fabricCanvas.on('selection:cleared',updateInspector);fabricCanvas.on('object:modified',()=>{updateInspector();updateLayers()});fabricCanvas.on('object:moving',updateInspector);fabricCanvas.on('object:scaling',updateInspector);fabricCanvas.on('object:rotating',updateInspector);

assets.forEach(([label,url],i)=>{const b=document.createElement('button');b.className='char-btn';b.title=label;b.innerHTML=`<img src="${url}" alt="${label}">`;b.onclick=()=>{document.querySelectorAll('.char-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');addCharacter(url,label)};$('characterGrid').appendChild(b);if(i===0)b.classList.add('active')});
emojis.forEach(e=>{const b=document.createElement('button');b.className='emoji-btn';b.textContent=e;b.title='이모지 추가';b.onclick=()=>addEmoji(e);$('emojiRow').appendChild(b)});
backgrounds.forEach(c=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.title=c;b.onclick=()=>{fabricCanvas.backgroundColor=c;fabricCanvas.renderAll()};$('backgroundSwatches').appendChild(b)});
phrases.forEach(p=>{const b=document.createElement('button');b.className='chip';b.textContent=p;b.onclick=()=>addText(p);$('phraseChips').appendChild(b)});
stickerAssets.forEach(([label,url])=>{const b=document.createElement('button');b.className='sticker-btn';b.title=label;b.innerHTML=`<img src="${url}" alt="${label}"><span>${escapeHtml(label)}</span>`;b.onclick=()=>addSvgSticker(url,label);$('stickerGrid').appendChild(b)});
resourcePhrases.forEach(p=>{const b=document.createElement('button');b.className='chip resource-chip';b.textContent=p;b.onclick=()=>addText(p);$('resourcePhraseChips').appendChild(b)});

fabricCanvas.backgroundColor='#fff';addCharacter('assets/character-neutral.svg','기본');

window.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&state.selected&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&state.selected.memeType!=='character'){$('deleteBtn').click()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();$('duplicateBtn').click()}});
