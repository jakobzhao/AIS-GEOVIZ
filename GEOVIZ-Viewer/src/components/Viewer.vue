<template>
  <div>
    <div id="display">
      <svg class="fill-screen" id="crosshair-background"></svg>
      <svg id="map" class="fill-screen" xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>
      <canvas id="animation" class="fill-screen"></canvas>
      <canvas id="overlay" class="fill-screen"></canvas>
      <canvas id="geoStreamTest" class="fill-screen"></canvas>
      <canvas id="geoPathTest" class="fill-screen"></canvas>
      <svg id="foreground" class="fill-screen" xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>
    </div>

    <div id="debug-info">
      <div>
        <button class="btn btn-primary"
                v-for="projection in params.PROJECTION_LIST"
                :key="projection"
                @click="changeProjection(projection)">
          {{projection | startCase}}
        </button>
        <button @click="geoStreamTest()">Line Test</button>
        <button @click="updateVesselRecordTest()">UpdateData</button>
        <!--        <button @click="toggleDrawing()">Toggle drawing</button>
                <button @click="pixiWormBox()">Open W-box </button>
                <button @click="drawData()">draw vessel </button>
                <button @click="processData()">Prep Data</button>-->

      </div>
      <div>Long: {{info.currentView.split(',')[0]}}</div>
      <div>Later: {{info.currentView.split(',')[1]}}</div>
      <div>Scale: {{info.currentView.split(',')[2]}}</div>
      <div>Projection: {{info.currentProjection}}</div>
      <div>info.isVisible: {{info.isVisible}}</div>
      <div>info.isRedrawing: {{info.isRedrawing}}</div>
      <div>all vessel: {{info.totalVessel}}</div>
      <div>visible vessel: {{info.totalVessel - info.invisibleVessel}}</div>
      <div id="statsMeter"></div>
    </div>

  </div>
</template>

