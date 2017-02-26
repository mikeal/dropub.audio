const qs = require('querystring')
const dropubAudio = require('./components/dropub-audio')

if (process.browser) {
  window.searchParams = qs.parse(window.location.search.slice(1))
  window.dropubAudio = dropubAudio
} else {
  module.exports = dropubAudio
}
