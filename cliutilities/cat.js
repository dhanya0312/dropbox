#!/usr/bin/env node
"use strict";

let fs = require('fs');
let filename=process.argv[2];

fs.readFile(filename, function (err, data) {
   if (err) {
       return console.error(err);
   }
   process.stdout.write(data.toString());
});