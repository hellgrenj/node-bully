'use strict';

const grpc = require('grpc');
const nodeFactory = require('../lib/node');
const port = parseInt(process.argv[2]); //node = 0, http.js = 1, {port} = 2
const nodeId = port;
const relativeElectionResponseTimeout = 100; // will be multiplied by the number of peers
const node = nodeFactory(nodeId, relativeElectionResponseTimeout);
const grpcWrapper = {};
const node_proto = grpc.load('./node.proto').nodeproto;

const server = new grpc.Server();
function inbox(call, callback) {
  if (call.request.type == 'COORDINATOR') {
      pingLeaderOnAnInterval();
  }
  node.inbox(call.request.type, {
      sender: parseInt(call.request.sender)
  });
  callback(null, {msg: ''});
}
function ping(call, callback) {
  callback(null, {msg: 'PONG'});
}
function addPeers(call, callback) {
  node.addPeers(call.request.peers.filter((p) => {
      return p != node.id;
  }));
  callback(null, {msg: 'I received the list of nodes, thank you!'});
}
server.addProtoService(node_proto.Peer.service, {inbox: inbox, ping: ping, peers: addPeers});
server.bind('0.0.0.0:' + nodeId, grpc.ServerCredentials.createInsecure());
server.start();

node.events.on('ELECTION', (e) => {
    sendToPeer(e.to, {
        type: 'ELECTION',
        sender: e.from
    });
});
node.events.on('ANSWER', (e) => {
    sendToPeer(e.to, {
        type: 'ANSWER',
        sender: e.from
    });

});
node.events.on('COORDINATOR', (e) => {
    sendToPeer(e.to, {
        type: 'COORDINATOR',
        sender: e.from
    });
});

function sendToPeer(port, payload) {
  let client = new node_proto.Peer('0.0.0.0:' + port,
  grpc.credentials.createInsecure());
  client.inbox(payload, function(err, response) {
    if(err){console.log(err);}
  });
}

function pingLeaderOnAnInterval() {
    clearInterval(grpcWrapper.pingLeaderInterval);
    grpcWrapper.pingLeaderInterval = setInterval(() => {
        if (node.id !== node.currentLeader) {
          const client = new node_proto.Peer('0.0.0.0:' + node.currentLeader,
          grpc.credentials.createInsecure());
          client.ping({msg:'ping'}, function(err, response) {
            if(err || response.msg !== 'PONG') {
              return node.removePeer(node.currentLeader);
            };
          });
        }
    }, 500 * node.peers.length);
}
process.send('up_and_running');
