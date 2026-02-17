// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════
const TEACHER_PASSCODE = '1234'; // change this!

const TOPIC_SUGGESTIONS = [
  'My favorite animal','Why I love recess','My best day ever',
  'Something I learned','My favorite food','A place I love',
  'A person I admire','Why reading is fun'
];

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
const S = {
  step:0, studentName:'', topic:'', details:[],
  topicOptions:[], concludingOptions:[],
  topicChoice:null, concludingChoice:null,
  awaitingChoice:null,
  recognition:null, isRecording:false,
  sessionStart:new Date()
};

const STEP = {WELCOME:0,NAME:1,TOPIC:2,D1:3,D2:4,D3:5,TOPIC_CH:6,TRANS:7,CONC_CH:8,DONE:9};
const PROGRESS = {0:3,1:8,2:16,3:28,4:42,5:56,6:68,7:78,8:88,9:100};
const STARS    = {0:'⭐',1:'⭐',2:'⭐',3:'⭐⭐',4:'⭐⭐',5:'⭐⭐⭐',6:'⭐⭐⭐',7:'⭐⭐⭐⭐',8:'⭐⭐⭐⭐',9:'⭐⭐⭐⭐⭐'};

// ══════════════════════════════════════
// TTS
// ══════════════════════════════════════
let currentAudio = null;
let audioAborted = false;

function cleanText(html){
  return html.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,'').replace(/\s+/g,' ').trim();
}

