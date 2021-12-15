export type Timestamp = number[];

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

export interface InserOp {
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

export const isDelete = (x : UpdateOperation) : x is DeleteOp => x.opName === "delete";
export const isInsert = (x : UpdateOperation) : x is InserOp => x.opName === "insert";
