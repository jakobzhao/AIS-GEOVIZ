<template>
  <div>
    <h2>let's do it</h2>
    <button @click="drawGlobe">draw</button>
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
        currentProjection: 'atlantis',
        isMobile: false,
        params: {
          projectionList: globes.projectionList,
          // TODO:add event handler for window resizing or just use vw vh? https://github.com/vuejs/vue/issues/1915
          view: micro.view()
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
      }
    },
    methods: {
      buildGlobe: function (projectionName) {
        if (Object.keys(this.params.projectionList).indexOf(projectionName) >= 0) {
          return globes[projectionName]()
        } else {return null}
      },
      drawGlobe: function () {
        this.globe.defineMap(d3.select('#map'), d3.select('#foreground'))
        let path = d3.geoPath().projection(this.globe.projection).pointRadius(7);
        let coastline = d3.select(".coastline");
        let lakes = d3.select(".lakes");
        coastline.datum(this.earthTopo.coastHi);
        lakes.datum(this.earthTopo.lakesHi);
        d3.selectAll("path").attr("d", path);
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
      }
    },
    mounted: function () {
      // enlarge charting dom to full screen
      _.forEach(document.getElementsByClassName('fill-screen'), element => {
        element.style.height = this.params.view.height
        element.style.width = this.params.view.width
      })
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
