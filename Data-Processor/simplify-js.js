/*
 (c) 2013, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

(function () { 'use strict';

//Haversine formula to calc length between two pts
// http://www.movable-type.co.uk/scripts/latlong.html
  function getGeoDistance (long1, lat1, long2, lat2) {
    let eRidus = 6371
    let φ1 = deg2rad(lat1)
    let φ2 = deg2rad(lat2)
    let Δφ = deg2rad(lat2 - lat1)
    let Δλ = deg2rad(long2 - long1)

    let a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return eRidus * c
  }

  function deg2rad (deg) {
    return deg * Math.PI / 180
  }

  function rad2deg (rad) {
    return rad * 180 / Math.PI
  }

// return in rad
  function getBearing (long1, lat1, long2, lat2) {
    let φ1 = deg2rad(lat1)
    let φ2 = deg2rad(lat2)
    let Δλ = deg2rad(long2 - long1)
    let y = Math.sin(Δλ) * Math.cos(φ2)
    let x = Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
    return Math.atan2(y, x)
  }

  /* starting long, starting lat, ending long, ending lat, external long, external lat
  * */
  function getCrossTrackDistance (long1, lat1, long2, lat2, long3, lat3) {
    let eRidus = 6371
    let d13 = getGeoDistance(long1, lat1, long3, lat3)
    let θ13 = getBearing(long1, lat1, long3, lat3)
    let θ12 = getBearing(long1, lat1, long2, lat2)
    return Math.asin(Math.sin(d13 / eRidus) * Math.sin(θ13 - θ12)) * eRidus
  }


// to suit your point format, run search/replace for '.longlat.x' and '.longlat.y';
// for 3D version, see 3d branch (configurability would draw significant performance overhead)

// square distance between 2 points
  function getSqDist(p1, p2) {
    return Math.pow(getGeoDistance(p1.longlat.x, p1.longlat.y, p2.longlat.x, p2.longlat.y), 2)
  }

// square distance from a point to a segment
  function getSqSegDist(p, p1, p2) {
    return Math.pow(getCrossTrackDistance(p1.longlat.x, p1.longlat.y, p2.longlat.x, p2.longlat.y, p.longlat.x, p.longlat.y), 2)
  }
// rest of the code doesn't care about point format

// basic distance-based simplification
  function simplifyRadialDist(points, sqTolerance) {

    let prevPoint = points[0],
      newPoints = [prevPoint],
      point;

    for (let i = 1, len = points.length; i < len; i++) {
      point = points[i];

      if (getSqDist(point, prevPoint) > sqTolerance) {
        newPoints.push(point);
        prevPoint = point;
      }
    }

    if (prevPoint !== point) newPoints.push(point);

    return newPoints;
  }

  function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    let maxSqDist = sqTolerance,
      index;

    for (let i = first + 1; i < last; i++) {
      let sqDist = getSqSegDist(points[i], points[first], points[last]);

      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
      simplified.push(points[index]);
      if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
  }

// simplification using Ramer-Douglas-Peucker algorithm
  function simplifyDouglasPeucker(points, sqTolerance) {
    let last = points.length - 1;

    let simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);

    return simplified;
  }

// both algorithms combined for awesome performance
  function simplify(points, tolerance, highestQuality) {

    if (points.length <= 2) return points;

    let sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

    points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
    points = simplifyDouglasPeucker(points, sqTolerance);

    return points;
  }

// export as AMD module / Node module / browser or worker letiable
  if (typeof define === 'function' && define.amd) define(function() { return simplify; });
  else if (typeof module !== 'undefined') module.exports = simplify;
  else if (typeof self !== 'undefined') self.simplify = simplify;
  else window.simplify = simplify;

})();
