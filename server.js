
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

app.get("/", (req, res) => {
  res.send("Ludo Multiplayer Server is running!");
});

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("create-room", () => {
    let code = makeRoomCode();

    while (rooms[code]) {
      code = makeRoomCode();
    }

    rooms[code] = {
      players: [socket.id]
    };

    socket.join(code);
    socket.data.roomCode = code;

    socket.emit("room-created", {
      code,
      players: 1
    });
  });

  socket.on("join-room", (code) => {
    code = String(code || "").trim().toUpperCase();

    const room = rooms[code];

    if (!room) {
      socket.emit("room-error", "Room not found!");
      return;
    }

    if (room.players.length >= 4) {
      socket.emit("room-error", "Room is full!");
      return;
    }

    if (room.players.includes(socket.id)) return;

    room.players.push(socket.id);
    socket.join(code);
    socket.data.roomCode = code;

    io.to(code).emit("room-updated", {
      code,
      players: room.players.length
    });

    socket.emit("room-joined", {
      code,
      players: room.players.length
    });
  });

  socket.on("game-action", (data) => {
    const code = socket.data.roomCode;

    if (!code || !rooms[code]) return;

    socket.to(code).emit("game-action", data);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;

    if (code && rooms[code]) {
      rooms[code].players =
        rooms[code].players.filter(id => id !== socket.id);

      io.to(code).emit("room-updated", {
        code,
        players: rooms[code].players.length
      });

      if (rooms[code].players.length === 0) {
        delete rooms[code];
      }
    }

    console.log("Player disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Ludo server running on port " + PORT);
});
