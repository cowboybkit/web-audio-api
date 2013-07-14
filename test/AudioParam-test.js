var assert = require('assert')
  , _ = require('underscore')
  , AudioParam = require('../lib/AudioParam')
  , BLOCK_SIZE = 128
  , SAMPLE_RATE = 44100
  , Ts = 1/SAMPLE_RATE

describe('AudioParam', function() {

  var dummyContext

  var untilTime = function(audioParam, until, testFunc) {
    var block
    while(audioParam._context.currentTime < until - 3*Ts/2) {
      block = audioParam._tick()
      testFunc(block, dummyContext.currentTime)
      assert.equal(audioParam.value, block[BLOCK_SIZE - 1])
      dummyContext.currentTime += (Ts * BLOCK_SIZE)
    }
  }

  var untilVal = function(audioParam, until, testFunc) {
    var block
      , testUntil = audioParam.value < until ? function(a, b) { return a < b } : function(a, b) { return a < b }
    while(!block || testUntil(block[BLOCK_SIZE - 1], until)) {
      block = audioParam._tick()
      testFunc(block, dummyContext.currentTime)
      assert.equal(audioParam.value, block[BLOCK_SIZE - 1])
      dummyContext.currentTime += (Ts * BLOCK_SIZE)
    }
  }

  var assertBlockEqual = function(block, testVal) {
    assert.equal(block.length, BLOCK_SIZE)
    block.forEach(function(val) {assert.equal(val, testVal)})
  }

  var assertBlockAboutEqual = function(block, testVal) {
    assert.equal(block.length, BLOCK_SIZE)
    block.forEach(function(val) {assertAboutEqual(val, testVal)})
  }

  var assertBlockFunc = function(block, Tb, testFunc) {
    var t = Tb
      , testVal
    assert.equal(block.length, BLOCK_SIZE)
    block.forEach(function(val) {
      testVal = testFunc(t, Tb)
      assertAboutEqual(testVal, val)
      t += Ts
    })
  }

  var assertAboutEqual = function(val1, val2) {
    var test = Math.abs(val1 - val2) < 0.0001
    if (test) assert.ok(test)
    else assert.equal(val1, val2)
  }

  beforeEach(function() {
    dummyContext = {currentTime: 0, sampleRate: SAMPLE_RATE}
  })

  it('should set the default value an make it readonly', function() {
    var audioParam = new AudioParam(dummyContext, 98)
    assert.equal(audioParam.defaultValue, 98)
    assert.equal(audioParam.value, 98)
    audioParam.defaultValue = 77
  })

  it('should throw an error if the defaultValue is not a number', function() {
    assert.throws(function() {
      new AudioParam(dummyContext, 'u')
    })
  })

  it('should remove all events when the value is set', function() {
    var audioParam = new AudioParam(dummyContext, 98)
    audioParam._schedule('bla', 9)
    assert.equal(audioParam._scheduled.length, 1)
    audioParam.value = 99
    assert.equal(audioParam._scheduled.length, 0)   
  })

  it('should be initialized with constant dsp method', function() {
    var audioParam = new AudioParam(dummyContext, 44)
      , block = audioParam._tick()
    assert.equal(block.length, BLOCK_SIZE)
    block.forEach(function(val) { assert.equal(val, 44) })
    block = audioParam._tick()
    assert.equal(block.length, BLOCK_SIZE)
    block.forEach(function(val) { assert.equal(val, 44) })
  })

  describe('_geometricSeries', function() {

    it('should progress as expected', function() {
      var audioParam = new AudioParam(dummyContext, 6)
        , iter = audioParam._geometricSeries(1, 2)
      assert.equal(iter(), 2)
      assert.equal(iter(), 4)
      assert.equal(iter(), 8)
    })

  })

  describe('_arithmeticSeries', function() {

    it('should progress as expected', function() {
      var audioParam = new AudioParam(dummyContext, 6)
        , iter = audioParam._arithmeticSeries(1, 2)
      assert.equal(iter(), 3)
      assert.equal(iter(), 5)
      assert.equal(iter(), 7)
    })
    
  })

  describe('setValueAtTime', function() {

    it('should set the value at the time specified', function() {
      var audioParam = new AudioParam(dummyContext, 6)
      audioParam.setValueAtTime(55, 1)
      
      // t=0 -> t=~1 / 6
      assert.equal(audioParam.value, 6)
      untilTime(audioParam, 1, function(block) { assertBlockEqual(block, 6) })

      // t=1 / 55
      dummyContext.currentTime += Ts
      assertBlockEqual(audioParam._tick(), 55)
      assert.equal(audioParam.value, 55)   
    })

  })

  describe('linearRampToValueAtTime', function() {
    // v(t) = V0 + (V1 - V0) * ((t - T0) / (T1 - T0))

    it('should calculate the ramp for each sample if a-rate', function() {
      var audioParam = new AudioParam(dummyContext, 15, 'a')

      // Ramp t=0 -> t=1 // 15 -> 25
      audioParam.linearRampToValueAtTime(25, 1)
      assert.equal(audioParam.value, 15)
      untilTime(audioParam, 1, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.min(15 + 10 * t, 25) })
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 25)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 25)

      // Ramp t=1 -> t=3 // 25 -> 20
      dummyContext.currentTime = 1
      audioParam.linearRampToValueAtTime(20, 3)
      untilTime(audioParam, 3, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.max(25 + -5 * (t - 1) / 2, 20) })
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 20)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 20)
    })

    it('should calculate the ramp for whole block if k-rate', function() {
      var audioParam = new AudioParam(dummyContext, 15, 'k')

      // Ramp t=0 -> t=1 // 15 -> 25
      audioParam.linearRampToValueAtTime(25, 1)
      assert.equal(audioParam.value, 15)
      untilTime(audioParam, 1 - 3*Ts/2, function(block, Tb) {
        assertBlockAboutEqual(block, 15 + 10 * Tb)
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 25)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 25)

      // Ramp t=1 -> t=3 // 25 -> 20
      dummyContext.currentTime = 1
      audioParam.linearRampToValueAtTime(20, 3)
      untilTime(audioParam, 3 - 3*Ts/2, function(block, Tb) {
        assertBlockAboutEqual(block, 25 + -5 * (Tb - 1) / 2)
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 20)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 20)
    })

  })

  describe('exponentialRampToValueAtTime', function() {
    // v(t) = V0 * (V1 / V0) ^ ((t - T0) / (T1 - T0))


    it('should throw an error if value is <= 0', function() {
      var audioParam = new AudioParam(dummyContext, 15, 'a')
      assert.throws(function() {
        audioParam.exponentialRampToValueAtTime(-1, 9)
      })
      assert.throws(function() {
        audioParam.exponentialRampToValueAtTime(0, 1)
      })
      audioParam.value = -5
      assert.throws(function() {
        audioParam.exponentialRampToValueAtTime(10, 9)
      })
    })

    it('should calculate the ramp for each sample if a-rate', function() {
      var audioParam = new AudioParam(dummyContext, 1, 'a')

      // Ramp t=0 -> t=1 // 1 -> 2
      audioParam.exponentialRampToValueAtTime(2, 1)
      assert.equal(audioParam.value, 1)
      untilTime(audioParam, 1, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.min(Math.pow(2, t), 2) })
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 2)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 2)

      // Ramp t=1 -> t=3 // 10 -> 5
      audioParam.value = 10
      dummyContext.currentTime = 1
      audioParam.exponentialRampToValueAtTime(5, 3)
      untilTime(audioParam, 3, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.max(10 * Math.pow(0.5, (t - 1) / 2), 5) })
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 5)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 5)
    })

    it('should calculate the ramp for the whole block if k-rate', function() {
      var audioParam = new AudioParam(dummyContext, 1, 'k')

      // Ramp t=0 -> t=1 // 1 -> 2
      audioParam.exponentialRampToValueAtTime(2, 1)
      assert.equal(audioParam.value, 1)
      untilTime(audioParam, 1, function(block, Tb) {
        assertBlockAboutEqual(block, Math.pow(2, Tb))
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 2)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 2)

      // Ramp t=1 -> t=3 // 10 -> 5
      audioParam.value = 10
      dummyContext.currentTime = 1
      audioParam.exponentialRampToValueAtTime(5, 3)
      untilTime(audioParam, 3, function(block, Tb) {
        assertBlockAboutEqual(block, 10 * Math.pow(0.5, (Tb - 1) / 2))
      })

      // Ramp finished, back to constant
      assert.equal(audioParam._scheduled.length, 1)
      assertBlockEqual(audioParam._tick(), 5)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 5)
    })

  })

  describe('setTargetAtTime', function() {
    // V1 + (V0 - V1) * exp(-(t - T0) / timeConstant)

    it('should calculate the ramp for each sample if a-rate', function() {
      var audioParam = new AudioParam(dummyContext, 1, 'a')

      // t=0 -> t=1 // 1
      dummyContext.currentTime = 1

      // Ramp t=1 -> ... // 1 -> 2
      audioParam.setTargetAtTime(2, 1, 0.3)
      assert.equal(audioParam.value, 1)
      untilVal(audioParam, 2, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.min(2 + -Math.exp(-(t - 1) / 0.3), 2) })
      })

      // Ramp finished, back to constant
      assertBlockEqual(audioParam._tick(), 2)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 2)

      // Ramp t=2 -> ... // 10 -> 5
      dummyContext.currentTime = 2
      audioParam.value = 10
      audioParam.setTargetAtTime(5, 2, 0.15)
      untilVal(audioParam, 5, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.max(5 + 5 * Math.exp(-(t - 2) / 0.15), 5) })
      })
    })

    it('should calculate the ramp for the whole block if k-rate', function() {
      var audioParam = new AudioParam(dummyContext, 1, 'k')

      // t=0 -> t=1 // 1
      dummyContext.currentTime = 1

      // Ramp t=1 -> ... // 1 -> 2
      audioParam.setTargetAtTime(2, 1, 0.3)
      assert.equal(audioParam.value, 1)
      untilVal(audioParam, 2, function(block, Tb) {
        assertBlockAboutEqual(block, 2 + -Math.exp(-(Tb - 1) / 0.3))
      })

      // Ramp finished, back to constant
      assertBlockEqual(audioParam._tick(), 2)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 2)

      // Ramp t=2 -> ... // 10 -> 5
      dummyContext.currentTime = 2
      audioParam.value = 10
      audioParam.setTargetAtTime(5, 2, 0.66)
      untilVal(audioParam, 5, function(block, Tb) {
        assertBlockAboutEqual(block, 5 + 5 * Math.exp(-(Tb - 2) / 0.15))
      })
    })

  })

  describe('setValueCurveAtTime', function() {
    // V1 + (V0 - V1) * exp(-(t - T0) / timeConstant)

    it('should calculate the values for each sample if a-rate', function() {
      var audioParam = new AudioParam(dummyContext, 1, 'a')
        , t1 = 12800 / 10 * Ts
        , t2 = t1 + 12800 / 5 * Ts
        , t3 = t2 + 12800 / 5 * Ts
        , t4 = t3 + 12800 / 5 * Ts
        , t5 = t4 + (12800 / 10 + 12800 / 5) * Ts

      // Ramp t=0
      audioParam.setValueCurveAtTime([1, 2, 3, 4, 5], 0, 12800 * Ts)
      assert.equal(audioParam.value, 1)
      untilTime(audioParam, t1, function(block, Tb) {
        assertBlockEqual(block, 1)
      })
      untilTime(audioParam, t2, function(block, Tb) {
        assertBlockEqual(block, 2)
      })
      untilTime(audioParam, t3, function(block, Tb) {
        assertBlockEqual(block, 3)
      })
      untilTime(audioParam, t4, function(block, Tb) {
        assertBlockEqual(block, 4)
      })
      untilTime(audioParam, t5, function(block, Tb) {
        assertBlockEqual(block, 5)
      })

      // Ramp finished, back to constant
      assertBlockEqual(audioParam._tick(), 5)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 5)
    })

    it('should calculate the values for the whole block if k-rate', function() {
      var audioParam = new AudioParam(dummyContext, 1, 'k')

      // Ramp t=0
      audioParam.setValueCurveAtTime([1, 2, 3, 4, 5], 0, 10000 * Ts)
      assert.equal(audioParam.value, 1)
      untilTime(audioParam, 1000 * Ts, function(block, Tb) {
        assertBlockEqual(block, 1)
      })
      untilTime(audioParam, 3000 * Ts, function(block, Tb) {
        assertBlockEqual(block, 2)
      })
      untilTime(audioParam, 5000 * Ts, function(block, Tb) {
        assertBlockEqual(block, 3)
      })
      untilTime(audioParam, 7000 * Ts, function(block, Tb) {
        assertBlockEqual(block, 4)
      })
      untilTime(audioParam, 1000 * Ts, function(block, Tb) {
        assertBlockEqual(block, 5)
      })

      // Ramp finished, back to constant
      assertBlockEqual(audioParam._tick(), 5)
      assert.equal(audioParam._scheduled.length, 0)
      assert.equal(audioParam.value, 5)
    })

  })

  describe('events sequence', function() {

    it('should start a ramp only after a setValue', function() {
      var audioParam = new AudioParam(dummyContext, -1, 'a')
        , block

      audioParam.setValueAtTime(0, 2)
      audioParam.linearRampToValueAtTime(1, 3)
      // expected:
      // t=0 -> t=2 / -1
      // t=2        / 0
      // t=2 -> t=3 / 0 -> 1

      untilTime(audioParam, 2, function(block) {
        assertBlockEqual(block, -1)
      })

      var T0 = audioParam._context.currentTime
      untilTime(audioParam, 3, function(block, Tb) {
        assertBlockFunc(block, Tb, function(t) { return Math.min((t - T0) / (3 - T0), 1) })
      })
    })

  })

})