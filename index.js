const express = require("express");
const http = require("http");
const path = require("path");
const socketio = require("socket.io");

global.presentations = {};

function nextPresentationId() {
    let presentationid = 0;
    while (presentations[presentationid]) {
        presentationid += 1;
    }
    return presentationid.toString();
}

global.appconfig = require('./config.json');
global.rootpath = __dirname;

const app = express();
const httpServer = http.createServer(app);
const io = new socketio.Server(httpServer);

io.on("connection", (socket) => {
  socket.on("start presentation", () => {
    let presentationid = Object.keys(presentations).find(p => presentations[p].host == socket);
    if (presentationid && presentations[presentationid]) {
        //delete presentations[presentationid];
    }else {
        presentationid = nextPresentationId();
        presentations[presentationid] = {
            host: socket,
            clients: [],
            raisedhands: [],
        };
        socket.emit("presentation created", presentationid);
        console.log("presentation created");
    }
  });
  socket.on('join presentation', (presentationid, nickname = 'User') => {
    socket.nickname = nickname;
    let oldpresentationid = Object.keys(presentations).find(p => presentations[p].clients.includes(socket));
    if (oldpresentationid && presentations[oldpresentationid]) {
        presentations[oldpresentationid].clients.splice(presentations[oldpresentationid].clients.indexOf(socket), 1);
    }

    if (presentationid && presentations[presentationid]) {
        presentations[presentationid].clients.push(socket);
        console.log("client added");
    }
  });
  socket.on("toggle raise hand", () => {
    let presentationid = Object.keys(presentations).find(p => presentations[p].clients.includes(socket));
    if (presentationid && presentations[presentationid]) {
        if (presentations[presentationid].raisedhands.includes(socket)) {
            presentations[presentationid].raisedhands.splice(presentations[presentationid].raisedhands.indexOf(socket), 1);
        }else{
            presentations[presentationid].raisedhands.push(socket);
        }
        console.log("hand toggled");
        presentations[presentationid].host.emit("update raised hands", presentations[presentationid].raisedhands.map(u => u.nickname));
    }
  });
  socket.on('disconnect', () => {
    let presentationid = Object.keys(presentations).find(p => presentations[p].clients.includes(socket));
    if (presentationid && presentations[presentationid]) {
        presentations[presentationid].clients.splice(presentations[presentationid].clients.indexOf(socket), 1);
        if (presentations[presentationid].raisedhands.includes(socket)) {
            presentations[presentationid].raisedhands.splice(presentations[presentationid].raisedhands.indexOf(socket), 1);
        }
    }
    
    presentationid = Object.keys(presentations).find(p => presentations[p].host == socket);
    if (presentationid && presentations[presentationid]) {
        delete presentations[presentationid];
    }
  });
});

app.use('/', express.static(path.join(rootpath, 'public')));
app.get('/:presentationId', (req, res) => {
    res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.5, user-scalable=no" />
</head>
<body>
<div>
<input id="nickname" type="text" placeholder="digite seu nome" length="150"></input><button id="joinButton">ENTRAR</button>
</div>
<br/>
<br/>
<br/>
<br/>
<button id="raiseHandButton" style="font-size: 25px">LEVANTAR MÃO</button>
<script src="/socket.io/socket.io.js"></script>
<script>
let presentationId = "${req.params.presentationId}";
let nickname = "USER";
let socket = io();
document.getElementById("joinButton").onclick = () => {
    nickname = document.getElementById("nickname").value;
    socket.emit("join presentation", presentationId, nickname);
};

socket.on("connect", () => {
    console.log("connected");
});

document.getElementById("raiseHandButton").onclick = () => {
    socket.emit("toggle raise hand");
};
</script>
</body>
</html>
    `);
});

httpServer.listen(3000);