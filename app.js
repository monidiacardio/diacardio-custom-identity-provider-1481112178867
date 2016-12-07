var express = require('express');
var cfenv = require('cfenv');
var log4js = require('log4js');
var jsonParser = require('body-parser').json();
var Cloudant = require('cloudant');

// Using hardcoded user repository
/*var userRepository = {
	"john.lennon":      { password: "12345" , displayName:"John Lennon"      , dob:"October 9, 1940"},
	"paul.mccartney":   { password: "67890" , displayName:"Paul McCartney"   , dob:"June 18, 1942"},
	"ringo.starr":      { password: "abcde" , displayName:"Ringo Starr"      , dob: "July 7, 1940"},
	"george.harrison":  { password: "fghij" , displayName: "George Harrison" , dob:"Feburary 25, 1943"}
}*/

var app = express();
var logger = log4js.getLogger("CustomIdentityProviderApp");
logger.info("Starting up");

//To Store URL of Cloudant VCAP Services as found under environment variables on from App Overview page
var cloudant_url;
var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
// Check if services are bound to your project
if(process.env.VCAP_SERVICES)
{
	services = JSON.parse(process.env.VCAP_SERVICES);
	if(services.cloudantNoSQLDB) //Check if cloudantNoSQLDB service is bound to your project
	{
		cloudant_url = services.cloudantNoSQLDB[0].credentials.url;  //Get URL and other paramters
		console.log("Name = " + services.cloudantNoSQLDB[0].name);
		console.log("URL = " + services.cloudantNoSQLDB[0].credentials.url);
        console.log("username = " + services.cloudantNoSQLDB[0].credentials.username);
		console.log("password = " + services.cloudantNoSQLDB[0].credentials.password);
	}
}

//Connect using cloudant npm and URL obtained from previous step
var cloudant = Cloudant({url: cloudant_url});
//Edit this variable value to change name of database.
var db = cloudant.db.use('diacardio_users');

app.post('/addUsers', function(req, res){
	var update_obj = {"_id": "john.lennon", "password": "12345", "displayName": "John Lennon", "dob": "October 9, 1940" };
	db.insert(update_obj, function(err, data){
		if (err) {
			console.log('an error has occured');
		} else {
			console.log('inserted successfully');
		}
	});
});

app.post('/apps/:tenantId/:realmName/startAuthorization', jsonParser, function(req, res){
	var tenantId = req.params.tenantId;
	var realmName = req.params.realmName;
	var headers = req.body.headers;

	logger.debug("startAuthorization", tenantId, realmName, headers);

	var responseJson = {
		status: "challenge",
		challenge: {
			text: "Enter username and password"
		}
	};

	res.status(200).json(responseJson);
});

app.post('/apps/:tenantId/:realmName/handleChallengeAnswer', jsonParser, function(req, res){
	var tenantId = req.params.tenantId;
	var realmName = req.params.realmName;
	var challengeAnswer = req.body.challengeAnswer;


	logger.debug("handleChallengeAnswer", tenantId, realmName, challengeAnswer);

	var username = req.body.challengeAnswer["username"];
	var password = req.body.challengeAnswer["password"];

	var responseJson = { status: "failure" };

	console.log('username entered:' + username);
	console.log('password entered:' + password);

	db.get(username, function(err, userObject){
		if(!err) {
			console.log("Found document : " + JSON.stringify(userObject));
			if (userObject && userObject.password == password ){
				logger.debug("Login success for userId ::", username);
				responseJson.status = "success";
				responseJson.userIdentity = {
					userName: username,
					displayName: userObject.displayName,
					attributes: {
						dob: userObject.dob
					}
				}
			} else 
				logger.debug("Login failure for userId ::", username);
		} else
      		console.log("Document not found in database");
		res.status(200).json(responseJson);	  
	});
});

app.use(function(req, res, next){
	res.status(404).send("This is not the URL you're looking for");
});

var server = app.listen(cfenv.getAppEnv().port, function () {
	var host = server.address().address;
	var port = server.address().port;
	logger.info('Server listening at %s:%s', host, port);
});