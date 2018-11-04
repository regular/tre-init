const {client} = require('tre-client')

client( (err, ssb, config) => {
  console.log('tre config', config.tre)
  if (err) return console.error(err)
  ssb.whoami( (err, feed) => {
    if (err) return console.error(err)
    console.log('pub key', feed.id) 
  }) 
})
