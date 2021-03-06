/**
 * globes - a set of models of the earth, each having their own kind of projection and onscreen behavior.
 *
 * Copyright (c) 2014 Cameron Beccario
 * The MIT License - http://opensource.org/licenses/MIT
 *
 * https://github.com/cambecc/earth
 */
// edit by Likun CHEN 07/23/2017

import * as d3 from 'd3'
// temp d3-geo-projection import fix
import * as d3p from 'd3-geo-projection'
import _ from 'lodash'
import * as micro from './micro'

/**
 * @returns {Array} rotation of globe to current position of the user. Aside from asking for geolocation,
 *          which user may reject, there is not much available except timezone. Better than nothing.
 */
export function currentPosition () {
  let λ = micro.floorMod(new Date().getTimezoneOffset() / 4, 360) // 24 hours * 60 min / 4 === 360 degrees
  return [λ, 0]
}

export function ensureNumber (num, fallback) {
  return _.isFinite(num) || num === Infinity || num === -Infinity ? num : fallback
}

/**
 * @param bounds the projection bounds: [[x0, y0], [x1, y1]]
 * @param view the view bounds {width:, height:}
 * @returns {Object} the projection bounds clamped to the specified view.
 */
export function clampedBounds (bounds, view) {
  let upperLeft = bounds[0]
  let lowerRight = bounds[1]
  let x = Math.max(Math.floor(ensureNumber(upperLeft[0], 0)), 0)
  let y = Math.max(Math.floor(ensureNumber(upperLeft[1], 0)), 0)
  let xMax = Math.min(Math.ceil(ensureNumber(lowerRight[0], view.width)), view.width - 1)
  let yMax = Math.min(Math.ceil(ensureNumber(lowerRight[1], view.height)), view.height - 1)
  return {x: x, y: y, xMax: xMax, yMax: yMax, width: xMax - x + 1, height: yMax - y + 1}
}

/**
 * Returns a globe object with standard behavior. At least the newProjection method must be overridden to
 * be functional.
 */
export function standardGlobe () {
  return {
    /**
     * This globe's current D3 projection.
     */
    projection: null,

    /**
     * @param view the size of the view as {width:, height:}.
     * @returns {Object} a new D3 projection of this globe appropriate for the specified view port.
     */
    newProjection: function (view) {
      throw new Error('method must be overridden')
    },

    /**
     * @param view the size of the view as {width:, height:}.
     * @returns {{x: Number, y: Number, xMax: Number, yMax: Number, width: Number, height: Number}}
     *          the bounds of the current projection clamped to the specified view.
     */
    bounds: function (view) {
      return clampedBounds(d3.geoPath().projection(this.projection).bounds({type: 'Sphere'}), view)
    },

    /**
     * @param view the size of the view as {width:, height:}.
     * @returns {Number} the projection scale at which the entire globe fits within the specified view.
     */
    fit: function (view) {
      let defaultProjection = this.newProjection(view)
      let bounds = d3.geoPath().projection(defaultProjection).bounds({type: 'Sphere'})
      let hScale = (bounds[1][0] - bounds[0][0]) / defaultProjection.scale()
      let vScale = (bounds[1][1] - bounds[0][1]) / defaultProjection.scale()
      return Math.min(view.width / hScale, view.height / vScale) * 0.9
    },

    /**
     * @param view the size of the view as {width:, height:}.
     * @returns {Array} the projection transform at which the globe is centered within the specified view.
     */
    center: function (view) {
      return [view.width / 2, view.height / 2]
    },

    /**
     * @returns {Array} the range at which this globe can be zoomed.
     */
    scaleExtent: function () {
      return [25, 3000]
    },

    /**
     * Returns the current orientation of this globe as a string. If the arguments are specified,
     * mutates this globe to match the specified orientation string, usually in the form "lat,lon,scale".
     *
     * @param [o] the orientation string
     * @param [view] the size of the view as {width:, height:}.
     */
    orientation: function (o, view, vueInstance) {
      let projection = this.projection
      let rotate = projection.rotate()
      if (micro.isValue(o)) {
        let parts = o.split(',')
        let λ = +parts[0]
        let φ = +parts[1]
        let scale = +parts[2]
        let extent = this.scaleExtent()
        projection.rotate(_.isFinite(λ) && _.isFinite(φ) ? [-λ, -φ, rotate[2]] : this.newProjection(view).rotate())
        projection.scale(_.isFinite(scale) ? micro.clamp(scale, extent[0], extent[1]) : this.fit(view))
        projection.translate(this.center(view))
        this.drawMap(vueInstance)
        return this
      }
      return [(-rotate[0]).toFixed(2), (-rotate[1]).toFixed(2), Math.round(projection.scale())].join(',')
    },

    /**
     * Returns an object that mutates this globe's current projection during a drag/zoom operation.
     * Each drag/zoom event invokes the move() method, and when the move is complete, the end() method
     * is invoked.
     *
     * @param startMouse starting mouse position.
     * @param startScale starting scale.
     */
    manipulator: function (startMouse, startScale) {
      let projection = this.projection
      // TODO: using Viewer.vue.params.DEFAULT_SCALE for now, should replace this magic number with a programmatic way (calc scale change of svg)
      let sensitivity = 60 / (startScale * 279) // seems to provide a good drag scaling factor
      let rotation = [projection.rotate()[0] / sensitivity, -projection.rotate()[1] / sensitivity]
      let original = projection.precision()
      projection.precision(original * 10)
      return {
        move: function (mouse, scale) {
          if (mouse) {
            let xd = mouse[0] - startMouse[0] + rotation[0]
            let yd = mouse[1] - startMouse[1] + rotation[1]
            projection.rotate([xd * sensitivity, -yd * sensitivity, projection.rotate()[2]])
          }
          projection.scale(scale)
        },
        end: function () {
          projection.precision(original)
        }
      }
    },

    /**
     * @returns {Array} the transform to apply, if any, to orient this globe to the specified coordinates.
     */
    locate: function (coord) {
      return null
    },

    /**
     * Draws a polygon on the specified context of this globe's boundary.
     * @param context a Canvas element's 2d context.
     * @returns the context
     */
    defineMask: function (context) {
      d3.geoPath().projection(this.projection).context(context)({type: 'Sphere'})
      return context
    },

    /**
     * Appends the SVG elements that render this globe.
     * @param mapSvg the primary map SVG container.
     * @param foregroundSvg the foreground SVG container.
     */
    drawMap: function (vueInstance) {
      let canvas = d3.select('#map')
      let path = d3.geoPath().projection(this.projection)
      let context = canvas.node().getContext('2d')
      context.restore()
      context.clearRect(0, 0, vueInstance.params.VIEW.width, vueInstance.params.VIEW.height)

      let globe = {type: 'Sphere'}
      let graticule = d3.geoGraticule10()

      let oceanGradient =
        context.createRadialGradient(
          Math.max(vueInstance.params.VIEW.width * 0.7, 960),
          vueInstance.params.VIEW.height * 0.2,
          300,
          vueInstance.params.VIEW.width * 0.6,
          vueInstance.params.VIEW.height * 0.4,
          900)

      oceanGradient.addColorStop(0, '#269FCE')
      oceanGradient.addColorStop(0.2, '#1F518B')
      oceanGradient.addColorStop(1, '#1A2980')

      if (vueInstance.info.currentProjection === 'orthographic' && (vueInstance.info.currentView.split(',')[2] <= 600 || vueInstance.info.currentView.split(', ')[2]=== 'null')) {
        context.fillStyle = oceanGradient
      } else {
        context.fillStyle =  '#2679AD'
      }


      // ocean
      // clip is permanent, we save it here and restore it later to update the clip
      context.save()
      context.beginPath()
      path.context(context)(globe)
      context.fill()
      context.clip()

      // land
      context.lineWidth = 0.2
      context.fillStyle = '#d7c7ad'
      context.beginPath()
      path.context(context)(vueInstance.earthTopo)
      context.fill()
      context.beginPath()
      path.context(context)(vueInstance.earthTopo)
      context.stroke()

      // halo
      context.lineWidth = 10
      context.strokeStyle = 'rgba(255,255,255, 0.6)'
      context.beginPath()
      path.context(context)(globe)
      context.stroke()

      context.strokeStyle = 'rgba(0,0,0, 0.8)'
      context.lineWidth = 0.2
      context.beginPath()
      path.context(context)(graticule)
      context.stroke()

      path = null
    }
  }
}

