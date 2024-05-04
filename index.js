const express = require("express");
const http = require("http");
const path = require("path");
const socketio = require("socket.io");
const expressHandlebars = require('express-handlebars');

const app = express();

const handlebars = expressHandlebars.create({
    defaultLayout: false,
    extname: '.html'
});

app.engine('.html', handlebars.engine);
app.set('view engine', '.html');

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
    }
  });
  socket.on("set multiple choice options", (MultipleChoiceOptions) => {
    let presentationid = Object.keys(presentations).find(p => presentations[p].host == socket);
    if (presentationid && presentations[presentationid]) {
        for (let i = 0; i < presentations[presentationid].clients.length; i++) {
            const client = presentations[presentationid].clients[i];
            client.emit("send multiple choice options", MultipleChoiceOptions);
            
        }
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
        presentations[presentationid].host.emit("update raised hands", presentations[presentationid].raisedhands.map(u => u.nickname));
    }
  });
  socket.on("send multiple choice answer", (choosedoption) => {
    let presentationid = Object.keys(presentations).find(p => presentations[p].clients.includes(socket));
    if (presentationid && presentations[presentationid]) {
        presentations[presentationid].host.emit("add multiple choice user answer", socket.nickname, choosedoption);
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
    res.render(path.join(rootpath, 'views', 'joinpresentation.html'), {presentationId: req.params.presentationId});
});

httpServer.listen(3000);