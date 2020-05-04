const fs = require('fs')
const {join} = require('path')

module.exports = function getRemote(conf) {
  const path = conf.config
  let remotes
  try {
    remotes = JSON.parse(
      fs.readFileSync(join(path, '../.tre/remotes'), 'utf8')
    )
  } catch(err) {
    throw new Error('Unable to read .tre/remotes:', err.message)
  }

  let remote = remotes[conf.remote]
  if (Object.values(remotes).length == 1) remote = Object.values(remotes)[0]
  if (!remote) {
    throw new Error('specify a remote. Available remotes: ' + Object.keys(remotes))
  }
  return remote
}
