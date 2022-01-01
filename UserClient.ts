import net from "net";
// const readline = require("readline");

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });

export const serv = net.createServer();
export let port = 8080;
// rl.question("enter port num",(ans)=>{port=Number(ans)});

export const start = () => {
    serv.listen(port);
console.log(`listening on port ${port} `);

let socket = net.connect(3000,"127.0.0.1");
socket.on("update",(str)=>{console.log(JSON.parse(str))});
socket.on("goodbye",(str)=>{console.log("goodbye")});
// socket.emit("goodbye");
}
// serv.listen(port);
// console.log(`listening on port ${port} `);

// let socket = net.connect(3000,"127.0.0.1");
// socket.on("update",(str)=>{console.log(JSON.parse(str))});
// socket.on("goodbye",(str)=>{console.log("goodbye")});
// socket.emit("goodbye");

import * as T from "./types";
import { exit } from "process";
import { max } from "ramda";

export class UserClient {
    id : number;
    localPort : number;
    local_replica : string;
    // clients : T.NeighborClient[];
    client_sockets : net.Socket[] = [];
    loaclOperations : T.UpdateOperation[];
    previousUpdates : T.PreviousUpdate[] = [];
    updatesToSend : T.PreviousUpdate [] = [];
    server : net.Server;
    timestamp: number;
    // updateFrequency : number;
    // modificationCounter : number = 0;
    goodbyeCounter : number = 0; 

    prevUpdatesLog = []; // for testing needs
    


    constructor(id:number,port:number,initReplica:string="") {
        this.id = id;
        this.localPort = port;
        this.local_replica = initReplica;
        // this.clients = client.clients;
        this.loaclOperations = [];
        this.timestamp = 0;
        // this.updateFrequency = update_frequency;
        this.server = net.createServer();
        this.server.listen(this.localPort);
        /**
         * defining behavior on receiving messages and
         * storing the new sockets for future functionality
         */
        this.server.on('connection', (socket : net.Socket) => {
            this.setSocketProtocol(socket);
            // console.log(`socket.localPort: ${socket.localPort}\t socket.remotePort: ${socket.remotePort}`); // delete
            this.client_sockets.push(socket);
        });
    }

    // starting the client lifecycle
    start = () => {
        this.server.listen(this.localPort);
        // this.connectToClients();
        // this.modify();
    }

    // connect to all other clients as defined in assignment logic
    // connectToClients = () => {
    //     this.clients.filter((clt:T.NeighborClient) => clt.id > this.id).
    //     forEach((clt:T.NeighborClient) => {
    //         // connect, define behavior and store
    //         const socket = net.connect(clt.port, clt.client_host);
    //         this.setSocketProtocol(socket);
    //         this.client_sockets.push(socket);
    //     });
    // };

    connectToClient = (clientPort:number) => {
        const socket = net.connect(clientPort, "127.0.0.1");
            this.setSocketProtocol(socket);
            this.client_sockets.push(socket);
    }

    setSocketProtocol = (socket:net.Socket) => {
        socket.on("update",this.onUpdateMessage);
        socket.on("goodbye",this.onGoodbyeMessage);
    }

    // update msg protocol
    onUpdateMessage = (updateOps: string) => {
        const prevUpdate:T.PreviousUpdate[] = JSON.parse(updateOps);
        // prints only for the first operation in the array
        console.log(`Client <${this.id}> received an update operation <${prevUpdate[0].op},${prevUpdate[0].timestamp}> from client <${prevUpdate[0].id}>`);
        this.timestamp = max(this.timestamp, prevUpdate[prevUpdate.length-1].timestamp) + 1;
        this.merge(prevUpdate);
    }

    // goodbye msg protocol
    onGoodbyeMessage = () => {
        this.goodbyeCounter++;
        // this.onGoodbye();
    }
    
    // Apply one local update operation
    modify = () => {
        if (this.loaclOperations.length === 0) { 
            this.updatesToSend.length > 0 && this.sendUpdate();
            this.onFinish();
        }
        else {
            console.log(`modify - current replica: ${this.local_replica}`);//delete
            let updateOP : T.UpdateOperation = this.loaclOperations.shift();
            this.timestamp++;
            // apply operation
            T.isDelete(updateOP) ? this.local_replica = this.remove(this.local_replica,updateOP) :
            T.isInsert(updateOP) ? this.local_replica = this.insert(this.local_replica,updateOP) :
            console.log("unsupported operation");
            // store applied modification
            this.previousUpdates.push({op : updateOP, current_string : this.local_replica, timestamp : this.timestamp, id: this.id});
            // logging -delete
            this.prevUpdatesLog.push({op : updateOP.opName, current_string : this.local_replica, timestamp : this.timestamp, id: this.id});

            // store applied modification for update message distribution
            this.updatesToSend.push({op : updateOP, current_string : this.local_replica, timestamp : this.timestamp, id: this.id});
            this.incrementModificationCounter();
        }
    }
    
    // Apply delete operation on a given string
    remove = (stringToModify:string,op : T.DeleteOp):string => {
        if (op.index === undefined || op.index < 0 || op.index >= this.local_replica.length) {
            return stringToModify;
        }
        return stringToModify.slice(0, op.index).concat(stringToModify.slice(op.index+1));
    }

    // Apply insert operation on a given string
    insert = (stringToModify:string, op : T.InsertOp):string => {
        let insertionIndex:number = op.index;
        op.index === undefined && (insertionIndex = stringToModify.length);
        if (op.index < 0 || op.index >= stringToModify.length) {
            return stringToModify;
        }
        return stringToModify.slice(0, insertionIndex).concat(op.char, stringToModify.slice(insertionIndex))
    }

