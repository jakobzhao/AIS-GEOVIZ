<template>
  <div>
    <div id="display" v-loading.fullscreen.lock=info.loadingInfo.isLoading :element-loading-text=info.loadingInfo.loadingText>
      <svg class="fill-screen" id="crosshair-background"></svg>
      <canvas id="map" class="fill-screen" xmlns="http://www.w3.org/2000/svg" version="1.1"></canvas>
      <canvas id="animation" class="fill-screen"></canvas>
      <canvas id="overlay" class="fill-screen"></canvas>
      <canvas id="geoStreamTest" class="fill-screen"></canvas>
      <canvas id="geoPathTest" class="fill-screen"></canvas>
      <canvas id="geoSimplifyTest" class="fill-screen"></canvas>
    </div>

    <div id="geo-viz-icon">
      <img
        src="../assets/geoviz-logo.png"
        :class="info.isShowingGEOVIZ ? 'small-logo' : 'big-logo'"
        @click="info.isShowingGEOVIZ = !info.isShowingGEOVIZ">
      <span
        :class="info.isShowingGEOVIZ ? 'small-logo' : 'big-logo'"
        @click="info.isShowingGEOVIZ = !info.isShowingGEOVIZ">
        GEOVIZ</span>

      <div id="geo-viz" v-show="info.isShowingGEOVIZ">
        <div class="geo-viz-content">
          <el-dropdown style="padding-left: 200px"
                       trigger="click"
                       @command="handleChangeProject">
            <el-button type="primary">
              {{info.currentProjection | startCase}}
              <i class="el-icon-caret-bottom el-icon--right"></i>
            </el-button>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item
                v-for="projection in params.PROJECTION_LIST"
                :key="projection"
                :command="projection"
                :disabled="info.currentProjection === projection">
                {{projection | startCase}}
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
          <span>Time step</span>
          <el-input-number
            v-model="info.pixiInfo.drawingTimeStep"
            style="width: 200px"
            :min="60"
            :max="6000"></el-input-number>
          <span>Turbo Mode</span>
          <el-tooltip placement="bottom">
            <div slot="content">Much faster but might create artifacts</div>
            <el-switch
              v-model="info.dataProcessInfo.isOnTurboMode"
              on-color="#ff4949"
              off-color="#13ce66">
            </el-switch>
          </el-tooltip>

          <span>Debug Info</span>
          <el-switch
            v-model="info.isShowingDebug"
            on-color="#107A92"
            off-color="#6BA7BF">
          </el-switch>

          <span>Mask Animation</span>
          <el-switch
            v-model="info.pixiInfo.isMasked"
            on-color="#107A92"
            off-color="#6BA7BF">
          </el-switch>

          <button @click="geoStreamTest()">Line Test</button>
          <button @click="updateVesselRecordTest()">UpdateData</button>
          <button @click="setCurrentCircle()">current Circle</button>

          <!--       <button @click="processData()">Prep Data</button>-->
          <button @click="loadData()" v-show="!info.pixiInfo.hasDrawn">draw vessel </button>
          <div>
            <el-progress
              :text-inside="true"
              :stroke-width="18"
              :percentage="currentTimeProgress"
              style="width: 400px"></el-progress>
            <div>currentTime: {{info.pixiInfo.drawingCurrentTime | showTime}}</div>
          </div>
        </div>
      </div>
    </div>


    <div id="debug-info" v-if="info.isShowingDebug">
      <div>Long: {{info.currentView.split(',')[0]}}</div>
      <div>Lat: {{info.currentView.split(',')[1]}}</div>
      <div>Scale: {{info.currentView.split(',')[2]}}</div>
      <div>Projection: {{info.currentProjection}}</div>
      <div>DeBounce Delay: {{params.DEBOUNCE_WAIT}}ms</div>
      <div>Circile: {{info.currentCircle}}</div>
      <div>isVisible: {{info.pixiInfo.isVisible}}</div>
      <div>isRedrawing: {{info.pixiInfo.isRedrawing}}</div>
      <div>All Vessel Count: {{info.dataProcessInfo.totalVessel}}</div>
      <div>Visible Vessel Count: {{info.dataProcessInfo.totalVessel - info.dataProcessInfo.invisibleVessel}}</div>
      <div>Processing Progress: {{(info.dataProcessInfo.processProgress * 100 | 0)}}%</div>
      <div>Last Process Time : {{info.dataProcessInfo.lastProcessDuration}}ms</div>
      <div>isLoading: {{info.loadingInfo.isLoading}}</div>
      <div>currentTime: {{info.pixiInfo.drawingCurrentTime}}</div>
    </div>

    <el-dialog title="Welcome to GEOVIZ - AIS Vessel Visualization" v-model="info.loadingInfo.isBrowserTestDVisible" size="tiny" :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false">
      <p v-if="info.loadingInfo.currentBrowser">It appears that you are using {{info.loadingInfo.currentBrowser}}</p>
      <p v-if="info.loadingInfo.currentDevices">It appears that you are visiting this site from a {{info.loadingInfo.currentDevices}}</p>
      <p>This site heavily utilizes webGL and has large data set for visualization.</p>
      <p>For the best user experience, please use the latest Chrome on computer with a dedicated graphic card.</p>
      <p slot="footer" class="dialog-footer">
        <el-button type="primary" @click="info.loadingInfo.isBrowserTestDVisible = false">Confirm</el-button>
      </p>
    </el-dialog>

  </div>
