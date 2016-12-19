'use strict';


//clear screen
console.log('\u001B[2J\u001B[0;0f');
console.log('(Quit with CTRL + C)\n');

const http = require('http');
const fork = require('child_process').fork;
const nodes = [];
const nodeIds = [];
const numOfNodes = parseInt(process.argv[2]) || 5;
const basePort = 8000;
for (let i = 1; i <= numOfNodes; i++) {
    nodeIds.push(basePort + i);
}
process.setMaxListeners(numOfNodes);

// run the demo
initNodes(nodeIds, () => {
    introduceNodes(nodes, () => {
        console.log(`\n> system up and running with ${nodes.length} nodes, they will now elect a leader \n`.toUpperCase());
        waitAWhileThenKillTheLeader(() => {
            waitAWhileThenBringTheInitialLeaderBackOnline(() => {
                waitAWhileThenHaveRogueNodeClaimThrone();
            });
        });
    });
});

function initNodes(nodeIds, done, index) {
    index = index || 0;
    const nodeId = nodeIds[index];
    console.log(`initiating node [${nodeId}]`);
    const nodeProc = fork('./wrapper/http.js', [nodeId], {
        silent: true
    });
    nodeProc.on('message', (msg) => {
        if (msg === 'up_and_running') {
            index++;
            if (index < nodeIds.length) {
                initNodes(nodeIds, done, index);
            } else {
                done();
            }
        }
    });
    nodeProc.stdout.on('data', function(data) {
        console.log(`[${nodeId}] says: ${data}`);
    });
    nodeProc.stdout.on('error', function(error) {
        console.log(`[${nodeId}] errors: ${error}`);
    });
    process.on('exit', () => {
        nodeProc.kill();
    });
    nodes.push({
        id: nodeId,
        proc: nodeProc
    });
}

function waitAWhileThenKillTheLeader(done) {
    setTimeout(() => {
        console.log('> killing current leader, remaining nodes will elect a new leader\n'.toUpperCase());
        nodes[nodes.length - 1].proc.kill();
        done();
    }, 1000 * nodes.length);
}

function waitAWhileThenBringTheInitialLeaderBackOnline(done) {
    setTimeout(() => {
        console.log('> bringing the initial leader back online\n'.toUpperCase());
        bringInitialLeaderBackOnline(done);
    }, 1500 * nodes.length);
}

function introduceNodes(nodes, done, index) {
    index = index || 0;
    const nodeId = nodes[index].id;
    const options = {
        host: 'localhost',
        path: '/peers',
        port: nodeId,
        method: 'POST'
    };
    const req = http.request(options, function(response) {
        let str = '';
        response.on('data', function(chunk) {
            str += chunk;
        });
        response.on('end', function() {
            if (response.statusCode == 200) {
                index++;
                if (index < nodeIds.length) {
                    introduceNodes(nodes, done, index);
                } else {
                    done();
                }
            } else {
                console.log('failed to initiate node, responded with status code', response.statusCode);
                process.exit(1);
            }

        });
    });
    req.write(JSON.stringify(nodeIds));
    req.end();
}

function bringInitialLeaderBackOnline(done) {
    const initialLeaderIndex = nodes.length - 1;
    const initialLeader = nodes[initialLeaderIndex];
    nodes[initialLeaderIndex].proc = fork('./wrapper/http', [initialLeader.id], {
        silent: true
    });
    nodes[initialLeaderIndex].proc.on('message', (msg) => {
        if (msg === 'up_and_running') {
            introduceNodes(nodes, done);
        }
    });
    nodes[initialLeaderIndex].proc.stdout.on('data', function(data) {
        console.log(`[${initialLeader.id}] says: ${data}`);
    });
    nodes[initialLeaderIndex].proc.stdout.on('error', function(error) {
        console.log(`[${initialLeader.id}] errors: ${error}`);
    });
}

function waitAWhileThenHaveRogueNodeClaimThrone() {
    setTimeout(() => {
        console.log('> Rogue node claims the throne, nodes will re-elect old leader\n'.toUpperCase());
        nodeIds.forEach((port) => {
            const options = {
                host: 'localhost',
                path: '/inbox',
                port: port,
                method: 'POST'
            };
            const req = http.request(options, (response) => {});
            req.write(JSON.stringify({
                type: 'COORDINATOR',
                sender: basePort // will be smaller than all of the active ports/nodes
            }));
            req.end();
        });
    }, 2000 * nodes.length);
}
