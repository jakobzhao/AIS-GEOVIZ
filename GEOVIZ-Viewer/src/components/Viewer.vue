<template>
  <div>
    <h2>let's do it</h2>
    <button @click="drawGlobe">ttt</button>
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
  import * as globes from '../Utils/globes'
  import earthTopoPC from '../data/earth-topo.json'
  import earthTopoMobile from '../data/earth-topo-mobile.json'

  export default {
    name: 'hello',
    data () {
      return {
        isMobile: false,
        test: globes.projectionList
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
      }
    },
    methods: {
      drawGlobe: function () {
        globes.orthographic().defineMap(d3.select("#map"), d3.select("#foreground"))
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
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<!--
d3.geo.(\w)
d3.geo\U$1\E
-->
<style lang="scss" rel="stylesheet/scss" scoped>
  h1, h2 {
    font-weight: normal;
  }

  ul {
    list-style-type: none;
    padding: 0;
  }

  li {
    display: inline-block;
    margin: 0 10px;
  }

  a {
    color: #42b983;
  }
</style>
