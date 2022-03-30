// helper functions
function emptyDOM (elem){
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

function createDOM (htmlString){
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

function *makeConversationLoader(room) {
    var lastConvoTimestamp = room.timestamp;
    var lastConvo;
    var runningFlag = true;

    while(runningFlag) {
        room.canLoadConversation = false;
        const res = Service.getLastConversation(room.id, lastConvoTimestamp);
        res.then(result => {
            if (result) {
                lastConvo = result;
                room.addConversation(result);
                room.canLoadConversation = true;
                lastConvoTimestamp = result.timestamp;
            } else {
                room.canLoadConversation = false;
                runningFlag = false;
            }
        });
        yield lastConvo;
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


// classes
class LobbyView {
    constructor(lobby) {
        this.lobby = lobby;
        this.elem = createDOM(
            `
            <div class="content">
                <ul class="room-list">
                <li>
                    <a href="#/chat">Everyone in CPEN322</a>
                </li>
                <li>
                    <a href="#/chat">Foodies only</a>
                </li>
                <li>
                    <a href="#/chat">Gamers unite</a>
                </li>
                </ul>
                <div class="page-control">
                <input type="text" placeholder="Room Title">
                <button>Create Room</button>
                </div>
            </div>
            `
        );
        this.listElem = this.elem.querySelector("ul.room-list");
        this.inputElem = this.elem.querySelector(".page-control input[type=text]");
        this.buttonElem = this.elem.querySelector(".page-control button");

        this.buttonElem.addEventListener("click", () => {
            this.clickHandler();
        });

        this.redrawList();

        this.lobby.onNewRoom = (room) => {
            var listItem = document.createElement('li');
            var linkItem = document.createElement('a');
            var linkText = document.createTextNode(room.name);
            linkItem.appendChild(linkText);
            linkItem.href = "/#/chat/" + room.id;
            listItem.appendChild(linkItem);
            this.listElem.appendChild(listItem);
        };
    }

    redrawList() {
        emptyDOM(this.listElem);

        for (var key in this.lobby.rooms) {
            var room = this.lobby.rooms[key];

            var listItem = document.createElement('li');
            var linkItem = document.createElement('a');
            var linkText = document.createTextNode(room.name);
            linkItem.appendChild(linkText);
            linkItem.href = "/#/chat/" + room.id;
            listItem.appendChild(linkItem);
            this.listElem.appendChild(listItem);
        }
    }

    clickHandler() {
        var inputText = this.inputElem.value;
        let data = {
            name: inputText
        }
        this.inputElem.value = "";
        Service.addRoom(data)
            .then((response) => {
                let room = response;
                this.lobby.addRoom(room._id, room.name, room.image, room.messages);
            });
    }
}

class ChatView {
    constructor(socket) {
        this.elem = createDOM(
            `
            <div class="content">
                <h4 class="room-name"></h4>
                <div class="message-list">
                <div class="message">
                    <span class="message-user">Alice</span>
                    <span class="message-text">Hi guys</span>
                </div>
                <div class="message my-message">
                    <span class="message-user">Bob</span>
                    <span class="message-text">Hello</span>
                </div>
                </div>
                <div class="page-control">
                <textarea></textarea>
                <button>Send</button>
                </div>
            </div>
            `
        );

        this.socket = socket;
        this.room = null;

        this.titleElem = this.elem.querySelector("h4.room-name");
        this.chatElem = this.elem.querySelector("div.message-list");
        this.chatElem.addEventListener("wheel", (e) => {
            if (e.deltaY < 0 && this.chatElem.scrollTop <= 0 && this.room.canLoadConversation) {
                var s = this.room.getLastConversation.next();
            }
        });

        this.inputElem = this.elem.querySelector(".page-control textarea");
        this.inputElem.addEventListener("keyup", (e) => {
            if (e.key === "Enter" && e.shiftKey === false) {
                this.sendMessage();
            }
        });

        this.buttonElem = this.elem.querySelector(".page-control button");
        this.buttonElem.addEventListener("click", () => {
            this.sendMessage();
        });
    }

    sendMessage() {
        var text = this.inputElem.value;
        this.inputElem.value = "";

        let data = {
            roomId: this.room.id,
            text: text
        };

        this.room.addMessage(profile.username, sanitize(text));
        this.socket.send(JSON.stringify(data));
    }

    setRoom(room) {
        this.room = room;
        this.titleElem.innerText = room.name;
        emptyDOM(this.chatElem);

        for (var msg in room.messages) {
            var msgDiv = document.createElement('div');
            if (msg.username === profile.username) {
                msgDiv.className = "message my-message";
            } else {
                msgDiv.className = "message";
            }

            var userSpan = document.createElement('span');
            userSpan.innerText = room.messages[msg].username;
            userSpan.className = "message-user";

            var textSpan = document.createElement('span');
            textSpan.innerText = room.messages[msg].text;
            textSpan.className = "message-text";

            msgDiv.appendChild(userSpan);
            msgDiv.appendChild(textSpan);

            this.chatElem.appendChild(msgDiv);
        }

        this.room.onNewMessage = (message) => {
            var msgDiv = document.createElement('div');
            if (message.username === profile.username) {
                msgDiv.className = "message my-message";
            } else {
                msgDiv.className = "message";
            }

            var userSpan = document.createElement('span');
            userSpan.innerText = message.username;
            userSpan.className = "message-user";

            var textSpan = document.createElement('span');
            textSpan.innerText = message.text;
            textSpan.className = "message-text";

            msgDiv.appendChild(userSpan);
            msgDiv.appendChild(textSpan);

            this.chatElem.appendChild(msgDiv);
        }

        this.room.onFetchConversation = (conversation) => {
            let hb = this.chatElem.scrollHeight;
            const messages = conversation.messages;

            messages.slice().reverse().forEach(message => {
                var msgDiv = document.createElement('div');
                if (message.username === profile.username) {
                    msgDiv.className = "message my-message";
                } else {
                    msgDiv.className = "message";
                }

                var userSpan = document.createElement('span');
                userSpan.innerText = message.username;
                userSpan.className = "message-user";

                var textSpan = document.createElement('span');
                textSpan.innerText = message.text;
                textSpan.className = "message-text";

                msgDiv.appendChild(userSpan);
                msgDiv.appendChild(textSpan);

                this.chatElem.prepend(msgDiv);
            });
            let ha = this.chatElem.scrollHeight;
            this.chatElem.scrollTop = ha - hb;
        };
    }
}

class ProfileView {
    constructor() {
        this.elem = createDOM(
            `
            <div class="content">
                <div class="profile-form">
                <div class="form-field">
                    <label>Username</label>
                    <input type="text" placeholder="Username">
                </div>
                <div class="form-field">
                    <label>Password</label>
                    <input type="password">
                </div>
                <div class="form-field">
                    <label>Avatar image</label>
                    <input type="file">
                </div>
                </div>
                <div class="page-control">
                <button>Save</button>
                </div>
            </div>
            `
        );
    }
}

class Room {
    constructor (id, name, image, messages) {
        if (!image) {
            this.image = "assets/everyone-icon.png";
        } else {
            this.image = image;
        }

        if (!messages) {
            this.messages = [];
        } else {
            this.messages = messages;
        }

        this.id = id;
        this.name = name;

        this.getLastConversation = makeConversationLoader(this);
        this.canLoadConversation = true;
        this.timestamp = Date.now();
    }

    addMessage(username, text) {
        if (text.trim() != "") {
            var msg = {
                username: username,
                text: text
            }
            this.messages.push(msg);
        }

        if (this.onNewMessage) {
            this.onNewMessage(msg);
        }
    }

    addConversation(conversation) {
        this.messages = conversation.messages.concat(this.messages);
        this.onFetchConversation(conversation);
    }
}

class Lobby {
    constructor() {
        this.rooms = {};
    }

    getRoom(roomId) {
        if (this.rooms.hasOwnProperty(roomId)) {
            return this.rooms[roomId];
        } else {
            return undefined;
        }
    }

    addRoom(id, name, image, messages) {
        var newRoom = new Room(id, name, image, messages);
        this.rooms[id] = newRoom;

        if (this.onNewRoom) {
            this.onNewRoom(newRoom);
        }
    }
}

var profile = {};

var Service = {
    origin: window.location.origin,
    getAllRooms: function() {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            var url = Service.origin + "/chat";

            xhr.open("GET", url);
            xhr.onload = function() {
                if (xhr.status == 200) {
                    resolve(JSON.parse(xhr.response));
                } else {
                    reject(new Error(xhr.response));
                }
            };
            xhr.onerror = function() {
                reject(new Error(xhr.statusText));
            };
            xhr.send(null);
        });
    },
    addRoom: function(data) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            var url = Service.origin + "/chat";

            xhr.open("POST", url);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = function() {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.response));
                } else {
                    reject(new Error(xhr.response));
                }
            };
            xhr.onerror = function() {
                reject(new Error(xhr.statusText));
            };
            xhr.send(JSON.stringify(data));
        });
    },
    getLastConversation: function(roomId, before) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            var url = Service.origin + `/chat/${roomId}/messages?before=${before}`;

            xhr.open("GET", url);
            xhr.onload = function() {
                if (xhr.status == 200) {
                    resolve(JSON.parse(xhr.response));
                } else {
                    reject(xhr.response);
                }
            }
            xhr.onerror = function() {
                reject(new Error(xhr.statusText));
            };
            xhr.send(null);
        });
    },
    getProfile: function() {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            var url = Service.origin + '/profile';

            xhr.open("GET", url);
            xhr.onload = function() {
                if (xhr.status == 200) {
                    resolve(JSON.parse(xhr.response));
                } else {
                    reject(xhr.response);
                }
            }
            xhr.onerror = function() {
                reject(new Error(xhr.statusText));
            };
            xhr.send(null);
        });
    }
};



