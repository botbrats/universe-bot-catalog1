import { gmailRoute } from "./gmail.js";
const headers = { "Cache-Control": "no-store" };
const json = (data, status = 200) => Response.json(data, { status, headers });
export function cookie(request, name) {
  return (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="))?.slice(name.length + 1);
}
export async function emailRoute(request, env) {
  if (!env.EMAIL_QUEUE || !env.OAUTH_TOKENS) return json({error:"Email service needs its deployment binding."},503);
  const session = cookie(request, "__Host-candy-session");
  const sessionProvider = session && await env.OAUTH_TOKENS.get("candy_session:"+session);
  if (!session || !/^[0-9a-f-]{36}$/.test(session) || !sessionProvider)
    return json({error:"Sign in with your authorized Gmail or Zoho mailbox."},401);
  if (request.method !== "GET" && request.headers.get("Origin") !== new URL(request.url).origin)
    return json({error:"Request origin rejected."},403);
  if (new URL(request.url).pathname === "/api/email/logout" && request.method === "POST") {
    await env.OAUTH_TOKENS.delete("candy_session:"+session);
    return Response.json({signedOut:true},{headers:{...headers,"Set-Cookie":"__Host-candy-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"}});
  }
  const provider = sessionProvider === "gmail" ? "gmail" : "zoho";
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("X-Candy-Mail-Provider", provider);
  const authorizedRequest = new Request(request, { headers: forwardedHeaders });
  return env.EMAIL_QUEUE.get(env.EMAIL_QUEUE.idFromName("owner")).fetch(authorizedRequest);
}
function validate(input, requireRecipient=false) {
  const {to,subject,body} = input;
  const recipient = typeof to === "string" ? to.trim() : "";
  if (requireRecipient && (!recipient || recipient.length>254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)))
    throw new Error("Add one valid recipient email address before approving this message.");
  if (recipient && (recipient.length>254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)))
    throw new Error("Enter one valid recipient email address, or leave it blank until confirmed.");
  if (typeof subject !== "string" || !subject.trim() || subject.length>250 || /[\r\n]/.test(subject))
    throw new Error("Enter a subject of 250 characters or less.");
  if (typeof body !== "string" || !body.trim() || body.length>30000)
    throw new Error("Enter an email body of 30,000 characters or less.");
  const threadId = typeof input.threadId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(input.threadId) ? input.threadId : "";
  const inReplyTo = typeof input.inReplyTo === "string" && input.inReplyTo.length <= 998 && !/[\r\n]/.test(input.inReplyTo) ? input.inReplyTo : "";
  const references = typeof input.references === "string" && input.references.length <= 4000 && !/[\r\n]/.test(input.references) ? input.references : "";
  return {to:recipient,subject,body,threadId,inReplyTo,references};
}
export class EmailQueue {
  constructor(state,env) { this.state=state; this.env=env; this.tail=Promise.resolve(); }
  fetch(request) {
    const task=this.tail.then(()=>this.handle(request));
    this.tail=task.catch(()=>{});
    return task.catch(()=>json({error:"Email service error. Check the delivery log before retrying."},500));
  }
  async handle(request) {
    const url=new URL(request.url);
    if (url.pathname === "/api/email/inbox" || url.pathname.startsWith("/api/email/thread/")) {
      if (request.headers.get("X-Candy-Mail-Provider") !== "gmail") return json({error:"Inbox reading is available for the connected Gmail mailbox."},403);
      return gmailRoute(request,this.env);
    }
    const match=url.pathname.match(/^\/api\/email\/drafts(?:\/([0-9a-f-]{36})(?:\/(approve|send))?)?$/);
    if (!match) return json({error:"Not found."},404);
    const id=match[1], action=match[2];
    if (!id && request.method==="GET") {
      const rows=await this.state.storage.list({prefix:"draft:"});
      return json({drafts:[...rows.values()]});
    }
    let input;
    if(request.method!=="GET") {
      if(Number(request.headers.get("Content-Length"))>40000) return json({error:"Request too large."},413);
      const raw=await request.text();
      if(raw.length>40000) return json({error:"Request too large."},413);
      try{input=JSON.parse(raw)}catch{return json({error:"Invalid JSON."},400)}
      if(!input || typeof input!=="object" || Array.isArray(input))return json({error:"Expected a JSON object."},400);
    }
    if(!id && request.method==="POST") {
      let fields;try{fields=validate(input)}catch(e){return json({error:e.message},400)}
      const rows=await this.state.storage.list({prefix:"draft:"});
      if(rows.size>=200) return json({error:"Draft limit reached."},409);
      const duplicate=[...rows.values()].find(x=>x.to===fields.to&&x.subject===fields.subject&&x.body===fields.body);
      if(duplicate) return json({draft:duplicate});
      const draft={id:crypto.randomUUID(),...fields,revision:1,status:"draft",createdAt:new Date().toISOString()};
      await this.state.storage.put("draft:"+draft.id,draft);return json({draft},201);
    }
    const draft=id&&await this.state.storage.get("draft:"+id);
    if(!draft)return json({error:"Draft not found."},404);
    if(request.method==="PUT"&&!action) {
      if(!["draft","approved"].includes(draft.status))return json({error:"A submitted email cannot be edited or resent."},409);
      if(input.revision!==draft.revision)return json({error:"Draft changed. Reload before editing."},409);
      let fields;try{fields=validate(input)}catch(e){return json({error:e.message},400)}
      Object.assign(draft,fields,{revision:draft.revision+1,status:"draft",approvedAt:null});
      await this.state.storage.put("draft:"+id,draft);return json({draft});
    }
    if(request.method!=="POST"||!action)return json({error:"Method not allowed."},405);
    if(input.revision!==draft.revision)return json({error:"Draft changed. Reload before continuing."},409);
    if(action==="approve") {
      if(draft.status!=="draft")return json({error:"Only an unapproved draft can be approved."},409);
      try { validate(draft,true); } catch(e) { return json({error:e.message},400); }
      draft.status="approved";draft.approvedAt=new Date().toISOString();
      await this.state.storage.put("draft:"+id,draft);
      return json({draft});
    }
    if(draft.status!=="approved")return json({error:"Approve this exact draft before sending."},409);
    try { validate(draft,true); } catch(e) { return json({error:e.message},400); }
    const provider=request.headers.get("X-Candy-Mail-Provider")==="gmail"?"gmail":"zoho";
    let token;
    if(provider==="gmail") {
      const sender=await this.env.OAUTH_TOKENS.get("google_sender");
      const refresh=await this.env.OAUTH_TOKENS.get("google_refresh_token");
      if(!sender||sender.toLowerCase()!=="shopclubhostings@gmail.com"||!refresh)
        return json({error:"Authorized Gmail mailbox is not connected."},503);
      try {
        const response=await fetch("https://oauth2.googleapis.com/token",{
          method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
          body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh,
            client_id:this.env.GOOGLE_CLIENT_ID,client_secret:this.env.GOOGLE_CLIENT_SECRET}),
          signal:AbortSignal.timeout(15000)
        });
        const result=await response.json();
        if(!response.ok||!result.access_token)return json({error:"Google authentication failed. Reconnect Gmail."},502);
        token=result.access_token;
      }catch{return json({error:"Could not reach Google authentication; email was not submitted."},502)}
    } else {
      const sender=JSON.parse(await this.env.OAUTH_TOKENS.get("zoho_sender")||"null");
      const refresh=await this.env.OAUTH_TOKENS.get("zoho_refresh_token");
      if(!sender||!refresh||sender.address.toLowerCase()!==this.env.ZOHO_ALLOWED_ADDRESS?.trim().toLowerCase())
        return json({error:"Authorized Zoho mailbox is not connected."},503);
      try {
        const response=await fetch("https://accounts.zoho.com/oauth/v2/token",{
          method:"POST",body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh,
            client_id:this.env.ZOHO_CLIENT_ID,client_secret:this.env.ZOHO_CLIENT_SECRET}),
          signal:AbortSignal.timeout(15000)
        });
        const result=await response.json();
        if(!response.ok||!result.access_token)return json({error:"Zoho authentication failed. Reconnect the mailbox."},502);
        token=result.access_token;
      }catch{return json({error:"Could not reach Zoho authentication; email was not submitted."},502)}
    }
    draft.status="submitting";draft.submittedAt=new Date().toISOString();
    await this.state.storage.put("draft:"+id,draft);
    try {
      let response, confirmed=false, providerMessageId="";
      if(provider==="gmail") {
        const sender=await this.env.OAUTH_TOKENS.get("google_sender");
        const encodedSubject=btoa(String.fromCharCode(...new TextEncoder().encode(draft.subject)));
        const mime=["From: "+sender,"To: "+draft.to,"Subject: =?UTF-8?B?"+encodedSubject+"?=",
          ...(draft.inReplyTo?["In-Reply-To: "+draft.inReplyTo]:[]),
          ...(draft.references?["References: "+draft.references]:[]),
          "MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: 8bit","",draft.body].join("\r\n");
        const bytes=new TextEncoder().encode(mime);
        let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
        const raw=btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
        response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
          method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
          body:JSON.stringify({raw,...(draft.threadId?{threadId:draft.threadId}:{})}),signal:AbortSignal.timeout(20000)
        });
        const result=await response.json();
        providerMessageId=result.id||"";
        confirmed=response.ok&&!!providerMessageId;
      } else {
        const sender=JSON.parse(await this.env.OAUTH_TOKENS.get("zoho_sender"));
        response=await fetch("https://mail.zoho.com/api/accounts/"+encodeURIComponent(sender.accountId)+"/messages",{
          method:"POST",headers:{"Content-Type":"application/json",Authorization:"Zoho-oauthtoken "+token},
          body:JSON.stringify({fromAddress:sender.address,toAddress:draft.to,subject:draft.subject,
            content:draft.body,mailFormat:"plaintext",encoding:"UTF-8"}),
          signal:AbortSignal.timeout(20000)
        });
        const result=await response.json();
        providerMessageId=result.data?.messageId||"";
        confirmed=response.ok&&Number(result.status?.code)===200&&!!providerMessageId;
      }
      draft.status=confirmed?"sent":"unknown";
      if(confirmed){draft.messageId=String(providerMessageId);draft.provider=provider;}
      else draft.notice="Provider submission was not confirmed. Check the mailbox Sent folder before any new send.";
    }catch{draft.status="unknown";draft.notice="Connection interrupted. Check the mailbox Sent folder; do not resend blindly."}
    await this.state.storage.put("draft:"+id,draft);
    return json({draft});
  }
}