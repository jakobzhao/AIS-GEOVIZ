const _ = require('lodash')
const axios = require('axios')
const credential = require('./credential')
const Promise = require('bluebird')
const moment = require('moment')
const nodemailer = Promise.promisifyAll(require('nodemailer'))
const options = {promiseLib: Promise, capSQL: true}
const pgp = require('pg-promise')(options)
const connection = {
  host: credential.pgHost,
  user: credential.pgUser,
  password: credential.pgPSW,
  port: credential.pgPort,
  database: credential.pgDatabase
}

const db = pgp(connection)
const defaultResponse = 'Welcome to Likun\'s AIS data hub, for more information about this project, please visit https://github.com/jakobzhao/AIS-GEOVIZ or email me via' + credential.emailAddress1
const maxQueryDay = 1

function notFound (res, reason) {
  res.status(404)
    .send(defaultResponse + '\n' + reason)
}

// e.g. /data/ais?startD=2017-07-23T02:24Z&endD=2017-07-23T02:24Z&resKM=50.5
function getAisJson (req, res, next) {
  if (req.params.type.toUpperCase() === 'AIS' && moment(req.query.startD).isValid() && moment(req.query.endD).isValid() && parseFloat(req.query.resKM)) {
    let startD = moment.utc(req.query.startD)
    // limit max query duration
    let endD = moment.utc(req.query.startD).add(maxQueryDay, 'days').isBefore(moment.utc(req.query.endD)) ? moment.utc(req.query.startD).add(maxQueryDay, 'days') : moment.utc(req.query.endD)
    let resKM = parseFloat(req.query.resKM) > 0 ? parseFloat(req.query.resKM) : parseFloat(req.query.resKM) * -1

    res.send(startD + ' - ' + endD + ' - ' + resKM)
  } else {
    notFound(res, 'wrong input')
  }
}

module.exports = {
  getAisJson: getAisJson
}
