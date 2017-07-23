const _ = require('lodash')
const axios = require('axios')
const credential = require('./credential')
const zlib = require('zlib')
const crypto = require('crypto')
const Promise = require('bluebird')
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

// todo: Wrap Promise within fancy Async/Await syntax
/* todo: metrohash is much faster but requires some dependencies, maybe later */

// simple promise-based retry function
function retry (fn, delay, maxTries) {
  return fn().catch(reason => {
    if (maxTries === 0) {
      console.log('retry failed, abort')
      throw reason
    }
    console.log('retry No.' + (maxTries - 1).toString())
    return Promise.delay(delay).then(retry.bind(null, fn, delay, maxTries - 1))
  })
}

/* There could be a very slim change where api key being used by another application. See typical error msg below
 * [
 {
 "ERROR": true,
 "USERNAME": "AH_2216_431EA3BE",
 "FORMAT": "HUMAN",
 "ERROR_MESSAGE": "Too frequent requests!"
 }
 ]
 * */
function getAisData () {
  // compress=2 returns gzip format as stream so we can cut some download time, typically 7MB vs 1.6MB
  return axios.get('http://data.aishub.net/ws.php?username=' + credential.aisHubApiKey + '&format=1&output=json&compress=2', {responseType: 'stream'})
    .then(response => {
      if (response.status === 200) {
        // promise wrapper for stream...
        return new Promise((resolve, reject) => {
          let result = ''
          response.data
            .pipe(zlib.createGunzip())
            // .pipe(fs.createWriteStream('test.json'))
            .on('data', chunk => {
              result += chunk.toString()
            })
            .on('end', () => {
              result = JSON.parse(result)
              if (result[0].ERROR === true) {
                // somehow this api key has been used by another application in the last 1 min
                reject(result[0].ERROR_MESSAGE)
              }
              resolve(result)
            })
            .on('err', (err) => {
              reject(err)
            })
        })
      }
    })
}

/* http://www.aishub.net/xml-description-20.php
 * Type: vessel type http://catb.org/gpsd/AIVDM.html#_type_5_static_and_voyage_related_data  <== table 11
 * COG: calculated heading  <= Course Over Ground AIS format – in 1/10 degrees
 *                          <= i.e. degrees multiplied by 10. COG=3600 means “not available”
 *                          <= Human readable format – degrees. COG=360.0 means “not available”
 * SOG: <= Speed Over Ground AIS format – in 1/10 knots i.e. knots multiplied by 10. SOG=1024 means “not available” Human readable format – knots. SOG=102.4 means “not available”
 * */

function processAisData (jsonData) {
  let totalRecordCount = parseInt(jsonData[0].RECORDS)
  let uploadTime = new Date()
  let aisRecordList = jsonData[1]
  let vesselData = []
  const vesselColumn = new pgp.helpers.ColumnSet([
    'mmsi',
    'imo',
    'name',
    'callsign',
    'type',
    'a',
    'b',
    'c',
    'd',
    'draught'
  ], {table: {table: 'vessel', schema: 'public'}})
  const aisRecordColumn = new pgp.helpers.ColumnSet([
    '_id',
    'mmsi',
    'report_time',
    'longlat',
    'cog',
    'sog',
    'navstat',
    'dest',
    'eta'
  ], {table: {table: 'ais_record', schema: 'public'}})

  let aisRecordData = []
  _.forEach(aisRecordList, record => {
    let vessel = {
      mmsi: record.MMSI,
      imo: record.IMO,
      name: record.NAME,
      callsign: record.CALLSIGN,
      type: record.TYPE,
      a: record.A,
      b: record.B,
      c: record.C,
      d: record.D,
      draught: record.DRAUGHT
    }
    vesselData.push(vessel)

    const hash = crypto.createHash('sha256')
    let aisRecord = {
      _id: hash.update((record.MMSI.toString() + '-' + record.TIME).toString()).digest('hex'),
      mmsi: record.MMSI,
      report_time: new Date(record.TIME.replace(/(\sGMT)/, 'Z').replace(/\s/, 'T')),
      longlat: '(' + record.LONGITUDE + ',' + record.LATITUDE + ')',
      cog: record.COG,
      sog: record.SOG,
      navstat: record.NAVSTAT,
      dest: record.DEST,
      eta: record.ETA
    }
    aisRecordData.push(aisRecord)
  })
  // todo: do nothing vs update vessel info (could be waste of time)
  // todo: use 'copy' to speed up the insert process?
  const pushVesselData = pgp.helpers.insert(vesselData, vesselColumn) + 'ON CONFLICT DO NOTHING'
  const pushAisRecordData = pgp.helpers.insert(aisRecordData, aisRecordColumn) + 'ON CONFLICT DO NOTHING'

  function doPushVesselData () {
    return db.result(pushVesselData)
  }

  // no need to use task/transaction here
  function doPushAisRecordData () {
    return db.result(pushAisRecordData)
  }

  return Promise.join(doPushVesselData(), doPushAisRecordData(), (vesselPushResult, aisPushResult) => {
    return {
      dbDuration: Math.ceil((vesselPushResult.duration + aisPushResult.duration) / 1000),
      hitRate: Math.floor(aisPushResult.rowCount / totalRecordCount * 100) / 100,
      recordCount: totalRecordCount,
      uploadTime: uploadTime
    }
  })
}

function addUploadReport (result, completeness, err) {
  let status = {
    'upload_time': result.uploadTime,
    'complete': completeness,
    'error': err,
    'record_count': result.recordCount,
    'hit_rate': result.hitRate,
    'process_duration': result.duration,
    'db_duration': result.dbDuration
  }
  const pushUploadStatus = pgp.helpers.insert(status, null, 'upload_status')
  return db.result(pushUploadStatus)
}

function sendEmail (errMsg) {
  let transporter = Promise.promisifyAll(nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: {
      user: credential.mailgunUser,
      pass: credential.mailgunPSW
    }
  }))

// setup email data with unicode symbols
  let mailOptions = {
    from: '"AIS Fetcher" <postmaster@mail.geotricks.net>',
    to: credential.emailAddress1, // list of receivers
    subject: 'AIS-Fetcher Failed', // Subject line
    text: 'something is not right \n?' +
    errMsg.toString()
  }

  transporter.sendMailAsync(mailOptions)
    .then((response) => {
      console.log('Message %s sent: %s', response.messageId, response.response)
    })
    .catch(err => {
      console.log(err)
    })
}

function doFetchPush () {
  let hrstart = process.hrtime()
  // api has a access limit of 1min/request
  retry(getAisData, 60001, 1)
    .then(result => {
      return processAisData(result)
    })
    .then((result) => {
      let hrend = process.hrtime(hrstart)
      console.info(`${result.uploadTime} - The whole execution time is ${hrend[0]}s \n database processes took ${result.dbDuration} (async mode) with a hit rate of ${result.hitRate * 100}%`)
      result.duration = hrend[0]
      return addUploadReport(result, true)
    })
    .catch(err => {
      sendEmail(err)
      let result = {
        // todo: pass a real error occur time
        uploadTime: new Date()
      }
      return addUploadReport(result, false, err)
    })
}

// run script every 30 minutes, really have no time to deal with million-row-data issue
// setInterval is better than recursive setTimeout as it calls function every given time interval comparing to latter one which calls again after last function finishes.
setInterval(() => {
  doFetchPush()
}, 1.8e+6)
