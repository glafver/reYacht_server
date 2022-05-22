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

const getNewYachts = function () {
	const FIELD_SIZE = 10;
	const yacht_sizes = [4, 3, 2, 2];
	const yachts = [];

	// we declare class yacht for create a new yacht
	class Yacht {

		// @length - how many spans our ship will take on battlefield
		// @row_start - the starting row of our ship 
		// @row_col - the starting column of our ship 
		// @vertical - horizontal ship = "0", vertical ship = "1"
		constructor(length, row_start, col_start, vertical) {
			this.row_start = row_start
			this.col_start = col_start

			if (vertical === 0) {
				this.row_end = "span " + 1
				this.col_end = "span " + length
			} else {
				this.row_end = "span " + length
				this.col_end = "span " + 1
			}
			// contains information about position of grid divs occupied by our ship
			this.points = this.getPoints(length, row_start, col_start, vertical)
		}

		// checks if every point of a newly created yacht will intersect existing yachts
		isNear(other_yacht) {

			let current_yacht_points = this.points;
			let other_yacht_points = other_yacht.points;

			for (let current_yacht_point of current_yacht_points) {
				for (let other_yacht_point of other_yacht_points) {
					// points are considered as near if they have either same position or 
					// they are neighbours (neighbors mean row/colum difference is 1).
					if (Math.abs(current_yacht_point.row - other_yacht_point.row) <= 1
						&& Math.abs(current_yacht_point.col - other_yacht_point.col) <= 1) {

						return true;
					}
				}
			}

			return false;
		}
		// checks current yacht is located within battlefield
		isNotFitField(field_rows, field_columns) {

			let current_yacht_points = this.points;
			// we check if every point within battlefield. 
			// 0 < column <= field_columns
			// 0 < row    <= field_rows
			for (let point of current_yacht_points) {
				if (point.row >= field_rows || point.row < 0 || point.col >= field_columns || point.col < 0) {
					return true;
				}
			}

			return false;
		}

		// generates points for a nnew yacht
		getPoints(length, row_start, col_start, vertical) {
			let points = [{ row: row_start, col: col_start }];

			// if it is a 2 points ship
			if (length === 2) {
				// and it is horizontal
				if (vertical === 0) {
					// we keep the same row but add another column horizontally
					points.push({ row: row_start, col: col_start + 1 })
				} else {
					// if it is vertical we add another row
					points.push({ row: row_start + 1, col: col_start })
				}
				// do the same for other ships
			} else if (length === 3) {
				if (vertical === 0) {
					points.push({ row: row_start, col: col_start + 1 })
					points.push({ row: row_start, col: col_start + 2 })

				} else {
					points.push({ row: row_start + 1, col: col_start })
					points.push({ row: row_start + 2, col: col_start })
				}
			} else if (length === 4) {
				if (vertical === 0) {
					points.push({ row: row_start, col: col_start + 1 })
					points.push({ row: row_start, col: col_start + 2 })
					points.push({ row: row_start, col: col_start + 3 })

				} else {
					points.push({ row: row_start + 1, col: col_start })
					points.push({ row: row_start + 2, col: col_start })
					points.push({ row: row_start + 3, col: col_start })
				}
			}
			return points;
		}

	}

	// here we generate yachts based on how many yachts we need
	for (let i = 0; i < yacht_sizes.length; i++) {

		let new_yacht;
		let is_near;
		let is_not_fit_field;

		// we create a new yacht based on class constructor
		do {
			is_near = false;
			is_not_fit_field = false;
			new_yacht = new Yacht(yacht_sizes[i], Math.floor(Math.random() * FIELD_SIZE), Math.floor(Math.random() * FIELD_SIZE), Math.floor(Math.random() * 2));

			// then we check if the yacht is near other yachts
			for (let existing_yacht of yachts) {
				is_near = existing_yacht.isNear(new_yacht);

				if (is_near) {
					// console.log("intersection");
					break;
				}
			}

			// and if it fits or not fits the game field
			is_not_fit_field = new_yacht.isNotFitField(FIELD_SIZE, FIELD_SIZE)
			// and we repeat this logic until we get a proper yacht
		} while (is_near || is_not_fit_field);

		// if we get a proper yacht we push it to all yachts array
		yachts.push(new_yacht);
		// console.log('Added yacht: ', new_yacht);
	}
	return yachts
}

const handleChatMessage = async function (data) {

	const room = rooms.find(room => room.users.find(user => user.id === this.id));

	// emit `chat:message` event to everyone EXCEPT the sender
	this.broadcast.to(room.id).emit('chat:message', data);
}

module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	// debug(`Client ${socket.id} connected`)

	// handle user disconnect
	socket.on('disconnect', handleDisconnect);

	socket.on('user:joined', function (username, callback) {

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
			// debug('There is no such room');
			return;
		}

		// join user to this room
		this.join(room.id);

		// associate socket id with username and store it in a room oject in the rooms array
		let user = {
			id: this.id,
			username: username,
			yachts: getNewYachts()
		}
		// debug(user.yachts)
		room.users.push(user);

		callback({
			yachts: user.yachts,
			waiting: waiting_opponent
		});

		// if we don't need to wait an opponent anymore:
		if (!waiting_opponent) {
			io.to(room.id).emit('user:opponent_found', waiting_opponent, room);
			// discard the temporary variables
			waiting_opponent = true;
			roomName = false;
		};
	});

	socket.on('chat:message', handleChatMessage);

}
