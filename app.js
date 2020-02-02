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

const oauthClient = new OAuthClient({
	clientId: "ABUkNOXEvvdKxllUTOte898zcpY6vViUHrwMK6raf5DuEVTIYJ",
    clientSecret: "CHL1zIeePVCqDuzRch3R8fexOdKTL4GctxUJJ83U",
    environment: "sandbox",
    redirectUri: "http://localhost:5000/qb-callback"
});

app.set('views', './views');
app.set('view engine', 'pug');

app.get('/customers', (req, res) => {
	MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
		var db = client.db('meteor');

		db.collection('customers').find().toArray(function (err, result) {
			if(result.length == 0)
				res.render('customers', { customers: [] })
			else {
				customers = result
				res.render('customers', { customers: customers })
			}
		});
	});
});

app.get('/pending-invoices', function (req, res) {
	MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
		var db = client.db('meteor');
		var pendingInvoices = [];

		db.collection('invoiceNeedingUpdate').find({customerIdd: "0", voidId: "0"}).toArray(function (err, result) {

			if(result.length == 0) {
				res.render('pending-invoices', { pendingInvoices: pendingInvoices });		
			}

			result.forEach(function(resultitem) {
				var arr = new Object();
				db.collection('bookingstatuses').findOne({invoiceId: resultitem.bookingId}, function(err, bookingstatus) {
					arr.invoiceNumber = bookingstatus.quickbooksInvoiceId;
					arr.bookingId = resultitem.bookingId;

					db.collection('bookingcustomers').findOne({invoiceId: bookingstatus.invoiceId} , function(err, bookingcustomer) {
						db.collection('customers').findOne({_id: bookingcustomer.customerId}, function(err, customer) {
							arr.customerName = customer.name;
							arr.customerId = customer._id;
							arr.customerIdd = "0";

							pendingInvoices.push(arr);		

							res.render('pending-invoices', { pendingInvoices: pendingInvoices });					
						});	
					});
				});
			});
		});
	});
})

