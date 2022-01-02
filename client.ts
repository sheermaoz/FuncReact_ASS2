import * as T from "./types";
import * as net from "net";
import { exit } from "process";
import { max } from "ramda";

export class Client {

    id : number;
    localPort : number;
    local_replica : string;
    clients : T.NeighborClient[];
    client_sockets : net.Socket[] = [];
    localOperations : T.UpdateOperation[];
    previousUpdates : T.PreviousUpdate[] = [];
    updatesToSend : T.PreviousUpdate [] = [];
    server : net.Server;
    timestamp: number;
    updateFrequency : number;
    modificationCounter : number = 0;
    goodbyeCounter : number = 0; 
    minNeighbourTimestamps : Map<number,number> = new Map();
    

    constructor(client : T.ClientData, update_frequency : number = 2) {
        this.id = client.id;
        this.localPort = client.port;
        this.local_replica = client.local_replica;
        this.clients = client.clients;
        this.localOperations = client.operations;
        this.timestamp = 0;
        this.updateFrequency = update_frequency;
        this.server = net.createServer();
        this.server.listen(this.localPort);
        /**
         * defining behavior on receiving messages and
         * storing the new sockets for future functionality
         */
        this.server.on('connection', (socket : net.Socket) => {
            this.setSocketProtocol(socket);
            this.client_sockets.push(socket);
            this.checkNStartModify();
        });
    }

    // starting the client lifecycle
    start = () => {
        this.connectToClients();
    }

    // connect to all other clients as defined in assignment logic
    connectToClients = () => {
        this.clients.filter((clt:T.NeighborClient) => clt.id > this.id).
        forEach((clt:T.NeighborClient) => {
            // connect, define behavior and store
            const socket = net.connect(clt.port, clt.client_host);
            this.setSocketProtocol(socket);
            this.client_sockets.push(socket);
            this.checkNStartModify();
        });
    };

    /**
     * Make sure all clients are connected before starting local modifications
     */
    checkNStartModify = ()=>{
        this.client_sockets.length === this.clients.length && this.modify();
    }

    
    setSocketProtocol = (socket:net.Socket) => {
        socket.on("data",this.onData);
    }

    onData = (data : String) => {
        // buffer can include more then just one message - we're using \n as delemiter
        const split_data = data.toString().split("\n");
        for (let message of split_data) {
            message != "" &&  (message == "goodbye" ? this.onGoodbyeMessage() : this.onUpdateMessage(message));
        }
    }

    // update message protocol
    onUpdateMessage = (updateOps: string) => {
        const prevUpdate:T.PreviousUpdate[] = JSON.parse(updateOps);
        // prints only for the first operation in the array
        console.log(`Client <${this.id}> received an update operation <${prevUpdate[0].op},${prevUpdate[0].timestamp}> from client <${prevUpdate[0].id}>`); //obligatory
        this.timestamp = max(this.timestamp, prevUpdate[prevUpdate.length-1].timestamp) + 1;
        this.merge(prevUpdate);
        this.CleanPreviousOps(prevUpdate);
    }

    // goodbye message protocol
    onGoodbyeMessage = () => {
        this.onGoodbye();
    }

    CleanPreviousOps = (prevUpdate : T.PreviousUpdate[]) => {
        // update client (neighbor) last timestamp
        this.minNeighbourTimestamps.set(prevUpdate[prevUpdate.length-1].id, prevUpdate[prevUpdate.length-1].timestamp);
        // find total minimum timestamp
        let minimum : number = Infinity;
        this.minNeighbourTimestamps.forEach((timeStamp : number, id : number) => {timeStamp < minimum && (minimum = timeStamp);})
        // delete all operations with timestamp less than the minimum - they are not relevant anymore
        let prev : T.PreviousUpdate = this.previousUpdates[0];
        while (prev.timestamp < minimum) {
            // removed the irelevant operation
            this.previousUpdates.shift();
            console.log(`Client <${this.id}> removed operation <${prev.op.opName}, ${prev.timestamp}> from storage`);
            // get the next candidate
            prev = this.previousUpdates[0];
        }
    }
    