<script>
  import _ from 'lodash'
  import ES6promise from 'es6-promise'

  ES6promise.polyfill()
  import axios from 'axios'
  import Promise from 'bluebird'
  import * as PIXI from 'pixi.js'
  import Stats from 'stats.js'
  import * as d3 from 'd3'
  import aisData from '../assets/records.json'
  // temp fix till topojson start to use es6 export, https://github.com/topojson/topojson/issues/285
  import * as topojson from 'topojson/node_modules/topojson-client/src/feature'
  import * as micro from '../Utils/micro'
  import * as globes from '../Utils/globes'
  import earthTopoPC from '../data/earth-topo.json'
  import earthTopoMobile from '../data/earth-topo-mobile.json'

  export default {
    name: 'Viewer',
    data () {
      return {
        info: {
          currentProjection: 'orthographic',
          currentView: '-170, 15, null',
          initScale: 0,
          isVisible: true,
          isRedrawing: false,
          isMobile: false,
          isRemoveInvalidData: false,
          totalVessel: 0,
          invisibleVessel: 0,
          invisibleVesselList: [],
          processProgress: 0.00
        },
        params: {
          DEBOUNCE_WAIT: 500,
          DEFAULT_SCALE: 450,
          MIN_MOVE: 4,
          MOVE_END_WAIT: 1000,
          PROJECTION_LIST: Object.keys(globes.projectionList),
          REDRAW_WAIT: 5,
          // TODO:add event handler for window resizing or just use vw vh? https://github.com/vuejs/vue/issues/1915
          VIEW: micro.view(),
          DEVMODE: 0
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
      }
    },
    methods: {
      addStatsMeter: function () {
        this.stats = new Stats()
        this.stats.domElement.style.position = 'absolute'
        this.stats.domElement.style.top = '0px'
        //document.getElementsByName('#statsMeter').appendChild(this.stats.domElement)
        document.body.appendChild(this.stats.domElement)
      },
      toggleDrawing: function () {
        this.info.isVisible = !this.info.isVisible
      },
      setEarthTopo: function () {
        this.info.isMobile = micro.isMobile()
        let isMobile = this.info.isMobile
        if (this.info.isMobile) {
          this.earthTopo = this.prepTopoMesh(earthTopoMobile, isMobile)
        } else {
          this.earthTopo = this.prepTopoMesh(earthTopoPC, isMobile)
        }
      },
      prepTopoMesh: function (topojsonData, isMobile) {
        let o = topojsonData.objects
        let coastLo = topojson.feature(topojsonData, isMobile ? o.coastline_tiny : o.coastline_110m)
        let coastHi = topojson.feature(topojsonData, isMobile ? o.coastline_110m : o.coastline_50m)
        let lakesLo = topojson.feature(topojsonData, isMobile ? o.lakes_tiny : o.lakes_110m)
        let lakesHi = topojson.feature(topojsonData, isMobile ? o.lakes_110m : o.lakes_50m)
        return {
          coastLo: coastLo,
          coastHi: coastHi,
          lakesLo: lakesLo,
          lakesHi: lakesHi
        }
      },
      buildGlobe: function (projectionName) {
        if (this.params.PROJECTION_LIST.indexOf(projectionName) >= 0) {
          return globes.projectionList[projectionName](this.params.VIEW)
        } else {return null}
      },
      drawGlobe: function (isUpdate) {
        if (this.params.DEVMODE > 100) console.log('drawing...')
        this.globe = this.buildGlobe(this.info.currentProjection)
        // First clear map and foreground svg contents.
        micro.removeChildren(d3.select('#map').node())
        micro.removeChildren(d3.select('#foreground').node())
        // Create new map svg elements.
        this.globe.defineMap(d3.select('#map'), d3.select('#foreground'))
        this.globe.orientation(this.info.currentView, this.params.VIEW)

        let coastline = d3.select('.coastline')
        let lakes = d3.select('.lakes')
        coastline.datum(this.earthTopo.coastHi)
        lakes.datum(this.earthTopo.lakesHi)
        d3.selectAll('path').attr('d', this.path)
      },
      onUserInput: function () {
        let vueViewer = this
        let coastline = d3.select('.coastline')
        let lakes = d3.select('.lakes')
        let displayDiv = document.getElementById('display')

        function newOp (startMouse, startScale) {
          return {
            type: 'click',  // initially assumed to be a click operation
            startMouse: startMouse,
            startScale: startScale,
            manipulator: vueViewer.globe.manipulator(startMouse, startScale)
          }
        }

        let op = null
        let zoom = d3.zoom()
          .on('start', () => {
            op = op || newOp(d3.mouse(displayDiv), d3.zoomTransform(displayDiv).k)  // a new operation begins
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
              if (currentZoomRatio === op.startScale && distanceMoved < vueViewer.params.MIN_MOVE) {
                // to reduce annoyance, ignore op if mouse has barely moved and no zoom is occurring
                op.type = distanceMoved > 0 ? 'click' : 'spurious'
                return
              }
              op.type = 'drag'
              this.info.isVisible = false

              // replace path with low-res data
              coastline.datum(this.earthTopo.coastLo)
              lakes.datum(this.earthTopo.lakesLo)
              d3.selectAll('path').attr('d', this.path)
            }
            if (currentZoomRatio !== op.startScale) {
              op.type = 'zoom' // whenever a scale change is detected, (stickily) switch to a zoom operation
            }

            // when zooming, ignore whatever the mouse is doing--really cleans up behavior on touch devices

            if (this.params.DEVMODE > 100) console.log('for real ' + op.type.toString() === 'zoom' ? null : currentMouse, currentZoomRatio)
            op.manipulator.move(op.type.toString() === 'zoom' ? null : currentMouse, currentZoomRatio * vueViewer.info.initScale)
            this.info.currentView = this.globe.orientation()
            d3.selectAll('path').attr('d', this.path)
          })
          .on('end', () => {
            if (this.params.DEVMODE > 10) {
              console.log('ended')
              console.log('op type= ' + op.type)
            }
            this.info.currentView = this.globe.orientation()
            coastline.datum(this.earthTopo.coastHi)
            lakes.datum(this.earthTopo.lakesHi)
            d3.selectAll('path').attr('d', this.path)

            op.manipulator.end()
            // click rarely happens...
            if (op.type === 'click' || op.type === 'spurious') {
              this.info.isVisible = true
            }
            else {
              // TODO: add a _.debounce here?
              this.info.isRedrawing = true
            }
            op = null  // the drag/zoom/click operation is over

          })
        d3.select('#display').call(zoom)
      },
      pixiWormBox: function () {
        let vueInstance = this
        let app = new PIXI.Application(this.params.VIEW.width, this.params.VIEW.height, {antialias: true, transparent: true, resolution: 1})
        document.getElementById('display').appendChild(app.view)
        app.view.className += 'fill-screen'
        let sprites = new PIXI.particles.ParticleContainer(10000, {
          scale: true,
          position: true,
          rotation: true,
          uvs: true,
          alpha: true
        })
        let totalSprites = app.renderer instanceof PIXI.WebGLRenderer ? 10000 : 100
        app.stage.addChild(sprites)
        let maggots

        function buildSprites () {
// create an array to store all the sprites
          maggots = []

          for (let i = 0; i < totalSprites; i++) {

            // create a new Sprite
            let dude = PIXI.Sprite.fromImage('static/maggot.png')
            dude.alpha = 0.5

            dude.tint = Math.random() * 0xE8D4CD

            // set the anchor point so the texture is centerd on the sprite
            dude.anchor.set(0.5)

            // different maggots, different sizes
            dude.scale.set(0.1 + Math.random() * 0.03)

            // scatter them all
            dude.x = Math.random() * app.renderer.width
            dude.y = Math.random() * app.renderer.height

            dude.tint = Math.random() * 0x808080

            // create a random direction in radians
            dude.direction = Math.random() * Math.PI * 2

            // this number will be used to modify the direction of the sprite over time
            dude.turningSpeed = Math.random() - 0.8

            // create a random speed between 0 - 2, and these maggots are slooww
            dude.speed = (2 + Math.random() * 2) * 0.2

            dude.offset = Math.random() * 100

            // finally we push the dude into the maggots array so it it can be easily accessed later
            maggots.push(dude)
            sprites.addChild(dude)
          }
        }

        buildSprites()
        // create a bounding box box for the little maggots
        let dudeBoundsPadding = 100
        let dudeBounds = new PIXI.Rectangle(
          -dudeBoundsPadding,
          -dudeBoundsPadding,
          app.renderer.width + dudeBoundsPadding * 2,
          app.renderer.height + dudeBoundsPadding * 2
        )

        app.ticker.add((delta) => {
          this.stats.begin()
          // increment the ticker
          delta = Math.min(delta, 5)

          // destroy old and create new
          if (vueInstance.info.isRedrawing) {
            // destroy old and create new
            while (sprites.children[0]) {
              sprites.removeChild(sprites.children[0])
            }
            buildSprites()
            this.info.isRedrawing = false
            this.info.isVisible = true
          }

          // iterate through the sprites and update their position
          if (this.info.isVisible) {
            sprites.visible = true
            for (let i = 0; i < maggots.length; i++) {
              let dude = maggots[i]
              dude.scale.y = 0.95 + Math.sin(delta + dude.offset) * 0.05
              dude.direction += dude.turningSpeed * 0.01
              dude.x += Math.sin(dude.direction) * (dude.speed * dude.scale.y)
              dude.y += Math.cos(dude.direction) * (dude.speed * dude.scale.y)
              dude.rotation = -dude.direction + Math.PI

              // wrap the maggots
              if (dude.x < dudeBounds.x) {
                dude.x += dudeBounds.width
              }
              else if (dude.x > dudeBounds.x + dudeBounds.width) {
                dude.x -= dudeBounds.width
              }

              if (dude.y < dudeBounds.y) {
                dude.y += dudeBounds.height
              }
              else if (dude.y > dudeBounds.y + dudeBounds.height) {
                dude.y -= dudeBounds.height
              }
            }
          } else {
            sprites.visible = false
          }
          this.stats.end()
        })
        app.ticker.speed = 1
        //requestAnimationFrame( this.pixiWormBox )
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

        // drawing svg
        let svg = document.getElementById('foreground') //Get svg element
        let newElement = document.createElementNS('http://www.w3.org/2000/svg', 'path') //Create a path in SVG's namespace
        newElement.setAttribute('d', svgGeoPath(vueInstance.testPath)) //Set path's data
        newElement.style.stroke = '#000' //Set stroke colour
        newElement.style.fill = 'none'
        newElement.style.strokeWidth = '2px' //Set stroke width
        svg.appendChild(newElement)
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
      changeProjection: function (newProjection) {
        if (newProjection !== this.info.currentProjection) {
          if (this.params.DEVMODE > 10) console.log('change projection, new projection= ' + _.snakeCase(newProjection))
          let scale = (this.info.currentView.split(','))[2]
          this.info.currentProjection = newProjection
          this.drawGlobe()
          this.onUserInput()
          this.info.isRedrawing = true
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
        vessel.records = this.info.isRemoveInvalidData ? this.removeInvalidData(vessel.records) : vessel.records
        let geoStreamedPoint = this.vesseLonglatToPixel(vessel)
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
                    if (currentPixelLocValue === (longlat[0].xy).join()) {
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
                        if (loopCounter < longlat.length) {
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
            }
            let x = 0
            while (x < newLongLat.length) {
              if (newLongLat[x].isAnchor === false)
                alert(vessel.mmsi)
              x++
            }

            this.info.processProgress += 1 / this.info.totalVessel
            return newLongLat
          } else {
            // this vessel has no route pts under current projection + scale (negative x y value)
            this.info.invisibleVessel += 1
            this.info.invisibleVesselList.push(vessel.mmsi)
            this.info.processProgress += 1 / this.info.totalVessel
            return []
          }
        } else {
          // this vessel has no route pts under current projection + scale
          if (this.params.DEVMODE > 10) {
            console.log(vessel.mmsi + ' is not visible')
          }
          this.info.invisibleVessel += 1
          this.info.invisibleVesselList.push(vessel.mmsi)
          this.info.processProgress += 1 / this.info.totalVessel
          return []
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
      processData: function () {
        let vueInstance = this
        vueInstance.info.invisibleVessel = 0
        vueInstance.rawData = aisData
        vueInstance.info.totalVessel = aisData.length

        vueInstance.processedData = {}

        // do while >> for >> forEach
        let i = 0
        while (i < vueInstance.rawData.length) {
          let currentVessel = vueInstance.rawData[i]
          vueInstance.processedData[currentVessel.mmsi] = {
            mmsi: currentVessel.mmsi,
            records: vueInstance.svgifyPath(currentVessel)
          }
          i++
        }
      },
      drawData: function () {
        this.info.isVisible = true
        this.processData()
        let vueInstance = this
        let app = new PIXI.Application(this.params.VIEW.width, this.params.VIEW.height, {antialias: true, transparent: true, resolution: 1})
        document.getElementById('display').appendChild(app.view)
        app.view.className += 'fill-screen'
        let totalSprites = app.renderer instanceof PIXI.WebGLRenderer ? vueInstance.info.totalVessel : 100
        let vesselNameList = Object.keys(vueInstance.processedData)
        let sprites = new PIXI.particles.ParticleContainer(vueInstance.info.totalVessel, {
          scale: true,
          position: true,
          rotation: true,
          uvs: true,
          alpha: true
        })
        app.stage.addChild(sprites)
        let vesselCollections

        function buildSprites () {
          vesselCollections = []

          for (let i = 0; i < totalSprites; i++) {
            if (vueInstance.processedData[vesselNameList[i]].records.length !== 0) {
              // create a new Sprite
              let vessel = PIXI.Sprite.fromImage('static/vessel.png')
              vessel.alpha = 0.3
              vessel.scale.set(1)
              vessel.tint = Math.random() * 0xE8D4CD

              // set the anchor point so the texture is centerd on the sprite
              vessel.anchor.set(0.5)

              // scatter them all
              vessel.x = vueInstance.processedData[vesselNameList[i]].records[0].xy[0]
              vessel.y = vueInstance.processedData[vesselNameList[i]].records[0].xy[1]
              vessel.currentIndex = 0
              vessel.mmsi = vueInstance.processedData[vesselNameList[i]].mmsi
              // create a random direction in radians
              vessel.direction = Math.random() * Math.PI * 2

              // this number will be used to modify the direction of the sprite over time
              vessel.turningSpeed = Math.random() - 0.8

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
          delta = Math.max(delta, 200000)

          // destroy old and create new
          if (vueInstance.info.isRedrawing) {
            // destroy old and create new
            while (sprites.children[0]) {
              sprites.removeChild(sprites.children[0])
            }
            vesselCollections = []
            vueInstance.processData()
            buildSprites()
            this.info.isRedrawing = false
            this.info.isVisible = true
          }

          if (this.info.isVisible) {
            sprites.visible = true
            // iterate through the sprites and update their position
            for (let i = 0; i < vesselCollections.length; i++) {
              let vessel = vesselCollections[i]
              if (vessel.currentIndex >= vueInstance.processedData[vessel.mmsi].records.length) {
                vessel.currentIndex = 0
              }
              vessel.x = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex].xy[0]
              vessel.y = vueInstance.processedData[vessel.mmsi].records[vessel.currentIndex].xy[1]
              vessel.currentIndex += 1

            }
          } else {
            sprites.visible = false
          }
          this.stats.end()
        })
        app.ticker.minFPS = 1
        //requestAnimationFrame( this.pixiWormBox )
      }
    },
    mounted: function () {
      // enlarge charting dom to full screen
      d3.selectAll('.fill-screen').attr('width', this.params.VIEW.width).attr('height', this.params.VIEW.height)
      this.setEarthTopo()
      this.drawGlobe()
      this.onUserInput()
      this.info.currentView = this.globe.orientation()
      this.addStatsMeter()

      // this.drawData()
      // have to move here as this.globe.orientation() seems to create a race condition and initScale will get a 0 if executed immediately after this.globe.orientation()
      this.info.initScale = (this.info.currentView.split(','))[2]
    },
    filters: {
      startCase: function (value) {
        return _.startCase(value)
      }
    }
  }
</script>


<style lang="scss" rel="stylesheet/scss">
  /*TODO: change to BEM style, next time...*/
  @import url('https://fonts.googleapis.com/css?family=Ubuntu:500');

  .btn {
    font-family: 'Ubuntu', Helvetica, Arial, sans-serif !important;
  }

  #debug-info {
    position: absolute;
    color: white;
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

</style>
