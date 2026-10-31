const statusNode=document.getElementById("status"),draftNode=document.getElementById("drafts");
let drafts=[], preparedInquiries=[];
document.getElementById("sign-out").onclick=async()=>{try{const r=await fetch("/api/email/logout",{method:"POST"});if(!r.ok)throw new Error("Could not sign out.");drafts=[];preparedInquiries=[];render();document.getElementById("compose").reset();status("Signed out.")}catch(e){status(e.message)}};
async function api(path="",method="GET",body) {
 const r=await fetch("/api/email/drafts"+path,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw new Error(data.error||"Email service unavailable.");return data;
}
function status(text){statusNode.textContent=text}
async function reload(message="Drafts and delivery log loaded."){const data=await api();drafts=data.drafts;render();status(message)}
function render(){
 draftNode.replaceChildren();
 for(const d of drafts){
  const a=document.createElement("article"),title=document.createElement("h2"),to=document.createElement("p"),body=document.createElement("pre"),state=document.createElement("p");
  title.textContent=d.subject;to.textContent="To: "+(d.to||"Recipient not supplied");body.textContent=d.body;
  if(d.status==="sent")state.textContent="Zoho accepted · Message ID "+d.messageId;
  else if(d.status==="draft"&&!d.to){state.textContent="Recipient needed before approval and sending.";state.className="needs"}
  else if(d.status==="draft")state.textContent="Saved draft — review before approving";
  else if(d.status==="approved")state.textContent="Approved — ready for your separate Send action";
  else state.textContent=d.notice||"Submission in progress or interrupted. Check Zoho Sent before resending.";
  a.append(title,to,body,state);
  if(d.status==="draft"||d.status==="approved"){
   const edit=document.createElement("button");
   edit.textContent=d.status==="approved"?"Edit (approval will reset)":"Review / edit";edit.onclick=()=>{const f=document.getElementById("compose");f.elements.to.value=d.to||"";f.elements.subject.value=d.subject;f.elements.body.value=d.body;f.dataset.id=d.id;f.dataset.revision=d.revision;f.scrollIntoView({behavior:"smooth"})};
   a.append(edit);
   if(d.to&&/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(d.to)){
    const action=document.createElement("button");
    action.textContent=d.status==="approved"?"Send":"Approve";
    action.onclick=async()=>{
     if(d.status==="draft"){
      if(!window.confirm("Approve this exact email for a separate Send step?\\n\\nTo: "+d.to+"\\nSubject: "+d.subject+"\\n\\nThis will NOT send it."))return;
      action.disabled=true;
      try{await api("/"+d.id+"/approve","POST",{revision:d.revision});await reload("Approved only. Review the message, then press Send when ready.");}
      catch(e){status(e.message);action.disabled=false}
     }else{
      if(!window.confirm("Send this approved email now via consignmentstores@zohomail.com?\\n\\nTo: "+d.to+"\\nSubject: "+d.subject))return;
      action.disabled=true;
      try{await api("/"+d.id+"/send","POST",{revision:d.revision});await reload("Send request processed. Check provider status below.");}
      catch(e){status(e.message);action.disabled=false}
     }
    };
    a.append(action);
   }
  }
  draftNode.append(a);
 }
}
document.getElementById("compose").onsubmit=async e=>{
 e.preventDefault();const f=e.target,button=f.querySelector("button");button.disabled=true;
 try{const body=Object.fromEntries(new FormData(f));if(f.dataset.id)body.revision=Number(f.dataset.revision);
 await api(f.dataset.id?"/"+f.dataset.id:"",f.dataset.id?"PUT":"POST",body);f.reset();delete f.dataset.id;delete f.dataset.revision;await reload("Draft saved.")}catch(e){status(e.message)}finally{button.disabled=false}
};
document.getElementById("inquiry-file").onchange=async e=>{
 try{
  const file=e.target.files[0];if(!file||file.size>300000)throw new Error("Choose a prepared inquiry JSON file below 300 KB.");
  const data=JSON.parse(await file.text());
  if(!Array.isArray(data)||data.length<1||data.length>10||data.some(x=>typeof x.subject!=="string"||typeof x.body!=="string"))throw new Error("Choose a batch containing 1–10 inquiries with subject and body fields.");
  preparedInquiries=data.map(x=>({to:typeof x.to==="string"?x.to:"",subject:x.subject,body:x.body}));
  status(preparedInquiries.length+" inquiries loaded locally. Nothing has been saved or sent yet. Click Import to save drafts.");
 }catch(err){preparedInquiries=[];status(err.message)}
};
document.getElementById("load-ten").onclick=async e=>{
 if(!preparedInquiries.length){status("Choose a prepared inquiry JSON file first.");return}
 e.target.disabled=true;
 try{
  let saved=0;
  for(const d of preparedInquiries){await api("","POST",d);saved++}
  await reload(saved+" drafts imported into the private queue. Nothing was sent. Review each message and approve individually.");
  preparedInquiries=[];
  document.getElementById("inquiry-file").value="";
 }catch(e){status("Import stopped: "+e.message+" Already imported drafts remain saved; retrying identical drafts will not create duplicates.")}finally{e.target.disabled=false}
};
reload().catch(e=>status(e.message));
document.getElementById("clear-all").onclick=()=>{
 if(!window.confirm("Clear the current unsaved import selection and compose fields? Saved drafts and sent emails will not be deleted."))return;
 preparedInquiries=[];
 const file=document.getElementById("inquiry-file");
 if(file)file.value="";
 const form=document.getElementById("compose");
 if(form){form.reset();delete form.dataset.id;delete form.dataset.revision;}
 status("Unsaved inputs cleared. Saved drafts and sent emails were not changed.");
};
