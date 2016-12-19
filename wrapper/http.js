'use strict';

const http = require('http');
const nodeFactory = require('../lib/node');
const port = process.argv[2]; //node = 0, http.js = 1, {port} = 2
const node = nodeFactory(port); //use port also as ID for node
const httpWrapper = {};

// public endpoints
http.createServer(function(request, response) {
    if (request.method === 'POST' && request.url === '/peers') {
        addPeers(request, response);
    } else if (request.method === 'POST' && request.url === '/inbox') {
        incomingMessage(request, response);
    } else if (request.method === 'POST' && request.url === '/ping') {
        ping(request, response);
    } else {
        response.statusCode = 404;
        response.end();
    }
}).listen(port).on('listening', () => {
  process.send('up_and_running');
});

// internal event handlers
node.events.on('ELECTION', (e) => {
    sendToPeer(e.to, {
        type: 'ELECTION',
        sender: node.id
    }, (resp) => {});
});
node.events.on('ANSWER', (e) => {
    sendToPeer(e.to, {
        type: 'ANSWER',
        sender: node.id
    }, (resp) => {});

});
node.events.on('COORDINATOR', (e) => {
    sendToPeer(e.to, {
        type: 'COORDINATOR',
        sender: node.id
    }, (resp) => {});
});

// private functions
function pingLeaderOnAnInterval() {
    clearInterval(httpWrapper.pingLeaderInterval);
    httpWrapper.pingLeaderInterval = setInterval(() => {
        if (node.id != node.currentLeader) {
            const options = {
                host: 'localhost',
                path: '/ping',
                port: node.currentLeader,
                method: 'POST'
            };
            const req = http.request(options, function(response) {
                let str = '';
                response.on('data', function(chunk) {
                    str += chunk;
                });
                response.on('end', function() {
                    if (response.statusCode != 200 || str != 'PONG') {
                        node.removePeer(node.currentLeader);
                    }
                });

            });
            req.write('PING');
            req.on('error', function(err) {
                node.removePeer(node.currentLeader);
            });
            req.end();
        }
    }, 500 * node.peers.length);
}

function incomingMessage(request, response) {
    let body = '';
    request.on('data', function(chunk) {
        body += chunk;
    }).on('end', function() {
        const message = JSON.parse(body);
        node.inbox(message.type, {
            sender: parseInt(message.sender)
        });
        if (message.type == 'COORDINATOR') {
            pingLeaderOnAnInterval();
        }
        response.writeHead(200, {
            'Content-Type': 'text/plain'
        });
        response.end('');
    });
}

function addPeers(request, response) {
    let body = '';
    request.on('data', function(chunk) {
        body += chunk;
    }).on('end', function() {
        let peers = JSON.parse(body);
        node.addPeers(peers.filter((p) => {
            return p != node.id;
        }));
        response.writeHead(200, {
            'Content-Type': 'text/plain'
        });
        response.end('I received the list of peers, thank you!');
    });
}

function sendToPeer(port, payload, done) {
    const req = http.request({
        host: 'localhost',
        path: '/inbox',
        port: port,
        method: 'POST'
    }, function(response) {
        let str = '';
        response.on('data', function(chunk) {
            str += chunk;
        });
        response.on('end', function() {
            done(str);
        });
    });
    req.write(JSON.stringify(payload));
    req.end();
}

function ping(request, response) {
    let body = '';
    request.on('data', function(chunk) {
        body += chunk;
    }).on('end', function() {
        response.writeHead(200, {
            'Content-Type': 'text/plain'
        });
        response.end('PONG');
    });
}
