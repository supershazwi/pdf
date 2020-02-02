var MongoClient = require('mongodb').MongoClient;
const moment = require('moment');

const synccustomer = (customerId, oauthClient) => {

    MongoClient.connect('mongodb://localhost:3001/meteor', function (err, client) {
		var db = client.db('meteor');

		console.log("???");
		console.log(customerId);

		db.collection('customers').findOne({_id: customerId}, function(err, customer) {

			var billobj = new Object();
			billobj.CountrySubDivisionCode = "SG";
			billobj.Country = "SG";
			billobj.City = "Singapore";
			billobj.PostalCode = "0";
			billobj.Line1 = customer.address;

			const body = {
  				BillAddr: billobj,
				CompanyName: customer.company, 
				DisplayName: customer.name,
				FamilyName: customer.lastName,
				GivenName: customer.firstName,
				MiddleName: customer.middleName,
				Active: true,
				PrimaryPhone: {
					FreeFormNumber: customer.contact
				},
				PrimaryEmailAddr: {
					Address: customer.email
				}
  			};

  			oauthClient.makeApiCall({
  			    url: 'https://sandbox-quickbooks.api.intuit.com/v3/company/1313024165/customer',
  			    method: 'POST',
  			    headers: {
  			      'Content-Type': 'application/json'
  			    },
  			    body: JSON.stringify(body)
	  		}).then(function(response){
	  				
	  			db.collection('invoiceNeedingUpdate').remove({customerIdd: customerId});

	  			db.collection('customers').findOneAndUpdate({_id: customerId}, {$set: {quickbooksId: response.json.Customer.Id}}, {}, (err, doc) => {		

	  			});

          		console.log('The API response is  : ' + response);
          	}).catch(function(e) {
          		console.log('The error is '+ JSON.stringify(e));
          	});
		});
	});
};

exports.synccustomer = synccustomer;