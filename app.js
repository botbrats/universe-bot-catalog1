const bots=[
["IT Supervisor","IT","$0/day"],["Shield","Security","$9/mo"],
["Idea Engine","Research","$0/day"],["Research Scout","Research","$3/day"],
["Money Desk","Money","$12/mo"],["School Mate","School","$0/day"],
["File Clerk","Operations","$0/day"],["Appointment","Life","$2/day"],
["Launch Pad","Operations","$49 buy"],["Moderator","Operations","$7/mo"],
["Portfolio","Creative","$0/day"],["Screen Pet","Creative","$5/day"],
["Handy-Candy","Operations","$0/day"]
];
const colors=["#c8d0d3","#e6d8b9","#b8c6ba","#d5b8ca","#c3b8d7","#d1c7b5","#afc1c9","#dcc1a8"];

function esc(v){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function js(v){return String(v).replaceAll("\\","\\\\").replaceAll("'","\\'")}

function render(){
 const q=document.getElementById("q"),cat=document.getElementById("cat"),cards=document.getElementById("cards");
 if(!q||!cat||!cards)return;
 const term=q.value.toLowerCase(), c=cat.value;
 cards.innerHTML=bots.filter(b=>(!term||b.join(" ").toLowerCase().includes(term))&&(!c||b[1]===c)).map(b=>`
 <article class="card"><div class="thumb">${esc(b[2])}</div><b>${esc(b[2])}</b><h3>${esc(b[0])}</h3>
 <p>${esc(b[1])} department • deployable assistant/agent/co-worker</p>
 <button type="button" onclick="deployBot('${js(b[0])}')">Choose / Deploy</button></article>`).join("");
}

function deployBot(name){
 const bot=bots.find(b=>b[0]===name); if(!bot)return;
 document.getElementById("bot-workspace")?.remove();
 const handy=name==="Handy-Candy";
 const description=handy?"EMAIL → draft → review → negotiate → schedule → follow up → thank → close. Approval required before consequential external actions.":`${bot[0]} is ready for deployment.`;
 const greeting=handy?"Hi! I’m Handy-Candy 🍬🤖. I can draft, review, negotiate, plan scheduling, follow up, thank, and close. I’ll pause for your approval before anything consequential is sent or committed.":"Hello. I'm ready. What can I help you with today?";
 const w=document.createElement("div"); w.id="bot-workspace";
 w.innerHTML=`<div class="bot-window">
 <div class="bot-header"><div><h2>${esc(bot[0])}</h2><small>${esc(bot[1])} • ${esc(bot[2])}</small></div>
 <button type="button" onclick="closeBotWorkspace()">×</button></div>
 <div class="bot-description">${esc(description)}</div>
 <div id="bot-messages" class="bot-messages"><div class="bot-message"><strong>${esc(bot[0])}:</strong> ${esc(greeting)}</div></div>
 <form id="bot-chat-form"><textarea id="bot-input" rows="2" placeholder="What can I help with today?"></textarea><button type="submit">Send to bot</button></form>
 </div>`;
 document.body.appendChild(w);
 document.getElementById("bot-chat-form").addEventListener("submit",e=>sendBotMessage(e,bot[0]));
 document.getElementById("bot-input")?.focus();
}

function closeBotWorkspace(){document.getElementById("bot-workspace")?.remove()}

function draftControls(container, reply, waiting=false){
 const bar=document.createElement("div");bar.className="draft-controls";
 const edit=document.createElement("button");edit.type="button";edit.textContent="Edit draft";
 edit.disabled=waiting;
 edit.onclick=()=>{
  const input=document.getElementById("bot-input");if(!input)return;
  input.value=`Please revise this draft. My changes: \n\nDraft:\n${reply}`;
  input.focus();input.setSelectionRange(39,39);
 };
 const approve=document.createElement("button");approve.type="button";
 approve.textContent="Approve";approve.disabled=true;
 approve.title="Available after customer sign-in and the server approval queue are connected.";
 const send=document.createElement("button");send.type="button";
 send.textContent="Send email";send.disabled=true;
 send.title="Available after verified approval and the email provider are connected.";
 const status=document.createElement("small");
 status.textContent=waiting?"Draft in progress. Approval and sending are locked.":"Draft only. Approval and email sending need a connected customer account.";
 bar.append(edit,approve,send,status);container.appendChild(bar);
}

async function sendBotMessage(e,botName){
 e.preventDefault(); const input=document.getElementById("bot-input"),messages=document.getElementById("bot-messages");
 if(!input||!messages)return; const message=input.value.trim(); if(!message)return;
 messages.innerHTML+=`<div class="bot-message user"><strong>You:</strong> ${esc(message)}</div>`;
 input.value=""; const id="thinking-"+Date.now();
 messages.innerHTML+=`<div id="${id}" class="bot-message"><strong>${esc(botName)}:</strong> Thinking...</div>`;
 if(botName==="Handy-Candy")draftControls(document.getElementById(id),"",true);
 try{
  const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bot:botName,message})});
  let d={}; try{d=await r.json()}catch(_){}
  document.getElementById(id)?.remove();
  if(!r.ok)throw new Error(d.error||"The bot service is not connected yet.");
  const item=document.createElement("div");item.className="bot-message";
  item.innerHTML=`<strong>${esc(botName)}:</strong> ${esc(d.reply||"No response returned.")}`;
  messages.appendChild(item);
  if(botName==="Handy-Candy")draftControls(item,d.reply);
 }catch(err){
  document.getElementById(id)?.remove();
  messages.innerHTML+=`<div class="bot-message error"><strong>Connection:</strong> ${esc(err.message)}</div>`;
 }
 messages.scrollTop=messages.scrollHeight;
}

