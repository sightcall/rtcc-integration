var RtccInt, RtccIntegration;
RtccInt = RtccIntegration = {};

/**
 * @typedef {object} jQueryObject
 * @typedef {object} Rtcc
 */
;;RtccInt.scriptpath = $("script[src]").last().attr("src").split('?')[0].split('/').slice(0, -1).join('/') + '/';

RtccInt.Draw = function(rtccObject, callObject, isExternal, settings) {
  'use strict'

  //DEFAULT VALUES
  settings = settings || {};
  settings.pointerSrc = settings.pointerSrc || RtccInt.scriptpath + 'img/pointer.png';
  settings.remoteCircleSrc = settings.remoteCircleSrc || RtccInt.scriptpath + 'img/drop_green.png';
  settings.localCircleSrc = settings.localCircleSrc || RtccInt.scriptpath + 'img/drop_orange.png';

  //GLOBAL
  var that = this;
  var allCanvas = {
    pointer: $('<canvas class="rtccint-pointer" />'),
    annotations: $('<canvas class="rtccint-annotations" />')
  }
  var videobox = $('.rtcc-videobox').first();
  var currentMode;
  var hexHundredPercent = parseInt('FFFE', 16);
  var ctx;
  var shouldSendPointerOff = false;
  var shouldSendPointer = true;
  var previousDrawCoordinatesReceived = false;
  var previousDrawCoordinatesSent = false;
  var rightMouseDown = false;

  //ATTRIBUTES
  this.ctxPtr = false;
  this.ctxDraw = false;
  this.pointerDelay = 50; //in ms
  this.circleRatioTovideobox = 0.15;
  this.pointer = new Image();
  this.pointer.src = settings.pointerSrc;
  this.remoteCircle = new Image()
  this.remoteCircle.src = settings.remoteCircleSrc;
  this.localCircle = new Image()
  this.localCircle.src = settings.localCircleSrc;
  this.color = {
    receive: [114, 255, 0, 255],
    send: [255, 174, 0, 255]
  }

  //PUBLIC
  this.setMode = function(mode) {
    currentMode = mode;
    updateModeListener();
  }

  this.getMode = function() {
    return currentMode;
  }

  this._percentToHex = function(percent) {
    var hex;
    if (0 <= percent && percent <= 100) {
      hex = Math.round(percent / 100 * parseInt('FFFE', 16)).toString(16).toUpperCase();
      while (hex.length < 4) {
        hex = '0' + hex;
      }
    } else {
      hex = 'FFFF';
    }
    return hex
  }

  this._hexToPercent = function(hex) {
    return parseInt(hex, 16) / hexHundredPercent * 100;
  }

  this.setPointer = function(x, y) {
    this.cleanPointer();
    this.ctxPtr.drawImage(that.pointer, x - that.pointer.width / 2, y - that.pointer.height / 2)
  }

  this.cleanPointer = function() {
    this.ctxPtr.clearRect(0, 0, allCanvas.pointer.width(), allCanvas.pointer.height());
  }

  this.dropCircle = function(x, y, circle) {
    var ratio = videobox.width() * this.circleRatioTovideobox / circle.width
    var drawnCircleWidth = Math.round(circle.width * ratio)
    var drawnCircleHeight = Math.round(circle.height * ratio)
    this.ctxDraw.drawImage(
      circle,
      Math.round(x - drawnCircleWidth / 2),
      Math.round(y - drawnCircleHeight / 2),
      drawnCircleWidth,
      drawnCircleHeight
    )
  }

  this.drawLine = function(from, to, color) {
    this.ctxDraw.beginPath();
    this.ctxDraw.moveTo(from.x, from.y);
    this.ctxDraw.lineTo(to.x, to.y);
    this.ctxDraw.lineWidth = 3;
    this.ctxDraw.strokeStyle = 'rgba(' + color.join(',') + ')';
    this.ctxDraw.stroke();
  }

  this.erase = function() {
    this.ctxDraw.clearRect(0, 0, allCanvas.annotations.width(), allCanvas.annotations.height());
  }

  this.destroy = function() {
    removeModeListeners();
    $.each(allCanvas, function(k, v) {
      v.remove();
    })
  }


  //PRIVATE
  function updateContexts() {
    that.ctxPtr = allCanvas.pointer[0].getContext('2d');
    that.ctxDraw = allCanvas.annotations[0].getContext('2d');
  }

  //this also erase all the canvas content...
  function updateCanvasSize() {
    $.each(allCanvas, function(k, canvas) {
      canvas[0].width = videobox.width()
      canvas[0].height = videobox.height()
    })
    updateContexts();
  }

  //Functions to ease maniputations of the hexa strings from the driver

  //str = XXXXYYYY
  function coordinatesFromHexStr(str) {
    return {
      x: Math.round(that._hexToPercent(str.substring(0, 4)) / 100 * allCanvas.pointer.width()),
      y: Math.round(that._hexToPercent(str.substring(4, 8)) / 100 * allCanvas.pointer.height())
    }
  }

  function isOutOfBox(hexStr) {
    return hexStr === 'FFFFFFFF';
  }

  //transform mouse coordinates in a string according to this spec:
  //https://github.com/weemo/Mobile/blob/feature-scheme/scheme.md
  //works for any videobox position
  function mouseCoordToHex(x, y) {
    var xOffset = x - videobox.offset().left;
    var yOffset = y - videobox.offset().top;
    var hexX = that._percentToHex(xOffset / videobox.width() * 100)
    var hexY = that._percentToHex(yOffset / videobox.height() * 100)
    return hexX === 'FFFF' || hexY === 'FFFF' ? 'FFFFFFFF' : hexX + hexY;
  }



  function pointerMouseListener(event) {
    var hexCoords = mouseCoordToHex(event.pageX, event.pageY);
    var message = 'RTCCPTR' + hexCoords;
    if (isOutOfBox(hexCoords)) {
      if (shouldSendPointerOff) {
        shouldSendPointerOff = false
        shouldSendPointer = true;
        rtccObject.sendInbandMessage(message);
      }
    } else if (shouldSendPointer) {
      shouldSendPointerOff = true;
      rtccObject.sendInbandMessage(message);
      shouldSendPointer = false;
      setTimeout(function() {
        shouldSendPointer = true;
      }, that.pointerDelay);
    }
  }

  function sendDrawCoords(event) {
    var hexCoords = mouseCoordToHex(event.pageX, event.pageY);
    rtccObject.sendInbandMessage('RTCCDRAW' + hexCoords);
    return hexCoords;
  }

  function stopDraw() {
    previousDrawCoordinatesSent = false
    rtccObject.sendInbandMessage('RTCCDRAWFFFFFFFF');
  }

  //event listeners
  var modeListeners = {};
  modeListeners[Rtcc.annotationMode.POINTER] = [{
    event: 'mousemove',
    target: $(document),
    listener: pointerMouseListener
  }]
  modeListeners[Rtcc.annotationMode.DROP] = [{
    event: 'mousedown',
    target: videobox,
    listener: function(event) {
      if (event.which === 3) {
        var hexCoords = mouseCoordToHex(event.pageX, event.pageY);
        rtccObject.sendInbandMessage('RTCCDROP' + hexCoords);
        var coords = coordinatesFromHexStr(hexCoords)
        that.dropCircle(coords.x, coords.y, that.localCircle)
      }
    }
  }]
  modeListeners[Rtcc.annotationMode.DRAW] = [{
    event: 'mousedown',
    target: videobox,
    listener: function(event) {
      if (event.which === 3) {
        rightMouseDown = true
        var hexStr = sendDrawCoords(event);
        if (!isOutOfBox(hexStr)) {
          previousDrawCoordinatesSent = coordinatesFromHexStr(hexStr)
        }
      }
    }
  }, {
    event: 'mouseup',
    target: videobox,
    listener: function(event) {
      if (event.which === 3) {
        rightMouseDown = false
        stopDraw();
      }
    }
  }, {
    event: 'mousemove',
    target: $(document),
    listener: function(event) {
      if (rightMouseDown) {
        var hexStr = sendDrawCoords(event);
        if (isOutOfBox(hexStr)) {
          previousDrawCoordinatesSent = false
          stopDraw();
        } else {
          var coords = coordinatesFromHexStr(hexStr)
          if (previousDrawCoordinatesSent)
            that.drawLine(previousDrawCoordinatesSent, coords, that.color.send)
          previousDrawCoordinatesSent = coords
        }
      }
    }
  }]


  function updateModeListener() {
    removeModeListeners();
    if (modeListeners[currentMode].length)
      $.each(modeListeners[currentMode], function(k, modeListener) {
        modeListener.target.on(modeListener.event, modeListener.listener);
      })
  }

  function removeModeListeners() {
    $.each(modeListeners, function(k, list) {
      $.each(list, function(i, v) {
        v.target.off(v.event, v.listener)
      })
    })
  }


  function handleInbandMessage(message) {
    $.each({
      RTCCPTR: function(hexStr) {
        if (!isOutOfBox(hexStr)) {
          var coords = coordinatesFromHexStr(hexStr)
          that.setPointer(coords.x, coords.y)
        } else {
          that.cleanPointer();
        }
      },
      RTCCDROP: function(hexStr) {
        var coords = coordinatesFromHexStr(hexStr)
        that.dropCircle(coords.x, coords.y, that.remoteCircle)
      },
      RTCCERASE: that.erase.bind(that),
      RTCCDRAW: function(hexStr) {
        if (isOutOfBox(hexStr)) {
          previousDrawCoordinatesReceived = false;
          return
        }
        var coords = coordinatesFromHexStr(hexStr)
        if (previousDrawCoordinatesReceived) {
          that.drawLine(previousDrawCoordinatesReceived, coords, that.color.receive)
        }
        previousDrawCoordinatesReceived = coords
      }
    }, function(key, listener) {
      if (message.search(key) === 0) {
        listener(message.replace(key, ''))
      }
    })
  }

  function startResizeSensor() {
    if (typeof ResizeSensor !== 'function')
      throw 'Missing css-element-queries dependency. You can find it in the bower_components folder.'

    new ResizeSensor(videobox, updateCanvasSize);
    if (videobox.attr('style').indexOf('position: relative') !== -1) {
      videobox.css('position', 'fixed')
    }
  }


  function init() {
    if (!videobox) throw 'RtccInt.Draw needs a videobox to draw.';
    //context menu disable right click
    videobox.attr('oncontextmenu', 'return false')

    $.each(allCanvas, function(k, v) {
      videobox.append(v);
    })

    rtccObject.on('message.inband', handleInbandMessage);
    startResizeSensor();
    updateCanvasSize();
  }

  init();
}
;RtccInt.Box = function(content) {
  'use strict'
  var htmlContent;
  this.setContent = function(newContent) {
    if (newContent) htmlContent = newContent;
  }

  this.getContent = function() {
    return htmlContent;
  }

  this.html = function() {
    return $('<div class="rtccint-box">').html(htmlContent);
  }

  this.setContent(content)
}
;/**
 * A widget to chat with another SightCall user
 * @class
 *
 * @param {Rtcc} rtccObject - The Rtcc object handling connexion
 * @param {String} uid - The SightCall user ID to chat with
 * @param {object} [userCallbacks={}]
 * @param {function} [userCallbacks.buildChatBox=defaultChatBox] -
 *     Must return a jQuery object of the chatbox with :
 *     - an attribute rtcc-messages where the messages will be append
 *     - an attribute rtcc-send for the send message button(s)
 *     - an attribute rtcc-input where the text to send will be extracted
 * @param {function} [userCallbacks.buildChatBox=buildChatBox] -
 * @param {function} [userCallbacks.showTyping=showTyping] -
 * @param {function} [userCallbacks.hideTyping=hideTyping] -
 *
 * @param {object} [settings={}]
 * @param {object} [settings.displayName=uid] - The name of the remote person, used by default callbacks
 * @param {object} [settings.isTypingMode] - According to this option, the chat will
 *    send some data about what the local user is typing. Use {@link RtccInt.Chat.isTypingModes} enumeration.
 *
 * @desc A modular chat
 */


