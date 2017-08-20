const raw = (require('./sample-raw.json'))[0]
const slim = (require('./sample-slim.json'))[0]
const _ = require('lodash')

let diffCounter = 0
let matchCounter = 0
_.forEach(slim.recordTime, (timeValue, index) => {
  let rawIndex = raw.recordTime.indexOf(timeValue)
  if (rawIndex + 1) {
    let rawLongLat = raw.geoJSON.coordinates[rawIndex].join()
    let slimLonglat = slim.geoJSON.coordinates[index].join()
    if (! rawLongLat === slimLonglat) {
      diffCounter += 1
    } else {
      matchCounter += 1
    }
  } else {
    diffCounter += 1
  }
})

console.log('diff counter= ' + diffCounter)
console.log('match counter= ' + matchCounter)
console.log('array length= ' + slim.recordTime.length)