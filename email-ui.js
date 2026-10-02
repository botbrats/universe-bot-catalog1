const statusNode=document.getElementById("status"),draftNode=document.getElementById("drafts");
let drafts=[], preparedInquiries=[];
document.getElementById("sign-out").onclick=async()=>{try{const r=await fetch("/api/email/logout",{method:"POST"});if(!r.ok)throw new Error("Could not sign out.");drafts=[];preparedInquiries=[];render();document.getElementById("compose").reset();status("Signed out.")}catch(e){status(e.message)}};
async function api(path="",method="GET",body) {
 const r=await fetch("/api/email/drafts"+path,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw new Error(data.error||"Email service unavailable.");return data;
}
function status(text){statusNode.textContent=text}
async function reload(){const data=await api();drafts=data.drafts;render();status("Drafts and delivery log loaded.")}
function render(){
 draftNode.replaceChildren();
 for(const d of drafts){
  const a=document.createElement("article"),title=document.createElement("h2"),to=document.createElement("p"),body=document.createElement("pre"),state=document.createElement("p");
  title.textContent=d.subject;to.textContent="To: "+d.to;body.textContent=d.body;
  state.textContent=d.status==="sent"?"Zoho accepted · Message ID "+d.messageId:d.status==="draft"?"Saved draft":d.notice||"Submission in progress or interrupted. Check Zoho Sent before resending.";
  a.append(title,to,body,state);
  if(d.status==="draft"){
   const edit=document.createElement("button"),send=document.createElement("button");
   edit.textContent="Edit";edit.onclick=()=>{const f=document.getElementById("compose");f.elements.to.value=d.to;f.elements.subject.value=d.subject;f.elements.body.value=d.body;f.dataset.id=d.id;f.dataset.revision=d.revision;f.scrollIntoView()};
   send.textContent="Send this email";send.onclick=async()=>{send.disabled=true;try{await api("/"+d.id+"/send","POST",{revision:d.revision});await reload()}catch(e){status(e.message);send.disabled=false}};
   a.append(edit,send);
  }
  draftNode.append(a);
 }
}
document.getElementById("compose").onsubmit=async e=>{
 e.preventDefault();const f=e.target,button=f.querySelector("button");button.disabled=true;
 try{const body=Object.fromEntries(new FormData(f));if(f.dataset.id)body.revision=Number(f.dataset.revision);
 await api(f.dataset.id?"/"+f.dataset.id:"",f.dataset.id?"PUT":"POST",body);f.reset();delete f.dataset.id;delete f.dataset.revision;await reload()}catch(e){status(e.message)}finally{button.disabled=false}
};
async function propertyDrafts(){
 if(preparedInquiries.length!==10)throw new Error("Choose your ten-inquiry JSON file first.");
 return preparedInquiries;
}
document.getElementById("inquiry-file").onchange=async e=>{
 try{const file=e.target.files[0];if(!file||file.size>300000)throw new Error("Choose an inquiry file below 300 KB.");
 const data=JSON.parse(await file.text());if(!Array.isArray(data)||data.length!==10||data.some(x=>!x.to||!x.subject||!x.body))throw new Error("Expected ten inquiries with to, subject, and body.");
 preparedInquiries=data;status("Ten inquiries loaded locally. Click Load to save them privately.");}catch(err){status(err.message)}
};
document.getElementById("load-ten").onclick=async e=>{
 e.target.disabled=true;try{for(const d of await propertyDrafts())await api("","POST",d);await reload();status("Ten property inquiries saved. Nothing sent.")}catch(e){status(e.message)}finally{e.target.disabled=false}
};
document.getElementById("send-ten").onclick=async e=>{
 e.target.disabled=true;
 try{
  const prepared=await propertyDrafts();await reload();
  const batch=prepared.map(p=>drafts.find(d=>d.to===p.to&&d.subject===p.subject&&d.body===p.body));
  if(batch.some(d=>!d))throw new Error("Load the ten inquiries first. Edited drafts can be sent individually.");
  for(const d of batch){if(d.status==="draft")await api("/"+d.id+"/send","POST",{revision:d.revision});}
  await reload();status("Batch finished. Check each delivery status below; unknown results are never automatically resent.");
 }catch(e){status(e.message)}finally{e.target.disabled=false}
};
reload().catch(e=>status(e.message));
