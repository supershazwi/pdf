const express = require('express');
const moment = require('moment');
const accounting = require('accounting');
const app = express();
let port = process.env.PORT;
var MongoClient = require('mongodb').MongoClient

const OAuthClient = require("intuit-oauth");
const pdf = require('pdfjs');
const fs = require('fs');

const qb = require('./updateqb.js');
const qbc = require('./updateqbcustomer.js');

// const oauthClient = new OAuthClient({
// 	clientId: "ABUkNOXEvvdKxllUTOte898zcpY6vViUHrwMK6raf5DuEVTIYJ",
//     clientSecret: "CHL1zIeePVCqDuzRch3R8fexOdKTL4GctxUJJ83U",
//     environment: "sandbox",
//     redirectUri: "http://localhost:5000/qb-callback"
// });

const oauthClient = new OAuthClient({
	   clientId: "ABXIhVYAzMZC2qp5ECVfEWpaNZxzFF5tvUGf8Xt89Q3kbcNh3i",
    clientSecret: "yfYlL9HfaNGv3EOLCEb5jwuFYvGouZFZSXkvKVdM",
    environment: "production",
    redirectUri: "https://evening-oasis-90021.herokuapp.com/qb-callback"
});

app.set('views', './views');
app.set('view engine', 'pug');


app.get('/qb-callback', (req, res) => {
	let parseRedirect = req.url;

	oauthClient.createToken(parseRedirect)
    .then(function(authResponse) {
    	// store qb credentials

    	MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
    		var db = client.db('meteor')
    		res.render('show-credentials', { access_token: authResponse.getJson().access_token, refresh_token: authResponse.getJson().refresh_token });
    	});
    })
    .catch(function(e) {
        res.send("The error message is :"+e.originalMessage);
    });
});

app.get('/', (req, res) =>  {
	if(oauthClient.isAccessTokenValid()) {
		let invoiceId = req.query.id;
		qb.syncinvoice(invoiceId, oauthClient);
		

		setTimeout(function() {
			res.redirect("/show-credentials");
		}, 3000);
	} 

	if(!oauthClient.isAccessTokenValid()){
	    oauthClient.refresh()
        .then(function(authResponse) {
        })
        .catch(function(e) {
        	res.redirect("/connect");
        });
	}
});

app.get('/connect', (req, res) =>  {
	

	let authUri = oauthClient.authorizeUri({
        scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
        state: "testState"
  	});

	res.redirect(authUri);
});

if (port == null || port == "") {
  port = 5000;
}
app.listen(port);