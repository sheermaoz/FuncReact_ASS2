// import * as T from "./types";
// import Client from "./client";
const fs = require("fs");

fs.readFile(process.argv[2], (err, data) => {console.log(data.toString().split("\r\n"))})
// const operations: T.UpdateOperation[] = [
//   { opName: "insert", char: "d" },
//   {
//     opName: "delete",
//     index: 0,
//   },
// ];

// const cltData: T.ClientData = {
//   id: 1,
//   port: 8050,
//   local_replica: "abc",
//   clients: [],
//   operations: operations,
// };

// const clt:Client = new Client(cltData);
// clt.start();

