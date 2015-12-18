
'use strict';


function createColorist(conf){

	var defaultStateColors = { 'FAILED': 'red','STOPPED': 'orange','PAUSED':'#e6e600',
	 'RUNNING': '#756bb1', 'SUCCEEDED': 'grey', 'SKIPPED': 'grey'};

	var timeManager, stateColors, operationConf;
	timeManager = conf.timeManager;
	operationConf = conf.operationConf;
	stateColors = conf.confStateColors || defaultStateColors;

	function startToAvailableColor(durationMS){
	  return durationMS > timeManager.lateTrimMs ? 'orange' : 'white';
	}

	function untilAvailableColor(durationMS){
	  return durationMS > timeManager.twentyFourHoursInMs ? 'red' : 'white';
	}

	function untilReadyForTrimColor(durationMS){
	  return durationMS > timeManager.lateTrimMs ? 'orange' : 'white';
	}

	function stateColor(state,defaultColor) {
	   return _.result(stateColors,state,defaultColor);
	}

	function operationColor(operationId){
	    var opconf = operationConf[operationId] || { 'color': '#afafaf' };
	    return opconf.color;
	}

	return {
		'stateColor'             : stateColor,
		'operationColor'         : operationColor,
	 	'startToAvailableColor'  : startToAvailableColor,
		'untilReadyForTrimColor' : untilReadyForTrimColor,
		'untilAvailableColor'    : untilAvailableColor
	};

}



module.exports = {
	'createColorist' : createColorist,
};
