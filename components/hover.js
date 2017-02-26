module.exports = (elem, enter, leave) => {
  let _in = false
  let mouseover = ev => {
    if (!_in) enter(ev)
    _in = true
  }
  let mouseout = ev => {
    if (_in) leave(ev)
    _in = false
  }
  elem.addEventListener('mouseover', mouseover)
  elem.addEventListener('mouseout', mouseout)
}