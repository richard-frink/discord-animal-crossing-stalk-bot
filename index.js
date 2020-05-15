const { Client } = require('discord.js');
const { token } = require('./settings');
const https = require('https');

const client = new Client();
const fs = require('fs');
var cacheFile = "cache.txt";
var dayHash = {
	1:"MON",
	2:"TUES",
	3:"WED",
	4:"THUR",
	5:"FRI",
	6:"SAT"
};
// have to add 1 to result because cannot hash a -1 but needs -1 for calculations later on
var patternToNumberHash = {
	"idk":0,
	"fluctuating":1,
	"large spike":2,
	"decreasing":3,
	"small spike":4
};
var numberToPatternHash = {
	0:"idk",
	1:"fluctuating",
	2:"large spike",
	3:"decreasing",
	4:"small spike"
};

class Price {
	constructor(day, amPm, price) {
		this.day = day;
		this.amPm = amPm;
		this.price = price;
	}
}

class UserPrices {
	constructor(id, username) {
		this.id = id;
		this.username = " ";
		this.prices = [];
		this.sundayPrice = " ";
		this.pattern = 0;
	}

	addSundayPrice(price) {
		this.sundayPrice = price;
	}

	addPattern(pattern) {
		this.pattern = pattern;
	}

	addPrice(price){
		if (getDay() == 0) {
			this.addSundayPrice(price);
		}
		else {
			this.prices.push(price);
		}
	}

	removeLastPrice() {
		this.prices.splice(this.prices.length - 1, 1)
	}

	toString() {
		var result = this.id;
		result = result + "," + this.username;
		result = result + "," + numberToPatternHash[this.pattern];
		result = result + "," + this.sundayPrice;
		this.prices.forEach(function(price) {
			result = result + "," + price;
		});
		result = result + ";";
		return result;
	}

	toFormattedString() {
		var result = "**" + this.username + "**" + " -- SUN: " + this.sundayPrice;
		// /2 gets amount of days, %2 accounts for if there is only one price so far for a day
		var days = (this.prices.length / 2) + (this.prices.length % 2);
		for(var i = 1; i <= days; i++) {
			var day = dayHash[i];
			var price1 = this.prices[(i-1)*2];
			if (price1 == " ")
				price1 = "none";
			result = result + "; " + day + ": " + price1;
			if (this.prices.length % 2 == 0 || i != days) {
				var price2 = this.prices[((i-1)*2) + 1];
				if (price2 != undefined) {
					if (price2 == " ")
						price2 = "none";
					var comma = ", ";
					result = result + comma + price2;
				}
			}
		}

		return result;
	}
}

function getAmOrPm() {
	var n = getHour();
	// PM shop hours
	if (n > 11 && n < 22)
		return 0;
	// AM shop hours
	else if (n > 7 && n < 12)
		return 1;
	else
		return -1;
}

function getDay() {
	var d = new Date();
	return d.getDay();
}

function getHour() {
	var d = new Date();
	return d.getHours();
}

function parseLine(line) {
	if (line == "")
		return null;
	var prices = line.split(",");

	// user id
	var rawUser = prices[0];
	if (rawUser == "")
		return null;
	var user = new UserPrices(rawUser);

	// splce off user id
	prices.splice(0,1);

	// username
	var rawUsername = prices[0];
	if (rawUsername == "")
		return null;
	user.username = rawUsername;

	// splce off username
	prices.splice(0,1);

	// pattern
	var pattern = prices[0];
	if (pattern == undefined)
		pattern = "idk";
	user.addPattern(patternToNumberHash[pattern]);
	// splce off pattern
	prices.splice(0,1);


	// sunday price
	var sunday = prices[0];
	user.addSundayPrice(sunday);

	// splice off sunday price
	prices.splice(0,1);

	// add anything left as prices
	prices.forEach(function(price) {
		user.addPrice(price);
	});

	return user;
}

function addPriceForUser(users, id, username, price) {
	var notFound = true;
	users.forEach(function(user) {
		if (user.id == id) {
			// we found the id in our list
			// we should have caught up this user with a blank by now,
			//		so we need to remove the blank, then add the new price
			user.removeLastPrice();
			user.addPrice(price);
			notFound = false;
		}
	});
	if (notFound) {
		// starting fresh
		var user = new UserPrices(id);
		user.username = username;
		user = catchUpUser(user);
		user.removeLastPrice();
		user.addPrice(price)
		users.push(user);
	}

	return users;
}

