/**
 * micro - a grab bag of somewhat useful utility functions and other stuff that requires unit testing
 *
 * Copyright (c) 2014 Cameron Beccario
 * The MIT License - http://opensource.org/licenses/MIT
 *
 * https://github.com/cambecc/earth
 */

// edit by Likun CHEN 07/23/2017

/**
 * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
 *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
 */
export const τ = 2 * Math.PI
export const H = 0.0000360 // 0.0000360°φ ~= 4m


/**
 * @returns {Boolean} true if the specified value is truthy.
 */
export function isTruthy (x) {
  return !!x
}

/**
 * @returns {Boolean} true if the specified value is not null and not undefined.
 */
export function isValue (x) {
  return x !== null && x !== undefined
}

/**
 * @returns {Object} the first argument if not null and not undefined, otherwise the second argument.
 */
export function coalesce (a, b) {
  return isValue(a) ? a : b
}

/**
 * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
 *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
 */
export function floorMod (a, n) {
  let f = a - n * Math.floor(a / n)
  // HACK: when a is extremely close to an n transition, f can be equal to n. This is bad because f must be
  //       within range [0, n). Check for this corner case. Example: a:=-1e-16, n:=10. What is the proper fix?
  return f === n ? 0 : f
}

/**
 * @returns {Number} distance between two points having the form [x, y].
 */
export function distance (a, b) {
  let Δx = b[0] - a[0]
  let Δy = b[1] - a[1]
  return Math.sqrt(Δx * Δx + Δy * Δy)
}

/**
 * @returns {Number} the value x clamped to the range [low, high].
 */
export function clamp (x, low, high) {
  return Math.max(low, Math.min(x, high))
}

/**
 * @returns {number} the fraction of the bounds [low, high] covered by the value x, after clamping x to the
 *          bounds. For example, given bounds=[10, 20], this method returns 1 for x>=20, 0.5 for x=15 and 0
 *          for x<=10.
 */
export function proportion (x, low, high) {
  return (clamp(x, low, high) - low) / (high - low)
}

/**
 * @returns {number} the value p within the range [0, 1], scaled to the range [low, high].
 */
export function spread (p, low, high) {
  return p * (high - low) + low
}

/**
 * Pad number with leading zeros. Does not support fractional or negative numbers.
 */
export function zeroPad (n, width) {
  let s = n.toString()
  let i = Math.max(width - s.length, 0)
  return new Array(i + 1).join('0') + s
}

/**
 * @returns {String} the specified string with the first letter capitalized.
 */
export function capitalize (s) {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.substr(1)
}

/**
 * @returns {Boolean} true if agent is probably firefox. Don't really care if this is accurate.
 */
export function isFF () {
  return (/firefox/i).test(navigator.userAgent)
}

/**
 * @returns {Boolean} true if agent is probably a mobile device. Don't really care if this is accurate.
 */
export function isMobile () {
  return (/android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i).test(navigator.userAgent)
}

export function isEmbeddedInIFrame () {
  return window !== window.top
}

export function toUTCISO (date) {
  return date.getUTCFullYear() + '-' +
    zeroPad(date.getUTCMonth() + 1, 2) + '-' +
    zeroPad(date.getUTCDate(), 2) + ' ' +
    zeroPad(date.getUTCHours(), 2) + ':00'
}

export function toLocalISO (date) {
  return date.getFullYear() + '-' +
    zeroPad(date.getMonth() + 1, 2) + '-' +
    zeroPad(date.getDate(), 2) + ' ' +
    zeroPad(date.getHours(), 2) + ':00'
}

/**
 * @returns {String} the string yyyyfmmfdd as yyyytmmtdd, where f and t are the "from" and "to" delimiters. Either
 *          delimiter may be the empty string.
 */
export function ymdRedelimit (ymd, fromDelimiter, toDelimiter) {
  if (!fromDelimiter) {
    return ymd.substr(0, 4) + toDelimiter + ymd.substr(4, 2) + toDelimiter + ymd.substr(6, 2)
  }
  let parts = ymd.substr(0, 10).split(fromDelimiter)
  return [parts[0], parts[1], parts[2]].join(toDelimiter)
}

/**
 * @returns {String} the UTC year, month, and day of the specified date in yyyyfmmfdd format, where f is the
 *          delimiter (and may be the empty string).
 */
export function dateToUTCymd (date, delimiter) {
  return ymdRedelimit(date.toISOString(), '-', delimiter || '')
}

