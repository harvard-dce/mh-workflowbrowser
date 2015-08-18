
'use strict';

var times, stateColors, operationConf;

var defaultStateColors = { 'FAILED': 'red','STOPPED': 'orange','PAUSED':'#e6e600',
 'RUNNING': '#756bb1', 'SUCCEEDED': 'grey', 'SKIPPED': 'grey'};

function startToAvailableColor(durationMS){
  return durationMS > times.lateTrimMs ? 'orange' : 'white';
}

function untilAvailableColor(durationMS){
  return durationMS > (24*60*60*1000) ? 'red' : 'white';
}

function untilReadyForTrimColor(durationMS){
  return durationMS > times.lateTrimMs ? 'orange' : 'white';
}

function stateColor(state,defaultColor) {
   return _.result(stateColors,state,defaultColor);
}

function operationColor(operationId){
    var opconf = operationConf[operationId] || { 'color': 'black' };
    return opconf.color;
}

function init(args){
	times = args.times;
	operationConf = args.operationConf;
	stateColors = args.confStateColors || defaultStateColors;
}

module.exports = {
	'init' : init,
	'stateColor'             : stateColor,
	'operationColor'         : operationColor,
 	'startToAvailableColor'  : startToAvailableColor,
	'untilReadyForTrimColor' : untilReadyForTrimColor,
	'untilAvailableColor'    : untilAvailableColor
};
