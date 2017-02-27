const funky = require('funky')
const bel = require('bel')
const emojione = require('emojione')

const leftPad = (str, length = 1) => `${'0'.repeat(length)}${str}`

// This is a bug in emojione somewhere that has bad data at the
// end of the string instead of a close bracket.
const fix = str => `${str.slice(0, str.lastIndexOf('/'))}/>`

const play = opts => {
  let button = bel`<play-button></play-button>`
  opts.play = () => {
    opts.audio.play()
    button.onclick = opts.pause
    button.innerHTML = emojione.toImage('⏸️')
  }
  opts.pause = () => {
    opts.audio.pause()
    button.onclick = opts.play
    button.innerHTML = fix(emojione.toImage('▶️️'))
  }
  opts.pause()
  return button
}

const timeDisplay = opts => {
  let display = bel`<time-display></time-display>`
  display.textContent = leftPad('0s')

  opts.audio.addEventListener('timeupdate', () => {
    let currentTime = opts.audio.currentTime
    display.textContent = leftPad(`${Math.round(currentTime)}s`)
  })
  return display
}

const progressSlider = opts => {
  let slider = bel`<input disabled="true" type="range" min="0" max="2" step=".01" value="0" />`
  slider.className = 'progress-slider'
  opts.audio.addEventListener('durationchange', () => {
    let duration = opts.audio.duration
    if (duration === Infinity) return
    slider.max = duration
    slider.disabled = false
    opts.audio.ontimeupdate = () => {
      slider.value = opts.audio.currentTime
    }
    opts.audio.onended = () => {
      slider.value = 0
      opts.audio.currentTime = 0
      opts.pause()
    }
    slider.oninput = () => {
      opts.audio.currentTime = slider.value
    }
  })
  return slider
}
const volumeSlider = opts => {
  let slider = bel`<input type="range" min="0" max="1" step=".01" value=".5" />`
  slider.className = 'volume-slider'
  opts.enableVolume = () => { slider.disabled = false }
  opts.disableVolume = () => { slider.disabled = true }
  slider.oninput = () => {
    opts.audio.volume = slider.value
  }
  return slider
}
const muteButton = opts => {
  let button = bel`<mute-button></mute-button>`
  opts.mute = () => {
    opts.audio.muted = true
    button.onclick = opts.unmute
    opts.disableVolume()
    button.innerHTML = emojione.toImage('🔇')
  }
  opts.unmute = () => {
    opts.audio.muted = false
    button.onclick = opts.mute
    opts.enableVolume()
    button.innerHTML = emojione.toImage('🔊')
  }
  button.onclick = opts.mute
  button.innerHTML = emojione.toImage('🔊')
  return button
}
const download = opts => {
  let button = bel`
  <download-button>
    <a href="${opts.audio.src}" download>
    </a>
  </download-button>`
  button.querySelector('a').innerHTML = fix(emojione.toImage('⬇️️'))
  return button
}

const init = (elem, opts) => {
  if (!opts.audio) throw new Error('Missing audio argument.')
  let slider = elem.querySelector('input.progress-slider')
  let display = elem.querySelector('time-display')
  opts.audio.onended = () => {
    display.textContent = leftPad('00s')
    opts.pause()
    slider.value = 0
    opts.audio.currentTime = 0
    opts.pause()
  }
}
const view = funky`
${init}
<waudio-player>
  <style>
  waudio-player {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  waudio-player * {
    padding: 2px;
  }
  waudio-player time-display {
    margin-top: -4px;
  }
  waudio-player mute-button,
  waudio-player play-button {
    cursor: pointer;
  }
  waudio-player play-button img {
    max-height: 50px;
  }
  waudio-player mute-button img {
    max-height: 30px;
  }
  waudio-player download-button img {
    max-height: 30px;
  }
  waudio-player input.progress-slider {
    flex-grow: 4;
  }
  waudio-player input.volume-slider {
    flex-grow: 2;
    width: 30px;
  }
  waudio-player input[type=range] {
    -webkit-appearance: none;
    margin-top: -2px;
  }
  waudio-player input[type=range]::-webkit-slider-runnable-track {
    height: 5px;
    background: #ddd;
    border: none;
    border-radius: 3px;
  }
  waudio-player input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    border: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #00D4DB;
    margin-top: -5px;
  }
  waudio-player input[type=range]:disabled::-webkit-slider-thumb {
    background: #BEBEBE;
  }
  waudio-player input[type=range] {
    /* fix for FF unable to apply focus style bug  */
    border: 1px solid white;

    /*required for proper track sizing in FF*/
  }
  waudio-player input[type=range]::-moz-range-track {
      height: 5px;
      background: #ddd;
      border: none;
      border-radius: 3px;
  }
  waudio-player input[type=range]::-moz-range-thumb {
      border: none;
      height: 16px;
      width: 16px;
      border-radius: 50%;
      background: #00D4DB;
  }
  waudio-player input[type=range]:disabled::-moz-range-thumb {
    background: #BEBEBE;
  }
  waudio-player input[type=range]:-moz-focusring{
      outline: 1px solid white;
      outline-offset: -1px;
  }
  waudio-player input[type=range]:focus::-moz-range-track {
      background: #ccc;
  }
  waudio-playerr input[type=range]:focus {
      outline: none;
  }
  waudio-player input[type=range]:focus::-webkit-slider-runnable-track {
      background: #ccc;
  }
  </style>
  ${play}
  ${timeDisplay}
  ${progressSlider}
  ${muteButton}
  ${volumeSlider}
  ${download}
</waudio-player>
`

module.exports = view
