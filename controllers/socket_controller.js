//  Socket Controller

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

// list of socket-ids and their username
const rooms = [];

// a 'toggler' for a status of a waiting opponent 
let waiting_opponent = true;

// creating a temporary variabel with a name for room
let roomName = false;

//  Handle a user disconnecting

const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected :(`);
}

//  Handle game start

const handleGameStart = function () {
	debug(`Client ${this.id} wants to start the game`);

	// tell everyone connected to start their games
	io.emit('game:start')
}

module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	debug(`Client ${socket.id} connected`)

	// handle user disconnect
	socket.on('disconnect', handleDisconnect);

	// listen for 'game:start' event
	socket.on('game:start', handleGameStart)

	socket.on('user:joined', function (username) {

		// if there is no room creating a new room with id equal to the first users id
		if (!roomName) {
			roomName = 'room_' + this.id;
			let room = {
				id: roomName,
				users: [],
			};
			// push a new room to all rooms array
			rooms.push(room);
		} else {
			waiting_opponent = false;
		}

		// looking for a room with a name from temporary variabel in the rooms array
		const room = rooms.find(room => room.id === roomName);

		if (!room) {
			debug('There is no such room');
			return;
		}

		// join user to this room
		this.join(room.id);

		// associate socket id with username and store it in a room oject in the rooms array
		let user = {
			id: this.id,
			username: username,
		}

		room.users.push(user);

		// if we don't need to wait an opponent anymore:
		if (!waiting_opponent) {
			io.to(room.id).emit('user:opponent_found', waiting_opponent, room);
			// discard the temporary variables
			waiting_opponent = true;
			roomName = false;
		};

	});

}