app.get('/sync-customer', (req, res) => {
	if(oauthClient.isAccessTokenValid()) {
		let customerId = req.query.id;
		qbc.synccustomer(customerId, oauthClient);
		
		setTimeout(function() {
			res.redirect("/pending-customers");
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

app.get('/sync-invoice', (req, res) => {
	if(oauthClient.isAccessTokenValid()) {
		let invoiceId = req.query.id;
		qb.syncinvoice(invoiceId, oauthClient);
		

		setTimeout(function() {
			res.redirect("/pending-invoices");
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

app.get('/pending-customers', function (req, res) {
	MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
		var db = client.db('meteor');
		var pendingCustomers;

		db.collection('customers').find({quickbooksId: 0}).toArray(function (err, result) {
			if(result.length == 0) {
				res.render('pending-customers', { pendingCustomers: [] })
			} else {
				pendingCustomers = result
				res.render('pending-customers', { pendingCustomers: pendingCustomers })
			}
		})
	});
})

app.get('/sync-qb', (req, res) => {

	if(oauthClient.isAccessTokenValid()) {
	} 

	if(!oauthClient.isAccessTokenValid()){
	    oauthClient.refresh()
        .then(function(authResponse) {
        })
        .catch(function(e) {
        	res.redirect("/connect");
        });
	}

	const body = {
	  "Line": [
	    {
	      "DetailType": "SalesItemLineDetail", 
	      "Amount": 999.69, 
	      "SalesItemLineDetail": {
	        "ItemRef": {
	          "name": "Services", 
	          "value": "1"
	        }
	      }
	    }
	  ], 
	  "CustomerRef": {
	    "value": "1"
	  }
	};

  	oauthClient.makeApiCall({
	    url: 'https://sandbox-quickbooks.api.intuit.com/v3/company/1313024165/invoice',
	    method: 'POST',
	    headers: {
	      'Content-Type': 'application/json'
	    },
	    body: JSON.stringify(body)
  	}).then(function(response){
		console.log('The API response is  : ' + response);
		res.send(JSON.parse(response.text()));
	})
	.catch(function(e) {
		console.log('The error is '+ JSON.stringify(e));
	});

	// oauthClient.makeApiCall({url: 'https://sandbox-quickbooks.api.intuit.com/v3/company/1313024165/companyinfo/1313024165'})
 //        .then(function(authResponse){
 //            res.send(JSON.parse(authResponse.text()));
 //        })
 //        .catch(function(e) {
 //            console.error(e);
 //        });
});

app.get('/qb-callback', (req, res) => {
	let parseRedirect = req.url;

	oauthClient.createToken(parseRedirect)
    .then(function(authResponse) {
    	// store qb credentials

    	MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
    		var db = client.db('meteor')

    		db.collection('qbcredentials').findOneAndUpdate({_id: "5e30049837500f2406f6bd8b"}, {$set:{access_token: authResponse.getJson().access_token, refresh_token: authResponse.getJson().refresh_token}}, {}, (err, doc) => {			
			});
    	});

    	res.redirect("/pending-invoices");
    })
    .catch(function(e) {
        res.send("The error message is :"+e.originalMessage);
    });
});

app.get('/', (req, res) =>  {
	res.render('index', {})
});

app.get('/connect', (req, res) =>  {
	

	let authUri = oauthClient.authorizeUri({
        scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
        state: "testState"
  	});

	res.redirect(authUri);
});

app.get('/generatePDF', async (req, res) =>  {

	let customer;
	let invoiceNumber;
	let projectName;
	let bookingGroups;
	let bookingLineItems = [];
	let totalBeforeGst = 0;
	let totalAfterGst = 0;
	let gst = 0;

	const bookingId = req.query.bookingId;
	
	MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
		if (err) throw err
		var db = client.db('meteor')

		// get customer details
		db.collection('bookingcustomers').find({invoiceId: bookingId}).toArray(function (err, result) {
			if (err) throw err
			db.collection('customers').find({_id: result[0].customerId}).toArray(function (err, result) {
				if (err) throw err
				customer = result[0]

				// get invoice number
				db.collection('bookingstatuses').find({invoiceId: bookingId}).toArray(function (err, result) {
					if (err) throw err
					invoiceNumber = result[0].quickbooksInvoiceId

					db.collection('bookingprojects').find({invoiceId: bookingId}).toArray(function (err, result) {
						if (err) throw err
						if(result[0].projectName == null || result[0].projectName == "")
							projectName = "NA";
						else
							projectName = result[0].projectName;

						db.collection('bookinggroups').find({invoiceId: bookingId}).toArray(function (err, result) {
							if (err) throw err
							bookingGroups = result;		

							db.collection('bookinglineitems').find({invoiceId: bookingId}).toArray(function (err, result) {
								if (err) throw err
								bookingLineItems = result;	

								setTimeout(async function() {
									var doc = new pdf.Document({ font: pdf.Font.Helvetica });

									const logo = new pdf.Image(fs.readFileSync('camwerkz-icon-converted.pdf'))

									var table = doc.table({
									  widths: [400, null],
									  paddingBottom: 0*pdf.cm
									})

									var row = table.row()
									row.cell().text()
										.add('RENTAL ACKNOWLEDGEMENT', { fontSize: 16, font: pdf.Font.HelveticaBold })
										.add('--------------------------------------------------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('Important Details', { underline: true })
										.add('-------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('• All equipment must be returned between 9.30am - 10.30am on the following day after usage.')
										.add('--------------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('• A late return fee of 1/2 day rental shall be chargeable after 10.30am and full day rate shall be chargeable after 12 noon.')
										.add('--------------------------------------------------------', { color: 0xffffff })
										.add('• Extension of usage is subjected to availability of equipment.')
										.add('--------------------------------------------------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('Other Details', { underline: true })
										.add('--------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('Location:')
										.add('---------------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('Blk 115A Commonwealth Drive #05-07/08/09 Singapore 149596')
										.add('--------------', { color: 0xffffff })
										.add('Operating Hours:')
										.add('-----------------------------------------------------------------------------', { color: 0xffffff })
										.add('Monday - Friday: 9.30am - 6.30pm, Saturday & Sunday: 9.30am - 3.30pm')
										.add('------', { color: 0xffffff })
										.add('Public Holiday: Closed (By special arrangement only)')
										.add('---------------------------------', { color: 0xffffff })
										.add('Enquiry:')
										.add('---------------------------------------------------------------------------------------------', { color: 0xffffff })
										.add('For quotation & advanced booking, kindly email us: admin@camwerkz.com')
										.add('------', { color: 0xffffff })
										.add('Office: +65 6474 4787 Mobile: +65 9040 6463 Fax: +65 6474 4052')

									row.cell().image(logo, { align: 'right', height: 3*pdf.cm })

									doc.text('-', { color: 0xffffff })

									var table = doc.table({
									  widths: [null, null, null],
									  paddingBottom: 0*pdf.cm
									})

									var row = table.row()
									row.cell('Customer Details', { underline: true, font: pdf.Font.HelveticaBold })
									row.cell('Invoice Number', { underline: true, font: pdf.Font.HelveticaBold })
									row.cell('Project Name', { underline: true, font: pdf.Font.HelveticaBold })

									var row = table.row()
									row.cell(customer.name)
									row.cell(invoiceNumber.toString())
									row.cell(projectName)

									var row = table.row()
									row.cell(customer.email)

									var row = table.row()
									row.cell(customer.contact)

									doc.text('-', { color: 0xffffff })

									for (var i = 0; i < bookingGroups.length; i++) {
										var table = doc.table({
							  				widths: [256, null],
							  				paddingBottom: 0.25*pdf.cm
										})	

										var row = table.row()
										row.cell('Equipment Details - Group ' + (parseInt(i)+1))
										row.cell(moment(bookingGroups[i].dates[0]).format('Do MMMM YYYY') + ' - ' + moment(bookingGroups[i].dates[bookingGroups[i].dates.length - 1]).format('Do MMMM YYYY'), { textAlign: 'right' })

										var table = doc.table({
										  widths: [null, 2.5*pdf.cm, 2.5*pdf.cm, 2.5*pdf.cm, 2.5*pdf.cm],
										  borderHorizontalWidths: function(i) { return i < 2 ? 1 : 0.1 },
										  padding: 5
										})

										var tr = table.header({ font: pdf.Font.HelveticaBold, borderBottomWidth: 1.5 })
										tr.cell('Equipment')
										tr.cell('Quantity', { textAlign: 'right' })
										tr.cell('Rate', { textAlign: 'right' })
										tr.cell('Discount', { textAlign: 'right' })
										tr.cell('Sub Amount', { textAlign: 'right' })

										function addRow(equipmentName, quantity, rate, discount, subAmount) {
										  var tr = table.row()
										  tr.cell(equipmentName)
										  tr.cell(quantity.toString(), { textAlign: 'right' })

										  tr.cell('$' + rate.toFixed(2), { textAlign: 'right' })
										  tr.cell('$' + discount.toFixed(2), { textAlign: 'right' })
										  tr.cell('$' + subAmount.toFixed(2), { textAlign: 'right' })
										}

										for (var j = 0; j < bookingLineItems.length; j++) {
											if(bookingLineItems[j].groupCounter == i) {
												if(bookingLineItems[j].discountOverwrite == null) {
													addRow(bookingLineItems[j].brand + " " + bookingLineItems[j].item, bookingLineItems[j].booked, parseInt(bookingLineItems[j].rate), 0, parseInt(bookingLineItems[j].rate) * bookingLineItems[j].days)
												} else {
													addRow(bookingLineItems[j].brand + " " + bookingLineItems[j].item, bookingLineItems[j].booked, parseInt(bookingLineItems[j].rate), bookingLineItems[j].discountOverwrite, parseInt(bookingLineItems[j].rate) * bookingLineItems[j].days)
												}
											}
										}

										let subdiscount = 0;
										let subtotal = 0;

										for(xx in bookingLineItems) {
											if(bookingLineItems[xx].groupCounter == i) {
												if(bookingLineItems[xx].discountOverwrite != undefined) {
											        subdiscount += bookingLineItems[xx].discountOverwrite;
											      }
											}
									    }

									    for(xx in bookingLineItems) {
											if(bookingLineItems[xx].groupCounter == i) {
										        subtotal += (bookingLineItems[xx].originalPriced * parseInt(bookingLineItems[xx].rate));
										    }
									    }

										var tr = table.row()
									    tr.cell('')
									    tr.cell('', { textAlign: 'right' })

									    tr.cell('Sub Disc:', { textAlign: 'right' })
									    tr.cell(accounting.formatMoney(subdiscount), { textAlign: 'right' })
									    tr.cell(accounting.formatMoney(subtotal), { textAlign: 'right' })

									    let aftertotal = 0;

									    if((subtotal - subdiscount) < 0) {
									      	aftertotal = 0;
									    } else {
									    	aftertotal = subtotal - subdiscount;
									    }

									    var tr = table.row()
									    tr.cell('')
									    tr.cell('', { textAlign: 'right' })

									    tr.cell('', { textAlign: 'right' })
									    tr.cell('Sub Total:', { textAlign: 'right' })
									    tr.cell(accounting.formatMoney(aftertotal), { textAlign: 'right' })

									    doc.text('-', { color: 0xffffff })

									    totalBeforeGst += aftertotal;
									}

								    doc.text('-', { color: 0xffffff })

								    var table = doc.table({
									  widths: [null, 2.5*pdf.cm, 5*pdf.cm, 2.5*pdf.cm],
									  borderHorizontalWidths: function(i) { return i < 2 ? 1 : 0.1 },
									  padding: 5
									})

									var tr = table.row()
								    tr.cell('')
								    tr.cell('', { textAlign: 'right' })

								    tr.cell('Total before GST', { textAlign: 'right' })
								    tr.cell(accounting.formatMoney(totalBeforeGst), { textAlign: 'right' })

								    gst = totalBeforeGst * 0.07;

								    var tr = table.row()
								    tr.cell('')
								    tr.cell('', { textAlign: 'right' })

								    tr.cell('GST', { textAlign: 'right' })
								    tr.cell(accounting.formatMoney(gst), { textAlign: 'right' })

								    totalAfterGst = totalBeforeGst + gst;

								    var tr = table.row()
								    tr.cell('')
								    tr.cell('', { textAlign: 'right' })

								    tr.cell('Total after GST', { textAlign: 'right' })
								    tr.cell(accounting.formatMoney(totalAfterGst), { textAlign: 'right' })

								    doc.footer()
									   .pageNumber(function(curr, total) { return curr + ' / ' + total }, { textAlign: 'center' })

									doc.pipe(fs.createWriteStream('Invoice_'+invoiceNumber+'.pdf'));
									await doc.end();
									res.redirect("/outputPDF?id="+invoiceNumber);	
								}, 1000);
							})
						})
					})	
				})
			})
		})
	})
});

app.get('/outputPDF', function(req, res) {
  res.sendFile(__dirname + "/Invoice_" + req.query.id + ".pdf");
});

if (port == null || port == "") {
  port = 8000;
}
app.listen(port);