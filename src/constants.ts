export const DEBUG = true

//---------------------------------------------------------
//  RPC ---------------------------------------------------
//---------------------------------------------------------

export type RpcId = number;
export type RpcParams = JsonArray | JsonObject;
export type RpcProcedure = string;

export interface RpcRequest {
    id: RpcId;
    procedure: RpcProcedure;
    params?: RpcParams;
}

export interface RpcResponse {
    id: RpcId;
    error: JsonValue;
    result: JsonValue;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [member: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;


export type fileType = {
   name: string
   isFile: boolean
   isDirectory: boolean
   isSymlink: boolean
}

export const files: fileType[] = []

export const ctx = {
   fileList: files,
   fileName: '',
   folderName: '',
}
