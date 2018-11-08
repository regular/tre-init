#!/usr/bin/env node
const crypto = require('crypto')
const {join} = require('path')
const createSbot = require('scuttlebot-release/node_modules/scuttlebot')

const pull = require('pull-stream')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const mkdirp = require('mkdirp')

const path = join(process.cwd(), '.tre')
mkdirp.sync(path)
const caps = crypto.randomBytes(32).toString('base64')
const port = Math.floor(50000 + 15000 * Math.random())

const branches = [
  {type: 'folder', name: 'Users', key: 'about'},
  {type: 'folder', name: '.Machines', key: 'machines'},
  {type: 'folder', name: 'Assets', children: [
    {type: 'folder', name: 'Icons'},
    {type: 'folder', name: 'Stylesheets'},
    {type: 'folder', name: 'Fonts'},
  ]},
  {type: 'folder', name: '.Code', children: [
    {type: 'folder', name: 'WebApps', key: 'webapps'}
  ]},
  {type: 'folder', name: '.Trash', key: 'trash'},
]

const browserKeys = ssbKeys.loadOrCreateSync(join(path, 'browser-keys'))

ssbKeys.loadOrCreate(join(path, 'secret'), (err, keys) => {
  const ssb = createSbot({
    keys,
    path,
    caps: { shs: caps }
  })

    ssb.whoami( (err, feed) => {
      if (err) return console.error(err)
      console.error('pub key', feed.id)
      console.error('app key', caps)
      ssb.publish({type: 'root'}, (err, kv) => {
        if (err) return console.error(err)
        const root = kv.key
        const folders = {root}
        console.error('root', root) 
        addBranches(branches, root, 0, err => {
          if (err) console.error(err)
          console.log(JSON.stringify({
            caps: {shs: caps},
            appKey: caps,
            port,
            ws: {port: port + 1},
            master: [browserKeys.id],
            /*
            connections: {
              incoming: {
                net: [{ port, scope: "public", transform: "shs" }],
                ws: [{ port: port + 2, scope: "device", transform: "noauth", host: "localhost" }]
              },
              outgoing: {
                net: [{ transform: "shs" }]
              }
            },
            */
            budo: {
              host: 'localhost',
              port: port + 2
            },
            tre: {branches: folders},
            autofollow: keys.public,
            autoname: folders.machines
          }, null, 2))
          setTimeout( ()=> process.exit(0), 200)
        })

        function addBranches(children, branch, level, cb) {
          pull(
            pull.values(children || []),
            pull.map( o => ({
              key: o.key,
              children: o.children,
              data: Object.assign({root, branch}, o, {children: undefined, key: undefined})
            })),
            pull.asyncMap( ({children, key, data}, cb) => {
              ssb.publish(data, (err, msg) => {
                if (err) return cb(err)
                console.error(Buffer.alloc(level).fill(' ').toString(), msg.value.content.name, msg.key)
                if (key) folders[key] =  msg.key
                cb(null, {msg, children})
              })
            }),
            pull.asyncMap( ({msg, children}, cb) => addBranches(children, msg.key, level + 1, cb) ),
            pull.onEnd(cb)
          )
        }

      })
    })

})