function catchUpUser(user) {
	var days = [1, 2, 3, 4, 5, 6];
	// decide the current day, and am or pm
	var today = getDay();
	var amOrPm = getAmOrPm();
	if (getHour() <= 7) {
		today = today - 1;
	}

	// for each day, should have two prices, add blanks for anything missing
	days.forEach(function(day) {
		if (today >= day) {
			if (getHour() >= 22 || getHour() < 8) {
				amOrPm = 0;
			}
			while (user.prices.length < ((day * 2) - amOrPm))
				user.addPrice(" ");
		}
	});

	return user;
}

function getStaleCache() {
	var rawCache = "";
	var parts = [];
	var users = [];
	var data = fs.readFileSync(cacheFile, 'utf-8');

	rawCache = data.toString('utf-8');
	parts = rawCache.split(";");
	parts.forEach(function(part) {
		var user = parseLine(part);
		if (user != null) {
			users.push(user);
		}
	});

	return users;
}

// read file
function getCache() {

	var staleUsersCache = getStaleCache();

	var updatedUsers = [];
	staleUsersCache.forEach(function(user) {

		updatedUsers.push(catchUpUser(user));
	});

	return updatedUsers;
}

function updateCache(users) {
	var newFile = "";
	users.forEach(function(user) {
		newFile = newFile + user.toString();
	});
	updateFile(newFile);
}

function updateFile(content) {
	fs.writeFile(cacheFile, content, 'utf8', function (err) {
		if (err) return console.log(err);
	});
}

function formatPrices(users) {
	var output = "here are the current prices:\r\n";
	users.forEach(function(user) {
		output = output + user.toFormattedString() + "\r\n";
	});
	return output;
}

// deprecated till I can make it happen in discord
function getBasicPricesForAnalysis(user) {
	var prices = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];

	if (user.sundayPrice == " ") {
		prices[0] = 110;
		prices[1] = 110;
	}
	else {
		prices[0] = user.sundayPrice;
		prices[1] = user.sundayPrice;
	}
	for (var i = 2; i - 2 < user.prices.length; i++) {
		if (user.prices[i - 2] != " ")
			prices[i] = user.prices[i - 2];
	}
	return prices;
}

function getUsersTurnipProphetLink(user) {
	var result = "https://turnipprophet.io";

	return result + getUsersLink(user);
}

function getUsersLink(user) {
	var prices = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];

	if (user.sundayPrice == " ") {
		prices[0] = 110;
	}
	else {
		prices[0] = user.sundayPrice;
	}
	for (var i = 1; i - 1 < user.prices.length; i++) {
		if (user.prices[i - 1] != ".")
			prices[i] = user.prices[i - 1];
	}

	var result = "/?prices=";
	prices.forEach(price => {
		var toAdd = price;
		if (isNaN(toAdd) || toAdd == " ")
			toAdd = "";
		result = result + toAdd + ".";
	});

	var pattern = user.pattern - 1;
	result = result + "&pattern=" + pattern;

	return result;
}

function getUserIdsInGuild(msg) {
	if (msg.guild === null)
		return [ msg.author.id ];

	return members = Array.from(msg.guild.members.keys());
}

var done = false;
var table_row = "";
callbackGET = function(response) {
	response.on('data',
		function(row) {
			table_row += row + "|";
			console.log(row);
			done = true;
		}
	);
}

function allResults(users) {
	var result = "here are all of the results: ";
	users.forEach(user => {
		result = result + "\r\n**" + user.username + "** " + getUsersTurnipProphetLink(user);
	});

	results += "\r\n\r\n Also here is the prediction chart: ";
	results += "\r\n|nam|dec|flu|lar|sma|";
	users.forEach(user => {
		var user_url = "http://localhost:5011" + getUsersLink(user);

		require('deasync').loopWhile(function () { return !done; });
		done = false;
		result += "\r\n" + user.username.slice(0,3) + table_row;
		table_row = "";
	});

	return result;
}