async function speakText(rawText, btn){
  const text = cleanText(rawText);
  
  if(btn && btn.classList.contains('speaking')){
    audioAborted = true;
    if(currentAudio){
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    btn.classList.remove('speaking');
    btn.textContent='🔊 Read to me';
    return;
  }
  
  // Stop other audio
  audioAborted = false;
  if(currentAudio){
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  document.querySelectorAll('.read-aloud-btn').forEach(b=>{
    b.classList.remove('speaking');
    b.textContent='🔊 Read to me';
  });
  
  try {
    if(btn){
      btn.classList.add('speaking');
      btn.textContent='🔊 Stop';
    }
    
    const response = await fetch('/api/synthesize-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if(!response.ok) throw new Error('TTS request failed');
    
    if(audioAborted) return;
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    currentAudio = new Audio(audioUrl);
    
    currentAudio.onended = currentAudio.onerror = ()=>{
      if(btn){
        btn.classList.remove('speaking');
        btn.textContent='🔊 Read to me';
      }
      URL.revokeObjectURL(audioUrl);
    };
    
    currentAudio.play();
  } catch(error) {
    console.error('TTS error:', error);
    if(btn){
      btn.classList.remove('speaking');
      btn.textContent='🔊 Read to me';
    }
  }
}

// ══════════════════════════════════════
// RENDER HELPERS
// ══════════════════════════════════════
function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function scrollChatToBottom(){
  const area = document.getElementById('chatArea');
  if(!area) return;
  const scrollRoot = document.scrollingElement || document.documentElement;
  requestAnimationFrame(()=>{
    const last = area.lastElementChild;
    if(last) last.scrollIntoView({behavior:'smooth',block:'end'});
    scrollRoot.scrollTo({top: scrollRoot.scrollHeight, behavior:'smooth'});
  });
}

function addPal(html){
  const area=document.getElementById('chatArea');
  const m=document.createElement('div');
  m.className='message pal';
  m.innerHTML=`<div class="avatar">🦉</div>
    <div class="bubble-wrap">
      <div class="bubble">${html}</div>
      <button class="read-aloud-btn" onclick="speakText(this.closest('.bubble-wrap').querySelector('.bubble').innerHTML,this)">🔊 Read to me</button>
    </div>`;
  area.appendChild(m);
  scrollChatToBottom();
}

function addStudent(text){
  const area=document.getElementById('chatArea');
  const m=document.createElement('div');
  m.className='message student';
  const safe=esc(text);
  m.innerHTML=`<div class="avatar">😊</div>
    <div class="bubble-wrap">
      <div class="bubble">${safe}</div>
      <button class="read-aloud-btn" onclick="speakText('${safe.replace(/'/g,"\\'")}',this)">🔊 Read to me</button>
    </div>`;
  area.appendChild(m);
  scrollChatToBottom();
}

function addLoader(){
  const area=document.getElementById('chatArea');
  const m=document.createElement('div');
  m.className='message pal'; m.id='loaderMsg';
  m.innerHTML=`<div class="avatar">🦉</div><div class="bubble-wrap"><div class="bubble"><div class="loading"><span></span><span></span><span></span></div></div></div>`;
  area.appendChild(m); scrollChatToBottom();
}

function removeLoader(){const el=document.getElementById('loaderMsg');if(el)el.remove();}

function updateProgress(){
  document.getElementById('progressFill').style.width=(PROGRESS[S.step]||3)+'%';
  document.getElementById('progressStars').textContent=STARS[S.step]||'⭐';
}

function ensureSentencePunctuation(text){
  const trimmed = text.trim();
  if(!trimmed) return text;
  if(/[.!?]$/.test(trimmed)) return trimmed;
  return trimmed + '.';
}

// ══════════════════════════════════════
// TOPIC CARD
// ══════════════════════════════════════
function renderTopicCard(){
  const chips=TOPIC_SUGGESTIONS.map(t=>`<span class="topic-chip" onclick="pickTopicChip(this,'${esc(t)}')">${t}</span>`).join('');
  addPal(`What will your paragraph be about? 🌟<br><br>Pick an idea below — or type your own!
    <div class="topic-prompt-card">
      <h4>💡 Pick a topic or write your own:</h4>
      <div class="topic-chips">${chips}</div>
      <div class="topic-own-row">
        <input id="topicOwn" placeholder="My own topic..." onkeydown="if(event.key==='Enter')confirmTopic()">
        <button class="topic-go-btn" onclick="confirmTopic()">Let's go! 🚀</button>
      </div>
    </div>`);
}

function pickTopicChip(el,topic){
  document.querySelectorAll('.topic-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  const inp=document.getElementById('topicOwn');
  if(inp)inp.value=topic;
}

function confirmTopic(){
  const val=(document.getElementById('topicOwn')||{}).value||'';
  const trimmed=val.trim();
  if(!trimmed){addPal('Can you tell me what your paragraph will be about? Pick one or type your own! 😊');return;}
  S.topic=trimmed;
  addStudent('My topic is: '+trimmed);
  S.step=STEP.D1; updateProgress();
  setTimeout(()=>addPal(`Great topic! 🎉<br><br>Now let's add your details. Tell me your <strong>first detail sentence</strong> about <em>${esc(trimmed)}</em>. What is one thing you want to say?`),400);
}

// ══════════════════════════════════════
// CHOICES
// ══════════════════════════════════════
function renderChoices(options,type){
  S.awaitingChoice=type;
  const cards=options.map((opt,i)=>`
    <div class="choice-card" id="ch${i}" onclick="selectChoice(${i},'${type}')">
      <span class="choice-badge">${['A','B','C'][i]}</span>
      <span>${esc(opt)}</span>
      <button class="choice-speak" onclick="event.stopPropagation();speakText('${esc(opt).replace(/'/g,"\\'")}',null)" title="Hear this">🔊</button>
    </div>`).join('');
  addPal(`<div style="font-weight:700;margin-bottom:6px;">Pick your favorite! 👇 (Press 🔊 to hear any choice)</div>
    <div class="choices-grid">${cards}</div>`);
}

function selectChoice(i,type){
  // Clear immediately so subsequent input isn't trapped in choice-picker
  S.awaitingChoice=null;
  document.querySelectorAll('.choice-card').forEach(c=>c.classList.remove('selected'));
  const card=document.getElementById('ch'+i);
  if(card)card.classList.add('selected');
  const opts=type==='topic'?S.topicOptions:S.concludingOptions;
  setTimeout(()=>{
    if(type==='topic'){
      S.topicChoice=opts[i];
      addStudent('I pick Choice '+['A','B','C'][i]+'!');
      S.step=STEP.TRANS; updateProgress();
      showTransitions();
    } else {
      S.concludingChoice=opts[i];
      addStudent('I pick Choice '+['A','B','C'][i]+'!');
      S.step=STEP.DONE; updateProgress();
      showFinalParagraph();
    }
  },300);
}

// ══════════════════════════════════════
// TRANSITIONS
// ══════════════════════════════════════
const TRANS_SETS = [
  ['First,','One reason,','To begin,','For example,'],
  ['Also,','Another reason,','Next,','In addition,'],
  ['Finally,','Last,','Most importantly,','To sum up,']
];

function showTransitions(){
  // Build one card per detail sentence
  const cards = S.details.map((d, i) => {
    const chips = TRANS_SETS[i].map(w =>
      `<button class="trans-chip" id="tc_${i}_${w.replace(/\W/g,'')}"
        onclick="applyTransition(${i},'${w}')">${w}</button>`
    ).join('');
    return `
      <div class="detail-edit-card" id="dec_${i}">
        <div class="dec-label">Detail ${i+1}</div>
        <div class="dec-chips">${chips}</div>
        <div class="dec-sentence" id="des_${i}">${esc(d)}</div>
        <button class="dec-clear" onclick="clearTransition(${i})" title="Remove transition word">✕ Remove word</button>
      </div>`;
  }).join('');

  addPal(`Great choice! 🎉 Here's a cool writing secret — we use <strong>transition words</strong> to connect sentences and make them flow smoothly!<br><br>
    Tap a word under each detail to add it to the beginning of that sentence. You can also skip any you don't want!
    <div class="trans-editor" id="transEditor">${cards}</div>
    <button onclick="advanceFromTransitions()" class="trans-next-btn">
      I'm done — Next! 🚀
    </button>`);
}

function applyTransition(idx, word){
  // Strip any previously applied transition word from this detail
  let base = S.details[idx];
  TRANS_SETS[idx].forEach(w => {
    const prefix = w + ' ';
    if(base.startsWith(prefix)) base = base.slice(prefix.length);
    // also handle capitalised version
    const cap = w.charAt(0).toUpperCase() + w.slice(1) + ' ';
    if(base.startsWith(cap)) base = base.slice(cap.length);
  });
  // Lowercase the first letter unless the student used "I "
  const adjustedBase = base.startsWith('I ') ? base : base.charAt(0).toLowerCase() + base.slice(1);
  const newSentence = word + ' ' + adjustedBase;
  S.details[idx] = newSentence;

  // Update the displayed sentence
  const display = document.getElementById('des_'+idx);
  if(display) display.textContent = newSentence;

  // Highlight the chosen chip, unhighlight others in this row
  TRANS_SETS[idx].forEach(w => {
    const chip = document.getElementById('tc_'+idx+'_'+w.replace(/\W/g,''));
    if(chip) chip.classList.toggle('active', w === word);
  });
}

function clearTransition(idx){
  // Strip any applied transition word and restore original capitalisation
  let base = S.details[idx];
  TRANS_SETS[idx].forEach(w => {
    const prefix = w + ' ';
    if(base.startsWith(prefix)){
      base = base.slice(prefix.length);
      base = base.charAt(0).toUpperCase() + base.slice(1);
    }
  });
  S.details[idx] = base;

  const display = document.getElementById('des_'+idx);
  if(display) display.textContent = base;

  TRANS_SETS[idx].forEach(w => {
    const chip = document.getElementById('tc_'+idx+'_'+w.replace(/\W/g,''));
    if(chip) chip.classList.remove('active');
  });
}

async function advanceFromTransitions(){
  if(S.step!==STEP.TRANS)return;
  S.step=STEP.CONC_CH;
  addStudent('I\'m ready for my ending sentence!');
  await loadConcludingChoices();
}

// ══════════════════════════════════════
// FINAL PARAGRAPH
// ══════════════════════════════════════
function showFinalParagraph(){
  const {details,topicChoice,concludingChoice,studentName}=S;
  const fullText=[topicChoice,...details,concludingChoice].join(' ');
  addPal(`<div class="celebration">🎊 YOU DID IT! YOUR PARAGRAPH IS READY! 🎊</div>
    <div class="paragraph-display">
      <div class="para-label">📝 YOUR PARAGRAPH${studentName?' — '+esc(studentName):''}</div>
      <span class="topic-s">${esc(topicChoice)}</span>
      ${details.map(d=>` <span>${esc(d)}</span>`).join('')}
      <span class="concluding-s"> ${esc(concludingChoice)}</span>
    </div>
    <div style="margin-top:14px;font-size:0.95rem;font-weight:700;">
      🌟 <strong>YOU</strong> wrote those details — I just helped put it together!
    </div>
    <div>
      <button class="copy-btn" onclick="copyPara()">📋 Copy</button>
      <button class="read-para-btn" onclick="speakText('${esc(fullText).replace(/'/g,"\\'")}',this)">🔊 Read My Paragraph</button>
      <button class="restart-btn" onclick="restartApp()">🔄 Write Another!</button>
    </div>`);
  document.getElementById('inputArea').classList.add('hidden');
  document.getElementById('micHint').classList.add('hidden');
  const readBtn = document.querySelector('.read-para-btn');
  setTimeout(()=>speakText(fullText, readBtn),1000);
}

function copyPara(){
  const t=[S.topicChoice,...S.details,S.concludingChoice].join(' ');
  navigator.clipboard.writeText(t).then(()=>addPal('📋 Copied! Paste it anywhere! 🌟')).catch(()=>addPal('Select the paragraph above and copy it yourself! 💪'));
}

// ══════════════════════════════════════
// AI - Now calls backend API
// ══════════════════════════════════════
async function generateSentences(type){
  try {
    const response = await fetch('/api/generate-sentences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: type,
        topic: S.topic,
        details: S.details,
        topicSentence: S.topicChoice || ''
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate sentences');
    }

    const data = await response.json();
    return data.sentences || [];
  } catch (error) {
    console.error('Error generating sentences:', error);
    // Fallback to default sentences if API fails
    const t = S.topic;
    return type === 'topic'
      ? [
        `${t.charAt(0).toUpperCase() + t.slice(1)} is something really interesting to learn about.`,
        `There are so many cool things to know about ${t}.`,
        `Learning about ${t} can teach us a lot of amazing things.`
      ]
      : [
        `That is why ${t} is so special and interesting.`,
        `As you can see, there is so much to love about ${t}.`,
        `${t.charAt(0).toUpperCase() + t.slice(1)} really is an awesome thing to think about.`
      ];
  }
}

// ══════════════════════════════════════
// FLOW
// ══════════════════════════════════════
async function handleInput(text){
  if(!text.trim())return;
  const raw=text.trim();
  const key=raw.toLowerCase().replace(/[^a-z\s]/g,'').trim();

  // picking a choice
  if(S.awaitingChoice==='topic'||S.awaitingChoice==='concluding'){
    const map={'a':0,'b':1,'c':2,'choice a':0,'choice b':1,'choice c':2,
               'i pick a':0,'i pick b':1,'i pick c':2,'option a':0,'option b':1,'option c':2};
    let idx=map[key]!==undefined?map[key]:
      (key==='a'||key.endsWith(' a')?0:key==='b'||key.endsWith(' b')?1:key==='c'||key.endsWith(' c')?2:-1);
    const opts=S.awaitingChoice==='topic'?S.topicOptions:S.concludingOptions;
    if(idx>=0&&opts[idx]){selectChoice(idx,S.awaitingChoice);return;}
    if(key.includes('try again')||key.includes('new ones')||key.includes('different')){
      addStudent(raw);
      S.awaitingChoice==='topic'?await loadTopicChoices():await loadConcludingChoices();
      return;
    }
    addStudent(raw);
    addPal('Type <strong>A</strong>, <strong>B</strong>, or <strong>C</strong> to pick! Or say "try again" for new choices 😊');
    return;
  }

  // transitions step — any typed input moves forward
  if(S.step===STEP.TRANS){
    addStudent(raw);
    S.step=STEP.CONC_CH; // guard against double-fire
    await loadConcludingChoices();
    return;
  }

  // name step
  if(S.step===STEP.NAME){
    S.studentName=raw; addStudent(raw); S.step=STEP.TOPIC; updateProgress();
    setTimeout(()=>renderTopicCard(),400); return;
  }

  // topic step
  if(S.step===STEP.TOPIC){
    if(!raw){addPal('Can you tell me what your paragraph will be about? Pick one or type your own! 😊');return;}
    S.topic=raw;
    addStudent('My topic is: '+raw);
    S.step=STEP.D1; updateProgress();
    setTimeout(()=>addPal(`Great topic! 🎉<br><br>Now let's add your details. Tell me your <strong>first detail sentence</strong> about <em>${esc(raw)}</em>. What is one thing you want to say?`),400);
    return;
  }

  // detail steps
  if(S.step===STEP.D1||S.step===STEP.D2||S.step===STEP.D3){
    if(raw.split(' ').length<3){addStudent(raw);addPal('Can you say a little more? Try a whole sentence! 😊');return;}
    const detail = ensureSentencePunctuation(raw);
    addStudent(detail); S.details.push(detail);
    if(S.step===STEP.D1){
      S.step=STEP.D2; updateProgress();
      setTimeout(()=>addPal('Ooh, I like that! Great detail! 🌟<br><br>Tell me your <strong>second</strong> detail. What else do you want to say?'),400);
    }else if(S.step===STEP.D2){
      S.step=STEP.D3; updateProgress();
      setTimeout(()=>addPal('Nice! You\'re doing great! 🌈<br><br>One more! What is your <strong>third</strong> detail?'),400);
    }else{
      S.step=STEP.TOPIC_CH; updateProgress();
      setTimeout(async()=>{addPal('You did it! 3 great details! 🎊<br><br>Now let me create some topic sentence choices for you...');await loadTopicChoices();},400);
    }
    return;
  }

  // welcome
  if(S.step===STEP.WELCOME){
    addStudent(raw); S.step=STEP.NAME; updateProgress();
    setTimeout(()=>addPal('Yay! Let\'s go! 🚀<br><br>First — what\'s your name?'),400);
  }
}

async function loadTopicChoices(){
  addLoader();
  const opts=await generateSentences('topic');
  removeLoader(); S.topicOptions=opts;
  addPal('Now I\'ll help you write your <strong>topic sentence</strong> — the sentence at the <strong>very beginning</strong> of your paragraph. It tells the reader what the whole paragraph is about! 📖<br><br>I made 3 choices from your details. <strong>Pick the one you like best</strong>!');
  renderChoices(opts,'topic');
}

async function loadConcludingChoices(){
  addPal('Great! Now let\'s make your <strong>ending sentence</strong>! 🎯<br><br>A concluding sentence wraps everything up — like giving your paragraph a big hug at the end!');
  addLoader();
  const opts=await generateSentences('concluding');
  removeLoader(); S.concludingOptions=opts;
  S.step=STEP.CONC_CH; updateProgress();
  renderChoices(opts,'concluding');
}

// ══════════════════════════════════════
// INPUT
// ══════════════════════════════════════
function sendMessage(){
  const ta=document.getElementById('userInput');
  const t=ta.value.trim(); if(!t)return;
  ta.value=''; ta.style.height='auto';
  handleInput(t);
}

function handleKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
  const ta=document.getElementById('userInput');
  setTimeout(()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,120)+'px';},0);
}

// ══════════════════════════════════════
// STT
// ══════════════════════════════════════
function toggleMic(){
  if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){
    addPal('The microphone might not work here — try Chrome on a computer or Chromebook! 🎤');return;
  }
  if(S.isRecording){S.recognition&&S.recognition.stop();return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const r=new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
  r.onstart=()=>{S.isRecording=true;document.getElementById('micBtn').classList.add('recording');document.getElementById('micBtn').textContent='⏹';document.getElementById('micHint').textContent='🔴 Listening... speak now!';};
  r.onresult=(e)=>{document.getElementById('userInput').value=e.results[0][0].transcript;};
  r.onend=r.onerror=()=>{S.isRecording=false;document.getElementById('micBtn').classList.remove('recording');document.getElementById('micBtn').textContent='🎤';document.getElementById('micHint').textContent='🎤 Press the orange button to speak — 🔊 press "Read to me" to hear any message!';};
  S.recognition=r; r.start();
}

// ══════════════════════════════════════
// TEACHER MODAL
// ══════════════════════════════════════
function openTeacherModal(){
  document.getElementById('teacherModal').classList.add('open');
  document.getElementById('passcodeScreen').style.display='block';
  document.getElementById('teacherDash').classList.remove('visible');
  document.getElementById('passcodeInput').value='';
  document.getElementById('passcodeError').style.display='none';
  setTimeout(()=>document.getElementById('passcodeInput').focus(),200);
}

function closeTeacherModal(){
  document.getElementById('teacherModal').classList.remove('open');
  window.speechSynthesis&&window.speechSynthesis.cancel();
}

function checkPasscode(){
  if(document.getElementById('passcodeInput').value===TEACHER_PASSCODE){
    document.getElementById('passcodeScreen').style.display='none';
    document.getElementById('teacherDash').classList.add('visible');
    renderDashboard();
  }else{
    document.getElementById('passcodeError').style.display='block';
    document.getElementById('passcodeInput').value='';
    document.getElementById('passcodeInput').focus();
  }
}

async function testHealthEndpoint(){
  try{
    const res=await fetch('/api/health');
    const data=await res.json();
    document.getElementById('debugOutput').innerHTML=`<div style="background:#e8f5e9;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">✅ <strong>Health Check Passed</strong><br/>${JSON.stringify(data,null,2)}</div>`;
  }catch(e){
    document.getElementById('debugOutput').innerHTML=`<div style="background:#ffebee;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">❌ <strong>Health Check Failed</strong><br/>${e.message}</div>`;
  }
}

async function testGenerateSentences(){
  try{
    if(!S.topic){
      document.getElementById('debugOutput').innerHTML=`<div style="background:#fff3e0;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">⚠️ No topic set. Start by entering a topic in the app.</div>`;
      return;
    }
    if(!S.details.length){
      document.getElementById('debugOutput').innerHTML=`<div style="background:#fff3e0;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">⚠️ No details written. Add at least one detail sentence first.</div>`;
      return;
    }
    document.getElementById('debugOutput').innerHTML=`<div style="color:#666;font-family:monospace;font-size:0.85rem">Testing API...</div>`;
    const res=await fetch('/api/generate-sentences',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'topic',topic:S.topic,details:S.details.slice(0,3)})
    });
    const data=await res.json();
    if(res.ok){
      document.getElementById('debugOutput').innerHTML=`<div style="background:#e8f5e9;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">✅ <strong>API Test Passed</strong><br/><strong>Generated 3 topic sentences:</strong><br/>${data.sentences.map((s,i)=>`${i+1}. ${s}`).join('<br/>')}</div>`;
    }else{
      document.getElementById('debugOutput').innerHTML=`<div style="background:#ffebee;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">❌ <strong>API Error</strong><br/>${JSON.stringify(data,null,2)}</div>`;
    }
  }catch(e){
    document.getElementById('debugOutput').innerHTML=`<div style="background:#ffebee;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">❌ <strong>Request Failed</strong><br/>${e.message}</div>`;
  }
}

