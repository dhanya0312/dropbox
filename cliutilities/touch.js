#!/usr/bin/env node

"use strict";

let fs = require('fs');

for(var i = 2; i < process.argv.length; i++) {
	let fd = fs.open(process.argv[i], "w", function(err) {
 		console.log(err);
	});
	
	fs.futimes(2, new Date(), new Date(), function(err) {
   		console.log(err);
	});
}