    /**
     * Updating the modification counter and sending
     * update accordingly to the updateFrequency value.
     * After all waiting 1 second and try appling the next loacl update operation.
     */
    incrementModificationCounter = () =>{
        this.modificationCounter === this.updateFrequency - 1 ? this.sendUpdate() : this.modificationCounter+=1;
        setTimeout(this.modify, 1000);
    }

    sendUpdate = ()=>{
        this.modificationCounter = 0;
        this.client_sockets.forEach((sock : net.Socket) => {
            sock.emit("update",JSON.stringify(this.updatesToSend));
            // console.log(`sending to remotePort ${sock.remotePort}`); // delete
        });
        this.updatesToSend = [];
    }

    // TODO: Fix Merge
    // merge = (prevUpdates : T.PreviousUpdate[]) => {
    //     let current_string = this.local_replica;
    //     console.log(`Client <${this.id}> started merging, from <${this.timestamp}> time stamp, on <${this.local_replica}>`);
    //     prevUpdates.forEach((prevUpdate) => {
    //         const insertionIndex = this.previousUpdates.findIndex((localPrevUpdate:T.PreviousUpdate) => 
    //             localPrevUpdate.timestamp>prevUpdate.timestamp ? true :
    //             localPrevUpdate.timestamp == prevUpdate.timestamp && localPrevUpdate.id > prevUpdate.id ? true : false
    //             );
    //     const replayOperations : T.PreviousUpdate[] = [prevUpdate].concat(this.previousUpdates.slice(insertionIndex)); 
    //     this.previousUpdates = this.previousUpdates.slice(0, insertionIndex);
    //     current_string = this.previousUpdates.length > 0 ? this.previousUpdates[this.previousUpdates.length-1].current_string : this.local_replica;
    //     while(replayOperations.length>0){
    //         let replay = replayOperations.pop();
    //         current_string = this.mergify(current_string,replay.op);
    //         console.log(`operation <${replay.op},${replay.timestamp}>, string: <${current_string}>`);
    //         this.previousUpdates.push({op : replay.op, current_string : current_string, timestamp : replay.timestamp, id: replay.id})
    //         // logging -delete
    //         this.prevUpdatesLog.push({op : replay.op, current_string : current_string, timestamp : replay.timestamp, id: replay.id});   

    //     }})
    //     this.local_replica = current_string;
    //     console.log(`Client <${this.id}> ended merging with string <${this.local_replica}>, on timestamp <${this.timestamp}>`);
    // }

    merge = (prevUpdates : T.PreviousUpdate[]) => {
        let current_string = this.local_replica;
        console.log(`Client <${this.id}> started merging, from <${this.timestamp}> time stamp, on <${this.local_replica}>`);
        prevUpdates.forEach((prevUpdate) => {
            const insertionIndex = this.previousUpdates.findIndex((localPrevUpdate:T.PreviousUpdate) => 
                localPrevUpdate.timestamp>prevUpdate.timestamp ? true :
                localPrevUpdate.timestamp == prevUpdate.timestamp && localPrevUpdate.id > prevUpdate.id ? true : false
                );
        const replayOperations : T.PreviousUpdate[] = [prevUpdate].concat(this.previousUpdates.slice(insertionIndex)); 
        this.previousUpdates = this.previousUpdates.slice(0, insertionIndex);
        current_string = this.previousUpdates.length > 0 ? this.previousUpdates[this.previousUpdates.length-1].current_string : this.local_replica;
        while(replayOperations.length>0){
            let replay = replayOperations.pop();
            current_string = this.mergify(current_string,replay.op);
            console.log(`operation <${replay.op},${replay.timestamp}>, string: <${current_string}>`);
            this.previousUpdates.push({op : replay.op, current_string : current_string, timestamp : replay.timestamp, id: replay.id})
            // logging -delete
            this.prevUpdatesLog.push({op : replay.op.opName, current_string : current_string, timestamp : replay.timestamp, id: replay.id});   

        }})
        this.local_replica = current_string;
        console.log(`Client <${this.id}> ended merging with string <${this.local_replica}>, on timestamp <${this.timestamp}>`);
    }


    /**
     * used to apply update operation during the merging procces
     * without affecting the updates sending procedure.
     */
    mergify = (stringToModify : string, updateOP : T.UpdateOperation):string => 
        T.isDelete(updateOP) ? this.remove(this.local_replica,updateOP) :
        T.isInsert(updateOP) ? this.insert(this.local_replica,updateOP) :
        stringToModify; // if updateOP is not supported do nothing    
    
    // When the client local operations list is empty send goodby special message.
    onFinish = () => {
        console.log(`Client <${this.id}> finished his local string modifications`);
        this.client_sockets.forEach((sock : net.Socket) => {
            sock.emit("goodbye"); 
            // console.log("sent goodbye to " + sock.remotePort); //delete
        });
        this.onGoodbye();
    }


    exit = ()=>exit()


    // apply goodbye logic
    // onGoodbye = () => {
    //     this.goodbyeCounter++;

    //     // console.log(`Client ${this.id} goodbye called "goodbye" counter: ${this.goodbye_counter}`); //delete

    //     if (this.goodbyeCounter === this.clients.length + 1)
    //     {
    //         console.log(`Client <${this.id}> is exiting, final replica: ${this.local_replica}`);
    //         // Terminate sockets before exiting the application.
    //         this.client_sockets.forEach((sock:net.Socket)=>{sock.destroy()});
    //         // data output for development testing
    //         const finalLogObject = {
    //             previous_updates: this.previousUpdates,
    //             final_timestamp: this.timestamp,
    //             updateLog: this.prevUpdatesLog
    //         };
    //         console.log(finalLogObject);
            
    //         exit();
    //     }
    // }
}

export default UserClient;