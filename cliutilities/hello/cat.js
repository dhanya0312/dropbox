#!/usr/bin/env node

"use strict";

let fs = require('fs');

for(var i = 2; i < process.argv.length; i++) {
    fs.readFile(process.argv[i], function (err, data) {
  		if (err) throw err;
  		let bufferString = data.toString();
  		console.log(bufferString);
	});
}
