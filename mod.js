// deno-lint-ignore-file
var R=Object.defineProperty;var l=(o,t)=>R(o,"name",{value:t,configurable:!0});var p=!1,i=!1,S=i?"http://localhost:9099/SSERPC/ioRequest":"https://bueno-rpc.deno.dev/SSERPC/ioRequest",d=i?"http://localhost:9099/SSERPC/ioRegistration":"https://bueno-rpc.deno.dev/SSERPC/ioRegistration",r=new Map,u=0,m=l((o,t)=>{let e=u++;return new Promise((a,n)=>{r.set(e,(c,s)=>{if(c)return n(new Error(c.message));a(s)}),p&&console.log(`fetch called: ${o}`),fetch(S,{method:"POST",body:JSON.stringify({txID:e,procedure:o,params:t})})})},"rpcRequest"),P=l(()=>new Promise((o,t)=>{let e=new EventSource(d);console.log("CONNECTING"),e.onopen=()=>{console.log("CONNECTED"),o("ok")},e.onerror=()=>{switch(e.readyState){case EventSource.OPEN:console.log("CONNECTED");break;case EventSource.CONNECTING:console.log("CONNECTING");break;case EventSource.CLOSED:t("closed"),console.log("DISCONNECTED");break}},e.onmessage=a=>{let{data:n}=a;p&&console.info("events.onmessage - ",n);let c=JSON.parse(n),{txID:s,error:E,result:C}=c;if(!r.has(s))return;let N=r.get(s);r.delete(s),N(E,C)}}),"initComms");export{P as initComms,m as rpcRequest};