export function dateToConfig (date) {
  return {date: dateToUTCymd(date, '/'), hour: zeroPad(date.getUTCHours(), 2) + '00'}
}

/**
 * @returns {Object} an object to perform logging, if/when the browser supports it.
 */
export function log () {
  function format (o) { return o && o.stack ? o + '\n' + o.stack : o }

  return {
    debug: function (s) { if (console && console.log) console.log(format(s)) },
    info: function (s) { if (console && console.info) console.info(format(s)) },
    error: function (e) { if (console && console.error) console.error(format(e)) },
    time: function (s) { if (console && console.time) console.time(format(s)) },
    timeEnd: function (s) { if (console && console.timeEnd) console.timeEnd(format(s)) }
  }
}

/**
 * @returns {width: (Number), height: (Number)} an object that describes the size of the browser's current view.
 */
export function view () {
  let w = window
  let d = document && document.documentElement
  let b = document && document.getElementsByTagName('body')[0]
  let x = w.innerWidth || d.clientWidth || b.clientWidth
  let y = w.innerHeight || d.clientHeight || b.clientHeight
  return {width: x, height: y - 60}
}

/**
 * Removes all children of the specified DOM element.
 */
export function removeChildren (element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}

/**
 * @returns {Object} clears and returns the specified Canvas element's 2d context.
 */
export function clearCanvas (canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  return canvas
}

export function colorInterpolator (start, end) {
  let r = start[0]
  let g = start[1]
  let b = start[2]
  let Δr = end[0] - r
  let Δg = end[1] - g
  let Δb = end[2] - b
  return function (i, a) {
    return [Math.floor(r + i * Δr), Math.floor(g + i * Δg), Math.floor(b + i * Δb), a]
  }
}

/**
 * Produces a color style in a rainbow-like trefoil color space. Not quite HSV, but produces a nice
 * spectrum. See http://krazydad.com/tutorials/makecolors.php.
 *
 * @param hue the hue rotation in the range [0, 1]
 * @param a the alpha value in the range [0, 255]
 * @returns {Array} [r, g, b, a]
 */
export function sinebowColor (hue, a) {
  // Map hue [0, 1] to radians [0, 5/6τ]. Don't allow a full rotation because that keeps hue == 0 and
  // hue == 1 from mapping to the same color.
  let rad = hue * τ * 5 / 6
  rad *= 0.75 // increase frequency to 2/3 cycle per rad

  let s = Math.sin(rad)
  let c = Math.cos(rad)
  let r = Math.floor(Math.max(0, -c) * 255)
  let g = Math.floor(Math.max(s, 0) * 255)
  let b = Math.floor(Math.max(c, 0, -s) * 255)
  return [r, g, b, a]
}

let BOUNDARY = 0.45
let fadeToWhite = colorInterpolator(sinebowColor(1.0, 0), [255, 255, 255])

/**
 * Interpolates a sinebow color where 0 <= i <= j, then fades to white where j < i <= 1.
 *
 * @param i number in the range [0, 1]
 * @param a alpha value in range [0, 255]
 * @returns {Array} [r, g, b, a]
 */
export function extendedSinebowColor (i, a) {
  return i <= BOUNDARY ? sinebowColor(i / BOUNDARY, a) : fadeToWhite((i - BOUNDARY) / (1 - BOUNDARY), a)
}

export function asColorStyle (r, g, b, a) {
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')'
}

/**
 * Returns a human readable string for the provided coordinates.
 */
export function formatCoordinates (λ, φ) {
  return Math.abs(φ).toFixed(2) + '° ' + (φ >= 0 ? 'N' : 'S') + ', ' +
    Math.abs(λ).toFixed(2) + '° ' + (λ >= 0 ? 'E' : 'W')
}

/**
 * Returns a human readable string for the provided scalar in the given units.
 */
export function formatScalar (value, units) {
  return units.conversion(value).toFixed(units.precision)
}

/**
 * Returns a human readable string for the provided rectangular wind vector in the given units.
 * See http://mst.nerc.ac.uk/wind_vect_convs.html.
 */
export function formatVector (wind, units) {
  let d = Math.atan2(-wind[0], -wind[1]) / τ * 360 // calculate into-the-wind cardinal degrees
  let wd = Math.round((d + 360) % 360 / 5) * 5 // shift [-180, 180] to [0, 360], and round to nearest 5.
  return wd.toFixed(0) + '° @ ' + formatScalar(wind[2], units)
}
