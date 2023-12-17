// deno-lint-ignore-file no-explicit-any

//let LOCAL_DEV = false
//==========================================
//  uncomment below to run a local service
//const LOCAL_DEV = true
//  otherwise, run the Deno-Deploy service
//==========================================
const DEBUG = false
let nextMsgID = 0;
let DBServiceURL = ''
const transactions = new Map();

/**
 * This db client communicates with an RPC service.    
 */
export class DbClient {

   querySet = []

   constructor(serviceURL: string) {
      //fix url ending
      DBServiceURL = (serviceURL.endsWith('/'))
      ? serviceURL
      : serviceURL += '/';
   }
   /** initialize our EventSource and fetch some data */
   init(registrationURL: string): Promise<void> {
      return new Promise((resolve, reject) => {
         let connectAttemps = 0
         console.log("CONNECTING");
         
         const eventSource = new EventSource(DBServiceURL + registrationURL );

         eventSource.addEventListener("open", () => {
            console.log("CONNECTED");
            resolve()
         });

         eventSource.addEventListener("error", (_e) => {
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
         });

         /* 
         When we get a message from the service we expect 
         an object containing {msgID, error, and result}.
         We then find the transaction that was registered for this msgID, 
         and execute it with the error and result properities.
         This will resolve or reject the promise that was
         returned to the client when the transaction was created.
         */
         eventSource.onmessage = (evt) => {
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
               resolve (JSON.parse(result))
            } else {
               console.log('Ooopppps: ', typeof result)
            }
         })
      })
   }

   /**
    * get row from key
    */
   get(key: string) {
      for (let index = 0; index < this.querySet.length; index++) {
         const element = this.querySet[index];
         //@ts-ignore ?
         if (element.id === key) return element
      }

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
            .then((result: any ) => {
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
} // End class

/** 
 * Make an Asynchronous Remote Proceedure Call
 *  
 * @param {key extends keyof TypedProcedures} procedure - the name of the remote procedure to be called
 * @param {TypedProcedures[key]} params - appropriately typed parameters for this procedure
 * 
 * @returns {Promise} - Promise object has a transaction that is stored by ID    
 *   in a transactions Set.   
 *   When this promise resolves or rejects, the transaction is retrieved by ID    
 *   and executed by the promise. 
 */
export const rpcRequest = (procedure: any, params: any) => {
   // increment our tranaction id
   const txID = nextMsgID++;
   return new Promise((resolve, reject) => {
      // create a unique promise callback and save it with this txID
      transactions.set(txID, (error: any, result: any) => {
         if (error) return reject(new Error(error));
         resolve(result);
      });
      fetch(DBServiceURL+'SSERPC/kvRequest', {
         method: "POST",
         mode: 'no-cors',
         body: JSON.stringify({ txID, procedure, params })
      });
   });
};
