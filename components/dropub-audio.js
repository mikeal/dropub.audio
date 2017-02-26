/* globals localStorage */
const funky = require('funky')
const bel = require('bel')
const events = require('events')
const sodi = require('sodi')
const once = require('once')
const sodiAuthority = require('sodi-authority')
const jsonstream2 = require('jsonstream2')
const websocket = require('websocket-stream')
const methodman = require('methodman')
const blurModal = require('blur-modal')
const elementClass = require('element-class')
const login = require('../../sodi-authority/component')
const hash = require('hash.js')

const player = require('./dropub-player')
const recorder = require('./dropub-recorder')

const sha256 = content => hash.sha256().update(content).digest('hex')

const copy = obj => Object.assign({}, obj)

const remove = elem => {
  let parent = elem.parentNode
  let _remove = () => parent.removeChild(elem)
  elem.addEventListener('webkitAnimationEnd', _remove)
  elem.addEventListener('animationend', _remove)
  elementClass(elem).add('removing')
}

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

const prepend = (parent, child) => {
  if (parent.firstChild) {
    parent.insertBefore(child, parent.firstChild)
  } else {
    parent.appendChild(child)
  }
}

const init = (elem, opts) => {
  let host
  let scheme
  if (opts.devsocket) {
    scheme = 'ws'
    host = 'localhost:8080'
  } else {
    host = 'dropub-audio.now.sh'
    scheme = 'wss'
  }
  const room = opts.room
  if (!room) throw new Error('Room is a required argument.')

  if (localStorage.token) {
    let token = JSON.parse(localStorage.token)
    opts.sodi = sodi(token.keypair)
    opts.token = token
  }

  if (!opts.sodi) {
    opts.login = () => {
      let unblur
      let elem = login((err, info) => {
        if (err) throw err
        opts.keypair = info.keypair
        opts.sodi = sodi(info.keypair)
        opts.signature = info.signature
        delete opts.login
        if (opts.onLogin) opts.onLogin()
        let token = {
          keypair: {
            publicKey: info.keypair.publicKey.toString('hex'),
            secretKey: info.keypair.secretKey.toString('hex')
          },
          signature: info.signature
        }
        localStorage.token = JSON.stringify(token)
        opts.token = token
        unblur()
        opts.login = null
      })
      unblur = blurModal(elem)
    }
  }

  let connect = () => websocket(`${scheme}://${host}`)
  let onWebSocket = ws => {
    const meth = methodman(ws)
    meth.on('commands:base', remote => {
      // TODO: initial query
      remote.joinRoom(room, (err, info) => {
        if (err) throw err
      })
      opts.remove = (id, cb) => {
        let data = {
          message: id,
          signature: opts.sodi.sign(id).toString('hex'),
          publicKey: opts.sodi.public,
          authorities: [opts.token.signature]
        }
        remote.remove(data, cb)
      }
      opts.writeData = (data, cb) => {
        data.ts = Date.now()
        let recording = copy(data.recording)
        data.recording.hash = sha256(data.recording.data)
        delete data.recording.data

        let doc = {
          message: data,
          signature: opts.sodi.sign(JSON.stringify(data)).toString('hex'),
          publicKey: opts.sodi.public,
          authorities: [opts.token.signature],
          recording
        }
        if (!cb) cb = () => {} // TODO: remove need for this.
        remote.writeData(room, doc, cb)
      }

      if (!elem.querySelector('dropub-recorder')) {
        prepend(elem, recorder(opts))
      }

      remote.recent(room, (err, info) => {
        if (err) throw err
        if (info.length !== 20) return
        // TODO: Add paging button.
      })
      opts.loadRecent = remote.recent

      let pingpong = () => {
        setTimeout(() => {
          let start = Date.now()
          remote.ping(() => {
            if (!opts.showping) return
            console.log(`ping-pong: ${Date.now() - start}ms RTT`)
            pingpong()
          })
        }, 30 * 1000)
      }
      pingpong()
    })
    meth.on('stream:database', (stream, id) => {
      // TODO: decode JSON
      let parser = jsonstream2.parse([/./])
      let log = new events.EventEmitter()
      let verify = doc => {
        let msg = JSON.stringify(doc.message)
        return sodi.verify(msg, doc.signature, doc.publicKey)
      }
      stream.pipe(parser).on('data', obj => {
        // TODO: figure out a way to sign deletions in the
        // actual database.
        if (obj.deleted) return log.emit('deleted', obj.id)

        // Check if this was signed by a valid authority
        if (!validAuthority(obj.authorities[0])) return
        // Verify both the authority signature and message
        // signature are valid.
        if (verify(obj) &&
            verify(obj.authorities[0]) &&
            obj.authorities[0].message.publicKey === obj.publicKey
          ) {
          let user = obj.authorities[0].message.user
          let doc = obj.message
          log.emit('data', {user, doc, id: obj._id})
        }
      })
      opts.log = log
      onLog(log)
    })

    let reconnect = once(e => {
      console.log('Disconnected')
      onWebSocket(connect())
    })
    ws.on('error', reconnect)
    ws.on('end', reconnect)
  }
  onWebSocket(connect())

  let container = bel`<dropub-recordings></dropub-recordings>`
  elem.appendChild(container)

  let onLog = log => {
    log.on('data', obj => {
      Object.defineProperty(obj, 'token', { get: () => opts.token })
      Object.defineProperty(obj, 'remove', { get: () => opts.remove })
      let elements = Array.prototype.slice.apply(container.children)
      let ts = obj.id.slice(obj.id.indexOf('@') + 1)
      let newPlayer = player(obj)
      for (var i = 0; i < elements.length; i++) {
        let el = elements[i]
        let t = el.querySelector('div.drop-time').getAttribute('ts')
        if (t < ts) {
          return container.insertBefore(newPlayer, el)
        }
      }
      container.appendChild(newPlayer)
    })
    log.on('deleted', id => {
      let el = document.getElementById(id)
      remove(el)
    })
  }
}

const view = funky`
${init}
<dropub-audio>
  <style>
  dropub-audio {
    display: flex;
    flex-wrap: wrap;
    font-family: Tahoma, Geneva, sans-serif;
    justify-content: center;
    width: 100%;
  }
  dropub-audio dropub-recordings,
  dropub-audio dropub-recorder {
    width: 100%;
    flex-grow: 3;
    align-items: center;
    text-align: center;
  }
  dropub-player {
    animation: slidein 1s;
  }

  @keyframes slidein {
    from {
      margin-left: 100%;
      width: 300%;
    }

    to {
      margin-left: 0%;
      width: 100%;
    }
  }
  @keyframes slideout {
    from {
      margin-left: 0%;
      width: 100%;
    }

    to {
      margin-left: 100%;
      width: 300%;
    }
  }
  .removing {
    animation: slideout 1s;
  }
  </style>
</dropub-audio>
`

module.exports = view