export function newGlobe (source, view) {
  let result = _.extend(standardGlobe(), source)
  result.projection = result.newProjection(view)
  return result
}

// ============================================================================================

export function atlantis () {
  return newGlobe({
    newProjection: function () {
      return d3p.geoMollweide().rotate([30, -45, 90]).precision(0.1)
    }
  })
}

export function azimuthalEquidistant () {
  return newGlobe({
    newProjection: function () {
      return d3.geoAzimuthalEquidistant().precision(0.1).rotate([0, -90]).clipAngle(180 - 0.001)
    }
  })
}

export function conicEquidistant () {
  return newGlobe({
    newProjection: function () {
      return d3.geoConicEquidistant().rotate(currentPosition()).precision(0.1)
    },
    center: function (view) {
      return [view.width / 2, view.height / 2 + view.height * 0.065]
    }
  })
}

export function equirectangular () {
  return newGlobe({
    newProjection: function () {
      return d3.geoEquirectangular().rotate(currentPosition()).precision(0.1)
    }
  })
}

export function orthographic () {
  return newGlobe({
    newProjection: function () {
      return d3.geoOrthographic().rotate(currentPosition()).precision(0.1).clipAngle(90)
    },
    locate: function (coord) {
      return [-coord[0], -coord[1], this.projection.rotate()[2]]
    }
  })
}

export function stereographic (view) {
  return newGlobe({
    newProjection: function (view) {
      return d3.geoStereographic()
        .rotate([-43, -20])
        .precision(1.0)
        .clipAngle(180 - 0.0001)
        .clipExtent([[0, 0], [view.width, view.height]])
    }
  }, view)
}

export function waterman () {
  return newGlobe({
    newProjection: function () {
      return d3p.geoPolyhedralWaterman().rotate([20, 0]).precision(0.1)
    },
  })
}

export function winkel3 () {
  return newGlobe({
    newProjection: function () {
      return d3p.geoWinkel3().precision(0.1)
    }
  })
}

export const projectionList = {
  atlantis: atlantis,
  azimuthal_equidistant: azimuthalEquidistant,
  /*  conic_equidistant: conicEquidistant,*/
  equirectangular: equirectangular,
  orthographic: orthographic,
  stereographic: stereographic,
  waterman: waterman,
  winkel_tripel: winkel3
}
