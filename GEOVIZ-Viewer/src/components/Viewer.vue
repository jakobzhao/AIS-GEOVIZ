<template>
  <div>
    <div id="display">
      <svg id="map" class="fill-screen" xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>
      <canvas id="animation" class="fill-screen"></canvas>
      <canvas id="overlay" class="fill-screen"></canvas>
      <svg id="foreground" class="fill-screen" xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>
    </div>
  </div>
</template>

<script>
  import _ from 'lodash'
  import ES6promise from 'es6-promise'

  ES6promise.polyfill()
  import axios from 'axios'
  import Promise from 'bluebird'
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
        currentView: '-170, 15, 300',
        isMobile: false,
        params: {
          MIN_MOVE: 4,
          MOVE_END_WAIT: 1000,
          PROJECTION_LIST: globes.projectionList,
          // TODO:add event handler for window resizing or just use vw vh? https://github.com/vuejs/vue/issues/1915
          VIEW: micro.view()
        }
      }
    },
    computed: {
      earthTopo: function () {
        let isMobile = this.isMobile
        if (isMobile) {
          return this.prepTopoMesh(earthTopoMobile)
        } else {
          return this.prepTopoMesh(earthTopoPC)
        }
      },
      globe: function () {
        return this.buildGlobe(this.currentProjection)
      },
      path: function () {
        return d3.geoPath().projection(this.globe.projection).pointRadius(7)
      }
    },
    methods: {
      buildGlobe: function (projectionName) {
        if (Object.keys(this.params.PROJECTION_LIST).indexOf(projectionName) >= 0) {
          return globes[projectionName]()
        } else {return null}
      },
      drawGlobe: function () {
        console.log('drawing...')
        // First clear map and foreground svg contents.
        micro.removeChildren(d3.select('#map').node())
        micro.removeChildren(d3.select('#foreground').node())
        // Create new map svg elements.
        this.globe.defineMap(d3.select('#map'), d3.select('#foreground'))

        this.globe.orientation(this.currentView, this.params.VIEW)

        let coastline = d3.select('.coastline')
        let lakes = d3.select('.lakes')
        coastline.datum(this.earthTopo.coastHi)
        lakes.datum(this.earthTopo.lakesHi)
        d3.selectAll('path').attr('d', this.path)
      },
      onUserInput: function () {
        let vueViewer = this

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
            op = op || newOp(d3.mouse(document.getElementById('display')), /*zoom.scale()*/ d3.zoomTransform(document.getElementById('display')).k)  // a new operation begins
            console.log('started')
          })
          .on('zoom', () => {
            console.log('zooming...')
            let currentMouse = d3.mouse(document.getElementById('display'))
            // console.log(currentMouse)
            //TODO: temp set scale to 1
           // let currentScale = d3.event.scale
            let currentScale = d3.zoomTransform(document.getElementById('display')).k
            op = op || newOp(currentMouse, 10)  // Fix bug on some browsers where zoomstart fires out of order.
            if (op.type === 'click' || op.type === 'spurious') {
              let distanceMoved = micro.distance(currentMouse, op.startMouse)
              if (currentScale === op.startScale && distanceMoved < vueViewer.params.MIN_MOVE) {
                // to reduce annoyance, ignore op if mouse has barely moved and no zoom is occurring
                op.type = distanceMoved > 0 ? 'click' : 'spurious'
                return
              }
              op.type = 'drag'
            }
            if (currentScale !== op.startScale) {
              op.type = 'zoom' // whenever a scale change is detected, (stickily) switch to a zoom operation
            }

            // when zooming, ignore whatever the mouse is doing--really cleans up behavior on touch devices
            console.log('op type= ' + op.type)
            console.log('for real ' + op.type.toString() === 'zoom' ? null : currentMouse, currentScale)
            op.manipulator.move(op.type.toString() === 'zoom' ? null : currentMouse, currentScale)
//            vueViewer.drawGlobe()
            d3.selectAll("path").attr("d", this.path)
            let coastline = d3.select('.coastline')
            let lakes = d3.select('.lakes')
            coastline.datum(this.earthTopo.coastHi)
            lakes.datum(this.earthTopo.lakesHi)
            d3.selectAll('path').attr('d', this.path)
          })
          .on('end', () => {
            console.log('ended')
            op.manipulator.end()
            op = null  // the drag/zoom/click operation is over
          })

        d3.select('#display').call(zoom)

      },
      prepTopoMesh: function (topojsonData) {
        let isMobile = this.isMobile
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
      doUserInput: function (zoom) {
        d3.select('#display').call(zoom)
      }

    },
    mounted: function () {
      // enlarge charting dom to full screen
      d3.selectAll('.fill-screen').attr('width', this.params.VIEW.width).attr('height', this.params.VIEW.height)
      this.drawGlobe()
      this.onUserInput()

    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<!--
d3.geo.(\w)
d3.geo\U$1\E
-->
<style lang="scss" rel="stylesheet/scss" scoped>
  /*TODO: change to BEM style, next time...*/
  a {
    color: #42b983;
  }

  svg {
    z-index: -100;
  }

</style>
