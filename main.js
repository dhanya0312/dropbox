let express = require('express')
let then = require('express-then')
require('songbird')
let morgan = require('morgan')
let trycatch = require('trycatch')
let fs = require('fs')
let path = require('path')
let bodyParser = require('body-parser')
let mimetypes = require('mime-types')
let nodeify  = require('bluebird-nodeify')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let jsonovertcp = require('json-over-tcp')
let chokidar = require('chokidar')
let archiver = require('archiver')

let clientSocketList = []

const ROOTDIR = path.resolve(process.cwd())
const TCP_PORT = process.env.TCP_PORT || 8001
const OPERATION_CREATE = 'create'
const OPERATION_UPDATE = 'update'
const OPERATION_DELETE = 'delete'

async function initialize(port) {
    console.log('Inside')
    let app = express()

    // Morgan provides HTTP logging
    app.use(morgan('dev'))

    // Use trycatch to send 500s and log async errors from requests
    app.use((req, res, next) => {
        console.log('Inside req')
        trycatch(next, e => {
            console.log(e.stack)
            res.writeHead(500)
            res.end(e.stack)
        })
    })

    //throw 'err'
    await app.promise.listen(port)
    console.log('LISTENING @ http://127.0.0.1:${port}')
    
    //HEAD
    app.head('*', setFilePath, sendHeaders, (req, res) => res.end())

    //GET
    app.get('*', setFilePath, sendHeaders, (req, res) => {
        if(res.body){
            res.json(res.body)
            return
        }

        fs.createReadStream(req.filePath).pipe(res)
        
    })

    app.get('*', setFilePath, sendHeaders, (req, res) => {
            
        let archive = archiver('zip')
        let output = fs.createWriteStream(__dirname + '/hi.zip')

        archive.pipe(output);

        var getStream = function(fileName){
            return fs.readFileSync(fileName);
        }

        var fileNames = ['hello.txt'];

        for(let i=0; i<fileNames.length; i++){
            var path = __dirname + '/'+fileNames[i];
            archive.append(getStream(path), { name: fileNames[i]});
        }

        archive.finalize(function(err, bytes) {
            if (err) {
                throw err;
        }

        console.log(bytes + ' total bytes');
        });
        
    })

    app.delete('*', setFilePath, (req, res, next) =>{
        async ()=>{
            console.log(req.filePath)
            if(req.stat && req.stat.isDirectory()){
                await rimraf.promise(req.filePath)
            }else{
                await fs.promise.unlink(req.filePath)
            }
            req.operation = OPERATION_DELETE
            next()
            //res.end()
        }().catch(next)
    }, notifyClients)

    app.put('*', setFilePath, setDirDetails, (req, res, next) =>{
        async() => {
            if(req.stat) return res.send(405, 'File Exists')
            await mkdirp.promise(req.dirPath)
            if(!req.isDir) req.pipe(fs.createWriteStream(req.filePath))

            req.operation = OPERATION_CREATE
            next()
            //res.end()
        }().catch(next)
    }, notifyClients)

    app.post('*', setFilePath, setDirDetails, (req, res, next) =>{
        async() => {
            if(!req.stat) return res.send(405, 'File does not Exists')
            if(req.isDir) return res.send(405, 'File does not Exists')

            req.operation = OPERATION_UPDATE
            await fs.promise.truncate(req.filePath,0)
            req.pipe(fs.createWriteStream(req.filePath))
            next()
            //res.end()
        }().catch(next)
    }, notifyClients)

    function sendHeaders(req, res, next){
        nodeify(async () => {
            let filePath = req.filePath
            let stat = req.stat
            if(stat.isDirectory()){
                let files = fs.promise.readdir(filePath)
                res.body = JSON.stringify(files)
                res.setHeader('Content-Length', res.body.length)
                res.setHeader('Content-Type', 'application/json')
                return
            }

            res.setHeader('Content-Length', stat.size)
            let contentType = mimetypes.contentType(path.extname(filePath))
            res.setHeader('Content-Type', contentType)
            
        }(), next)
    }

    function setFilePath(req, res, next){
        req.filePath = path.join(ROOTDIR, req.url)
        fs.promise.stat(req.filePath)
            .then(stat => req.stat = stat, ()=> req.stat = null)
            .nodeify(next)
    }

    function setDirDetails(req, res, next){
        let filePath = req.filePath
        let endswithSlash = filePath.charAt(filePath.length-1) === path.sep
        let hasExt = path.extname(filePath) !== ''
        req.isDir = endswithSlash || !hasExt
        req.dirPath = req.isDir? filePath: path.dirname(filePath)
        next()
    }

    async function notifyClients(req, res, next){
        for (let i = 0; i < clientSocketList.length; i++) {
            // Read the contents of the file
            let contents = null
            let fileType = req.isDir ? 'dir' : 'file'
            console.log('Notify Clients: ' + req.operation)
            // Get the file contents if the operation is PUT/POST
            if (fileType === 'file' && req.operation !== OPERATION_DELETE) {
              await fs.promise.readFile(req.filePath, 'utf-8')
              .then((fileContent) => {
                contents = fileContent
                console.log('Contents: ' + contents)
              })
            }

            let data = {
              'action': req.operation,
              'path': req.filePath,
              'contents': contents,
              'type': fileType,
              'updated': Date.now(),
              'url': req.url
            }
            req.data = data
            data = JSON.stringify(req.data)
            console.log('After the method...' + data)
            clientSocketList[i].write(data)
            res.end()
        }
        next()
    }

    chokidar.watch(ROOTDIR, {ignored: /[\/\\]\./}).on('all', async (event,path,stat,next) => {
        let fileType = stat && stat.isDirectory()? 'dir' :'file'
        let op= null
        let contents=''

        if(event === 'add' || event == 'addDir') op=OPERATION_CREATE
        if(event === 'unlink') op=OPERATION_DELETE
        if(event === 'change') op=OPERATION_UPDATE 
        for (let i = 0; i < clientSocketList.length; i++) { 
            if (fileType === 'file' && op !== OPERATION_DELETE) {
                console.log(path)
                contents=await fs.promise.readFile(path,'utf-8')
            }
            
            try{
                let data = {
                    'action': op,
                    'path': path,
                    'contents': contents,
                    'type': fileType,
                    'updated': Date.now(),
                    'url': '/hello1'
                }

                data = JSON.stringify(data)
                console.log('After the method...' + data)
                clientSocketList[i].write(data)

            }catch(e){
                console.log(e.stack)
            }
        }
       // next()
    })

    let tcpServer = jsonovertcp.createServer(TCP_PORT).listen(TCP_PORT)
    console.log('TCP Server listening @ http://127.0.0.1:${TCP_PORT}')

    tcpServer.on('connection', (socket) => {
        socket.on('data', (data) => {
        console.log("TCP Connection from client. Client Id:  " + data.clientId + ' .Adding client to listeners')
        clientSocketList.push(socket)
        })
    })
}

module.exports = {initialize}