RtccInt.Chat = function(rtccObject, uid, userCallbacks, settings) {
  'use strict'

  //DEFAULT ARGS
  if (!rtccObject) throw new Error('First argument must be an object Rtcc.')
  if (!uid) throw new Error('UID ' + uid + ' is incorrect.')
  settings = settings || {};
  settings.displayName = settings.displayName || uid;
  settings.isTypingMode = settings.isTypingMode || RtccInt.Chat.isTypingModes.NORMAL;

  userCallbacks = userCallbacks || {};
  var defaultCallbacks = {

    buildChatBox: function() {
      var html = $('<div class="rtccint-chat"><div class="rtccint-uid">' + settings.displayName +
        '</div><div rtcc-messages class="rtccint-messages"></div></div></div>');
      html.append('<div class="rtccint-chat-controls"><button rtcc-send>Send</button><textarea rtcc-input></textarea></div>')
      return html
    },

    formatMessage: (function(message, from) {
      var toAppend = $('<div class="rtccint-message ' + from + '"></div>')
      var time = '<span class="rtccint-time">' + (new Date()).toLocaleTimeString() + '</span>';
      toAppend.append('<span class="rtccint-bubble">' + message + '<br /></span>' + time + '')
      messageContainer.append(toAppend);
      this.scrollBottom();
      toAppend.hide().fadeIn()
    }).bind(this),

    showTyping: (function(text) {
      callbacks.hideTyping();
      text = text ? ': ' + text : '...';
      messageContainer.append($('<div class="rtccint-typing">' + settings.displayName + ' is typing' + text + '</div>'))
      this.scrollBottom();
    }).bind(this),

    hideTyping: function() {
      chatBox.find('.rtccint-typing').remove();
    }

  }

  var callbacks = {};
  $.each(defaultCallbacks, function(k, v) {
    callbacks[k] = userCallbacks[k] || v;
  })


  //PRIVATE VARS
  var chatBox;
  var messageContainer;
  var sendButton;
  var textInput;
  var that = this;
  var typingSent = false;


  //PRIVATE FUNCTIONS
  function escapeMessage(m) {
    return RtccInt.Utils.htmlEscape(m).replace(new RegExp('\n', 'g'), '<br />');
  }

  function getInputText() {
    return textInput.val().replace(new RegExp('\r?\n$'), '');
  }

  function addMessage(message, from) {
    callbacks.formatMessage(escapeMessage(message), from)
  }

  function onMessage(messageId, dest, message) {
    if (dest === uid) that.receive(message)
  }

  function onMessageAck(messageId, dest, message) {
    if (dest === uid) that.acknowledge(messageId)
  }

  function onPressEnter(e) {
    if (e.which === 13 && !e.shiftKey) { //13 = enter
      e.preventDefault();
      sendButton.click();
    }
  }

  function onTyping() {
    var text = getInputText();
    if (settings.isTypingMode !== RtccInt.Chat.isTypingModes.NONE &&
      (settings.isTypingMode === RtccInt.Chat.isTypingModes.PREVIEW || text.length === 0 || !typingSent)
    ) {
      typingSent = that.sendTyping(text);
    }
  }

  function onClickButton() {
    that.send(getInputText());
    textInput.val('')
    typingSent = that.sendTyping('');
  }

  function bindEvents() {
    //html
    sendButton.on('click', onClickButton);
    textInput.on('input', onTyping);
    textInput.on('keyup', onPressEnter)

    //rtcc
    rtccObject.on('message', onMessage)
    rtccObject.on('message.acknowledge', onMessageAck)
  }


  //PUBLIC FUNCTIONS
  this.send = function(message) {
    if (message === '') return;
    addMessage(message, RtccInt.Chat.from.ME);
    var json = JSON.stringify({
      message: message
    })
    rtccObject.sendMessage('', uid, json)
  }

  this.receive = function(json) {
    var data = JSON.parse(json);
    if (data.message)
      addMessage(data.message, RtccInt.Chat.from.REMOTE);
    else if (data.typing)
      callbacks.showTyping(typeof data.value === "string" ? escapeMessage(data.value) : data.value);
    else if (data.typing === false)
      callbacks.hideTyping();
  }

  this.sendTyping = function(text) {
    var status = text.length !== 0;
    var textToSend = (settings.isTypingMode === RtccInt.Chat.isTypingModes.PREVIEW) ? text : false;
    rtccObject.sendMessage('', uid, JSON.stringify({
      typing: status,
      value: textToSend
    }))
    return status;
  }

  this.scrollBottom = function() {
    messageContainer.scrollTop(messageContainer.prop("scrollHeight"))
  }

  this.getBox = function() {
    return chatBox;
  }

  this.destroy = function() {
    chatBox.remove();
    rtccObject.off('message', onMessage);
    rtccObject.off('message.acknowledge', onMessageAck)
  }


  chatBox = callbacks.buildChatBox();
  messageContainer = chatBox.find('[rtcc-messages]')
  sendButton = chatBox.find('[rtcc-send]')
  textInput = chatBox.find('[rtcc-input]')
  bindEvents();
}


