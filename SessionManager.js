const crypto = require('crypto');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
        let sessionToken = crypto.randomBytes(64).toString('hex');

        let obj = {
            username: username,
            timestamp: Date.now()
        }

        sessions[sessionToken] = obj;

        response.cookie("cpen322-session", sessionToken, {maxAge: maxAge});

        setTimeout(() => {
            delete sessions[sessionToken];
        }, maxAge)
	};

	this.deleteSession = (request) => {
        delete request["username"];
        delete sessions[request.session];
        delete request["session"];
	};

	this.middleware = (request, response, next) => {
		if (request && request.headers && request.headers.cookie){
            let cookieHeader = request.headers.cookie;
            const cookies = cookieHeader.split("; ");

            for (cookieString of cookies) {
               let cookie = cookieString.split("=")[1];

                if (this.getIsValidSession(cookie)) {
                    request.username = this.getUsername(cookie);
                    request.session = cookie;
                    next();
                } else {
                    next(new SessionError());
                    return;
                }
            }
        } else {
            next(new SessionError());
            return;
        }
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);

	this.getIsValidSession = (token) => (token in sessions);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;