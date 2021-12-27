export interface NeighborClient {
    id : number;
    client_host : string;
    port : number;
}

export interface UpdateOperation {
    opName : string;
    char? : string;
    index? : number;
}

export interface DeleteOp {
    opName : "delete";
    index : number;
}

export interface InsertOp {
    opName : "insert";
    char : string;
    index?: number;

}

export interface ClientData {
    id : number;
    port : number;
    local_replica : string;
    clients : NeighborClient[];
    operations : UpdateOperation[];
}

export interface PreviousUpdate {
    op : UpdateOperation;
    current_string : string;
    timestamp : number;
    id: number
}

export const createClientData = (id:number,port:number,initialString:string,neighborClients:NeighborClient[],localOperations:UpdateOperation[]):ClientData =>{
    return {
        id : id,
        port : port,
        local_replica : initialString,
        clients : neighborClients,
        operations : localOperations
        }
    }
export const createNeighborClient = ( id : number, client_host : string, port : number):NeighborClient =>{
        return {
                    id : id,
                    client_host : client_host,
                    port : port
                }
    }
export const createUpdateOperation = (opName: string, char?: string, index?: number):UpdateOperation =>
        opName === "delete" ? createDeleteOp(index) : createInsertOp(char,index)
    
export const createDeleteOp = (index: number):DeleteOp => {
    return {
        opName : "delete",
        index : index
    }
}
export const createInsertOp = (char: string , index?: number):InsertOp => // char must be of length 1 - not checked
    index != undefined ? {
        opName : "insert",
        char : char,
        index : index
    } :
    {
        opName : "insert",
        char : char
    }
export const createPreviousUpdate = (op:UpdateOperation,current_string:string,timestamp:number,id:number):PreviousUpdate =>{
    return {
        op : op,
        current_string : current_string,
        timestamp : timestamp,
        id: id
    }
}



export const isDelete = (x : UpdateOperation) : x is DeleteOp => x.opName === "delete";
export const isInsert = (x : UpdateOperation) : x is InsertOp => x.opName === "insert";