//CONSTANTS
RtccInt.Chat.from = {
  ME: 'rtccint-me',
  REMOTE: 'rtccint-remote',
}

/**
 * Typing modes
 * @readonly
 * @enum {string}
 */
RtccInt.Chat.isTypingModes = {
  /** No data about typing will be sent */
  NONE: 1,
  /** Remote user will know that current user is typing */
  NORMAL: 2,
  /** Remote user will see what the current user is typing */
  PREVIEW: 3
}
;/**
 * A widget to show the connection status.
 * @class
 * @param {Rtcc} rtccObject - The connection you want to track
 * @param {jQueryObject} htmlContainer - The html object where the connection status will be displayed
 * @param {object} [settings={}]
 * @param {object} [settings.lang] - The string to display next to each status
 * @param {string} [settings.lang.client] - Can reach the client
 * @param {string} [settings.lang.cloud] - Can reach the cloud
 * @param {string} [settings.lang.authenticate] - Is authenticated
 * @param {string} [settings.lang.sip] - Can make calls
 * @param {boolean} [settings.useBox] - Use a box wrapper. Defaults to false
 */

RtccInt.ConnectionStatus = function(rtccObject, htmlContainer, settings) {
  'use strict'
  var rtcc = rtccObject;
  var html;

  var statuses = {
    'client': {
      text: 'Local network',
      eventName: 'client.connect'
    },
    'cloud': {
      text: 'Cloud',
      eventName: 'cloud.connect'
    },
    'authenticate': {
      text: 'Authenticate',
      eventName: 'cloud.authenticate.success'
    },
    'ready': {
      text: 'Ready',
      eventName: 'cloud.sip.ok'
    },
    'presence': {
      text: 'Presence',
      eventName: 'presence.ok'
    },
  }


  function manageSettings() {
    if (!rtcc) throw new Error('First argument must be an object Rtcc.')
    if (!(htmlContainer instanceof jQuery)) htmlContainer = $(htmlContainer)

    settings = settings || {};
    settings.lang = settings.lang || {};
    settings.useBox = settings.useBox || false;
    $.each(settings.lang, function(k, v) {
      statuses[k].text = v;
    });
  }

  function activateLi(key) {
    html.find('.rtccint-' + key).addClass('rtccint-connected')
  }

  function deactivateLi(keys) {
    $.each(keys, function(k, v) {
      html.find('.rtccint-' + v).removeClass('rtccint-connected')
    })
  }

  function buildHtml() {
    html = $('<ul class="rtccint-connection-status"></ul>');
    $.each(statuses, function(k, v) {
      html.append('<li class="rtccint-' + k + '">' + v.text + '</li>')
    })
    if (settings.useBox)
      return (new RtccInt.Box(html)).html();
    else
      return html
  }


  function init() {
    /*jshint validthis: true */
    manageSettings();
    $.each(statuses, function(k, v) {
      rtcc.on(v.eventName, activateLi.bind(this, k));
    })
    rtcc.on('client.disconnect', deactivateLi.bind(this, Object.keys(statuses)));
    rtcc.on('cloud.disconnect', deactivateLi.bind(this, ['cloud', 'authenticate', 'ready', 'presence']));
    rtcc.on('cloud.sip.ko', deactivateLi.bind(this, ['ready']));
    rtcc.on('presence.ko', deactivateLi.bind(this, ['presence']));
    htmlContainer.html(buildHtml());
  }

  init.call(this);
}
;RtccInt.Utils = {
  //exists in underscore, include it if we need another function
  htmlEscape: function(str) {
    'use strict'
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};