const test = require('tape')
const sort = require('../lib/causal-order')

test('simple', t => {
  const msgs = {
    a : {
      content: {
        foo: '%b'
      }
    },
    b: {
      content: {
        foo: 'bar'
      }
    }
  }
  const result = sort(msgs)
  t.deepEqual(result[0].value, msgs.b, 'message b is first')
  t.deepEqual(result[1].value, msgs.a, 'then message a')
  t.end()
})

test('reverse', t => {
  const msgs = {
    a : {
      content: {
        foo: 'bar'
      }
    },
    b: {
      content: {
        foo: '%a'
      }
    }
  }
  const result = sort(msgs)
  t.deepEqual(result[0].value, msgs.a, 'message bais first')
  t.deepEqual(result[1].value, msgs.b, 'then message b')
  t.end()
})
