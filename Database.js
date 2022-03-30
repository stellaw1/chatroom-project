const { MongoClient, ObjectID, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatrooms from `db`
			 * and resolve an array of chatrooms */
			const col = db.collection('chatrooms');
			col.find({}).toArray(function(err, items) {

					if (err) {
						reject(err);
					}

					resolve(items);
				});
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatroom from `db`
			 * and resolve the result */

			const col = db.collection('chatrooms');

			if (ObjectId.isValid(room_id)) {
				col.findOne({_id: ObjectId(room_id)}, function(err, document) {
					if (document) {
						resolve(document);
					} else {
						// did not find any records with _id = ObjectId(room_id), now try just _id = room_id
						col.findOne({_id: room_id}, function(err, document) {
							if (err) {
								reject(err);
							}
							resolve(document);
						});
					}
				});
			} else {
				// room_id is not valid ObjectId so find with string id
				col.findOne({_id: room_id}, function(err, document) {
					if (err) {
						reject(err);
					}

					resolve(document);
				});
			}


		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: insert a room in the "chatrooms" collection in `db`
			 * and resolve the newly added room */

			if (!room.hasOwnProperty("name")) {
				reject(new Error("invalid name field in room argument"));
			}

			let roomEntry = {
				name: room.name,
				image: room.image
			};

			if (room.hasOwnProperty("_id")) {
				roomEntry["_id"] = room._id;
			}

			const col = db.collection('chatrooms');
				col.insertOne(roomEntry, function(err, res){
					if(err){
						console.log(err);
					}
					resolve(roomEntry);
				});
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read a conversation from `db` based on the given arguments
			 * and resolve if found */
			let time = before;
			if (!before) {
				time = Date.now();
			}

			const col = db.collection('conversations');
			col.find({room_id: room_id}).toArray(function(err, items) {
				if (err) {
					reject(err);
				}
				if (items.length <= 0) {
					resolve(null);
				}

				let ret;

				items.forEach(item => {
					if (item.timestamp < time) {
						if ( !ret || ( ret && ret.timestamp < item.timestamp ) ) {
							ret = item;
						}
					}
				});
				resolve(ret);
			});
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: insert a conversation in the "conversations" collection in `db`
			 * and resolve the newly added conversation */
			if (!conversation.hasOwnProperty("room_id")) {
				reject(new Error("invalid room_id field in conversation argument"));
			}
			if (!conversation.hasOwnProperty("timestamp")) {
				reject(new Error("invalid timestamp field in conversation argument"));
			}
			if (!conversation.hasOwnProperty("messages")) {
				reject(new Error("invalid messages field in conversation argument"));
			}

			const col = db.collection('conversations');

			col.insertOne(conversation);

			col.findOne(conversation, function(err, conversationRecord) {
					if (err) {
						reject(err);
					}
					resolve(conversationRecord);
				});
		})
	)
}



Database.prototype.getUser = function(username){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatroom from `db`
			 * and resolve the result */

			const col = db.collection('users');

			col.findOne({username: username}, function(err, document) {
				if (err) {
					reject(err);
				}

				resolve(document);
			});
		})
	)
}

module.exports = Database;