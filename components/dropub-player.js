/* globals Audio, alert */
const funky = require('funky')
const moment = require('moment')
const bel = require('bel')
const emojione = require('emojione')
const hover = require('./hover')
const audioComponent = require('./audio-player')

const base = 'https://mikeal.cloudant.com/dropub-audio/'

const e = encodeURIComponent

const getWaudio = opts => {
  let audio = new Audio()
  window.audio = audio
  audio.src = `${base}${e(opts.id)}/recording`
  let elem = audioComponent({audio})
  audio.preload = 'auto'
  return elem
}

const timeago = ts => {
  let now = Date.now()
  if ((now - ts) < 10 * 60 * 1000) {
    return moment(ts).fromNow()
  } else {
    return moment(ts).calendar()
  }
}

const init = (elem, opts) => {
  elem.id = opts.id
  let avatar = elem.querySelector('dropub-avatar')
  let isme = () => {
    if (!opts.token) return false
    let id = avatar.getAttribute('githubid')
    if (opts.token.signature.message.user.id.toString() !== id) return false
    return true
  }
  let img = elem.querySelector('img')
  let remove = bel([emojione.toImage('➖')])
  remove.onclick = () => opts.remove(opts.id, (err) => {
    if (err) return alert(err)
    // elem.parentNode.removeChild(elem)
  })
  let enter = () => {
    if (!isme()) return
    avatar.removeChild(img)
    avatar.appendChild(remove)
  }
  let leave = () => {
    if (!isme()) return
    avatar.removeChild(remove)
    avatar.appendChild(img)
  }
  hover(avatar, enter, leave)
}

const view = funky`
${init}
<dropub-player>
  <style>
  dropub-player {
    width: 100%;
    display: flex;
  }
  dropub-avatar {
    flex-grow: 1;
    max-width: 50px;
  }
  dropup-audio-file {
    flex-grow: 10;
  }
  dropub-avatar img {
    max-width: 50px;
  }
  div.drop-time {
    font-size: 80%;
    margin-bottom: -20px;
  }
  mute-button img {
    margin-top: -5px;
  }
  img[alt="➖"] {
    cursor: pointer;
  }
  </style>
  <dropub-avatar githubid="${opts => opts.user.id}">
    <img class="dropub-avatar" src="${opts => opts.user.avatar_url}" />
  </dropub-avatar>
  <dropup-audio-file>
    <div class="drop-time"
         ts="${opts => opts.id.slice(opts.id.indexOf('@') + 1)}"
         >
      ${opts => timeago(opts.id.slice(opts.id.indexOf('@') + 1))}
    </div>
    ${opts => getWaudio(opts)}
  </dropub-audio-file>

</dropub-player>
`

module.exports = view
