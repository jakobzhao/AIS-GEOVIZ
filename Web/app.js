const Promise = require('bluebird')
const express = require('express')
const helmet = require('helmet')
const app = express()
app.use(helmet())

const db = require('./queries')
const defaultResponse = 'Welcome to Likun\'s AIS data hub, for more information about this project, please visit https://github.com/jakobzhao/AIS-GEOVIZ or email me via chenli@oregonstate.edu'

app.get('*', function (req, res) {
  res.send(defaultResponse)
})

// servers static json file as backup data
app.use(express.static('public'))

// three params, two dates and one resolution
// e.g. /data/ais?startD=2017-07-23T02:24Z&endD=2017-07-23T02:24Z&resKM=50.5
app.post('/data/:type', db.getAisJson)

app.post('*', function (req, res) {
  res.send(defaultResponse)
})

app.listen(2713, function () {
  console.log('Example app listening on port 2713!')
})
