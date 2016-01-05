#!/usr/bin/env node

"use strict";

let fs = require('fs');

for(var i = 2; i < process.argv.length; i++) {
    fs.mkdir(process.argv[i], 0o777, function (err, stats) {
          if (err) throw err;
      });
}




