/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

/**
 * Handle a user disconnecting
 *
 */
const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected :(`);
}

/**
 * Handle game start
 *
 */
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

}
