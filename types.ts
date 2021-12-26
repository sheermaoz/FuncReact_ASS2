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

export const isDelete = (x : UpdateOperation) : x is DeleteOp => x.opName === "delete";
export const isInsert = (x : UpdateOperation) : x is InsertOp => x.opName === "insert";
