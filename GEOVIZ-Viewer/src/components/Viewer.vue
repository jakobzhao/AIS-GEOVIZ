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
        <button @click="toggleDrawing()">Toggle drawing</button>
        <button @click="pixiWormBox()">Open W-box </button>

      </div>
      <div>Long: {{info.currentView.split(',')[0]}}</div>
      <div>Later: {{info.currentView.split(',')[1]}}</div>
      <div>Scale: {{info.currentView.split(',')[2]}}</div>
      <div>Projection: {{info.currentProjection}}</div>
      <div>info.isDrawing: {{info.isDrawing}}</div>
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
          isDrawing: true,
          isMobile: false,
        },
        params: {
          DEBOUNCE_WAIT: 500,
          DEFAULT_SCALE: 450,
          MIN_MOVE: 4,
          MOVE_END_WAIT: 1000,
          PROJECTION_LIST: Object.keys(globes.projectionList),
          REDRAW_WAIT: 5,
          // TODO:add event handler for window resizing or just use vw vh? https://github.com/vuejs/vue/issues/1915
          VIEW: micro.view()
        },
        earthTopo: null,
        globe: null,
        stats: null, // stats meter
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
      currentScale: function () {
        // return (this.info.currentView.split(','))[2] === null ? 1 : (this.info.currentView.split(','))[2]
        return this.globe.projection.scale()
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
        this.info.isDrawing = !this.info.isDrawing
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
        console.log('drawing...')
        this.globe = this.buildGlobe(this.info.currentProjection)
        // First clear map and foreground svg contents.
        micro.removeChildren(d3.select('#map').node())
        micro.removeChildren(d3.select('#foreground').node())
        // Create new map svg elements.
        this.globe.defineMap(d3.select('#map'), d3.select('#foreground'))
        if (isUpdate) {
          let newView = this.info.currentView.split(',')
          newView[2] = this.globe.fit(this.params.VIEW)
          this.info.currentView = newView.join()
        }
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
            this.info.isDrawing = false

            op = op || newOp(d3.mouse(displayDiv), /*zoom.scale()*/ d3.zoomTransform(displayDiv).k)  // a new operation begins
            console.log('zoom started')

            // replace path with low-res data
            coastline.datum(this.earthTopo.coastLo)
            lakes.datum(this.earthTopo.lakesLo)
            d3.selectAll('path').attr('d', this.path)

          })
          .on('zoom', () => {
            console.log('zooming...')
            let currentMouse = d3.mouse(displayDiv)
            let currentZoomRatio = d3.zoomTransform(displayDiv).k
            // console.log('current Scale= ' + currentZoomRatio)

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
            }
            if (currentZoomRatio !== op.startScale) {
              op.type = 'zoom' // whenever a scale change is detected, (stickily) switch to a zoom operation
            }

            // when zooming, ignore whatever the mouse is doing--really cleans up behavior on touch devices
            console.log('op type= ' + op.type)
            // console.log('for real ' + op.type.toString() === 'zoom' ? null : currentMouse, currentZoomRatio)
            op.manipulator.move(op.type.toString() === 'zoom' ? null : currentMouse, currentZoomRatio * vueViewer.currentScale)
            this.info.currentView = this.globe.orientation()
            d3.selectAll('path').attr('d', this.path)
          })
          .on('end', () => {
            console.log('ended')
            this.info.currentView = this.globe.orientation()

            coastline.datum(this.earthTopo.coastHi)
            lakes.datum(this.earthTopo.lakesHi)
            d3.selectAll('path').attr('d', this.path)

            op.manipulator.end()
            if (op.type === 'click') {
            }
            else if (op.type !== 'spurious') {
            }
            op = null  // the drag/zoom/click operation is over

            this.info.isDrawing = true
          })
        d3.select('#display').call(zoom)
      },
      pixiWormBox: function () {
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
        app.stage.addChild(sprites)

// create an array to store all the sprites
        let maggots = []

        let totalSprites = app.renderer instanceof PIXI.WebGLRenderer ? 10000 : 100

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
          this.pixiInstance = maggots
          sprites.addChild(dude)
        }

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
          // iterate through the sprites and update their position
          if (this.info.isDrawing) {
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
          console.log('now drawing')
          context.lineWidth = 7
          context.strokeStyle = 'rgba(71, 192, 180, 0.7)'
          context.beginPath()
          path(vueInstance.testPath)
          context.stroke()
        }
        drawGeoPath(geoPath, context2)
        let svgGeoPath = vueInstance.path.context(null)
        console.info(svgGeoPath(vueInstance.testPath))

        // drawing svg
        let svg = document.getElementById('foreground') //Get svg element
        let newElement = document.createElementNS("http://www.w3.org/2000/svg", 'path'); //Create a path in SVG's namespace
        newElement.setAttribute("d", svgGeoPath(vueInstance.testPath)); //Set path's data
        newElement.style.stroke = "#000"; //Set stroke colour
        newElement.style.fill = 'none'
        newElement.style.strokeWidth = "2px"; //Set stroke width
        svg.appendChild(newElement);
      },
      updateVesselRecordTest: function () {
        let vueInstance = this
        let correctedStream = vueInstance.correctedStream
        correctedStream = []

        /*     // TODO: we might need this in the future in case we need filter out data points
               correctedStream = new Array(vueInstance.testRoute.length).fill(null)
                //clousre to pass the index
                let streamWrapper = function (x, y, index) {
                  let stream = vueInstance.globe.projection.stream({
                    point: function (x, y) {
                      correctedStream[index] = [x, y]
                    }
                  })
                  stream.point(x, y)
                }
                */

        let stream = vueInstance.globe.projection.stream({
          point: function (x, y) {
            correctedStream.push([x, y])
          }
        })

        vueInstance.testPath.coordinates.forEach((point, index) => {
          // streamWrapper(point[0], point[1], index)
          stream.point(point[0], point[1])
        })
        console.log(vueInstance.testPath.coordinates.length + ' of points have been filter to ' + correctedStream.length)
        console.info(correctedStream)
        this.correctedStream = correctedStream
      },
      changeProjection: function (newProjection) {
        if (newProjection !== this.info.currentProjection) {
          console.log('change projection, new projection= ' + _.snakeCase(newProjection))
          this.info.currentProjection = newProjection
          this.drawGlobe(true)
          this.onUserInput()
          this.info.currentView = this.globe.orientation()
        }
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
      //this.pixiWormBox()
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