var main = function () {
    Service.getProfile()
        .then(result => {
            profile["username"] = result.username;
        });

    var lobby = new Lobby();

    var socket = new WebSocket('ws://localhost:8000');
    socket.addEventListener("message", (response) => {
        let msg = JSON.parse(response.data);
        let room = lobby.getRoom(msg.roomId);
        room.addMessage(msg.username, msg.text);
    });

    var lobbyView = new LobbyView(lobby);
    var chatView = new ChatView(socket);
    var profileView = new ProfileView();

    var renderRoute = function() {
        var urlHash = window.location.hash;
        const urlArr = urlHash.split("/");

        if (urlArr[1] == "") {
            var pageView = document.getElementById("page-view");
            emptyDOM(pageView);
            pageView.appendChild(lobbyView.elem);
        } else if (urlArr[1] == "chat") {
            var pageView = document.getElementById("page-view");
            emptyDOM(pageView);
            pageView.appendChild(chatView.elem);

            var chatRoomId = urlArr[2];
            var chatRoom = lobby.getRoom(chatRoomId);

            if (chatRoom) {
                chatView.setRoom(chatRoom);
            }
        } else if (urlArr[1] == "profile") {
            var pageView = document.getElementById("page-view");
            emptyDOM(pageView);
            pageView.appendChild(profileView.elem);
        } else {
            // 404
            var pageView = document.getElementById("page-view");
            emptyDOM(pageView);
        }
    }
    window.addEventListener("popstate", renderRoute);
    renderRoute();

    var refreshLobby = function() {
        Service.getAllRooms()
            .then(response => {
                for (var i in response) {
                    let room = response[i];
                    if (room._id in lobby.rooms) {
                        lobby.rooms[room._id].name = room.name;
                        lobby.rooms[room._id].image = room.image;
                    } else {
                        lobby.addRoom(room._id, room.name, room.image, room.messages);
                    }
                }
            })
            .catch((err) => {
                console.log(err);
            });
    };

    refreshLobby();
    setInterval(refreshLobby, 8000);

    cpen322.export(arguments.callee, {
        renderRoute: renderRoute,
        refreshLobby: refreshLobby,
        lobby: lobby,
        socket: socket,
        lobbyView: lobbyView,
        chatView: chatView,
        profileView: profileView
    });
}

window.addEventListener("load", main);