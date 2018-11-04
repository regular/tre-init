const {client} = require('tre-client')
const pull = require('pull-stream')
const collectMutations = require('collect-mutations')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const h = require('mutant/html-element')

client( (err, ssb, config) => {
  console.log('tre config', config.tre)
  if (err) return console.error(err)
  ssb.whoami( (err, feed) => {
    if (err) return console.error(err)
    console.log('pub key', feed.id)
    const arr = MutantArray()
    document.body.appendChild(
      h('ol', MutantMap(arr, m => {
        console.log(m())
        return h('li', m().value.content.name)
      }, (a,b) => a===b ))
    )
    pull(
      ssb.revisions.messagesByBranch(config.tre.branches.root),
      collectMutations(arr)
    )
  }) 
})
