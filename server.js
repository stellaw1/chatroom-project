// assuming cpen322-tester.js is in the same directory as server.js
const cpen322 = require('./cpen322-tester.js');
const ws = require('ws');

const path = require('path');
const fs = require('fs');
const express = require('express');

const Database = require('./Database.js');
const SessionManager = require('./SessionManager.js');
const crypto = require('crypto');

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');


/*
 * helper functions
 */
function isCorrectPassword(password, saltedHash) {
	let salt = saltedHash.substring(0, 20);
	let storedHash = saltedHash.substring(20);

	let saltedPassword = password.concat(salt);

	let hash = crypto
		.createHash('sha256')
		.update(saltedPassword)
		.digest('base64');

	return hash == storedHash;
}

function errorHandler(err, req, res, next) {
	if (err instanceof SessionManager.Error) {
		if (req && req.headers && req.headers.accept == "application/json"){
			res.status(401).send(err)
		} else {
			res.redirect('/login');
		}
  	} else {
		res.status(500).send(err);
	}
}

function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    return string.replace(reg, (match)=>(map[match]));
}


/*
 * initialize variables
 */
var messages = {};
const messageBlockSize = 10;

var sessionManager = new SessionManager();

var db = Database("mongodb://localhost:27017", "cpen322-messenger");

db.getRooms()
	.then(result => {
		result.forEach(dbRoom => {
			messages[dbRoom._id] = [];
		});
	});


/*
 * express app
 */
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

// setup non middleware routing
app.route('/login')
	.post(function(req, res, next) {
		let username = req.body.username;
		let password = req.body.password;
		db.getUser(username)
			.then(result => {
				if (result != null && isCorrectPassword(password, result.password)) {
					sessionManager.createSession(res, username, 600000);
					res.redirect('/');
				} else {
					res.redirect('/login');
				}
			});
	});

// serve static files (client-side)
app.use('/login', express.static("./client/login.html"));
app.use('/style.css', express.static("./client/style.css"));

app.use('/', sessionManager.middleware, express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

// setup routing with middleware
app.route('/chat')
	.get(sessionManager.middleware, function(req, res, next) {
		var ret = [];
		db.getRooms()
			.then(result => {
				result.forEach(dbRoom => {
					ret.push({...dbRoom, ...{ "messages": messages[dbRoom._id]}});
				});
				res.send(JSON.stringify(ret));
			});
	})
	.post(sessionManager.middleware, function(req, res, next) {
		let data = req.body;

		if (data && data.hasOwnProperty("name")) {
			let room = {
				name: data.name,
				image: data.image
			}

			db.addRoom(room)
				.then(result => {
					if (result) {
						messages[result._id] = [];
						res.status(200).send(JSON.stringify(result))
					}
				});
		} else {
			res.status(400).send('data does not have a "name" field')
		}
	});

app.route('/chat/:room_id')
	.get(sessionManager.middleware, function(req, res, next) {
		let room_id = req.params.room_id;

		db.getRoom(room_id)
			.then(result => {
				if (result) {
					res.send(JSON.stringify(result));
				} else {
					res.status(404).send(`Room ${room_id} was not found`);
				}
			});
	})

app.route('/chat/:room_id/messages')
	.get(sessionManager.middleware, function(req, res, next) {
		let room_id = req.params.room_id;
		let before = req.query.before;

		db.getLastConversation(room_id, before)
			.then(result => {
				if (result) {
					res.send(JSON.stringify(result));
				} else {
					res.status(404).send(`Conversation was not found`);
				}
			});
	});

app.route('/profile')
	.get(sessionManager.middleware, function(req, res, next) {
		res.send({ username: req.username });
	});

app.route('/logout')
	.get(sessionManager.middleware, function(req, res, next) {
		sessionManager.deleteSession(req);
		res.redirect('/login');
	});

app.use(errorHandler);


const broker = new ws.WebSocketServer({ port: 8000 });
broker.on("connection", function(wsc, request) {
	if (request && request.headers && request.headers.cookie){
		let cookieHeader = request.headers.cookie;

		let cookie = cookieHeader.split("=")[1];

		if (sessionManager.getIsValidSession(cookie)) {
			wsc.on('message', function incoming(data, isBinary) {
				let username = sessionManager.getUsername(cookie);

				let msg = JSON.parse(data);
				let newMsg = {
					username: username,
					text: sanitize(msg.text)
				};
				if (msg.roomId in messages) {
					messages[msg.roomId].push(newMsg);
				} else {
					messages[msg.roomId] = [newMsg];
				}
				broker.clients.forEach(function each(client) {
						if (client !== wsc && client.readyState === ws.OPEN) {
							client.send(JSON.stringify(newMsg));
						}
					});

				// asst 4 stuff below
				if (messages[msg.roomId].length >= messageBlockSize) {
					let conversation = {
						room_id: msg.roomId,
						timestamp: Date.now(),
						messages: messages[msg.roomId]
					};

					db.addConversation(conversation)
						.then(result => {
							// empty messages array to collect new messages
							messages[msg.roomId] = [];
						});
				}
			});
		} else{
			wsc.close();
		}
	} else {
		wsc.close();
	}
})

cpen322.connect('http://99.79.42.146/cpen322/test-a5-server.js');
cpen322.export(__filename, { app, messages, broker, db, messageBlockSize, sessionManager, isCorrectPassword });
