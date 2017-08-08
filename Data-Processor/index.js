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
//  'LIMIT 20' +
    ';',
    queryInfo
  )
  console.log(query)
  return query
}

db.result(singleDayQueryBuilder('2017-08-06', '2017-08-07', [1, 2]))
  .then(result => {
    let records = groupByMMSI(result.rows)
    fs.writeFileAsync('records.json', JSON.stringify(records), 'utf-8')
  })

function groupByMMSI (data) {
  // build vessel data with a geoJSON object which can be use directly to generate svg path later in viewer
  //
  function buildGeoJSON(vessel) {
    let vesselData = {
      mmsi: vessel.mmsi,
      recordTime: [],
      geoJSON: {
        type: 'LineString',
        coordinates: []
      }
    }
    _.forEach(vessel.records, record => {
      // store recordTime in second to save space
      // division is still faster https://jsperf.com/slicevsdivision
      vesselData.recordTime.push((new Date(record.report_time)).getTime() / 1e3)
      vesselData.geoJSON.coordinates.push([record.longlat.x, record.longlat.y])
    })
    return vesselData
  }

  return _.chain(data)
    .groupBy('mmsi')
    .toPairs()
    .map(vessel => _.zipObject(['mmsi', 'records'], vessel))
    .map(vessel => buildGeoJSON(vessel))
    .value()
}

// moment.js brings too many overheads, use native Date() instead. https://github.com/moment/moment/issues/731