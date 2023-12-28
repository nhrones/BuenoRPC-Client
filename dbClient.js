// deno-lint-ignore-file
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/context.ts
var CTX = {
  DEBUG: false,
  DBServiceURL: "",
  registrationURL: "",
  requestURL: ""
};

// src/dbClient.ts
var { DBServiceURL, DEBUG, registrationURL, requestURL } = CTX;
var nextTxID = 0;
var transactions = /* @__PURE__ */ new Map();
var DbClient = class {
  /**
   * Creates a new DBClient instance
   * @param serviceURL - the url for the RPC service
   * @param serviceType - the type of service to register for
   */
  constructor(serviceURL, serviceType, client = "unknown") {
    this.querySet = [];
    DBServiceURL = serviceURL.endsWith("/") ? serviceURL : serviceURL += "/";
    switch (serviceType) {
      case "IO":
        registrationURL = DBServiceURL + `SSERPC/ioRegistration?client=${client}`, requestURL = DBServiceURL + "SSERPC/ioRequest";
        break;
      case "KV":
        registrationURL = DBServiceURL + `SSERPC/kvRegistration?client=${client}`, requestURL = DBServiceURL + "SSERPC/kvRequest";
        break;
      case "RELAY":
        registrationURL = DBServiceURL + `SSERPC/relayRegistration?client=${client}`, requestURL = DBServiceURL + "SSERPC/relayRequest";
        break;
      default:
        break;
    }
  }
  /** 
   * initialize our EventSource and fetch initial data 
   * */
  init() {
    return new Promise((resolve, reject) => {
      let connectAttemps = 0;
      console.log("CONNECTING");
      const eventSource = new EventSource(registrationURL);
      eventSource.onopen = () => {
        console.log("CONNECTED");
        resolve();
      };
      eventSource.onerror = (_e) => {
        switch (eventSource.readyState) {
          case EventSource.OPEN:
            console.log("CONNECTED");
            break;
          case EventSource.CONNECTING:
            console.log("CONNECTING");
            connectAttemps++;
            if (connectAttemps > 1) {
              eventSource.close();
              alert(`No Service!
Please start the DBservice!
See: readme.md.`);
            }
            console.log(`URL: ${window.location.href}`);
            break;
          case EventSource.CLOSED:
            console.log("DISCONNECTED");
            reject();
            break;
        }
      };
      eventSource.onmessage = (evt) => {
        if (DEBUG)
          console.info("events.onmessage - ", evt.data);
        const parsed = JSON.parse(evt.data);
        const { txID, error, result } = parsed;
        if (!transactions.has(txID))
          return;
        const transaction = transactions.get(txID);
        transactions.delete(txID);
        if (transaction)
          transaction(error, result);
      };
    });
  }
  /**
   * fetch a querySet      
   */
  fetchQuerySet() {
    return new Promise((resolve, _reject) => {
      rpcRequest("GETALL", {}).then((result) => {
        if (typeof result === "string") {
          resolve(JSON.parse(result));
        } else {
          console.log("Ooopppps: ", typeof result);
        }
      });
    });
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
  get(key) {
    const start = performance.now();
    console.info(`Get called with key = `, key);
    return new Promise((resolve, _reject) => {
      rpcRequest("GET", { key }).then((result) => {
        console.info("GET result ", result);
        console.info(`GET call returned ${result} in ${performance.now() - start}`);
        if (typeof result.value === "string") {
          resolve(result.value);
        } else {
          resolve(JSON.stringify(result.value));
        }
      });
    });
  }
  /** 
   * The `set` method mutates - will call the `persist` method. 
   */
  set(key, value) {
    console.log(`set call key = `, key);
    try {
      rpcRequest(
        "SET",
        {
          key,
          value,
          //@ts-ignore ?
          currentPage: this.currentPage,
          //@ts-ignore ?
          rowsPerPage: this.rowsPerPage
        }
      ).then((result) => {
        console.info("SET call returned ", result.querySet);
        this.querySet = result.querySet;
        return this.querySet;
      });
    } catch (e) {
      return { Error: e };
    }
  }
  /** 
   * The `delete` method mutates - will call the `persist` method. 
   */
  delete(key) {
    try {
      rpcRequest("DELETE", { key }).then((result) => {
        this.querySet = result.querySet;
        this.totalPages = result.totalPages;
        return this.querySet;
      });
    } catch (_e) {
      return { Error: _e };
    }
  }
  /** 
   * The `clearAll` method removes all records from the DB. 
   */
  async clearAll() {
    try {
      await rpcRequest("CLEARALL", { key: [""] });
    } catch (_e) {
      return { Error: _e };
    }
  }
};
__name(DbClient, "DbClient");
var rpcRequest = /* @__PURE__ */ __name((procedure, params) => {
  const thisID = nextTxID++;
  return new Promise((resolve, reject) => {
    transactions.set(thisID, (error, result) => {
      if (error)
        return reject(new Error(error));
      resolve(result);
    });
    fetch(requestURL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ txID: thisID, procedure, params })
    });
  });
}, "rpcRequest");
export {
  DbClient,
  rpcRequest
};