async function testSynthesizeSpeech(){
  try{
    const testText='Hello! This is a test of the text to speech API. I sound pretty good, don\'t I?';
    document.getElementById('debugOutput').innerHTML=`<div style="color:#666;font-family:monospace;font-size:0.85rem">Testing TTS API...</div>`;
    const res=await fetch('/api/synthesize-speech',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:testText})
    });
    if(res.ok){
      const audioBlob=await res.blob();
      const audioUrl=URL.createObjectURL(audioBlob);
      const audio=new Audio(audioUrl);
      audio.play();
      document.getElementById('debugOutput').innerHTML=`<div style="background:#e8f5e9;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">✅ <strong>TTS API Test Passed</strong><br/>Playing audio: "${testText}"<br/><button class="dash-btn blue" onclick="this.closest('div').querySelector('audio')?.pause()">Stop</button></div>`;
    }else{
      const errData=await res.json();
      document.getElementById('debugOutput').innerHTML=`<div style="background:#ffebee;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">❌ <strong>API Error</strong><br/>${JSON.stringify(errData,null,2)}</div>`;
    }
  }catch(e){
    document.getElementById('debugOutput').innerHTML=`<div style="background:#ffebee;border-radius:8px;padding:12px;font-family:monospace;font-size:0.85rem">❌ <strong>Request Failed</strong><br/>${e.message}</div>`;
  }
}

