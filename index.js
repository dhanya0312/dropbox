let trycatch = require("trycatch");
let main = require("./main");

trycatch.configure({'long-stack-traces': true})

let handleErrorAndExit = function(err){
	console.log('In handleErrorAndExit' , err)
}

let handleError = function(err){
	console.log('In handleError' , err)
}

process.on('uncaughtException', handleErrorAndExit)
process.on('unhandledRejection', handleError)

console.log(main)
//throw 'err';
main.initialize(8000).catch(e => console.log(e.stack))