import test from "node:test";
import assert from "node:assert/strict";
import {EmailQueue,emailRoute} from "./email.js";
import worker from "./worker.js";
const origin="https://candy.example";
function fixture(){
 const rows=new Map();
 const storage={get:async k=>rows.get(k),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async()=>new Map(rows)};
 const kv=new Map([["zoho_sender",JSON.stringify({address:"owner@zohomail.com",accountId:"123"})],["zoho_refresh_token","test-refresh"],["candy_session:00000000-0000-0000-0000-000000000000","owner"]]);
 const env={ZOHO_ALLOWED_ADDRESS:"owner@zohomail.com",OAUTH_TOKENS:{get:async k=>kv.get(k),put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k)},ZOHO_CLIENT_ID:"test",ZOHO_CLIENT_SECRET:"test"};
 const queue=new EmailQueue({storage},env);env.EMAIL_QUEUE={idFromName:()=>1,get:()=>queue};
 const req=(path="",method="GET",body)=>new Request(origin+"/api/email/drafts"+path,{method,headers:{Origin:origin,Cookie:"__Host-candy-session=00000000-0000-0000-0000-000000000000"},body:body?JSON.stringify(body):undefined});
 return {env,queue,req};
}
test("owner session and same-origin requests required",async()=>{
 const {env,req}=fixture();
 assert.equal((await emailRoute(new Request(origin+"/api/email/drafts"),env)).status,401);
 const r=req("","POST",{});r.headers.set("Origin","https://attacker.example");
 assert.equal((await emailRoute(r,env)).status,403);
});
test("sign-out revokes the owner session",async()=>{
 const {env,req}=fixture();
 const request=new Request(origin+"/api/email/logout",{method:"POST",headers:req().headers});
 assert.equal((await emailRoute(request,env)).status,200);
 assert.equal((await emailRoute(req(),env)).status,401);
});
test("OAuth state is bound to the initiating browser",async()=>{
 const {env}=fixture();
 const start=await worker.fetch(new Request(origin+"/api/zoho/connect"),env);
 const state=new URL(start.headers.get("Location")).searchParams.get("state");
 const callback=origin+"/api/zoho/callback?code=test&state="+state;
 assert.equal((await worker.fetch(new Request(callback),env)).status,400);
 const original=globalThis.fetch;
 globalThis.fetch=async url=>url.includes("oauth")?Response.json({access_token:"test",refresh_token:"test"}):Response.json({data:[{enabled:true,primaryEmailAddress:"owner@zohomail.com",accountId:"123"}]});
 try{
 const r=await worker.fetch(new Request(callback,{headers:{Cookie:"__Host-candy-oauth="+state}}),env);
 assert.equal(r.status,302);assert.equal(r.headers.get("Location"),"/mail.html");
 assert.match(r.headers.get("Set-Cookie"),/HttpOnly; Secure; SameSite=Strict/);
 }finally{globalThis.fetch=original}
});
test("invalid recipient and stale revision cannot send",async()=>{
 const {queue,req}=fixture();
 assert.equal((await queue.fetch(req("","POST",{to:"a@x.com,b@x.com",subject:"hi",body:"hello"}))).status,400);
 const {draft}=await (await queue.fetch(req("","POST",{to:"a@x.com",subject:"hi",body:"hello"}))).json();
 assert.equal((await queue.fetch(req("/"+draft.id+"/send","POST",{revision:0}))).status,409);
});
test("concurrent send clicks issue one provider submission",async()=>{
 const {queue,req}=fixture();let submissions=0;const original=globalThis.fetch;
 globalThis.fetch=async url=>url.includes("oauth")?Response.json({access_token:"test"}):(submissions++,Response.json({status:{code:200},data:{messageId:"12345"}}));
 try{
 const {draft}=await (await queue.fetch(req("","POST",{to:"a@x.com",subject:"hi",body:"hello"}))).json();
 const send=()=>queue.fetch(req("/"+draft.id+"/send","POST",{revision:1}));
 const results=await Promise.all([send(),send()]);
 assert.equal(submissions,1);
 for(const r of results)assert.equal((await r.json()).draft.status,"sent");
 }finally{globalThis.fetch=original}
});
test("timeout after submission is unknown and cannot resend",async()=>{
 const {queue,req}=fixture();let submissions=0;const original=globalThis.fetch;
 globalThis.fetch=async url=>{if(url.includes("oauth"))return Response.json({access_token:"test"});submissions++;throw new Error("timeout")};
 try{
 const {draft}=await (await queue.fetch(req("","POST",{to:"a@x.com",subject:"hi",body:"hello"}))).json();
 const send=()=>queue.fetch(req("/"+draft.id+"/send","POST",{revision:1}));
 assert.equal((await (await send()).json()).draft.status,"unknown");
 await send();assert.equal(submissions,1);
 }finally{globalThis.fetch=original}
});

test("drafts with unknown recipients can be saved but cannot be sent",async()=>{
 const {queue,req}=fixture();
 const saved=await queue.fetch(req("","POST",{to:"",subject:"Find contact email",body:"Contact details to confirm."}));
 assert.equal(saved.status,201);
 const {draft}=await saved.json();
 assert.equal((await queue.fetch(req("/"+draft.id+"/send","POST",{revision:1}))).status,400);
});