function go(id){document.getElementById(id)?.scrollIntoView({behavior:"smooth"})}

const homeDrawers=[
 ["📄","Documents & signing",[{label:"DocuSign",url:"https://account.docusign.com/"},{label:"My templates",target:"documents"},{label:"My forms",target:"documents"}]],
 ["🧾","Accounting",[{label:"Accounting workspace",target:"portal"}]],
 ["👥","Employees",[{label:"Employee portal",target:"portal"}]],
 ["🤖","Agents & tools",[{label:"Bot catalog",target:"catalog"},{label:"Deploy agents",target:"deploy"}],true],
 ["✨","Personal assistant",[{label:"Personal workspace",target:"portal"}]],
 ["💬","ChatGPT assistant",[{label:"Open ChatGPT",url:"https://chatgpt.com/"},{label:"Handy-Candy",bot:"Handy-Candy"}]],
 ["🛍️","Stores",[{label:"Store workspace",target:"portal"}]],
 ["🗂️","Project files",[{label:"Private file room demo",target:"drawers"}]]
];

function setupHome(){
 const host=document.getElementById("home-drawers");
 const dialog=document.getElementById("drawer-dialog");
 for(const [icon,name,entries,isPublic] of homeDrawers){
  const tile=document.createElement("button");tile.type="button";tile.className="home-tile";
  const symbol=document.createElement("span");symbol.className="home-icon";symbol.textContent=icon;
  const title=document.createElement("span");title.textContent=name;tile.append(symbol,title);
  if(!isPublic){const badge=document.createElement("small");badge.textContent="🔒 Administrator only";tile.appendChild(badge)}
  tile.onclick=()=>{
   const heading=document.getElementById("drawer-title");if(heading)heading.textContent=`${icon} ${name}`;
   const links=document.getElementById("drawer-links");links?.replaceChildren();
   if(!isPublic){
    const notice=document.createElement("p");notice.textContent="Locked. Administrator sign-in is required. This private workspace is not available on the public prototype.";
    links?.appendChild(notice);dialog?.showModal();return;
   }
  for(const entry of entries){
   const button=document.createElement("button");button.type="button";button.textContent=entry.label;
   button.onclick=()=>{
    dialog?.close();
    if(entry.url)window.open(entry.url,"_blank","noopener,noreferrer");
    else if(entry.bot)deployBot(entry.bot);
    else go(entry.target);
   };links.appendChild(button);
  }
   dialog?.showModal();
  };
  host?.appendChild(tile);
 }
 const key="universe-cabinet-bookmarks-v1";
 const read=()=>{try{const data=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(data)?data:[]}catch(_){return []}};
 const list=document.getElementById("bookmark-list");
 const renderBookmarks=()=>{
  if(!list)return;list.replaceChildren();
  for(const [index,item] of read().entries()){
   const row=document.createElement("div");row.className="bookmark-row";
   const link=document.createElement("a");link.href=item.url;link.textContent=item.label;
   link.target="_blank";link.rel="noopener noreferrer";
   const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";
   remove.onclick=()=>{const items=read();items.splice(index,1);localStorage.setItem(key,JSON.stringify(items));renderBookmarks()};
   row.append(link,remove);list.appendChild(row);
  }
 };
 document.getElementById("bookmark-form")?.addEventListener("submit",event=>{
  event.preventDefault();const label=document.getElementById("bookmark-label").value.trim();
  const raw=document.getElementById("bookmark-url").value.trim();
  let url;try{url=new URL(raw);if(!["http:","https:"].includes(url.protocol))return}catch(_){return}
  if(!label)return;const items=read();items.push({label,url:url.href});
  localStorage.setItem(key,JSON.stringify(items));event.target.reset();renderBookmarks();
 });
 renderBookmarks();
 const status=document.getElementById("offline-status");
 const update=()=>{if(status)status.textContent=navigator.onLine?"Online • Offline cabinet available after first load":"Offline • Bookmarks and cached cabinet available"};
 window.addEventListener("online",update);window.addEventListener("offline",update);update();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
}

function setup(){
 setupHome();
 const q=document.getElementById("q"),cat=document.getElementById("cat"); if(q)q.oninput=render;if(cat)cat.onchange=render;
 const power=document.getElementById("power"),status=document.getElementById("status");
 if(power)power.onclick=()=>{if(status){status.textContent="● ONLINE — Morning Power On complete. Review today’s priorities.";status.style.color="#496c3c"}};
 const drawers=document.getElementById("drawers");
 if(drawers){
  ["LEVEL 1 • OPERATIONS","LEVEL 2 • MANAGEMENT","PRIVATE • ADMIN"].forEach((x,i)=>{
   drawers.insertAdjacentHTML("beforeend",`<div class="drawer"><button type="button">${x} ▾</button><div>${["Morning Start","Calendar & Alarms","Daily Deploy","Schedules","Approvals","Audits","Licenses","Partner Files","Keys & Integrations","Security Plans","Operations","Archive"].slice(i*4,i*4+4).map(a=>`<span>${esc(a)}</span>`).join("")}</div></div>`);
  });
  drawers.querySelectorAll(".drawer button").forEach(b=>b.onclick=()=>b.parentElement.classList.toggle("open"));
 }
 const listings=document.getElementById("listings");
 if(listings)for(let i=1;i<=120;i++){const b=bots[(i-1)%bots.length],bg=colors[(i*7)%colors.length];listings.insertAdjacentHTML("beforeend",`<div class="listing" style="background:linear-gradient(110deg,${bg},#fff9)"><b>${String(i).padStart(3,"0")}</b><span><strong>${esc(b[0])}</strong><br><small>${esc(b[1])} • ${esc(b[2])}</small></span><span class="price">${esc(b[2])}</span></div>`)}
 render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
