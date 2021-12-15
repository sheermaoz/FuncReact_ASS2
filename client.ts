import * as T from "./types";

class Client {
    id : number;
    port : number;
    local_replica : string;
    clients : T.NeighborClient[];
    operations : T.UpdateOperation[];
    // server : Server;
    timestamp_vector: T.Timestamp;
    update_frequency : number;
    modification_counter : number = 0;


    constructor(client : T.ClientData, update_frequency : number = 1) {
        this.id = client.id;
        this.port = client.port;
        this.local_replica = client.local_replica;
        this.clients = client.clients;
        this.operations = client.operations;
        this.timestamp_vector = [].fill(0, 0, this.clients.length + 1)
        this.update_frequency = update_frequency;

        // init the server
    }

    start = () => {
        
    }
    
    modify = () => {
        let updateOP : T.UpdateOperation = this.operations.shift();
        T.isDelete(updateOP) ? this.remove(updateOP) :
        T.isInsert(updateOP) ? this.insert(updateOP):
        console.log("unsupported operation");

    }

    remove = (op : T.DeleteOp) => {
        if (op.index === undefined || op.index < 0 || op.index >= this.local_replica.length) {
            throw new Error("Index out of bounds");
        }

        this.local_replica = this.local_replica.slice(0, op.index).concat(this.local_replica.slice(op.index+1));
        this.incrementModificationCounter();
    }

    insert = (op : T.InserOp) => {
        let insertionIndex:number = op.index;
        if (op.char === undefined) 
        {
            throw new Error("Char is undefined");
        }
        op.index === undefined && (insertionIndex = this.local_replica.length);
        if (op.index < 0 || op.index >= this.local_replica.length) {
            throw new Error("Index out of bounds");
        }
        this.local_replica = this.local_replica.slice(0, insertionIndex).concat(op.char, this.local_replica.slice(insertionIndex))

        this.incrementModificationCounter();

    }
    
    incrementModificationCounter = () =>{
        this.modification_counter === this.update_frequency - 1 ? this.sendUpdate() : this.modification_counter+=1;
        setTimeout(this.modify, 1000);
    }

    sendUpdate = ()=>{
        this.modification_counter = 0;
        // send updates
    }

    updateVector = () => {}

    //
    merge = () => {}

    // when operations list is empty send goodby special massege
    onFinish = () => {

    }
}