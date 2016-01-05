#!/usr/bin/env node

"use strict";

for(var i = 2; i < process.argv.length; i++) {
    process.stdout.write(process.argv[i] + '\n');
}
