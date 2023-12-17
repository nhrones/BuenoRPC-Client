// deno-lint-ignore-file
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/bueno_rpc.ts
var DEBUG = false;
var local = false;
var postURL = local ? "http://localhost:9099/SSERPC/ioRequest" : "https://bueno-rpc.deno.dev/SSERPC/ioRequest";
var regtURL = local ? "http://localhost:9099/SSERPC/ioRegistration" : "https://bueno-rpc.deno.dev/SSERPC/ioRegistration";
var callbacks = /* @__PURE__ */ new Map();
var nextTxID = 0;
function refreshCSS() {
  if (DEBUG)
    console.log("refreshed css");
  const sheets = [].slice.call(document.getElementsByTagName("link"));
  const head = document.getElementsByTagName("head")[0];
  for (let i = 0; i < sheets.length; ++i) {
    const elem = sheets[i];
    const parent = elem.parentElement || head;
    parent.removeChild(elem);
    const rel = elem.rel;
    if (elem.href && typeof rel != "string" || rel.length == 0 || rel.toLowerCase() == "stylesheet") {
      const url = elem.href.replace(/(&|\?)_cacheOverride=d+/, "");
      elem.href = url + (url.indexOf("?") >= 0 ? "&" : "?") + "_cacheOverride=" + (/* @__PURE__ */ new Date()).valueOf();
    }
    parent.appendChild(elem);
  }
}
__name(refreshCSS, "refreshCSS");
var rpcRequest = /* @__PURE__ */ __name((procedure, params) => {
  const newTxID = nextTxID++;
  return new Promise((resolve, reject) => {
    callbacks.set(newTxID, (error, result) => {
      if (error)
        return reject(new Error(error.message));
      resolve(result);
    });
    if (DEBUG)
      console.log(`fetch called: ${procedure}`);
    fetch(postURL, {
      method: "POST",
      body: JSON.stringify({ txID: newTxID, procedure, params })
    });
  });
}, "rpcRequest");
var initComms = /* @__PURE__ */ __name(() => {
  return new Promise((resolve, reject) => {
    const events = new EventSource(regtURL);
    console.log("CONNECTING");
    events.onopen = () => {
      console.log("CONNECTED");
      resolve("ok");
    };
    events.onerror = () => {
      switch (events.readyState) {
        case EventSource.OPEN:
          console.log("CONNECTED");
          break;
        case EventSource.CONNECTING:
          console.log("CONNECTING");
          break;
        case EventSource.CLOSED:
          reject("closed");
          console.log("DISCONNECTED");
          break;
      }
    };
    events.onmessage = (e) => {
      const { data } = e;
      if (DEBUG)
        console.info("events.onmessage - ", data);
      const parsed = JSON.parse(data);
      const { txID, error, result } = parsed;
      if (!callbacks.has(txID))
        return;
      const callback = callbacks.get(txID);
      callbacks.delete(txID);
      callback(error, result);
    };
  });
}, "initComms");
export {
  initComms,
  refreshCSS,
  rpcRequest
};