</template>

<script>
  import _ from 'lodash'
  import ES6promise from 'es6-promise'

  ES6promise.polyfill()
  import axios from 'axios'
  import bowser from 'bowser'
  import Promise from 'bluebird'
  import * as PIXI from 'pixi.js'
  import Stats from 'stats.js'
  import * as d3 from 'd3'
  // temp fix till topojson start to use es6 export, https://github.com/topojson/topojson/issues/285
  import * as topojson from 'topojson/node_modules/topojson-client/src/feature'
  import * as micro from '../Utils/micro'
  import * as globes from '../Utils/globes'
  import earthTopoSimple from '../data/world-110m.json'
  import sampleRaw from '../data/sample-raw.json'
  import sampleSlim from '../data/sample-slim.json'

  export default {
    name: 'Viewer',
    data () {
      return {
        info: {
          currentProjection: 'orthographic',
          currentView: '-170, 15, null',
          currentCircle: null,
          initScale: 0,
          isShowingDebug: true,
          isShowingGEOVIZ: false,
          pixiInfo: {
            isVisible: true,
            isRedrawing: false,
            isMasked: true,
            hasDrawn: false,
            drawingStartTime: 0,
            drawingEndTime: 0,
            drawingCurrentTime: 0,
            drawingTimeStep: 360,
            drawingAlpha: 0.4,
            drawingMaxLife: 300
          },
          dataProcessInfo: {
            isRemoveInvalidData: false,
            isUsingWebWorker: false,
            isOnTurboMode: true,
            isOnScopedMode: false, // very heave calc, takes 3x times
            totalVessel: 0,
            invisibleVessel: 0,
            invisibleVesselList: [],
            processProgress: 0.00,
            lastProcessDuration: 0
          },
          loadingInfo: {
            isBrowserTestDVisible: false,
            isLoading: false,
            currentBrowser: null,
            currentDevices: null,
            loadingText: 'Processing data...'
          }
        },
        params: {
          DEBOUNCE_WAIT: 600,
          DEFAULT_SCALE: 450,
          MIN_MOVE: 4,
          MOVE_END_WAIT: 1000,
          PROJECTION_LIST: Object.keys(globes.projectionList),
          REDRAW_WAIT: 5,
          // TODO:add event handler for window resizing or just use vw vh? https://github.com/vuejs/vue/issues/1915
          VIEW: micro.view(),
          DEVMODE: 0,
          KMPERRAD: 40075 / (Math.PI * 2),
          EARTHRADIUS: 6371
        },
        earthTopo: null,
        globe: null,
        stats: null, // stats meter
        rawData: null,
        processedData: {},
        testRoute: [
          [121.565, 31.098],
          [139.846, 37.062],
          [155.213, 36.921],
          [168.702, 43.547],
          [-163.896, 34.794],
          [-142.251, 29.103]
        ],
        testPath: {
          type: 'LineString',
          coordinates: [
            [121.565, 31.098],
            [139.846, 37.062],
            [166.213, 36.921],
            [-122.702, 43.547],
            [-115.896, 34.794],
            [-97.251, 29.103]
          ],
        },
        correctedStream: [],
      }
    },
    computed: {
      path: function () {
        return d3.geoPath().projection(this.globe.projection).pointRadius(7)
      },
      currentTimeProgress: function () {
        return ((this.info.pixiInfo.drawingCurrentTime - this.info.pixiInfo.drawingStartTime) * 100 / (this.info.pixiInfo.drawingEndTime - this.info.pixiInfo.drawingStartTime)) | 0
      },
    },
    methods: {
      addStatsMeter: function () {
        this.stats = new Stats()
        this.stats.domElement.style.position = 'absolute'
        this.stats.domElement.style.top = '0px'
        this.stats.domElement.id = 'statsMeter'
        document.body.appendChild(this.stats.domElement)
      },
      toggleDrawing: function () {
        this.info.pixiInfo.isVisible = !this.info.pixiInfo.isVisible
      },
      setEarthTopo: function () {
        this.earthTopo = Object.freeze(topojson.object(earthTopoSimple, earthTopoSimple.objects.countries))
      },
      buildGlobe: function (projectionName) {
        if (this.params.PROJECTION_LIST.indexOf(projectionName) >= 0) {
          return globes.projectionList[projectionName](this.params.VIEW)
        } else {return null}
      },
      drawGlobe: function (isUpdate) {
        if (this.params.DEVMODE > 100) console.log('drawing...')
        this.globe = this.buildGlobe(this.info.currentProjection)

        // Create new map svg elements.
        this.globe.drawMap(this)
        this.globe.orientation(this.info.currentView, this.params.VIEW, this)
      },
      onUserInput: function () {
        let vueInstance = this
        let coastline = d3.select('.coastline')
        let lakes = d3.select('.lakes')
        let displayDiv = document.getElementById('display')

        function newOp (startMouse, startScale) {
          return {
            type: 'click',  // initially assumed to be a click operation
            startMouse: startMouse,
            startScale: startScale,
            manipulator: vueInstance.globe.manipulator(startMouse, startScale)
          }
        }

        let triggerRedraw = _.debounce(()=> {
          vueInstance.info.pixiInfo.isRedrawing = true
        }, vueInstance.params.DEBOUNCE_WAIT)

        let op = null
        let zoom = d3.zoom()
          .on('start', () => {
            op = op || newOp(d3.mouse(displayDiv), d3.zoomTransform(displayDiv).k)  // a new operation begins

            // clean up canvas before rotate
            document.getElementById('geoPathTest').getContext('2d').clearRect(0, 0, this.params.VIEW.width, this.params.VIEW.height)
            document.getElementById('geoStreamTest').getContext('2d').clearRect(0, 0, this.params.VIEW.width, this.params.VIEW.height)
            if (this.params.DEVMODE > 10) console.log('zoom started')
          })
          .on('zoom', () => {
            if (this.params.DEVMODE > 10) console.log('zooming...')
            let currentMouse = d3.mouse(displayDiv)
            let currentZoomRatio = d3.zoomTransform(displayDiv).k
            if (this.params.DEVMODE > 100) console.log('zoomRatio= ' + d3.zoomTransform(displayDiv).k)

            op = op || newOp(currentMouse, 10)  // Fix bug on some browsers where zoomstart fires out of order.
            if (op.type === 'click' || op.type === 'spurious') {
              let distanceMoved = micro.distance(currentMouse, op.startMouse)
              // console.log(distanceMoved + ' moved')
              if (currentZoomRatio === op.startScale && distanceMoved < vueInstance.params.MIN_MOVE) {
                // to reduce annoyance, ignore op if mouse has barely moved and no zoom is occurring
                op.type = distanceMoved > 0 ? 'click' : 'spurious'
                return
              }
              op.type = 'drag'
              this.info.pixiInfo.isVisible = false
            }
            if (currentZoomRatio !== op.startScale) {
              op.type = 'zoom' // whenever a scale change is detected, (stickily) switch to a zoom operation
            }

            // when zooming, ignore whatever the mouse is doing--really cleans up behavior on touch devices

            if (this.params.DEVMODE > 100) console.log('for real ' + op.type.toString() === 'zoom' ? null : currentMouse, currentZoomRatio)
            op.manipulator.move(op.type.toString() === 'zoom' ? null : currentMouse, currentZoomRatio * vueInstance.info.initScale)
            this.globe.drawMap(this)
            this.info.currentView = this.globe.orientation()
          })
          .on('end', () => {
            if (this.params.DEVMODE > 10) {
              console.log('ended')
              console.log('op type= ' + op.type)
            }
            this.info.currentView = this.globe.orientation()

            op.manipulator.end()
            // click rarely happens...
            if (op.type === 'click' || op.type === 'spurious') {
              this.info.pixiInfo.isVisible = true
            }
            else {
              // TODO: add a _.debounce here?
           //   this.info.pixiInfo.isVisible = false
              triggerRedraw()
            }
            op = null  // the drag/zoom/click operation is over

          })
        d3.select('#display').call(zoom)
      },
      geoStreamTest: function () {
        let vueInstance = this
        // drawing using geoStream
        let context = document.getElementById('geoStreamTest').getContext('2d')
        context.clearRect(0, 0, vueInstance.params.VIEW.width, vueInstance.params.VIEW.height)
        context.strokeStyle = 'rgba(245, 90, 92, 0.7)'
        context.lineWidth = 7

        vueInstance.updateVesselRecordTest()

        context.beginPath()
        vueInstance.correctedStream.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point[0], point[1])
          } else {
            context.lineTo(point[0], point[1])
          }
        })
        context.stroke()

        // drawing using geoPath
        let context2 = document.getElementById('geoPathTest').getContext('2d')
        context2.clearRect(0, 0, vueInstance.params.VIEW.width, vueInstance.params.VIEW.height)
        let geoPath = vueInstance.path.context(context2)

        let drawGeoPath = function (path, context) {
          if (vueInstance.params.DEVMODE > 10) console.log('now drawing')
          context.lineWidth = 7
          context.strokeStyle = 'rgba(71, 192, 180, 0.7)'
          context.beginPath()
          path(vueInstance.testPath)
          context.stroke()
        }
        drawGeoPath(geoPath, context2)
        let svgGeoPath = vueInstance.path.context(null)
        if (vueInstance.params.DEVMODE > 10) console.info(svgGeoPath(vueInstance.testPath))
      },
      geoSimplifyTest: function () {
        let context = document.getElementById('geoSimplifyTest').getContext('2d')
        context.clearRect(0, 0, this.params.VIEW.width, this.params.VIEW.height)
        context.strokeStyle = 'rgba(245, 90, 92, 0.7)'
        context.lineWidth = 7
      },
      updateVesselRecordTest: function () {
        let vueInstance = this
        let correctedStream = vueInstance.correctedStream
        correctedStream = []

        let stream = vueInstance.globe.projection.stream({
          point: function (x, y) {
            correctedStream.push([x, y])
          }
        })

        vueInstance.testPath.coordinates.forEach((point, index) => {
          // streamWrapper(point[0], point[1], index)
          stream.point(point[0], point[1])
        })
        if (this.params.DEVMODE > 10) {
          console.log(vueInstance.testPath.coordinates.length + ' of points have been filter to ' + correctedStream.length)
          console.info(correctedStream)
        }
        this.correctedStream = correctedStream
      },
      handleChangeProject: function (command) {
        // http://element.eleme.io/#/en-US/component/dropdown
        this.changeProjection(command)
      },
      changeProjection: function (newProjection) {
        if (newProjection !== this.info.currentProjection) {
          if (this.params.DEVMODE > 10) console.log('change projection, new projection= ' + _.snakeCase(newProjection))
          let scale = (this.info.currentView.split(','))[2]
          this.info.currentProjection = newProjection
          this.drawGlobe()
          this.onUserInput()
          this.info.pixiInfo.isRedrawing = true
        }
      },
      vesseLonglatToPixel: function (vessel) {
        let vueInstance = this
        let pixelArray = []
        let streamWrapper = function (x, y, vessel, index) {
          let stream = vueInstance.globe.projection.stream({
            point: function (x, y) {
              pixelArray.push([x, y, vessel.recordTime[index]])
            }
          })
          stream.point(x, y)
        }

        let i = 0
        while (i < vessel.geoJSON.coordinates.length) {
          let currentLonglat = vessel.geoJSON.coordinates[i]
          streamWrapper(currentLonglat[0], currentLonglat[1], vessel, i)
          i++
        }
        return pixelArray
      },
      removeInvalidData: function (records) {
        // remove longlat pts with 181, 91 coordinates
        return records.filter(record => {
          return record.longlat.x !== 181 && record.longlat.y !== 91
        })
      },
      svgifyPath: function (vessel) {
        // get geoStreamed points with timestamps
        /*        vessel.records = this.info.dataProcessInfo.isRemoveInvalidData ? this.removeInvalidData(vessel.records) : vessel.records*/
        let geoStreamedPoint = this.vesseLonglatToPixel(vessel).filter(record => {
          return record[0] >= 0 && record[1] >= 0 && record[0] <= this.params.VIEW.width && record[1] <= this.params.VIEW.height
        })

        // only works on sphere
        // this is faster than calc-ing geoLength but still the overhead will slow down the process 3x to 5x
        if (this.info.dataProcessInfo.isOnScopedMode && this.info.currentProjection === 'orthographic') {
          this.setCurrentCircle()
          // only cares when sphere is smaller than view
          if (this.info.currentCircle[2] * 2 < this.params.VIEW.height) {
            geoStreamedPoint = geoStreamedPoint.filter(pt => {
              return this.checkPtInCircle(pt)
            })
          }
        }

        if (!this.info.dataProcessInfo.isOnTurboMode) {
          let svgGeoPath = this.path.context(null)
          let svgString = svgGeoPath(vessel.geoJSON)

          if (svgString !== null) {
            // parse svg for longlat
            // negative values might appear when scale is large enough
            let longlatRegex = /(-?\d+\.\d+,-?\d+\.\d+)/g
            let longlatMatch
            let longlatTemp = []
            while (longlatMatch = longlatRegex.exec(svgString)) {
              longlatTemp.push(longlatMatch[1])
            }

            // loop longlap for cleanup
            let longlat = []
            let i = 0
            while (i < longlatTemp.length) {
              let currentLonglat = longlatTemp[i]
              let longlatString = currentLonglat.split(',')
              // bottleneck here
              // https://jsperf.com/number-vs-plus-vs-toint-vs-tofloat/14
              let result = {
                xy: [parseFloat(longlatString[0]), parseFloat(longlatString[1])],
                timeStamp: null,
                isAnchor: false
              }
              if (result.xy[0] > 0 && result.xy[1] > 0) {
                longlat.push(result)
              }
              i++
            }

            // check if there is any curve or v/h line in generated svg string
            // TODO: disable in production
            let checkerRegex = /([a-zA-Z])/g
            let checkerMatch
            let checker = []
            while (checkerMatch = checkerRegex.exec(svgString)) {
              checker.push(checkerMatch[1])
            }
            let checkResult = checker.join().replace(/[lLmM,]/g, '')
            if (checkResult) {
              checkResult.length === 0 ? console.log() : console.log('something not right, ' + checkResult)
            }

            if (longlat.length) {
              // compare and merge svg-generated pts with geoStream generated pts
              // TODO: need to refactor this nested loop
              let anchorPtsIndex = []
              let newLongLat = []
              let j = 0
              geoStreamLoop:
                while (j < geoStreamedPoint.length) {
                  // for pts with same longlat but different timestamp
                  if (j !== 0) {
                    if (geoStreamedPoint[j][0] === geoStreamedPoint[j - 1][0] &&
                      geoStreamedPoint[j][1] === geoStreamedPoint[j - 1][1]) {
                      let newLonglatItem = {
                        isAnchor: true,
                        timeStamp: geoStreamedPoint[j][2],
                        xy: [geoStreamedPoint[j][0], geoStreamedPoint[j][1]]
                      }
                      newLongLat.push(newLonglatItem)
                      anchorPtsIndex.push(newLongLat.length - 1)
                      j++
                      continue
                    }
                  }
                  let currentPixelLocValue = [geoStreamedPoint[j][0], geoStreamedPoint[j][1]].join().toString()
                  let loopCounter = 0
                  svgPtsLoop:
                    while (longlat.length) {
                      if (currentPixelLocValue === (longlat[loopCounter].xy).join()) {
                        // svg-generated path will eliminate/overwrite pts with same longlat but different timestamp...
                        let newLonglatItem = {
                          isAnchor: true,
                          timeStamp: geoStreamedPoint[j][2],
                          xy: [geoStreamedPoint[j][0], geoStreamedPoint[j][1]]
                        }
                        newLongLat.push(newLonglatItem)
                        anchorPtsIndex.push(newLongLat.length - 1)
                        longlat.shift()
                        j++
                        continue geoStreamLoop
                      } else {
                        if (anchorPtsIndex.length) {
                          if (loopCounter < longlat.length - 1) {
                            loopCounter += 1
                          } else {
                            // no matching result for current geoStream pts, pass
                            loopCounter = 0
                            j++
                            continue geoStreamLoop
                          }
                        } else {
                          // filter out leading pts w/o timestamp
                          longlat.shift()
                        }
                      }
                    }
                  j++
                }
              // console.log is like cout, an expensive operation
              if (this.params.DEVMODE > 50) {
                console.log(vessel.mmsi)
                console.info(geoStreamedPoint)
                console.log(newLongLat)
                console.log(anchorPtsIndex)
                if (newLongLat.length < 1) {
                  alert('not right')
                }
              }
              let x = 0
              while (x < newLongLat.length) {
                if (newLongLat[x].isAnchor === false)
                  alert(vessel.mmsi)
                x++
              }

              this.info.dataProcessInfo.processProgress += 1 / this.info.dataProcessInfo.totalVessel
              return newLongLat
            } else {
              // this vessel has no route pts under current projection + scale (negative x y value)
              this.info.dataProcessInfo.invisibleVessel += 1
              this.info.dataProcessInfo.invisibleVesselList.push(vessel.mmsi)
              this.info.dataProcessInfo.processProgress += 1 / this.info.dataProcessInfo.totalVessel
              return []
            }
          } else {
            // this vessel has no route pts under current projection + scale
            if (this.params.DEVMODE > 10) {
              console.log(vessel.mmsi + ' is not visible')
            }
            this.info.dataProcessInfo.invisibleVessel += 1
            this.info.dataProcessInfo.invisibleVesselList.push(vessel.mmsi)
            this.info.dataProcessInfo.processProgress += 1 / this.info.dataProcessInfo.totalVessel
            return []
          }
        } else {
          if (geoStreamedPoint.length) {
            let longlat = []
            let i = 0
            while (i < geoStreamedPoint.length) {
              let newLonglatItem = {
                isAnchor: true,
                timeStamp: geoStreamedPoint[i][2],
                xy: [geoStreamedPoint[i][0], geoStreamedPoint[i][1]]
              }
              longlat.push(newLonglatItem)
              i++
            }
            this.info.dataProcessInfo.processProgress += 1 / this.info.dataProcessInfo.totalVessel
            if (this.params.DEVMODE > 50) {
              console.log(longlat)
              console.log(geoStreamedPoint)
            }
            return longlat
          } else {
            this.info.dataProcessInfo.invisibleVessel += 1
            this.info.dataProcessInfo.invisibleVesselList.push(vessel.mmsi)
            this.info.dataProcessInfo.processProgress += 1 / this.info.dataProcessInfo.totalVessel
            return []
          }
        }

      },
      timeStampInterpretation: function (vessel) {
        //use geoPath + timestamp to add timestamp to pts
        let x = 0
        while (x < vessel.records.length) {
          if (vessel.records[x].isAnchor === false)
            alert(vessel.mmsi)
          x++
        }
        return vessel
      },
      goWebWorker: function (currentVessel) {
        let svgifyFunc = (vesselRecords => {

          let x = 0
          while (x < vesselRecords.length) {
            // there gotta be a smarter way then re-write the single longest function here again...

            x++
          }
        })

        const actions = [
          {message: 'func2', func: svgifyFunc},
        ]

        let worker = this.$worker.create(actions)

        worker.postMessage('func2', [this.$data.rawData])
          .then(console.info) // logs 'Worker 3: Working on func3'
          .catch(console.error) // logs any possible error
      },
      processData: function () {
        this.info.loadingInfo.isLoading = true
        let startTime = window.performance.now()
        this.info.dataProcessInfo.invisibleVessel = 0
        this.info.dataProcessInfo.totalVessel = this.rawData.length
        this.processedData = {}
        this.info.dataProcessInfo.processProgress = 0
        let vueInstance = this

        if (this.info.dataProcessInfo.isUsingWebWorker) {
          this.goWebWorker()
        } else {
          // do while >> for >> forEach
          let processedData = {}
          let i = 0
          while (i < vueInstance.rawData.length) {
            let currentVessel = vueInstance.rawData[i]
            processedData[currentVessel.mmsi] = Object.seal({
              mmsi: currentVessel.mmsi,
              // can't do setTimeOut here to free UI process as setTimeOut and even window.postMessage have lags, and 60K * .01ms = 6 secs...
              //https://stackoverflow.com/questions/18826570/settimeout0-vs-window-postmessage-vs-messageport-postmessage
              records: vueInstance.svgifyPath(currentVessel)
            })
            i++
          }
          this.processedData = Object.seal(processedData)
        }

        let endTime = window.performance.now()
        let processDuration = (endTime - startTime) | 0
        this.info.dataProcessInfo.lastProcessDuration = processDuration
        this.$message(`All data of ${this.info.dataProcessInfo.totalVessel} vessels processed in  ${processDuration} ms`)
        this.info.loadingInfo.isLoading = false
      },
      drawData: function () {
        this.info.pixiInfo.isVisible = true
        this.info.pixiInfo.hasDrawn = true
        this.processData()
        let vueInstance = this
        let app = new PIXI.Application(this.params.VIEW.width, this.params.VIEW.height, {antialias: true, transparent: true, resolution: 1})
        document.getElementById('display').appendChild(app.view)
        app.view.className += 'fill-screen'
        let totalSprites = app.renderer instanceof PIXI.WebGLRenderer ? vueInstance.info.dataProcessInfo.totalVessel : 100
        let vesselNameList = Object.keys(vueInstance.processedData)
        let sprites = new PIXI.particles.ParticleContainer(vueInstance.info.dataProcessInfo.totalVessel, {
          scale: true,
          position: true,
          rotation: true,
          uvs: true,
          alpha: true
        })

        let container = new PIXI.Container()
        container.filterArea = new PIXI.Rectangle(0, 0, this.params.VIEW.width, this.params.VIEW.height)
        container.addChild(sprites)
        app.stage.addChild(container)
        let vesselCollections
        let myMask = new PIXI.Graphics()

        function buildSprites () {
          vesselCollections = []

          // build mask
          if (vueInstance.info.pixiInfo.isMasked && vueInstance.info.currentProjection === 'orthographic') {
            vueInstance.setCurrentCircle()
            myMask.clear()
            // somehow regular filled circle doesn't do well as a mask, so we use arc + width
            myMask.lineStyle(vueInstance.info.currentCircle[2] * 1.92, 0xffffff)
            myMask.arc(vueInstance.info.currentCircle[0], vueInstance.info.currentCircle[1], 1, 0, Math.PI * 2)
            app.stage.addChild(myMask)
            container.mask = myMask
          }

          for (let i = 0; i < totalSprites; i++) {
            if (vueInstance.processedData[vesselNameList[i]].records.length !== 0) {
              // create a new Sprite
              let vessel = PIXI.Sprite.fromImage('static/vessel.png')
              vessel.alpha = vueInstance.info.pixiInfo.drawingAlpha
              vessel.scale.set(1)
              vessel.tint = Math.random() * 0xE8D4CD

              // set the anchor point so the texture is centerd on the sprite
              // set the anchor point so the texture is centerd on the sprite
              vessel.anchor.set(0.5)

              vessel.x = vueInstance.processedData[vesselNameList[i]].records[0].xy[0]
              vessel.y = vueInstance.processedData[vesselNameList[i]].records[0].xy[1]
              vessel.mmsi = vueInstance.processedData[vesselNameList[i]].mmsi
              vessel.currentIndex = 0
              vessel.totalLength = vueInstance.processedData[vessel.mmsi].records.length

              if (vessel.totalLength > 1) {
                vessel.next = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex + 1]
                let x2 = vessel.next.xy[0]
                let y2 = vessel.next.xy[1]
                vessel.rotation = Math.atan2(y2 - vessel.y, x2 - vessel.x)
              } else {
                vessel.next = vessel
              }

              // create a random speed between 0 - 2, and these vesselCollections are slooww
              vessel.speed = (2 + Math.random() * 2) * 0.2

              vessel.offset = Math.random() * 100

              // finally we push the vessel into the vesselCollections array so it it can be easily accessed later
              vesselCollections.push(vessel)
              sprites.addChild(vessel)
            }
          }
        }

        buildSprites()
        app.ticker.add((delta) => {
          this.stats.begin()
          // increment the ticker
          // delta = Math.min(delta, 5)
          delta = Math.min(delta, 5)

          // destroy old and create new
          if (vueInstance.info.pixiInfo.isRedrawing) {
            // destroy old and create new
            while (sprites.children[0]) {
              sprites.removeChild(sprites.children[0])
            }
            vesselCollections = []
            vueInstance.processData()
            buildSprites()
            this.info.pixiInfo.isRedrawing = false
            this.info.pixiInfo.isVisible = true
          }

          if (this.info.pixiInfo.isVisible) {
            sprites.visible = true
            // iterate through the sprites and update their position
            for (let i = 0; i < vesselCollections.length; i++) {
              let vessel = vesselCollections[i]

              if (vessel.next !== vessel) {
                if (vueInstance.info.pixiInfo.drawingCurrentTime >= vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex + 1].timeStamp) {
                  vessel.alpha = vueInstance.info.pixiInfo.drawingAlpha
                  vessel.currentIndex++
                  vessel.x = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex].xy[0]
                  vessel.y = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex].xy[1]
                  if (vessel.currentIndex < vessel.totalLength - 1) {
                    vessel.next = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex + 1]
                    let x2 = vessel.next.xy[0]
                    let y2 = vessel.next.xy[1]
                    vessel.rotation = Math.atan2(y2 - vessel.y, x2 - vessel.x)
                  } else {
                    // last pts
                    vessel.next = vessel
                  }
                }
              } else {
                if (vueInstance.info.pixiInfo.drawingCurrentTime >= (vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex].timeStamp + vueInstance.info.pixiInfo.drawingMaxLife)) {
                  // sprite in particleContainer has no visibility setting
                  // https://github.com/pixijs/pixi.js/issues/1910
                  vessel.alpha = 0
                  if (vueInstance.info.pixiInfo.drawingCurrentTime + vueInstance.info.pixiInfo.drawingTimeStep > vueInstance.info.pixiInfo.drawingEndTime) {
                    vessel.alpha = vueInstance.info.pixiInfo.drawingAlpha
                    vessel.currentIndex = 0
                    vessel.x = vueInstance.processedData[vessel.mmsi].records[0].xy[0]
                    vessel.y = vueInstance.processedData[vessel.mmsi].records[0].xy[1]
                    if (vessel.totalLength > 1) {
                      vessel.next = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex + 1]
                      let x2 = vessel.next.xy[0]
                      let y2 = vessel.next.xy[1]
                      vessel.rotation = Math.atan2(y2 - vessel.y, x2 - vessel.x)
                    } else {
                      vessel.next = vessel
                    }
                  }
                } else {
                  vessel.alpha = vueInstance.info.pixiInfo.drawingAlpha
                }
              }
            }
          } else {
            sprites.visible = false
          }
          // reset time when necessary
          if (vueInstance.info.pixiInfo.drawingCurrentTime + vueInstance.info.pixiInfo.drawingTimeStep > vueInstance.info.pixiInfo.drawingEndTime) {
            vueInstance.info.pixiInfo.drawingCurrentTime = vueInstance.info.pixiInfo.drawingStartTime
          }
          vueInstance.info.pixiInfo.drawingCurrentTime += vueInstance.info.pixiInfo.drawingTimeStep
          this.stats.end()
        })
      },
      loadData: function () {
        this.info.loadingInfo.isLoading = true
        this.info.loadingInfo.loadingText = 'Downloading Data...'
        axios.get('./static/records.json')
          .then(response => {
            console.log(response.status)
            if (response.data) {
              // https://github.com/vuejs/vue/issues/4384
              // freeze data so no getter setter are added, significantly reduce memory usage (500MB), no need to do recursive freeze
              // test it with this.rawData.__ob__
              this.rawData = Object.freeze(response.data)
              //  this.rawData = response.data)
              this.info.loadingInfo.isLoading = false
              this.drawData()
            }
          })
      },
      browserTest: function () {
        if (!bowser.chrome) {
          this.info.loadingInfo.currentBrowser = bowser.name + ' ' + bowser.version
          this.info.loadingInfo.isBrowserTestDVisible = true
        }

        if (bowser.mobile) {
          this.info.loadingInfo.currentDevices = 'mobile'
          this.info.loadingInfo.isBrowserTestDVisible = true
        } else if (bowser.tablet) {
          this.info.loadingInfo.currentDevices = 'tablet'
          this.info.loadingInfo.isBrowserTestDVisible = true
        }
      },
      setCurrentCircle: function () {
        let circleBounds = this.path.bounds({type: 'Sphere'})
        let circleCenter = (this.path.centroid({type: 'Sphere'}).map(pixel => pixel | 0))
        let radius = (((circleBounds[1][0] | 0) - (circleBounds[0][0] | 0)) / 2) | 0
        this.info.currentCircle = [...circleCenter, radius]
      },
      checkPtInCircle: function (streamedPoint) {
        let deltaX = streamedPoint[0] - this.info.currentCircle[0]
        let deltaY = streamedPoint[1] - this.info.currentCircle[1]
        let distance = Math.hypot(deltaX, deltaY)
        return distance < (this.info.currentCircle[2] * 0.95)
      },
      checkPtInRange: function (longlatArray) {
        let currentViewArray = this.info.currentView.split(',')
        let center = [currentViewArray[0], currentViewArray[1]]
        let distance = d3.geoDistance(center, longlatArray) * this.params.KMPERRAD
        return (distance > (this.params.EARTHRADIUS * 0.9))
      }
    },
    mounted: function () {
      this.browserTest()
      // enlarge charting dom to full screen
      d3.selectAll('.fill-screen').attr('width', this.params.VIEW.width).attr('height', this.params.VIEW.height)
      let fullScreenDOM = document.querySelectorAll('.full-screen')
      let vueInstance = this
      for (let i = 1; i < fullScreenDOM.length; i++) {
        fullScreenDOM[i].style.height = vueInstance.params.VIEW.height + 'px'
        fullScreenDOM[i].style.width = vueInstance.params.VIEW.width + 'px'
      }

      this.setEarthTopo()
      this.drawGlobe()
      this.onUserInput()
      this.info.currentView = this.globe.orientation()
      this.addStatsMeter()
      // manually set these values for now
      this.info.pixiInfo.drawingStartTime = 1501977600 //new Date('2017-08-06').getTime()/1e3

      this.info.pixiInfo.drawingCurrentTime = 1501977600 //new Date('2017-08-06').getTime()/1e3
      this.info.pixiInfo.drawingEndTime = 1502150400 //new Date('2017-08-08').getTime()/1e3

      // have to move here as this.globe.orientation() seems to create a race condition and initScale will get a 0 if executed immediately after this.globe.orientation()
      this.info.initScale = (this.info.currentView.split(','))[2]
    },
    filters: {
      startCase: function (value) {
        return _.startCase(value)
      },
      showTime: function (timeInSec) {
        return new Date(timeInSec * 1e3).toISOString()
      }
    }
  }
