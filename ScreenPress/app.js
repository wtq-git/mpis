var path = require('path');
var express = require('express'), app = express(), http = require('http'), server = http.createServer(app), io = require('socket.io').listen(server), request = require("request");

server.listen(5000);

// routing
// a convenient variable to refer to the HTML directory
//var html_dir = './';

// routes to serve the static HTML files

// Note: route names need not match the file name
app.get('/LW', function(req, res) {
	//res.sendfile(html_dir + 'locationAware.html');
	res.sendFile(path.join(__dirname, '/locationAware.html'));
});


// displaynames which are currently connected to the chat
var displaynames = {};
var usernames = {};
var userLocations = {};
var mapLocations = {};
// display collection length
var displayColLength = {};
// display image collection
var displayImages = {};
// rooms which are currently available in chat
var rooms = ['room1', 'room2', 'room3'];
// Sample url : http://hostname/WordPressfolder/
var mainUrl = "http://localhost/wordpress3/";

// Calculating the distance between two lat and long
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
	var R = 6371;
	// Radius of the earth in km
	var dLat = deg2rad(lat2 - lat1);
	// deg2rad below
	var dLon = deg2rad(lon2 - lon1);
	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c;
	// Distance in m
	return d * 1000;
}

function deg2rad(deg) {
	return deg * (Math.PI / 180)
}

//updating the news
function mapRetriver(dipSocket) {
	
	if (displaynames[dipSocket]) {			
		request({
			url : mainUrl+"ambimajson/?ptype=tour&tourName=" + displaynames[dipSocket],
			json : true
		}, function(error, response, body) {

			if (!error && response.statusCode === 200) {
				if ( typeof body === 'object') {
					var count = Object.keys(body).length;
					//console.log(count);

					if (count != 0)
						// console.log(body[0]);

						var title;
					var lat;
					var lng;

					// check if user's location is close to place on the map

					var checkIfMatch = 0;
					if (userLocations[dipSocket]) {
						for (var entery in body) {
							title = body[entery]["title"];

							lat1 = userLocations[dipSocket]['G'];
							//user's location (lat)
							lng1 = userLocations[dipSocket]['K'];
							//user's location (lng)
							lat2 = body[entery]["lat"];
							//lat of a place on the map
							lng2 = body[entery]["lng"];
							//lng of a place on the map

							// Calculating the distance
							var tempDistance = getDistanceFromLatLonInKm(lat1, lng1, lat2, lng2);
							// Push the information if the distance is < X
							if (tempDistance < 42) {

								io.sockets.connected[dipSocket].emit('pushInfo', body[entery]);
								checkIfMatch = 1;
							}

							console.log(getDistanceFromLatLonInKm(lat1, lng1, lat2, lng2));

						}
					}
					if (checkIfMatch == 0) {
						io.sockets.connected[dipSocket].emit('pushInfo', "");
					}
					if (displaynames[dipSocket]) {
						io.sockets.connected[dipSocket].emit('updateMap', body);
				
					}

				}
			}

		});

	}

}

//updating main user
function userRetriver(dipSocket) {

	if (displaynames[dipSocket]) {

		request({
			url : mainUrl+"ambimajson/?ptype=user&username=" + usernames[dipSocket],
			json : true
		}, function(error, response, body) {

			if (!error && response.statusCode === 200) {
				if ( typeof body === 'object') {
					var count = Object.keys(body).length;
					//console.log(count);
					for (var entery in body) {
						// console.log(body[entery]);
					}
					if (count != 0)
						// console.log(body[0]);

						if (displaynames[dipSocket]) {
							io.sockets.connected[dipSocket].emit('updateUser', body,userLocations[dipSocket]);
							// console.log(body);
						}

				}
			}

		});

	}

}

io.sockets.on('connection', function(socket) {

	// when the client emits 'adddisplay', this listens and executes
	socket.on('adddisplay', function(displayname, username) {
		// store the displayname in the socket session for this client
		socket.displayname = displayname;
		// console.log(displayname);
		// store the room name in the socket session for this client
		socket.room = 'room1';
		// add the client's displayname to the global list
		displaynames[socket.id] = displayname;
		usernames[socket.id] = username;

		//console.log(socket.id);
		io.sockets.connected[socket.id].emit('socketId', socket.id);

		// send client to room 1
		socket.join('room1');

		io.sockets.emit('updatedisplays', displaynames);
		mapRetriver(socket.id);

	});

	socket.on('addsender', function(displayname) {
		//console.log(displayname);
		socket.emit('updatedisplays', displaynames);

		request({
			url : url_users,
			json : true
		}, function(error, response, body) {

			//console.log(body) // Print the json response
			//console.log(body[0]['title']);
			var tempThumbs = "";
			for (var entery in body) {
				var tempThumb = '<option value="' + body[entery]["thumb"] + '">' + body[entery]["title"] + '</option>';
				//if (body[entery]["wpcf-group-mail"] != 1) {
				tempThumbs = tempThumbs + tempThumb;
				//console.log(entery + ": " + body[entery]["wpcf-group-mail"]);
				//}
			}

			socket.emit('updateusers', tempThumbs);
		})
	});

	socket.on('needUserProfile', function(username, sId, latLng) {
		// console.log(latLng);
		userLocations[sId] = latLng;
		// console.log(userLocations[sId]);
		// console.log(latLng);
		userRetriver(socket.id);
		mapRetriver(socket.id);
	});

	// when the display disconnects.. perform this
	socket.on('disconnect', function() {
		if (socket.displayname) {
			// remove the displayname from global displaynames list
			delete displaynames[socket.id];
			delete displayColLength[socket.id];
			delete usernames[socket.id];
			delete userLocations[socket.id];
			// update list of displays in chat, client-side

			io.sockets.emit('updatedisplays', displaynames);
			// echo globally that this client has left

			socket.leave(socket.room);
		}
	});
});
