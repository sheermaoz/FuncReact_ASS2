import * as T from "./types";
import Client from "./client";
const operations: T.UpdateOperation[] = [
  { opName: "insert", char: "d" },
  {
    opName: "delete",
    index: 0,
  },
];

const cltData: T.ClientData = {
  id: 1,
  port: 8050,
  local_replica: "abc",
  clients: [],
  operations: operations,
};

const clt:Client = new Client(cltData);
clt.start();

