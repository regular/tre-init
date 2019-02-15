const {isMsg} = require('ssb-ref')
const traverse = require('traverse')
const causalSort = require('ssb-sort')
const debug = require('debug')('causal-order')

function makeMsgRef(k) {
  if (k[0] !== '%') k = `%${k}`
  const template = "%++++++++++++++++++++++++++++++++++++++++++A=.sha256"
  return k + template.substr(k.length)
}

module.exports = function causalOrder(messages) {

  const replacementKeys = {}
  const thread = Object.keys(messages).map((k, i) => {
    const newKey = makeMsgRef(k)
    if (newKey !== k) {
      replacementKeys[newKey] = k
    }
    const msgForSort = {
      key: newKey,
      timestamp: i,
      value: {}
    }
      
    traverse(messages[k]).forEach(function(x) {
      if (typeof x == 'string' && x[0] == '%') {
        if(!isMsg(x)) {
        const newX = makeMsgRef(x)
        msgForSort.value[x.slice(1)] = newX
        } else if (!isMsg(x)) {
          msgForSort.value[x.slice(1)] = x
        }
      }
    })
    return msgForSort
  })
  const sortedThread = causalSort(thread)
  debug('sorted thread: %O', sortedThread)
  return sortedThread.map(msg => {
    if (replacementKeys[msg.key]) {
      const orig = replacementKeys[msg.key]
      return {
        key: orig,
        value: messages[orig]
      }
    }
    return msg
  })
}
