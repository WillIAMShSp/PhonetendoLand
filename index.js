const express = require("express");
const http = require("http");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { VirtualPad } = require("./build/VigemInputManager");

const socketIO = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new socketIO.Server(server);

const pads = new Map();

app.use(express.static(path.join(__dirname, "public")));

io.sockets.on("connection", (socket) => {
  console.log("User Connected");

  function log() {
    var array = ["Message from server:"];
    array.push.apply(array, arguments);
    socket.emit("log", array);
  }

  socket.on("message", (message) => {
    log("Message: ", message);
    socket.broadcast.emit("message", message);
  });

  socket.on("create or join", function (room) {
    log("Received request to create or join room " + room);

    var clientsInRoom = io.sockets.adapter.rooms.get(room);
    var numClients = clientsInRoom ? clientsInRoom.size : 0;

    log("Room " + room + " now has " + numClients + " client(s)");

    if (numClients === 0) {
      socket.join(room);
      log("Client ID " + socket.id + " created room " + room);
      socket.emit("created", room, socket.id);
    } else if (numClients === 1) {
      log("Client ID " + socket.id + " joined room " + room);
      io.sockets.in(room).emit("join", room);
      socket.join(room);
      socket.emit("joined", room, socket.id);
      io.sockets.in(room).emit("ready");
      const pad = new VirtualPad(socket.id);
      pads.set(socket.id, pad);
    } else {
      // max two clients
      socket.emit("full", room);
    }
  });

  socket.on("ipaddr", function () {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function (details) {
        if (details.family === "IPv4" && details.address !== "127.0.0.1") {
          socket.emit("ipaddr", details.address);
        }
      });
    }
  });

  socket.on("controllerInput", function (input) {
    const pad = pads.get(socket.id);
    if (!pad) {
      console.log("No virtual pad for socket:", socket.id);
      return;
    }

    pad.test("IT WORKS!!!");
  });
});

const port = process.env.PORT || 5555;

server.listen(port, () => {
  console.log("Listening on port:", port);
});
