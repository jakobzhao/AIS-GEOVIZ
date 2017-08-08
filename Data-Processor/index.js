//TODO increase memory for this consuming task
// pm2 start index.js --node-args="--max_old_space_size=6144" # increase to 6gb
const _ = require('lodash')
const credential = require('./credential')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const options = {promiseLib: Promise, capSQL: true}
const pgp = require('pg-promise')(options)
const connection = {
  // host: credential.pgHost,
  host: credential.pgHostNonDocker,
  user: credential.pgUser,
  password: credential.pgPSW,
  port: credential.pgPort,
  database: credential.pgDatabase
}
const db = pgp(connection)

let singleDayQueryBuilder = function (startDate, endDate, digitArray) {
  let queryInfo = {
    startDate: startDate, // GMT0
    endDate: endDate,
    queryMMSI_Digit: digitArray.join(',')
  }
  let query = pgp.as.format(
    'SELECT mmsi, report_time, longlat\n' +
    'FROM ais_record\n' +
    'WHERE report_time >= ${startDate}\n' +
    'AND report_time <= ${endDate}\n' +
    'AND CAST(RIGHT(CAST(mmsi as VARCHAR), 1) as INT) IN (${queryMMSI_Digit^})\n' +
    'ORDER BY mmsi, report_time\n' +
    'LIMIT 20' +
    ';',
    queryInfo
  )
  console.log(query)
  return query
}

db.result(singleDayQueryBuilder('2017-08-06', '2017-08-07', [1, 2]))
  .then(result => {
    fs.writeFileAsync('3.json', JSON.stringify(result.rows), 'utf-8')
  })


// moment.js brings too many overheads, use native Date() instead. https://github.com/moment/moment/issues/731