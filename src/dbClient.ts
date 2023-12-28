// deno-lint-ignore-file no-explicit-any
import type { PromiseType, TxID } from './constants.ts'
import { CTX, ServiceType } from './context.ts'
let { DBServiceURL, DEBUG, registrationURL, requestURL } = CTX

let nextTxID: TxID = 0;

const transactions: Map<number, PromiseType> = new Map();

/**
 * This db client communicates with an RPC service.    
 */
export class DbClient {

   querySet = []

   /**
    * Creates a new DBClient instance
    * @param serviceURL - the url for the RPC service
    * @param serviceType - the type of service to register for
    */
   constructor(serviceURL: string, serviceType: ServiceType, client = "unknown") {

      //fix url ending
      DBServiceURL = (serviceURL.endsWith('/'))
         ? serviceURL
         : serviceURL += '/';

      switch (serviceType) {
         case "IO":
            registrationURL = DBServiceURL + `SSERPC/ioRegistration?client=${client}`;
            requestURL = DBServiceURL + 'SSERPC/ioRequest';
            break;
         case "KV":
            registrationURL = DBServiceURL + `SSERPC/kvRegistration?client=${client}`;
            requestURL = DBServiceURL + 'SSERPC/kvRequest';
            break;
         case "RELAY":
            registrationURL = DBServiceURL + `SSERPC/relayRegistration?client=${client}`;
            requestURL = DBServiceURL + 'SSERPC/relayRequest';
            break;
         default:
            break;
      }
   }

   /** 
    * initialize our EventSource and fetch initial data 
    * */
   init(): Promise<void> {

      return new Promise((resolve, reject) => {

         let connectAttemps = 0
         console.log("CONNECTING");

         const eventSource = new EventSource(registrationURL);

         eventSource.onopen = () => {
            console.log("CONNECTED");
            resolve()
         };

         eventSource.onerror = (_e) => {
            switch (eventSource.readyState) {
               case EventSource.OPEN:
                  console.log("CONNECTED");
                  break;
               case EventSource.CONNECTING:
                  console.log("CONNECTING");
                  connectAttemps++
                  if (connectAttemps > 1) {
                     eventSource.close()
                     alert(`No Service!
Please start the DBservice!
See: readme.md.`)
                  }
                  console.log(`URL: ${window.location.href}`)
                  break;
               case EventSource.CLOSED:
                  console.log("DISCONNECTED");
                  reject()
                  break;
            }
         };

         // When we get a message from the server, we expect 
         // an object containing {msgID, error, and result}.
         // We find the callback that was registered for this ID, 
         // and execute it with the error and result properities.
         // This will resolve or reject the promise that was
         // returned to the client when the call was created.
         eventSource.onmessage = (evt: any) => {
            if (DEBUG) console.info('events.onmessage - ', evt.data)
            const parsed = JSON.parse(evt.data);
            const { txID, error, result } = parsed;         // unpack
            if (!transactions.has(txID)) return             // check        
            const transaction = transactions.get(txID)      // fetch
            transactions.delete(txID)                       // clean up
            if (transaction) transaction(error, result)     // execute
         }
      })
   }

   /**
    * fetch a querySet      
    */
   fetchQuerySet() {
      return new Promise((resolve, _reject) => {
         rpcRequest("GETALL", {})
            .then((result) => {
               if (typeof result === "string") {
                  resolve(JSON.parse(result))
               } else {
                  console.log('Ooopppps: ', typeof result)
               }
            })
      })
   }

   // /**
   //  * get row from key
   //  */
   // get(key: string) {
   //    for (let index = 0; index < this.querySet.length; index++) {
   //       const element = this.querySet[index];
   //       //@ts-ignore ?
   //       if (element.id === key) return element
   //    }
   // }

   /**
    * get row from key
    */
   get(key: any[]) {
      const start = performance.now()
      console.info(`Get called with key = `, key)
      return new Promise((resolve, _reject) => {
         // persist single record to the service
         rpcRequest("GET", { key: key })
            .then((result) => {
               console.info('GET result ', result)
               console.info(`GET call returned ${result} in ${performance.now() - start}`)
               //@ts-ignore ?
               if (typeof result.value === "string") {
                  //@ts-ignore ?
                  resolve(result.value)
               } else {
                  //@ts-ignore ?
                  resolve(JSON.stringify(result.value))
               }
            })
      })
   }



   /** 
    * The `set` method mutates - will call the `persist` method. 
    */
   set(key: any, value: any) {
      console.log(`set call key = `, key)
      try {
         // persist single record to the service
         rpcRequest("SET",
            {
               key: key,
               value: value,
               //@ts-ignore ?
               currentPage: this.currentPage,
               //@ts-ignore ?
               rowsPerPage: this.rowsPerPage
            })
            .then((result: any) => {
               console.info('SET call returned ', result.querySet)
               this.querySet = result.querySet
               return this.querySet
            })
      } catch (e) {
         return { Error: e }
      }
   }

   /** 
    * The `delete` method mutates - will call the `persist` method. 
    */
   delete(key: any) {
      try {
         rpcRequest("DELETE", { key: key })
            .then((result) => {
               //@ts-ignore ?
               this.querySet = result.querySet
               //@ts-ignore ?
               this.totalPages = result.totalPages
               return this.querySet
            })
      } catch (_e) {
         return { Error: _e }
      }
   }

   /** 
    * The `clearAll` method removes all records from the DB. 
    */
   async clearAll() {
      try {
         await rpcRequest("CLEARALL", { key: [""] })
      } catch (_e) {
         return { Error: _e }
      }
   }
}

/** 
 * Make an Asynchronous Remote Proceedure Call    
 * Here we POST a message to our SSE-RPC-server.     
 * We give each message a unique transaction ID.    
 * We then create/save a callback with this ID.    
 * Finally, we return a promise for this callback.     
 * This is how we implement async transactions with    
 * our SSE-RPC-server. Since most of the heavy lifting is    
 * on the server, we never block the UI 
 *  
 * @param {key extends keyof TypedProcedures} procedure - the name of the remote procedure to be called
 * @param {TypedProcedures[key]} params - appropriately typed parameters for this procedure
 * 
 * @returns {Promise} - Promise object has a transaction that is stored by ID    
 *   in a transactions Map.   
 *   When this promise resolves or rejects, the transaction is retrieved by ID    
 *   and executed by the promise. 
 */
export const rpcRequest = (procedure: any, params: any) => {
   // increment our tranaction id
   const thisID = nextTxID++;
   return new Promise((resolve, reject) => {
      // create a unique promise callback and save it with this txID
      transactions.set(thisID, (error: any, result: any) => {
         if (error) return reject(new Error(error));
         resolve(result);
      });
      fetch(requestURL, {
         method: "POST",
         mode: 'no-cors',
         body: JSON.stringify({ txID: thisID, procedure, params })
      });
   });
};
