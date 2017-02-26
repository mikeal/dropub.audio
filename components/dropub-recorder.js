const funky = require('funky')
const bl = require('bl')
const getMedia = require('getusermedia')
const mediaRecorder = require('media-recorder-stream')

const mediaOpts = {audio: true, video: false, interval: 1000}

const initRecorder = (elem, opts, cb) => {
  let stream = mediaRecorder(opts.media, mediaOpts)
  let ms = opts.limit * 1000
  console.log(stream)
  let timeout = setTimeout(() => stream.stop(), ms)
  stream.pipe(bl((err, data) => {
    data = data.toString('base64')
    cb(err, !data ? null : {content_type: stream.recorder.mimeType, data})
  }))
  elem.querySelector('svg').onclick = () => {
    clearTimeout(timeout)
    stream.stop()
  }
}

const recorderView = funky`
${initRecorder}
<countdown-recorder>
  <style>
  @keyframes fillup {
    to { stroke-dasharray: 158 158; }
  }
  svg.recording-animation {
    cursor: pointer;
    transform: rotate(-90deg);
  }
  circle.recording-animation {
    fill: yellowgreen;
    stroke: #655;
    stroke-width: 50;
    stroke-dasharray: 0 158;
    animation: fillup ${opts => opts.limit || 3}s linear;
  }
  </style>
  <svg class="recording-animation" width="100" height="100">
    <circle class="recording-animation" r="25" cx="50" cy="50" />
  </svg>
</countdown-recorder>
`

const init = (elem, opts) => {
  if (!opts.limit) opts.limit = 30
  if (typeof opts.limit !== 'string') opts.limit = parseInt(opts.limit)
  let button = elem.querySelector('svg')
  button.onclick = () => {
    if (opts.login) return opts.login()
    getMedia(mediaOpts, (err, media) => {
      if (err) throw err
      opts.media = media
      let recorder = recorderView(opts, (err, recording) => {
        if (err) throw err
        console.log('finished', recording)
        opts.writeData({recording}, (err, info) => {
          if (err) throw err
        })
        elem.removeChild(recorder)
        elem.appendChild(button)
      })
      elem.appendChild(recorder)
      elem.removeChild(button)
    })
  }
}

const view = funky`
${init}
<dropub-recorder>
  <style>
  dropub-recorder {
    padding: 50px;
  }
  circle.record {
    fill: yellowgreen;
  }
  svg {
    background: yellowgreen;
    border-radius: 50%;
    cursor: pointer;
  }
  </style>
  <svg width="100" height="100">
    <circle class="record" r="25" cx="50" cy="50" />
  </svg>
  <dropup-recordings>
  </dropup-recordings>
</dropub-recorder>
`

module.exports = view
