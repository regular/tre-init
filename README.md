# tre-init

tre-init and other command line utilities for Tre. 

## Install

```
npm i -g tre-init
```

## tre-init - Create a new ssb network and an initial message tree

```
cd myproject
tre-init
```

This creates the file `.trerc` and the directory `.tre` in the current working directory. `.trerc` serves the same purpose as `~/.ssb/config` in traditional ssb setups. Additionally, it contains ssb message keys of some of the branches that were created by tre-init. A new, random network-id was created, port numbers also are random (above 50000 and below 65000)

Data is stored in `.tre`, it replaces `~/.ssb` in traditional ssb setups. 

In case they did not exist before, new keypairs were created in `.tre/secret` and `.tre/browser-keys`

## Run sbot with the local config

`tre-bot` is a simple wrapper around `sbot` (scuttlebot). It instructs sbot to use the local config. You can run it from anywhere inside your project tree, it will pick up the closest `.trerc` file.

```
tre-bot server
```