client.on("error", (e) => console.error(e));

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {

	// - my prices (buying and week's prices)

	// all prices (buying and week's prices for everyone)

	// clear out last weeks records on sunday

	var message = msg.content.toLowerCase();
	// get a user ID
		// msg.author.id;

	// reply to a user and mention anyone
		// msg.reply(toName(authorId))

	if (message.startsWith("!s track ")) {
		if (getAmOrPm() == -1 && getDay() != 0) {
			msg.reply("i'm not accepting prices at this time");
			return;
		}

		var id = msg.author.id;
		var username = msg.author.username;
		var num = message.replace("!s track ", "");

		if (isNaN(num))
			msg.reply(`i can only track numbers, try again`);
		else {

			// load data from file
			var users = getCache();

			// add a new number to the author
			users = addPriceForUser(users, "<@!" + id + ">", username, num);

			updateCache(users);

			msg.reply("thank you for helping us earn");

			// filter down to the people in the chat the command came from
			var userIds = getUserIdsInGuild(msg);
			var finalUsers = [];
			userIds.forEach(id => {
				users.forEach(user => {
					if (user.id.includes(id))
						finalUsers.push(user);
				});
			});
			msg.author.send(formatPrices(finalUsers));
			msg.author.send(allResults(finalUsers));
		}
	}
	else if (message.startsWith("!s prices")) {
		var users = getCache();

		// filter down to the people in the chat the command came from
		var userIds = getUserIdsInGuild(msg);
		var finalUsers = [];
		userIds.forEach(id => {
			users.forEach(user => {
				if (user.id.includes(id))
					finalUsers.push(user);
			});
		});

		var output = formatPrices(finalUsers);

		msg.reply(output);
	}
	else if (message.startsWith("!s results")) {
		var users = getCache();

		var id = msg.author.id;
		var thisUser = users[0];

		users.forEach(user => {
			if (user.id.includes(id))
				thisUser = user;
		});

		if (thisUser == undefined)
			return;

		var link = getUsersTurnipProphetLink(thisUser);

		msg.reply("please go here to see your results: " + link);
	}
	else if (message.startsWith("!s all-results")) {
		var users = getCache();

		// filter down to the people in the chat the command came from
		var userIds = getUserIdsInGuild(msg);
		var finalUsers = [];
		userIds.forEach(id => {
			users.forEach(user => {
				if (user.id.includes(id))
					finalUsers.push(user);
			});
		});

		msg.reply(allResults(finalUsers));
	}
	else if (message.startsWith("!s last-pattern")) {

		var id = msg.author.id;
		var pattern = message.replace("!s last-pattern ", "").toLocaleLowerCase();

		var choices = ["idk", "fluctuating", "large spike", "decreasing", "small spike"];
		if (!choices.includes(pattern)) {
			msg.reply("your pattern must be 'idk', 'fluctuating', 'large spike', 'decreasing', or 'small spike'");
			return;
		}

		var users = getCache();

		users.forEach(user => {
			if (user.id.includes(id)) {
				user.addPattern(patternToNumberHash[pattern]);
			}
		});

		updateCache(users);

		msg.reply("thanks, i'm tracking your pattern now");
	}
	else if (message.startsWith("!s clear")) {
		if (msg.author.id == "208327539192627201") {
			updateFile("");
			msg.reply("new week new stonks! The cache has been cleared.");
		}
	}
	else if (message.startsWith("test")) {
		console.log(msg.author);
	}
	else if (message.startsWith("!s help")) {
		msg.reply("here are the commands I know:\r\n!s track <your stalk price to track>\r\n!s prices\r\n!s results\r\n!s all-results\r\n!s last-pattern <your last pattern as words>\r\n!s snacks\r\n!s outsnacks");
	}
	else if (message.startsWith("!s snacks") || msg.content.startsWith("!s nacks")) {
		if (msg.author.id == 254064916061880320) {
			msg.reply("be patient Brendan");
		}
		else {
			msg.reply("it's almost snack time");
		}
	}
	else if (message.startsWith("!s outsnacks")) {
		if (msg.author.id == 254064916061880320) {
			msg.reply("liter challenge 2.0, ready go!");
		}
		else {
			msg.reply("time for a blue-moon onion");
		}
	}
});

client.login(token);
