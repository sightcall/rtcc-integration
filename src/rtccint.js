var RtccInt, RtccIntegration;

/**
 * Several modules to help integrate the Rtcc API.
 * @namespace
 */
RtccInt = RtccIntegration = {};

/**
 * @property {String} version - The version of the library
 */
RtccInt.version = '@@version';

try {
  RtccInt.scriptpath = $("script[src]").last().attr("src").split('?')[0].split('/').slice(0, -1).join('/') + '/';
} catch (e) {
  console.log('Failed to get the script path')
}

/**
 * An instance of jQuery
 * @typedef {object} jQueryObject
 */

/**
 * @typedef {object} Rtcc
 */

/**
 * Represents a call, given by Rtcc when a call starts
 * @typedef {object} RtccCall
 */

/**
 * @typedef {object} DOMobject
 */

/**
 * An array in the format [redValue, greenValue, blueValue, alphaValue]
 * @typedef {array} colorRGBA
 */

/**
 * An image created with "(new Image()).src = ...". Be sure the image is loaded before trying to use it.
 * @typedef {object} imageObject
 */
