set -exu

conf () {
  node -p "require(\"${here}/../node_modules/rc\")('tre').$1"
}

binjs=scuttlebot-release/node_modules/scuttlebot/bin.js
#binjs=scuttlebot/bin.js
here=$(dirname $(realpath $0))
sbot=${here}/../node_modules/${binjs}
config=$(conf config)
ssb_appname=tre "${sbot}" "$@" -- --path=$(dirname "${config}")/.tre
