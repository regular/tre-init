const fs = require('fs')
const {join, resolve, relative, dirname} = require('path')
const pull = require('pull-stream')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const multicb = require('multicb')
const file = require('pull-file')

module.exports = function upload(sources, conf, keys, remote, cb) {
  const done = multicb({pluck: 1, spread: true})

  ssbClient(keys, Object.assign({},
    conf, { manifest: {
      blobs: {
        add: 'sink',
        has: 'async'
      },
      gossip: {
        connect: 'async'
      }
    }}
  ), done())

  ssbClient(keys, Object.assign({},
    conf, { 
      remote,
      manifest: {blobs: { want: 'async' }}
    }
  ), done())
  
  done( (err, ssb, pub) => {
    if (err) return cb(err)

    pull(
      pull.values(sources),
      pull.asyncMap( (source, cb) => {
        let size = 0
        pull(
          source,
          pull.through(b=>size += (b.byteLength || b.length)),
          ssb.blobs.add( (err, hash)=>{
            cb(err, {size, hash})
          })
        )
      }),
      pull.asyncMap( (d, cb) =>{
        ssb.gossip.connect(remote, err =>{
          if (err) return cb(err)
          console.error('Connected to remote')
          cb(null, d)
        })
      }),
      pull.asyncMap( ({hash, size}, cb)=>{
        console.error(`Uploading ${size} bytes (${Math.round(size/conf.blobs.max*100)}% of max blob size) hash: ${hash}`)
        const start = Date.now()
        pub.blobs.want(hash, (err, succ) =>{
          if (err) return cb(err)
          const duration = (Date.now() - start)/1000
          const throughput = Math.round(size/duration)
          if (!succ) {
            return cb(new Error('blob.want retunred false'))
          }
          console.error(`Uploaded ${succ} ${size} bytes in ${duration} seconds, ${throughput} bytes per second`)
          return cb(null, hash)
        })
      }),
      pull.collect( (err, result) =>{
        ssb.close()
        pub.close()
        cb(err, result)
      })
    )
  })
}
