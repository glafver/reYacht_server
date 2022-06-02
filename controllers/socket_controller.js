//  Socket Controller

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

// list of socket-ids and their username
const rooms = [];

// a 'toggler' for a status of a waiting opponent 
let waiting_opponent = true;

// creating a temporary variabel with a name for room
let roomName = false;

// rematch variable initially set to 0, when user clicks to rematch, this will increment by one. If rematch equals 2, then both players have agreed to rematch and further functionality will follow.
let rematch = 0

// we declare class yacht for create a new yacht
class Yacht {

	// @length - how many spans our ship will take on battlefield
	// @row_start - the starting row of our ship 
	// @row_col - the starting column of our ship 
	// @vertical - horizontal ship = "0", vertical ship = "1"
	constructor(length, row_start, col_start, vertical) {
		this.row_start = row_start
		this.col_start = col_start

		// contains information about position of grid divs occupied by our ship
		this.points = this.getPoints(length, row_start, col_start, vertical)

		this.hit_points = []
		this.is_killed = false
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
//  Handle a user disconnecting
const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected :(`);
}

const getNewYachts = function () {
	const FIELD_SIZE = 10;
	const yacht_sizes = [4, 3, 2, 2];
	const yachts = [];

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
					break;
				}
			}

			// and if it fits or not fits the game field
			is_not_fit_field = new_yacht.isNotFitField(FIELD_SIZE, FIELD_SIZE)
			// and we repeat this logic until we get a proper yacht
		} while (is_near || is_not_fit_field);

		// if we get a proper yacht we push it to all yachts array
		yachts.push(new_yacht);
	}
	return yachts
}

const handleChatMessage = async function (data) {

	const room = rooms.find(room => room.users.find(user => user.id === this.id));
	if (!room) {
		return
	}
	// emit `chat:message` event to everyone EXCEPT the sender
	this.broadcast.to(room.id).emit('chat:message', data)
}

module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	// handle user disconnect
	socket.on('disconnect', handleDisconnect)

	socket.on('user:joined', function (username, yachts, callback) {

		// if there is no room creating a new room with id equal to the first sockets id
		if (!roomName) {
			roomName = 'room_' + this.id
			let room = {
				id: roomName,
				users: [],
			}
			// push a new room to all rooms array
			rooms.push(room);
		} else {
			waiting_opponent = false
		}

		// looking for a room with a name from temporary variable in the rooms array
		const room = rooms.find(room => room.id === roomName)

		if (!room) {
			return
		}

		// join user to this room
		this.join(room.id);

		// associate socket id with username and store it in a room oject in the rooms array
		let user = {
			id: this.id,
			username: username,
			move: false,
			killed_ships: 0
		}

		if (!yachts) {
			user.yachts = getNewYachts()
		} else {
			user.yachts = []
			for (let yacht of yachts) {
				if (yacht.vertical === 'horizontal') {
					yacht.vertical = 0
				} else {
					yacht.vertical = 1
				}
				let new_yacht = new Yacht(yacht.length, yacht.row_start, yacht.col_start, yacht.vertical)
				user.yachts.push(new_yacht)
			}
		}

		room.users.push(user);

		callback({
			yachts: user.yachts,
			waiting: waiting_opponent
		});

		// if we don't need to wait an opponent anymore:
		if (!waiting_opponent) {

			// choose a random user to move first
			let user_to_move_first = Math.floor(Math.random() * 2);
			room.users[user_to_move_first].move = true;

			// sever emit to second socket waiting status, opponent name and who move first
			socket.emit('user:opponent_found', waiting_opponent, room.users[0].username, room.users[1].move);

			// sever emit to first socket waiting status, opponent name and who move first
			socket.to(room.id).emit('user:opponent_found', waiting_opponent, username, room.users[0].move);

			// discard the temporary variables
			waiting_opponent = true;
			roomName = false;

		};
	});

	socket.on('chat:message', handleChatMessage);


	socket.on('game:shoot', (shootTarget) => {

		if (shootTarget) {
			const room = rooms.find(room => room.users.find(user => user.id === socket.id))

			if (!room) {
				return
			}

			const user = room.users.find(user => user.id === socket.id)
			const opponent = room.users.find(user => user.id !== socket.id)

			// Empty array that will contain all the enemy yacht points
			let opponentCoordinates = []

			// Declaring empty killedYacht variable - yacht will be pushed into here when it is killed, in order for it to be emitted to the client side
			let killedYacht = false;

			// Pushing all enemy yacht points into opponentCoordinates array
			opponent.yachts.map((yacht) => {
				yacht.points.map((point) => {
					opponentCoordinates.push(point)
				})
			})

			// Checking to see if opponent has a ship on a point we just clicked on, in which case it returns true, otherwise it returns false
			const isHit = opponentCoordinates.some(coordinate => {
				return coordinate.row === shootTarget.row && coordinate.col === shootTarget.col
			})

			// Mapping over opponent yachts
			opponent.yachts.map((yacht) => {
				// Mapping over points
				yacht.points.map((point) => {
					// Checking if user has hit a yacht point
					if (point.row === shootTarget.row && point.col === shootTarget.col) {

						// Since there exists a slight delay between clicking a correct coordinate, and said coordinate being blocked from further clicks, verification needs to be added to make sure the tile can't be clicked rapidly, in turn filling the hit_points array with multiple instances of the same coordinate and triggering other bugs down the line such as a yacht being killed, when it shouldn't be.

						// VERIFICATION - checking if the coordinate already exists in the array of hit_points and if it does, returning true, if it doesn't returning false
						const hasObj = yacht.hit_points.some(coordinate => {
							return coordinate.row === shootTarget.row && coordinate.col === shootTarget.col
						})

						// If hit_points doesn't already contain the hit coordinate, push the coordinate into hit_points
						if (!hasObj) {
							// Pushing the hit coordinate into hit_points
							yacht.hit_points.push(shootTarget)
						}

						// Checking if the amount of hit points equals the amount of total points for the yacht, in which case the yacht is killed and the is_killed status is set to true, for that yacht
						if (yacht.hit_points.length === yacht.points.length) {
							yacht.is_killed = true
							killedYacht = yacht
						}
					}
				})
			})

			// If yacht gets hit,
			if (isHit) {
				// Emit the hit to the client side
				io.in(room.id).emit('shot:hit', user.id, shootTarget, killedYacht)
				debug(killedYacht)
				// If it didn't get hit, the shot must have missed - emit this to the client side
			} else {
				io.in(room.id).emit('shot:miss', user.id, shootTarget)
			}

			// Returns true if all enemy yachts are killed - all enemy yacht is_killed === true, otherwise returns false
			const gameOver = opponent.yachts.every(yacht => {
				return yacht.is_killed === true
			})

			// If every enemy yacht gets killed - emit this to the client side
			if (gameOver) {
				io.in(room.id).emit('shot:winner', user.id, shootTarget, killedYacht)
			}
		}
	})

	socket.on('rematch:offer', username => {
	// Adding variables to find the room, opponent and current user
	const room = rooms.find(room => room.users.find(user => user.id === socket.id))
	const opponent = room.users.find(user => user.id !== socket.id)
	const user = room.users.find(user => user.id === socket.id)

	// Setting the rematch-button-clicker's yachts to a new set of yachts
	debug('old', user.yachts)
	user.yachts = getNewYachts();
	// Resetting the killedYacht variable
	killedYacht = undefined;
	debug(killedYacht)
	// getNewYachts()
	debug('new', user.yachts)

	// Emitting the recalibration of yachts aswell as the hp of the user's yachts and the yachts that have been killed to the user client.
	socket.emit('recalibrating:yachts', user.yachts)

	// If the rematch button is clicked twice, both players have agreed to rematch and rematch agreement functionality will follow.
	if (rematch < 2) {
		rematch += 1
		debug(rematch)
	} else {
		return
	}

	// Sending information to the other user that a rematch has been requested
	socket.broadcast.to(room.id).emit('rematch:requested')

	// If the rematch variable gets to 2 - it means both users have declared intent to rematch eachother
	if (rematch === 2) {
		debug(rematch)
		io.in(room.id).emit('rematch:agreed', user.yachts)
		rematch = 0
		debug(rematch)
	}
	})
}