function renderDashboard(){
  const {studentName,topic,details,topicChoice,concludingChoice,sessionStart,step}=S;
  const mins=Math.round((new Date()-sessionStart)/60000);
  const done=step===STEP.DONE;
  const fullText=done?[topicChoice,...details,concludingChoice].join(' '):null;
  let h='';

  h+=`<div class="dash-meta">
    <div>👤 Student: <span>${studentName||'(not entered yet)'}</span></div>
    <div>📌 Topic: <span>${topic||'(not chosen yet)'}</span></div>
    <div>⏱ Time on task: <span>~${mins} min</span></div>
    <div>✅ Status: <span>${done?'Paragraph complete 🎉':'In progress (step '+(step)+' of '+STEP.DONE+')'}</span></div>
  </div>`;

  h+=`<div class="dash-section"><div class="dash-section-title" style="color:var(--sky)">📝 Detail Sentences</div>`;
  if(!details.length){h+=`<div class="dash-empty">No details written yet.</div>`;}
  else{details.forEach((d,i)=>{h+=`<div class="dash-detail-item"><strong>Detail ${i+1}:</strong> ${esc(d)}</div>`;});}
  h+=`</div>`;

  h+=`<div class="dash-section"><div class="dash-section-title" style="color:var(--sky)">🟦 Topic Sentence Chosen</div>`;
  h+=topicChoice?`<div class="dash-sentence topic">${esc(topicChoice)}</div>`:`<div class="dash-empty">Not selected yet.</div>`;
  h+=`</div>`;

  h+=`<div class="dash-section"><div class="dash-section-title" style="color:var(--coral)">🟥 Concluding Sentence Chosen</div>`;
  h+=concludingChoice?`<div class="dash-sentence concluding">${esc(concludingChoice)}</div>`:`<div class="dash-empty">Not selected yet.</div>`;
  h+=`</div>`;

  if(done&&fullText){
    const safeText=esc(fullText).replace(/'/g,"\\'");
    h+=`<div class="dash-section"><div class="dash-section-title" style="color:var(--mint)">📄 Complete Paragraph</div>
      <div class="dash-paragraph-box">
        <span class="t">${esc(topicChoice)}</span>
        ${details.map(d=>` <span>${esc(d)}</span>`).join('')}
        <span class="c"> ${esc(concludingChoice)}</span>
      </div>
      <button class="dash-btn" onclick="navigator.clipboard.writeText('${safeText}').then(()=>this.textContent='✅ Copied!')">📋 Copy Paragraph</button>
      <button class="dash-btn blue" onclick="speakText('${safeText}',null)">🔊 Read Aloud</button>
    </div>`;
  }

  h+=`<div class="dash-section"><div class="dash-section-title" style="color:#9c27b0">🔧 Debug Menu (Dev Only)</div>
    <div style="background:#f5f5f5;border-radius:12px;padding:14px;margin-bottom:12px;border:1px dashed #ddd">
      <div style="margin-bottom:10px;font-size:0.9rem;color:#666"><strong>Test API Endpoints:</strong></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="dash-btn" onclick="testHealthEndpoint()" style="background:#2196F3">🏥 Test Health</button>
        <button class="dash-btn" onclick="testGenerateSentences()" style="background:#4CAF50">🎯 Test Generate</button>
        <button class="dash-btn" onclick="testSynthesizeSpeech()" style="background:#FF9800">🔊 Test TTS</button>
      </div>
      <div id="debugOutput" style="font-family:monospace;font-size:0.85rem;color:#666;min-height:40px;max-height:150px;overflow:auto;background:white;border-radius:6px;padding:10px;border:1px solid #ddd">Test results appear here...</div>
    </div>
  </div>`;

  document.getElementById('dashContent').innerHTML=h;
}

// ══════════════════════════════════════
// RESTART
// ══════════════════════════════════════
function restartApp(){
  Object.assign(S,{step:0,studentName:'',topic:'',details:[],topicOptions:[],concludingOptions:[],topicChoice:null,concludingChoice:null,awaitingChoice:null,sessionStart:new Date()});
  document.getElementById('chatArea').innerHTML='';
  document.getElementById('inputArea').classList.remove('hidden');
  document.getElementById('micHint').classList.remove('hidden');
  document.getElementById('userInput').value='';
  updateProgress(); startApp();
}

// ══════════════════════════════════════
// START
// ══════════════════════════════════════
function startApp(){
  updateProgress();
  setTimeout(()=>addPal(`Hi! I'm your <strong>Paragraph Pal!</strong> 🌟<br><br>
    I'll help you write an awesome paragraph today. Just tell me your ideas — I'll help put them together!<br><br>
    🎤 Press the <strong>orange button</strong> to speak your answers.<br>
    🔊 Press <strong>"Read to me"</strong> on any message to hear it out loud.<br><br>
    Are you ready? Type <strong>"yes"</strong> or <strong>"I'm ready!"</strong> to begin! 🚀`),300);
}

startApp();
