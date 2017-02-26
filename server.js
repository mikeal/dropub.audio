const websocket = require('websocket-stream')
const methodman = require('methodman')
const jsonstream2 = require('jsonstream2')
const corsify = require('corsify')
const events = require('events')
const http = require('http')
const sodi = require('sodi')
const sodiAuthority = require('sodi-authority')
const hash = require('hash.js')

const sha256 = content => hash.sha256().update(content).digest('hex')

const defaultdb = 'https://mikeal.cloudant.com/dropub-audio'
const storage = require('./lib/storage')(process.env.DROPUB_AUDIO_COUCHDB || defaultdb)

const rooms = new events.EventEmitter()

storage.feed.on('change', change => {
  let [room] = change.id.split('@')
  if (rooms.listenerCount(room)) {
    if (change.deleted) {
      return rooms.emit(room, change)
    }
    storage.db.get(change.id, (err, doc) => {
      if (err) return console.error('BAD!!!')
      rooms.emit(room, doc)
    })
  }
})

function validAuthority (signature) {
  for (var i = 0; i < sodiAuthority.knownKeys.length; i++) {
    let key = sodiAuthority.knownKeys[i]
    if (signature.publicKey === key.key) {
      if (key.expiration > Date.now()) {
        return true
      }
    }
  }
  return false
}

function onWebsocketStream (stream) {
  let rpc = {}
  let databaseStream = jsonstream2.stringify()
  let inRooms = []
  let dbWrite = obj => databaseStream.write(obj)
  rpc.joinRoom = (room, cb) => {
    rooms.on(room, dbWrite)
    inRooms.push(room)
    cb(null)
  }
  rpc.recent = (room, ts, cb) => {
    if (!cb) {
      cb = ts
      ts = (new Date()).toISOString()
    }
    let end = (new Date(Date.now() / 2)).toISOString()
    let query = {
      startkey: `${room}@${ts}`,
      endkey: `${room}@${end}`,
      include_docs: true,
      // limit: 20, /  Disabled during beta.
      descending: true
    }
    storage.db.all(query, (e, results) => {
      if (e) return cb(e)
      results.rows.map(row => row.doc).forEach(doc => dbWrite(doc))
      cb(null, results.rows.map(r => r.id))
    })
  }

  let verify = doc => {
    let msg = JSON.stringify(doc.message)
    return sodi.verify(msg, doc.signature, doc.publicKey)
  }

  rpc.remove = (data, cb) => {
    if (!sodi.verify(data.message, data.signature, data.publicKey)) {
      return cb(new Error('Invalid signature.'))
    }
    if (!validAuthority(data.authorities[0])) {
      return cb(new Error('No valid authority'))
    }
    if (verify(data.authorities[0]) &&
        data.authorities[0].message.publicKey === data.publicKey
      ) {
      storage.db.delete(data.message, cb)
    }
  }

  rpc.writeData = (room, doc, cb) => {
    // Don't accept payloads over 3 megs.
    if (JSON.stringify(doc).length > (3 * 100 * 1025)) {
      return cb(new Error('Max Length.'))
    }

    if (!doc.recording) return cb(new Error('missing recording.'))

    // Check if this was signed by a valid authority
    if (!validAuthority(doc.authorities[0])) {
      return cb(new Error('No valid authority'))
    }
    if (doc.message.recording.hash !== sha256(doc.recording.data)) {
      return cb(new Error('Invalid attachment hash.'))
    }

    // Verify both the authority signature and message
    // signature are valid.
    if (verify(doc) &&
        verify(doc.authorities[0]) &&
        doc.authorities[0].message.publicKey === doc.publicKey
      ) {
      doc._id = `${room}@${(new Date()).toISOString()}`
      doc._attachments = {recording: doc.recording}
      delete doc.recording
      storage.db.post(doc, cb)
    } else {
      return cb(new Error('Invalid signature.'))
    }
  }
  rpc.ping = cb => cb()

  var meth = methodman(stream)
  meth.commands(rpc, 'base')
  databaseStream.pipe(meth.stream('database'))

  let clean = () => inRooms.forEach(room => rooms.removeListener(room, dbWrite))
  stream.on('error', clean)
  stream.on('end', clean)
}

const cors = corsify({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization'
})

const handler = (req, res) => {}
const app = http.createServer(cors(handler))
const wss = websocket.createServer({server: app}, onWebsocketStream)
app.listen(8080)
