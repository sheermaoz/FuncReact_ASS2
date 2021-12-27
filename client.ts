import * as T from "./types";
import * as net from "net";
import { exit } from "process";
import { max } from "ramda";

export class Client {
    id : number;
    port : number;
    local_replica : string;
    clients : T.NeighborClient[];
    client_sockets : net.Socket[] = [];
    operations : T.UpdateOperation[];
    previous_updates : T.PreviousUpdate[] = [];
    updates_to_send : T.PreviousUpdate [] = [];
    server : net.Server;
    timestamp: number;
    update_frequency : number;
    modification_counter : number = 0;
    goodbye_counter : number = 0; 
    


    constructor(client : T.ClientData, update_frequency : number = 1) {
        this.id = client.id;
        this.port = client.port;
        this.local_replica = client.local_replica;
        this.clients = client.clients;
        this.operations = client.operations;
        this.timestamp = 0;
        this.update_frequency = update_frequency;
        this.server = net.createServer();
        this.server.listen(this.port);
        this.server.on('connection', (socket : net.Socket) => {
            socket.on("data", this.onData);
            console.log(`socket.localPort: ${socket.localPort}\t socket.remotePort: ${socket.remotePort}`);
            this.client_sockets.push(socket);
        });
    }

    start = () => {
        this.connectToClients();
        this.modify();
    }

    connectToClients = () => {
        this.clients.filter((clt:T.NeighborClient) => clt.id > this.id).forEach((clt:T.NeighborClient) => {
            const socket = net.connect(clt.port, clt.client_host);
            socket.on("data", this.onData);
            this.client_sockets.push(socket);
        });
    };

    onData = (data:string)=>{
        console.log(`client ${this.id} got msg: ${data}`); // delete
        if (data == "goodbye"){
           this.onGoodbye(); 
        }else{
            const prevUpdate:T.PreviousUpdate[] = JSON.parse(data);
            // prints only for the first operation in the array
            console.log(`Client <${this.id}> received an update operation <${prevUpdate[0].op},${prevUpdate[0].timestamp}> from client <${prevUpdate[0].id}>`);
            this.timestamp = max(this.timestamp, prevUpdate[prevUpdate.length-1].timestamp) + 1;
            this.merge(prevUpdate);
        }                
    }
    
    modify = () => {
        if (this.operations.length === 0) { 
            this.onFinish();
        }
        else {
            console.log(`modify - current replica: ${this.local_replica}`);//delete
            let updateOP : T.UpdateOperation = this.operations.shift();
            this.timestamp++;
            T.isDelete(updateOP) ? this.local_replica = this.remove(this.local_replica,updateOP) :
            T.isInsert(updateOP) ? this.local_replica = this.insert(this.local_replica,updateOP) :
            console.log("unsupported operation");
            this.previous_updates.push({op : updateOP, current_string : this.local_replica, timestamp : this.timestamp, id: this.id});
            this.updates_to_send.push({op : updateOP, current_string : this.local_replica, timestamp : this.timestamp, id: this.id});
            this.incrementModificationCounter();
        }
    }

    remove = (stringToModify:string,op : T.DeleteOp):string => {
        if (op.index === undefined || op.index < 0 || op.index >= this.local_replica.length) {
            return stringToModify;
        }
        return stringToModify.slice(0, op.index).concat(stringToModify.slice(op.index+1));
    }

    insert = (stringToModify:string, op : T.InsertOp):string => {
        let insertionIndex:number = op.index;
        op.index === undefined && (insertionIndex = stringToModify.length);
        if (op.index < 0 || op.index >= stringToModify.length) {
            return stringToModify;
        }
        return stringToModify.slice(0, insertionIndex).concat(op.char, stringToModify.slice(insertionIndex))
    }
    
    incrementModificationCounter = () =>{
        this.modification_counter === this.update_frequency - 1 ? this.sendUpdate() : this.modification_counter+=1;
        setTimeout(this.modify, 1000);
    }

    sendUpdate = ()=>{
        this.modification_counter = 0;
        this.client_sockets.forEach((sock : net.Socket) => {
            sock.write(JSON.stringify(this.updates_to_send));
            // console.log(`sending to remotePort ${sock.remotePort}`); // delete
        });
        this.updates_to_send = [];
    }

    //
    merge = (prevUpdates : T.PreviousUpdate[]) => {
        let current_string = this.local_replica;
        console.log(`Client <${this.id}> started merging, from <${this.timestamp}> time stamp, on <${this.local_replica}>`);
        prevUpdates.forEach((prevUpdate) => {
            const insertionIndex = this.previous_updates.findIndex((localPrevUpdate:T.PreviousUpdate) => 
                localPrevUpdate.timestamp>prevUpdate.timestamp ? true :
                localPrevUpdate.timestamp == prevUpdate.timestamp && localPrevUpdate.id > prevUpdate.id ? true : false
                );
        const replayOperations : T.PreviousUpdate[] = [prevUpdate].concat(this.previous_updates.slice(insertionIndex)); 
        this.previous_updates = this.previous_updates.slice(0, insertionIndex);
        current_string = this.previous_updates.length > 0 ? this.previous_updates[this.previous_updates.length-1].current_string : this.local_replica;
        while(replayOperations.length>0){
            let replay = replayOperations.pop();
            current_string = this.mergify(current_string,replay.op);
            console.log(`operation <${replay.op},${replay.timestamp}>, string: <${current_string}>`);
            this.previous_updates.push({op : replay.op, current_string : current_string, timestamp : replay.timestamp, id: replay.id})
        }})
        this.local_replica = current_string;
        console.log(`Client <${this.id}> ended merging with string <${this.local_replica}>, on timestamp <${this.timestamp}>`);
    }

    mergify = (stringToModify : string, updateOP : T.UpdateOperation):string => 
        T.isDelete(updateOP) ? this.remove(this.local_replica,updateOP) :
        T.isInsert(updateOP) ? this.insert(this.local_replica,updateOP) :
        stringToModify; // if updateOP is not supported do nothing
    

    // when operations list is empty send goodby special message
    onFinish = () => {
        console.log(`Client <${this.id}> finished his local string modifications`);
        this.client_sockets.forEach((sock : net.Socket) => {
            sock.write("goodbye"); 
            // console.log("sent goodbye to " + sock.remotePort); //delete
        });
        this.onGoodbye();
    }

    // gb:boolean = true;

    onGoodbye = () => {
        this.goodbye_counter++;

        // console.log(`Client ${this.id} goodbye called "goodbye" counter: ${this.goodbye_counter}`); //delete

        if (this.goodbye_counter === this.clients.length + 1)
        {
            console.log(`Client <${this.id}> is exiting, final replica: ${this.local_replica}`);
            this.client_sockets.forEach((sock:net.Socket)=>{sock.destroy()});
            exit();
        }
    }
}

export default Client;