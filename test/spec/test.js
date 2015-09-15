/* global describe, it */

'use strict';

var assert = require('assert');
var stacker = require('../../app/scripts/stacker');

describe('Stacker', function() {
  describe('stack', function () {
    it('should stack timespans so that there are no overlaps', function () {
      var s = stacker.create();
      assert.equal(0,s.stack({'dateStarted': new Date(1995, 11, 17), 'dateCompleted': new Date(1995, 11, 21)}));
      assert.equal(1,s.stack({'dateStarted': new Date(1995, 11, 17), 'dateCompleted': new Date(1995, 11, 19)}));
      assert.equal(2,s.stack({'dateStarted': new Date(1995, 11, 17), 'dateCompleted': new Date(1995, 11, 17)}));
      assert.equal(0,s.stack({'dateStarted': new Date(1995, 11, 16), 'dateCompleted': new Date(1995, 11, 16)}));
      assert.equal(3,s.stack({'dateStarted': new Date(1995, 11, 16), 'dateCompleted': new Date(1995, 11, 17)}));
      assert.equal(4,s.stack({'dateStarted': new Date(1994, 11, 17, 3, 24, 0), 'dateCompleted': new Date(1996, 11, 17, 3, 24, 0)}));      
    });
  });
});
