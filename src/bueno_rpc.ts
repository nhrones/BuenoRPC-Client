
// deno-lint-ignore-file no-explicit-any
/// <reference lib="dom" />


import { RpcId, RpcProcedure, RpcParams } from './constants.ts'

const RunningLocal = (window.location.href === "http://localhost:8080/");
const DEBUG = RunningLocal
console.log(`RunningLocal`, RunningLocal);

const postURL = (RunningLocal)
   ? "http://localhost:9099/SSERPC/ioRequest"
   : "https://bueno-rpc.deno.dev/SSERPC/ioRequest";
   
const regtURL = (RunningLocal)
   ? "http://localhost:9099/SSERPC/ioRegistration"
   : "https://bueno-rpc.deno.dev/SSERPC/ioRegistration";
   
console.log(`Running from ${postURL}`)

/** 
 * A Map of transaction promise-callbacks keyed by txID 
 */
const transactions: Map<RpcId, any> = new Map()

/** ID number generator */
let nextTxID = 0

/** 
 * Post a message to our SSE-RPC-server     
 * We give each message a unique transaction ID.    
 * We then create/save a callback with this ID.    
 * Finally, we return a promise for this callback.     
 * This is how we implement async transactions with    
 * our SSE-RPC-server. Since most of the heavy lifting is    
 * on the server, we never block the UI 
 */
export const rpcRequest = (procedure: RpcProcedure, params: RpcParams) => {
   // increment our tranaction id
   const newTxID: RpcId = nextTxID++
   return new Promise((resolve, reject) => {
      // create a unique promise callback and save it with this txID
      transactions.set(newTxID, (error: any, result: any) => {
         if (error) return reject(new Error(error.message))
         resolve(result)
      })
      if (DEBUG) console.log(`fetch called: ${procedure}`)
      fetch(postURL, {
         method: "POST",
         body: JSON.stringify({ txID: newTxID, procedure: procedure, params: params }),
      });
   })
}

/** 
 * Initialize our SSE communications 
 */
export const initComms = () => {
   return new Promise((resolve, reject) => {

      /** EventSource from deno SSE-Sever */
      const events = new EventSource(regtURL);

      console.log('CONNECTING');

      events.onopen = () => {
         console.log('CONNECTED');
         resolve('ok')
      }

      events.onerror = () => {
         switch (events.readyState) {
            case EventSource.OPEN:
               console.log('CONNECTED');
               break;
            case EventSource.CONNECTING:
               console.log('CONNECTING');
               break;
            case EventSource.CLOSED:
               reject('closed')
               console.log('DISCONNECTED');
               break;
         }
      };

      // When we get a message from the server, we expect 
      // an object containing {msgID, error, and result}.
      // We find the callback that was registered for this ID, 
      // and execute it with the error and result properities.
      // This will resolve or reject the promise that was
      // returned to the client when the callback was created.
      events.onmessage = (evt) => {
         if (DEBUG) console.info('events.onmessage - ', evt.data)
         const parsed = JSON.parse( evt.data)
         const { txID, error, result } = parsed          // unpack
         if (!transactions.has(txID)) return;            // check                  
         const transaction = transactions.get(txID)      // fetch
         transactions.delete(txID)                       // clean up
         if (transaction) transaction(error, result)     // execute
      }
   })
}