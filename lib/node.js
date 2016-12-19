 'use strict';

 const EventEmitter = require('events');
 exports = module.exports = function nodeFactory(id) {
     const node = {
         events: new EventEmitter(),
         flags: {
             anyBiggerNodesAlive: false,
         },
         currentLeader: null,
         id: id,
         addPeers: (peers) => {
             node.peers = peers;
             setTimeout(() => {
                 node._sendElectionMessage();
             }, 100 * node.peers.length);
         },
         removePeer: (peer) => {
             const peerToRemoveIndex = node.peers.indexOf(parseInt(peer));
             node.peers.splice(peerToRemoveIndex, 1);
             setTimeout(() => {
                 node._sendElectionMessage();
             }, 100 * node.peers.length);
         },
         _sendElectionMessage: () => {
             node.flags.anyBiggerNodesAlive = false;
             let peersWithHigherIds = node.peers.filter((pId) => {
                 return pId > node.id;
             });
             peersWithHigherIds.forEach((peerId) => {
                 node.events.emit('ELECTION', {
                     to: peerId,
                     from: node.id
                 });
             });
             setTimeout(() => {
                 if (node.flags.anyBiggerNodesAlive === false) {
                     console.log(`I AM THE KING!`);
                     node.currentLeader = node.id;
                     node.peers.forEach((p) => {
                         node.events.emit('COORDINATOR', {
                             to: p,
                             from: node.id
                         });
                     });
                 }
             }, (100  * node.peers.length));
         },
         inbox: (message, args) => {
             switch (message) {
                 case 'ELECTION':
                     node.events.emit('ANSWER', {
                         to: parseInt(args.sender),
                         from: parseInt(node.id),
                         message: 'I AM ONLINE'
                     });
                     break;
                 case 'ANSWER':
                     node.flags.anyBiggerNodesAlive = true;
                     break;
                 case 'COORDINATOR':
                     if (args.sender < node.id) {
                         if (node.id == node.currentLeader) {
                           console.log(`HEY ${args.sender}, MY NODES ARE LOYAL TO ME!`);
                         } else {
                             console.log(`SO, YEAH... THATS AKWARD ${args.sender}, I'M GONNA GO AHEAD AND RE-ELECT ${node.currentLeader}`);
                         }
                         node._sendElectionMessage();
                     } else {
                         node.currentLeader = parseInt(args.sender);
                         node.flags.anyBiggerNodesAlive = true;
                         console.log(`LONG LIVE NODE ${args.sender}!`);
                     }
                     break;
                 default:
                     break;
             }
         }
     };

     return node;
 };