</script>


<style lang="scss" rel="stylesheet/scss">
  /*TODO: change to BEM style, next time...*/
  $font-stack: 'Ubuntu', Helvetica, Arial, sans-serif !important;
  @import url('https://fonts.googleapis.com/css?family=Ubuntu:500');

  #geo-viz-icon {
    position: absolute;
    display: block;
    color: white;
    bottom: 0;
    padding: 2em;
    user-select: none !important;
    span {
      font-weight: bold;
      display: block;
      cursor: pointer !important;
    }
    img {
      cursor: pointer !important;
    }

  }

  .big-logo {
    width: 110px;
    height: auto;
    font-size: 2em;
  }

  .small-logo {
    width: 80px;
    height: auto;
    font-size: 1.5em;
  }

  #geo-viz {
    background-color: rgba(62, 140, 132, 0.7);
    color: white;
    width: 500px;
    border-radius: 5px;
    button > span, .el-dropdown-menu__item {
      font-family: $font-stack;
      font-size: 1.1em;
      color: white;
    }
    .geo-viz-content {
      padding: 1em;
    }
  }

  #debug-info {
    position: absolute;
    color: white;
    right: 0;
    user-select: none;
    margin: 1em 1.5em;
    padding: 1em;
    background-color: rgba(82, 159, 191, 0.5);
    border-radius: 5px;
  }

  .el-dropdown-menu {
    background-color: dodgerblue;
    border-color: dodgerblue;
    border-radius: 8px;
  }

  #crosshair-background {
    background-image: url("../assets/cross-bg.png");
    background-repeat: repeat;
    opacity: 0.3;
  }

  .fill-screen {
    position: absolute;
    top: 0;
    left: 0;
    /*  will-change: transform;*/
  }

  .el-loading-spinner {
    top: 25% !important;
  }

  .el-loading-text {
    font-size: 2em !important;
    font-family: $font-stack;
  }

  body > div.el-loading-mask.is-fullscreen > div > svg {
    width: 100px !important;
    height: 100px !important;
  }
</style>