    // Apply one local update operation
    modify = () => {
        if (this.localOperations.length === 0) { 
            this.updatesToSend.length > 0 && this.sendUpdate();
            this.onFinish();
        }
        else {
            let updateOP : T.UpdateOperation = this.localOperations.shift();
            this.timestamp++;
            // apply operation
            T.isDelete(updateOP) ? this.local_replica = this.remove(this.local_replica,updateOP) :
            T.isInsert(updateOP) ? this.local_replica = this.insert(this.local_replica,updateOP) :
            console.log("unsupported operation");
            // store applied modification
            this.previousUpdates.push({op : updateOP, current_string : this.local_replica, timestamp : this.timestamp, id: this.id});
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
            sock.write(JSON.stringify(this.updatesToSend) + "\n");
        });
        this.updatesToSend = [];
    }

    // merge given operations to the local replica
    merge = (prevUpdates : T.PreviousUpdate[]) => {
        let current_string = this.local_replica;
        console.log(`Client <${this.id}> started merging, from <${this.timestamp}> time stamp, on <${this.local_replica}>`); //obligatory
        // merge each received update operation
        prevUpdates.forEach((prevUpdate) => {
            // get all preceding operations to the current update operation
            const prevToCurrent = this.previousUpdates.filter((localPrevUpdate:T.PreviousUpdate) => 
            localPrevUpdate.timestamp < prevUpdate.timestamp ? true :
            localPrevUpdate.timestamp == prevUpdate.timestamp && localPrevUpdate.id < prevUpdate.id ? true : false);
            // get all succeeding operations to the current update operation
            const postToCurrent = this.previousUpdates.filter((localPrevUpdate:T.PreviousUpdate) => 
            localPrevUpdate.timestamp>prevUpdate.timestamp ? true :
            localPrevUpdate.timestamp == prevUpdate.timestamp && localPrevUpdate.id > prevUpdate.id ? true : false);
            // get the newest preceding string
            current_string = prevToCurrent.length > 0 ? prevToCurrent[prevToCurrent.length-1].current_string : prevUpdate.current_string;
            
            if (prevToCurrent.length != 0 ){
                postToCurrent.unshift(prevUpdate);
            }
            else {
                prevToCurrent.unshift(prevUpdate);
            }
            // reapply all succeeding operations
            while(postToCurrent.length>0){
                let replay = postToCurrent.shift();
                current_string = this.mergify(current_string,replay.op);
                console.log(`operation <${replay.op},${replay.timestamp}>, string: <${current_string}>`); // obligatory
                prevToCurrent.push({op : replay.op, current_string : current_string, timestamp : replay.timestamp, id: replay.id})
            }
            this.previousUpdates = prevToCurrent;
    })
        this.local_replica = current_string;
        console.log(`Client <${this.id}> ended merging with string <${this.local_replica}>, on timestamp <${this.timestamp}>`); // obligatory
    }

    /**
     * used to apply update operation during the merging procces
     * without affecting the updates sending procedure.
     */
    mergify = (stringToModify : string, updateOP : T.UpdateOperation):string => 
        T.isDelete(updateOP) ? this.remove(stringToModify,updateOP) :
        T.isInsert(updateOP) ? this.insert(stringToModify,updateOP) :
        stringToModify; // if updateOP is not supported do nothing    
    
    // When the client local operations list is empty send goodby special message.
    onFinish = () => {
        console.log(`Client <${this.id}> finished his local string modifications`); // obligatory
        this.client_sockets.forEach((sock : net.Socket) => {
            sock.write("goodbye"); 
        });
        this.onGoodbye();
    }

    // apply goodbye logic
    onGoodbye = () => {
        this.goodbyeCounter++;

        if (this.goodbyeCounter === this.clients.length + 1)
        {
            console.log(`Client <${this.id}> is exiting, final replica: ${this.local_replica}`); // obligatory
            // Terminate sockets before exiting the application.
            this.client_sockets.forEach((sock:net.Socket)=>{sock.destroy()});            
            exit();
        }
    }
}

export default Client;