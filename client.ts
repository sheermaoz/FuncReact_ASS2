type Timestamp = number[];

interface NeighborClient {
    id : number;
    client_host : string;
    port : number;
}

interface UpdateOperation {
    op : string;
    char? : string;
    index? : number;
}

interface ClientData {
    id : number;
    port : number;
    local_replica : string;
    clients : NeighborClient[];
    operations : UpdateOperation[];
}

class Client {
    id : number;
    port : number;
    local_replica : string;
    clients : NeighborClient[];
    operations : UpdateOperation[];
    // server : Server;
    timestamp_vector: Timestamp;
    update_frequency : number;
    modification_counter : number = 0;

    //Ido - type management ("isDelete"/"isInsert" ....)


    constructor(client : ClientData, update_frequency : number = 1) {
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
        let updateOP : UpdateOperation = this.operations.shift();
        updateOP.op === "delete" ? this.remove(updateOP) : this.insert(updateOP);

    }

    remove = (op : UpdateOperation) => {
        if (op.index === undefined || op.index < 0 || op.index >= this.local_replica.length) {
            throw new Error("Index out of bounds");
        }

        this.local_replica = this.local_replica.slice(0, op.index).concat(this.local_replica.slice(op.index+1));
        this.incrementModificationCounter();
    }

    insert = (op : UpdateOperation) => {
        if (op.char === undefined) 
        {
            throw new Error("Char is undefined");
            
        }
        if (op.index === undefined)
        {
            this.local_replica = this.local_replica.concat(op.char);
        }
        if (op.index < 0 || op.index >= this.local_replica.length) {
            throw new Error("Index out of bounds");
        }
        this.local_replica = this.local_replica.slice(0, op.index).concat(op.char, this.local_replica.slice(op.index))

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