const request = require('supertest');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(morgan('combined'));

const server = http.createServer(app);
const io = socketIo(server, {
	cors: { origin: "http://127.0.0.1:5173" },
});

io.on("connection", (socket) => {
	socket.on("join-room", (roomId, userId) => {
		socket.join(roomId);
		socket.to(roomId).broadcast.emit("user-connected", userId);
		socket.on("disconnect", () => {
			socket.to(roomId).broadcast.emit("user-disconnected", userId);
		});
	});
});

describe('Server Tests', () => {
	it('should respond with 404 for unknown routes', async () => {
		const res = await request(app).get('/unknown-route');
		expect(res.statusCode).toEqual(404);
	});
});

afterAll((done) => {
	server.close(done);
});
