<template>
  <div>
    <div id="display">
      <svg class="fill-screen" id="crosshair-background"></svg>
      <svg id="map" class="fill-screen" xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>
      <canvas id="animation" class="fill-screen"></canvas>
      <canvas id="overlay" class="fill-screen"></canvas>
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
        <button @click="pixiTest2()">Create Circle</button>
        <button @click="updateVesselRecord()">UpdateData</button>
        <button @click="toggleDrawing()">toggle drawing</button>
        {{isDrawing}}
      </div>
      <div>{{currentView.split(',')[0]}}</div>
      <div>{{currentView.split(',')[1]}}</div>
      <div>{{currentView.split(',')[2]}}</div>
      <div>{{currentProjection}}</div>
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
        currentProjection: 'orthographic',
        currentView: '-170, 15, null',
        earthTopo: null,
        globe: null,
        isMobile: false,
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
        vesselData: 10,
        stats: null,
        testRoute: [
          [121.565, 31.098],
          [139.846, 37.062],
          [166.213, 36.921],
          [-122.702, 43.547],
          [-115.896, 34.794],
          [-97.251, 29.103]
        ],
        correctedStream: [],
        isDrawing: false
      }
    },
    computed: {
      path: function () {
        return d3.geoPath().projection(this.globe.projection).pointRadius(7)
      },
      currentScale: function () {
        // return (this.currentView.split(','))[2] === null ? 1 : (this.currentView.split(','))[2]
        return this.globe.projection.scale()
      }
    },
    methods: {
      toggleDrawing: function () {
        this.isDrawing = !this.isDrawing
      },
      setEarthTopo: function () {
        this.isMobile = micro.isMobile()
        let isMobile = this.isMobile
        if (this.isMobile) {
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
      addStatsMeter: function () {
        this.stats = new Stats()
        this.stats.domElement.style.position = 'absolute'
        this.stats.domElement.style.top = '0px'
        //document.getElementsByName('#statsMeter').appendChild(this.stats.domElement)
        document.body.appendChild(this.stats.domElement)

      },
      buildGlobe: function (projectionName) {
        if (this.params.PROJECTION_LIST.indexOf(projectionName) >= 0) {
          return globes.projectionList[projectionName](this.params.VIEW)
        } else {return null}
      },
      drawGlobe: function (isUpdate) {
        console.log('drawing...')
        this.globe = this.buildGlobe(this.currentProjection)
        // First clear map and foreground svg contents.
        micro.removeChildren(d3.select('#map').node())
        micro.removeChildren(d3.select('#foreground').node())
        // Create new map svg elements.
        this.globe.defineMap(d3.select('#map'), d3.select('#foreground'))
        if (isUpdate) {
          let newView = this.currentView.split(',')
          newView[2] = this.globe.fit(this.params.VIEW)
          this.currentView = newView.join()
        }
        this.globe.orientation(this.currentView, this.params.VIEW)

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

        // somehow 'this' is not binded to element so we have to manually set it
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
            //TODO: temp set scale to 1
            //TODO: show find a better to way to use 'this === #display' here
            op = op || newOp(d3.mouse(displayDiv), /*zoom.scale()*/ d3.zoomTransform(displayDiv).k)  // a new operation begins
            console.log('started')

            // replace path with low-res data
            coastline.datum(this.earthTopo.coastLo)
            lakes.datum(this.earthTopo.lakesLo)
            d3.selectAll('path').attr('d', this.path)
          })
          .on('zoom', () => {
            console.log('zooming...')
            let currentMouse = d3.mouse(displayDiv)
            // console.log(currentMouse)
            //TODO: temp set scale to 1
            // let currentZoomRatio = d3.event.scale
            let currentZoomRatio = d3.zoomTransform(displayDiv).k
            // currentZoomRatio = currentZoomRatio === 1 ? this.currentZoomRatio - 0.1 : currentZoomRatio
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
            this.currentView = this.globe.orientation()

            d3.selectAll('path').attr('d', this.path)
          })
          .on('end', () => {
            console.log('ended')
            this.currentView = this.globe.orientation()
            console.log(this.currentView)
            coastline.datum(this.earthTopo.coastHi)
            lakes.datum(this.earthTopo.lakesHi)
            d3.selectAll('path').attr('d', this.path)

            op.manipulator.end()
            if (op.type === 'click') {
            }
            else if (op.type !== 'spurious') {

            }
            op = null  // the drag/zoom/click operation is over
          })

        d3.select('#display').call(zoom)

      },
      pixiTest: function () {
        // this.stats.begin()
        //  this.pixiInstance = new PIXI.Application(1200, 800, {antialias: true, transparent: true, resolution: 1})
        let app = new PIXI.Application(this.params.VIEW.width, this.params.VIEW.height, {antialias: true, transparent: true, resolution: 1})
        // this.pixiInstance = app
        document.getElementById('display').appendChild(app.view)
        app.view.className += 'fill-screen'
        var sprites = new PIXI.particles.ParticleContainer(10000, {
          scale: true,
          position: true,
          rotation: true,
          uvs: true,
          alpha: true
        })
        app.stage.addChild(sprites)

// create an array to store all the sprites
        var maggots = []

        var totalSprites = app.renderer instanceof PIXI.WebGLRenderer ? 10000 : 100

        for (var i = 0; i < totalSprites; i++) {

          // create a new Sprite
          var dude = PIXI.Sprite.fromImage('static/bg.png')
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
        var dudeBoundsPadding = 100
        var dudeBounds = new PIXI.Rectangle(
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
          for (var i = 0; i < maggots.length; i++) {
            var dude = maggots[i]
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
          this.stats.end()
        })
        app.ticker.speed = 1

        //requestAnimationFrame( this.pixiTest )

      },
      pixiTest2: function () {
        // this.stats.begin()
        //  this.pixiInstance = new PIXI.Application(1200, 800, {antialias: true, transparent: true, resolution: 1})
        let vueInstance = this
        d3.select('#pixiTest').remove()
        let app = new PIXI.Application(this.params.VIEW.width, this.params.VIEW.height, {antialias: true, transparent: true, resolution: 1})
        // this.pixiInstance = app
        app.view.id = 'pixiTest'
        document.getElementById('display').appendChild(app.view)
        app.view.className += 'fill-screen'

        var graphics = new PIXI.Graphics()
        graphics.lineStyle(4, 0xffd900, 1)
        graphics.beginFill(0xFFFF0B, 0.5)
        console.info('graphic children= ' + graphics.children)
// set a fill and line style

        this.updateVesselRecord()

        app.ticker.add((delta) => {
          // increment the ticker
          delta = Math.min(delta, 5)
          if (!vueInstance.isDrawing) {
            console.log(359)
            graphics.clear()
            // graphics.destroy()

          } else {
            console.log(graphics.graphicsData.length)
              console.log(369)
              vueInstance.correctedStream.forEach(point => {
                graphics.drawCircle(point[0], point[1], 10)
                graphics.endFill()
              })

          }
        })

        app.stage.addChild(graphics)
        console.log(d3.geoBounds(this.globe))
      },
      updateVesselRecord: function () {
        let correctedStream = this.correctedStream
        let stream = this.globe.projection.stream({
          point: function (x, y, index, index2) {
            correctedStream.push([x, y])
            console.info([x, y])
            return ([x, y])
          }
        })
        this.testRoute.forEach(point => {
          stream.point(point[0], point[1], 100)
        })
        console.log('geoStream clipped points= ')
        console.info(correctedStream)
      },
      changeProjection: function (newProjection) {
        console.log(_.snakeCase(newProjection))
        if (newProjection !== this.currentProjection) {
          this.currentProjection = newProjection
          this.drawGlobe(true)
          this.onUserInput()
          this.currentView = this.globe.orientation()
        }

      }
    },
    mounted: function () {
      // enlarge charting dom to full screen
      d3.selectAll('.fill-screen').attr('width', this.params.VIEW.width).attr('height', this.params.VIEW.height)
      this.setEarthTopo()
      this.drawGlobe()
      this.onUserInput()
      this.currentView = this.globe.orientation()
      this.addStatsMeter()
      //  this.pixiTest2()
      this.pixiTest()
      //requestAnimationFrame(this.pixiTest)

    },
    filters: {
      startCase: function (value) {
        return _.startCase(value)
      }
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<!--
d3.geo.(\w)
d3.geo\U$1\E
-->
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
