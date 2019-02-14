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

  //const replacements = {}
  const thread = Object.keys(messages).map(k => {
    const newKey = makeMsgRef(k)
    /*
    if (newKey !== k) {
      replacements['KEY_' + newKey] = k
    }*/
      
    const msg = {
      key: newKey,
      value: {
        __orig: {key: k, value: messages[k]}
      }
    }
    traverse(messages[k]).forEach(function(x) {
      if (typeof x == 'string' && x[0] == '%' && !isMsg(x)) {
        const newX = makeMsgRef(x)
        //replacements[newX] = x
        msg.value[x.slice(1)] = newX
        //this.update(newX)
      }
    })
    return msg
  })
  const sortedThread = causalSort(thread)
  debug('sorted thread: %O', sortedThread)
  /*
  return sortedThread.map(msg => {
    if (replacements['KEY_' + msg.key]) {
      msg.key = replacements['KEY_' + msg.key]
    }
    traverse(msg.value).forEach( function(x) {
      if (replacements[x]) {
        this.update(replacements[x])
      }
    })
    return msg
  })
  */
  return sortedThread.map(kv => kv.value.__orig)
}
