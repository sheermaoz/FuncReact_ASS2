import * as T from "./types";
import * as fs from "fs";
import * as Clt from "./client";


// fs.readFile(process.argv[2], (err, data) => { console.log(parse(data.toString())) });
// fs.readFile(process.argv[2], (err, data) => { console.log(data.toString()) });

const parse = (text:string):T.ClientData => {
    let lines:string[] = text.split("\r\n");
    const clientId:number = Number(lines.shift());
    // console.log(`clientId: ${clientId}`);
    const clientPort:number = Number(lines.shift());
    // console.log(`clientPort: ${clientPort}`);
    const initialString:string = lines.shift();
    // console.log(`initialString: ${initialString}`);
    let neighborClients:T.NeighborClient[] = [];
    let localUpdateOps:T.UpdateOperation[] = [];

    lines.shift();
    let line = lines.shift();
    while(line != ""){
        let neighborClientData:string[] = line.split(" ");
        neighborClients.push(T.createNeighborClient(Number(neighborClientData[0]),neighborClientData[1],Number(neighborClientData[2])));
        line = lines.shift();;
    }

    line = lines.shift();
    while(line != ""){
        localUpdateOps.push(createUpdateOperationFromLine(line));
        line = lines.shift();
    }

    return T.createClientData(clientId,clientPort,initialString,neighborClients,localUpdateOps);
    
}

const createUpdateOperationFromLine = (line: string):T.UpdateOperation => {
    const lineAsArray: string[] = line.split(" ");
    const opName:string = lineAsArray[0];
    if (opName === "delete"){
        return T.createDeleteOp(Number(lineAsArray[1]));
    }else{
        if (lineAsArray.length > 2){
            return T.createInsertOp(lineAsArray[1],Number(lineAsArray[2]));
        }else{
            return T.createInsertOp(lineAsArray[1]);
        }
    }
}
let clt:Clt.Client = undefined;
fs.readFile(process.argv[2], (err, data) => { 
        clt = new Clt.Client(parse(data.toString()));
        clt.start(); 
    });

// const clt:Client = new Client(cltData);
// clt.start();

