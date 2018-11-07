set -exu
here=$(dirname $(realpath $0))
npm_bin="${here}/../node_modules/.bin"

conf () {
  node -p "require(\"${here}/../node_modules/rc\")('tre').$1"
}

port=$(conf budo.port)
host=$(conf budo.host)
secret=$(dirname $(conf config))/.tre/browser-keys
keys=$(cat "${secret}"|grep -v '^#')
remote=$(bash ${here}/trebot ws.getAddress)
${npm_bin}/localstorage write "${host}:${port}" tre-remote "${remote}"
${npm_bin}/localstorage write "${host}:${port}" tre-keypair "${keys}"
${npm_bin}/budo --static-options [ --dotfiles allow ] --no-portfind --port ${port} --host "${host}" $@
